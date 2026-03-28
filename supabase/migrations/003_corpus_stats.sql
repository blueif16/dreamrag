-- ============================================================================
-- DreamRAG: Corpus Statistics Table
-- Pre-computed aggregates from annotated dream datasets (Dryad HVdC, DreamBank)
-- Used by StatCard widget for population baseline comparisons.
-- ============================================================================

CREATE TABLE IF NOT EXISTS corpus_stats (
  id         BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  stat_key   TEXT NOT NULL,    -- e.g. "emotion:anxiety", "symbol:water", "hvdc:aggression_mean"
  stat_value FLOAT NOT NULL,   -- the computed value (pct, mean, count)
  count      INT   DEFAULT 0,  -- raw count if applicable
  source     TEXT,             -- "dreambank_annotated" | "dryad_annotated" | "all"
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(stat_key, source)
);

CREATE INDEX IF NOT EXISTS idx_corpus_stats_key ON corpus_stats(stat_key);
CREATE INDEX IF NOT EXISTS idx_corpus_stats_source ON corpus_stats(source);

-- Helper: lookup a stat with fallback
CREATE OR REPLACE FUNCTION get_corpus_stat(
  p_key    TEXT,
  p_source TEXT DEFAULT 'all'
)
RETURNS FLOAT
LANGUAGE sql STABLE
AS $$
  SELECT stat_value
  FROM corpus_stats
  WHERE stat_key = p_key AND source = p_source
  LIMIT 1;
$$;
