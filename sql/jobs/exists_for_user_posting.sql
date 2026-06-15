SELECT EXISTS (
  SELECT 1
  FROM jobs
  WHERE user_id = $1
    AND job_posting_id = $2
    AND status <> 'failed'
) AS exists;
