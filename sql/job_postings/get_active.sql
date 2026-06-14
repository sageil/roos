SELECT
  id::int,
  created_by_user_id::int,
  title,
  description,
  skills,
  status,
  created_at::text,
  updated_at::text
FROM job_postings
WHERE id = $1
  AND status = 'active';
