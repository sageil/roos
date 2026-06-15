SELECT
  j.id::int,
  j.user_id::int,
  j.job_posting_id::int,
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
  j.llm_model,
  j.embedding_model,
  j.created_at::text,
  j.updated_at::text
FROM jobs j
LEFT JOIN users u ON u.id = j.user_id
LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
LEFT JOIN LATERAL (
  SELECT array_position($4::bigint[], j.id) AS rank
) semantic_match ON true
WHERE
  ($1::text = 'admin' OR j.user_id = $2)
  AND (
    COALESCE($3::text, '') = ''
    OR j.id = ANY($4::bigint[])
    OR j.job_title ILIKE '%' || $3 || '%'
    OR COALESCE(j.job_description, '') ILIKE '%' || $3 || '%'
    OR COALESCE(j.llm_recommendation, '') ILIKE '%' || $3 || '%'
    OR COALESCE(j.analysis_json::text, '') ILIKE '%' || $3 || '%'
    OR COALESCE(j.resume_file_name, '') ILIKE '%' || $3 || '%'
    OR COALESCE(jp.title, '') ILIKE '%' || $3 || '%'
    OR COALESCE(u.name, '') ILIKE '%' || $3 || '%'
    OR COALESCE(u.email, '') ILIKE '%' || $3 || '%'
  )
ORDER BY
  CASE WHEN semantic_match.rank IS NULL THEN 1 ELSE 0 END,
  semantic_match.rank NULLS LAST,
  j.created_at DESC,
  j.id DESC
LIMIT $5;
