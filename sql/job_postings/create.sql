INSERT INTO job_postings (
  created_by_user_id,
  title,
  description,
  skills
)
VALUES ($1, $2, $3, $4)
RETURNING
  id::int,
  created_by_user_id::int,
  title,
  description,
  skills,
  status,
  created_at::text,
  updated_at::text;
