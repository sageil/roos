INSERT INTO job_postings (
  created_by_user_id,
  title,
  description
)
VALUES ($1, $2, $3)
RETURNING
  id::int,
  created_by_user_id::int,
  title,
  description,
  status,
  created_at::text,
  updated_at::text;
