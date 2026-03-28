-- ============================================================================
-- DreamRAG: Supabase GraphRAG Schema
-- Qwen3-Embedding-0.6b: 1024 dimensions (MRL, native max)
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Documents table (community_dreams + dream_knowledge namespaces)
CREATE TABLE IF NOT EXISTS documents (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  content    TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',       -- {"source": "dreambank", "type": "dream_narrative"}
  namespace  TEXT DEFAULT 'default',
  content_hash TEXT,                   -- deduplication
  embedding  vector(1024),             -- qwen3-embedding-0.6b @ 1024 dims

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT documents_content_check CHECK (content IS NOT NULL)
);

-- 3. Graph edges
CREATE TABLE IF NOT EXISTS doc_relations (
  id        BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  source_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
  target_id BIGINT REFERENCES documents(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,   -- symbolizes | similar_to | co_occurs | follows | interprets | contradicts | coded_as
  properties JSONB DEFAULT '{}',   -- {"weight": 0.9, "theory": "jungian"}
  namespace TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_id, target_id, type, namespace)
);

-- 4. Indexes

-- Vector similarity (HNSW for fast ANN search)
CREATE INDEX IF NOT EXISTS idx_docs_embedding
  ON documents USING hnsw (embedding vector_cosine_ops);

-- Full-text search (BM25-style keyword matching)
CREATE INDEX IF NOT EXISTS idx_docs_fts
  ON documents USING GIN (to_tsvector('english', content));

-- Namespace isolation
CREATE INDEX IF NOT EXISTS idx_docs_namespace ON documents(namespace);
CREATE INDEX IF NOT EXISTS idx_docs_hash ON documents(content_hash);

-- Graph traversal
CREATE INDEX IF NOT EXISTS idx_rels_source ON doc_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_rels_target ON doc_relations(target_id);
CREATE INDEX IF NOT EXISTS idx_rels_namespace ON doc_relations(namespace);

-- ============================================================================
-- 5. SOTA Search: Hybrid RRF (BM25 + Vector) + Recursive Graph Traversal
-- ============================================================================

CREATE OR REPLACE FUNCTION search_context_mesh(
  query_text       TEXT,
  query_embedding  vector(1024),
  match_count      INT     DEFAULT 5,
  rrf_k            INT     DEFAULT 60,
  graph_depth      INT     DEFAULT 2,
  filter_namespace TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id          BIGINT,
  content     TEXT,
  metadata    JSONB,
  source_type TEXT,   -- 'seed' | relation type (symbolizes, co_occurs, …)
  score       FLOAT,
  depth       INT
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE

  -- A. Full-text search (keyword / BM25-style)
  fts AS (
    SELECT
      d.id,
      ts_rank_cd(to_tsvector('english', d.content), plainto_tsquery('english', query_text)) AS rank
    FROM documents d
    WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', query_text)
      AND (filter_namespace IS NULL OR d.namespace = filter_namespace)
    ORDER BY rank DESC
    LIMIT match_count * 3
  ),
  fts_ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY rank DESC) AS rank_pos FROM fts
  ),

  -- B. Vector search (cosine similarity)
  vec AS (
    SELECT
      d.id,
      d.embedding <=> query_embedding AS dist
    FROM documents d
    WHERE filter_namespace IS NULL OR d.namespace = filter_namespace
    ORDER BY dist
    LIMIT match_count * 3
  ),
  vec_ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY dist) AS rank_pos FROM vec
  ),

  -- C. Reciprocal Rank Fusion
  rrf AS (
    SELECT
      COALESCE(f.id, v.id) AS id,
      COALESCE(1.0 / (rrf_k + f.rank_pos), 0.0) +
      COALESCE(1.0 / (rrf_k + v.rank_pos), 0.0) AS rrf_score
    FROM fts_ranked f
    FULL OUTER JOIN vec_ranked v ON f.id = v.id
  ),
  seeds AS (
    SELECT id, rrf_score FROM rrf ORDER BY rrf_score DESC LIMIT match_count
  ),

  -- D. Graph expansion (recursive CTE, depth-limited, cycle-safe)
  graph AS (
    -- Seed documents
    SELECT
      d.id, d.content, d.metadata,
      'seed'::TEXT AS source_type,
      s.rrf_score   AS score,
      0             AS depth,
      ARRAY[d.id]   AS path
    FROM seeds s
    JOIN documents d ON s.id = d.id

    UNION ALL

    -- Traverse outgoing edges
    SELECT
      d.id, d.content, d.metadata,
      r.type          AS source_type,
      g.score * 0.8   AS score,   -- 20% score decay per hop
      g.depth + 1,
      g.path || d.id
    FROM graph g
    JOIN doc_relations r ON r.source_id = g.id
    JOIN documents d     ON d.id = r.target_id
    WHERE g.depth < graph_depth
      AND NOT d.id = ANY(g.path)
      AND (filter_namespace IS NULL OR d.namespace = filter_namespace)
  )

  -- Return best score per unique document
  SELECT DISTINCT ON (graph.id)
    graph.id,
    graph.content,
    graph.metadata,
    graph.source_type,
    graph.score::FLOAT,
    graph.depth
  FROM graph
  ORDER BY graph.id, graph.score DESC;
END;
$$;

-- ============================================================================
-- 6. Fast vector-only search (skip graph, for low-latency cases)
-- ============================================================================

CREATE OR REPLACE FUNCTION search_vector(
  query_embedding  vector(1024),
  match_count      INT  DEFAULT 5,
  filter_namespace TEXT DEFAULT NULL
)
RETURNS TABLE (id BIGINT, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE sql STABLE
AS $$
  SELECT
    id, content, metadata,
    (1 - (embedding <=> query_embedding))::FLOAT AS similarity
  FROM documents
  WHERE filter_namespace IS NULL OR namespace = filter_namespace
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
