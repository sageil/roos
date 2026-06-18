SELECT
  j.id::int,
  j.created_at::text
FROM jobs j
WHERE j.user_id = $1
  AND j.job_posting_id = $2
  AND j.analysis_kind = 'application'
  AND j.status <> 'failed'
ORDER BY j.created_at DESC, j.id DESC
LIMIT 1;
