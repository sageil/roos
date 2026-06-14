INSERT INTO resume_chunks (
  job_id,
  chunk_id,
  document,
  embedding,
  application_date,
  job_title,
  embedding_model
)
VALUES ($1, $2, $3, $4::vector, $5, $6, $7)
ON CONFLICT (job_id, chunk_id)
DO UPDATE SET
  document = EXCLUDED.document,
  embedding = EXCLUDED.embedding,
  application_date = EXCLUDED.application_date,
  job_title = EXCLUDED.job_title,
  embedding_model = EXCLUDED.embedding_model;
