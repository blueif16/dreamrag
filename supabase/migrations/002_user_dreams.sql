-- ============================================================================
-- DreamRAG: User Dreams Table
-- Personal dream journal with pgvector + tag indexes
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_dreams (
  id               BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id          TEXT,                        -- session/user identifier
  raw_text         TEXT NOT NULL,
  recorded_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Auto-tags (populated by qwen3.5-4b tagger via :8083)
  emotion_tags     TEXT[]  DEFAULT '{}',
  symbol_tags      TEXT[]  DEFAULT '{}',
  character_tags   TEXT[]  DEFAULT '{}',
  interaction_type TEXT,

  -- Scores
  lucidity_score   FLOAT,
  vividness_score  FLOAT,

  -- HVdC annotation codes (JSON from auto-tagger)
  hvdc_codes       JSONB DEFAULT '{}',

  -- Embedding (qwen3-embedding-0.6b @ 1024 dims)
  embedding        vector(1024),

  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_dreams_embedding
  ON user_dreams USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_user_dreams_symbol_tags
  ON user_dreams USING GIN (symbol_tags);

CREATE INDEX IF NOT EXISTS idx_user_dreams_emotion_tags
  ON user_dreams USING GIN (emotion_tags);

CREATE INDEX IF NOT EXISTS idx_user_dreams_user_id
  ON user_dreams (user_id);

CREATE INDEX IF NOT EXISTS idx_user_dreams_recorded_at
  ON user_dreams (recorded_at DESC);
