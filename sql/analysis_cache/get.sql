SELECT
  cache_key,
  resume_hash,
  job_profile_hash,
  llm_model,
  embedding_model,
  analysis_json::text,
  chunk_count,
  created_at::text,
  updated_at::text
FROM analysis_cache
WHERE cache_key = $1;
