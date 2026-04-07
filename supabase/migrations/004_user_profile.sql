-- ============================================================================
-- DreamRAG: User Profiles — cached aggregated stats from user_dreams
-- Recomputed after every record_dream call
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id              TEXT PRIMARY KEY,

  -- For emotional_climate card: [{label: "anxiety", pct: 35}, ...]
  emotion_distribution JSONB DEFAULT '[]',

  -- For recurrence_card: [{label: "water", value: "12×", note: "Appeared in 40% of dreams"}, ...]
  recurrence           JSONB DEFAULT '[]',

  -- For dream_streak card
  current_streak       INT DEFAULT 0,
  last7                BOOLEAN[] DEFAULT '{f,f,f,f,f,f,f}',

  -- For heatmap_calendar card
  heatmap_data         JSONB DEFAULT '[]',
  heatmap_month        TEXT,

  -- Bookkeeping
  total_dreams         INT DEFAULT 0,
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
