INSERT INTO jobs (
  user_id,
  status,
  application_date,
  job_title,
  job_description,
  resume_file_name,
  character_count,
  chunk_count,
  llm_recommendation,
  fit_score,
  fit_level,
  analysis_json,
  llm_model,
  embedding_model
) VALUES ($1, 'completed', '2026-06-14', $2, $3, $4, 2400, 1, $5, 82, 'high', $6::jsonb, 'e2e-llm', 'e2e-embedding');
