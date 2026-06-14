INSERT INTO analysis_cache (
  cache_key,
  resume_hash,
  job_profile_hash,
  llm_model,
  embedding_model,
  analysis_json,
  chunk_count
) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
ON CONFLICT (cache_key) DO UPDATE SET
  analysis_json = EXCLUDED.analysis_json,
  chunk_count = EXCLUDED.chunk_count,
  updated_at = NOW();
