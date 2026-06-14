UPDATE jobs
SET
  status = 'completed',
  chunk_count = $1,
  llm_recommendation = $2,
  fit_score = $3,
  fit_level = $4,
  analysis_json = $5::jsonb,
  error_message = NULL,
  llm_model = $6,
  embedding_model = $7,
  updated_at = NOW()
WHERE id = $8;
