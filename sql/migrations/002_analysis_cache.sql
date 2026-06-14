CREATE TABLE IF NOT EXISTS analysis_cache (
  cache_key TEXT PRIMARY KEY,
  resume_hash TEXT NOT NULL,
  job_profile_hash TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  analysis_json JSONB NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS analysis_cache_models_idx
  ON analysis_cache(llm_model, embedding_model);
