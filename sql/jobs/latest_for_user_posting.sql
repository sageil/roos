SELECT
  id::int,
  created_at::text
FROM jobs
WHERE user_id = $1
  AND job_posting_id = $2
  AND COALESCE(analysis_kind, 'application') = 'application'
  AND status <> 'failed'
ORDER BY created_at DESC, id DESC
LIMIT 1;
