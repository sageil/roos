SELECT
  j.id::int,
  j.user_id::int,
  j.job_posting_id::int,
  COALESCE(j.analysis_kind, 'application') AS analysis_kind,
  jp.title AS job_posting_title,
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
  j.created_at::text,
  j.updated_at::text
FROM jobs j
LEFT JOIN users u ON u.id = j.user_id
LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
ORDER BY j.created_at DESC, j.id DESC
LIMIT $1;
