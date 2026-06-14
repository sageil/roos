INSERT INTO jobs (
  user_id,
  status,
  application_date,
  job_title,
  job_description,
  resume_file_name,
  character_count
)
VALUES ($1, 'running', $2, $3, $4, $5, $6)
RETURNING id;
