-- ============================================================================
-- Migration 005: Fix search_context_mesh (42702 ambiguous "id") and
-- search_vector (HNSW post-filter starves sparse namespaces, e.g.
-- dream_knowledge with ~2k of ~32k rows returned 0 results).
--
-- Root causes:
--   1. search_context_mesh is plpgsql and has `RETURNS TABLE (id BIGINT, ...,
--      depth INT)`. Inside the function body, bare `id` / `depth` in CTEs
--      collide with these OUT parameters, producing 42702 "ambiguous column
--      reference". Fix: declare `#variable_conflict use_column` and alias
--      CTE columns (doc_id etc.) so the planner has no ambiguity.
--   2. search_vector uses `ORDER BY embedding <=> q LIMIT k` with HNSW +
--      `WHERE filter_namespace = ...`. pgvector HNSW does index scan with
--      ef_search=40 (default), then post-filters. Sparse namespaces lose all
--      candidates after filtering. Fix: bump ef_search to 200 inside the
--      function, and oversample candidates in an inner subquery before
--      applying the namespace filter.
--
-- Apply via Supabase SQL editor (paste this whole file and RUN).
-- Safe to re-run (CREATE OR REPLACE).
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
  source_type TEXT,
  score       FLOAT,
  depth       INT
)
LANGUAGE plpgsql STABLE
AS $$
#variable_conflict use_column
BEGIN
  PERFORM set_config('hnsw.ef_search', '200', true);

  RETURN QUERY
  WITH RECURSIVE
  fts AS (
    SELECT
      d.id AS doc_id,
      ts_rank_cd(to_tsvector('english', d.content), plainto_tsquery('english', query_text)) AS rank
    FROM documents d
    WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', query_text)
      AND (filter_namespace IS NULL OR d.namespace = filter_namespace)
    ORDER BY rank DESC
    LIMIT match_count * 3
  ),
  fts_ranked AS (
    SELECT doc_id, ROW_NUMBER() OVER (ORDER BY rank DESC) AS rank_pos FROM fts
  ),
  vec_raw AS (
    SELECT
      d.id AS doc_id,
      d.namespace AS ns,
      d.embedding <=> query_embedding AS dist
    FROM documents d
    ORDER BY d.embedding <=> query_embedding
    LIMIT GREATEST(match_count * 50, 200)
  ),
  vec AS (
    SELECT doc_id, dist
    FROM vec_raw
    WHERE filter_namespace IS NULL OR ns = filter_namespace
    ORDER BY dist
    LIMIT match_count * 3
  ),
  vec_ranked AS (
    SELECT doc_id, ROW_NUMBER() OVER (ORDER BY dist) AS rank_pos FROM vec
  ),
  rrf AS (
    SELECT
      COALESCE(f.doc_id, v.doc_id) AS doc_id,
      COALESCE(1.0 / (rrf_k + f.rank_pos), 0.0) +
      COALESCE(1.0 / (rrf_k + v.rank_pos), 0.0) AS rrf_score
    FROM fts_ranked f
    FULL OUTER JOIN vec_ranked v ON f.doc_id = v.doc_id
  ),
  seeds AS (
    SELECT doc_id, rrf_score FROM rrf ORDER BY rrf_score DESC LIMIT match_count
  ),
  graph AS (
    SELECT
      d.id AS doc_id, d.content AS content, d.metadata AS metadata,
      'seed'::TEXT AS source_type,
      s.rrf_score   AS score,
      0             AS depth,
      ARRAY[d.id]   AS path
    FROM seeds s
    JOIN documents d ON s.doc_id = d.id

    UNION ALL

    SELECT
      d.id AS doc_id, d.content AS content, d.metadata AS metadata,
      r.type          AS source_type,
      g.score * 0.8   AS score,
      g.depth + 1,
      g.path || d.id
    FROM graph g
    JOIN doc_relations r ON r.source_id = g.doc_id
    JOIN documents d     ON d.id = r.target_id
    WHERE g.depth < graph_depth
      AND NOT d.id = ANY(g.path)
      AND (filter_namespace IS NULL OR d.namespace = filter_namespace)
  )
  SELECT DISTINCT ON (graph.doc_id)
    graph.doc_id AS id,
    graph.content,
    graph.metadata,
    graph.source_type,
    graph.score::FLOAT,
    graph.depth
  FROM graph
  ORDER BY graph.doc_id, graph.score DESC;
END;
$$;


CREATE OR REPLACE FUNCTION search_vector(
  query_embedding  vector(1024),
  match_count      INT  DEFAULT 5,
  filter_namespace TEXT DEFAULT NULL
)
RETURNS TABLE (id BIGINT, content TEXT, metadata JSONB, similarity FLOAT)
LANGUAGE plpgsql STABLE
AS $$
#variable_conflict use_column
BEGIN
  PERFORM set_config('hnsw.ef_search', '200', true);

  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    (1 - (d.embedding <=> query_embedding))::FLOAT AS similarity
  FROM (
    SELECT id, content, metadata, embedding, namespace
    FROM documents
    ORDER BY embedding <=> query_embedding
    LIMIT GREATEST(match_count * 50, 200)
  ) d
  WHERE filter_namespace IS NULL OR d.namespace = filter_namespace
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
