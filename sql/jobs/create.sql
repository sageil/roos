INSERT INTO jobs (
  user_id,
  job_posting_id,
  analysis_kind,
  status,
  application_date,
  job_title,
  job_description,
  resume_file_name,
  character_count
)
VALUES ($1, $2, $3, 'running', $4, $5, $6, $7, $8)
RETURNING id;
