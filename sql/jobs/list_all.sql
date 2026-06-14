SELECT
  j.id::int,
  j.user_id::int,
  u.name AS user_name,
  u.email AS user_email,
  j.status,
  j.application_date::text,
  j.job_title,
  j.job_description,
  j.resume_file_name,
  j.character_count,
  j.chunk_count,
  j.llm_recommendation,
  j.fit_score,
  j.fit_level,
  j.analysis_json::text,
  j.error_message,
  j.llm_model,
  j.embedding_model,
  j.created_at::text,
  j.updated_at::text
FROM jobs j
LEFT JOIN users u ON u.id = j.user_id
ORDER BY j.created_at DESC, j.id DESC
LIMIT $1;
