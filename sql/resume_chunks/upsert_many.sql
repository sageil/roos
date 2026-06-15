INSERT INTO resume_chunks (
  job_id,
  chunk_id,
  document,
  embedding,
  application_date,
  job_title,
  embedding_model
)
SELECT
  $1,
  input.chunk_id,
  input.document,
  input.embedding::vector,
  $5,
  $6,
  $7
FROM unnest($2::integer[], $3::text[], $4::text[]) AS input(chunk_id, document, embedding)
ON CONFLICT (job_id, chunk_id)
DO UPDATE SET
  document = EXCLUDED.document,
  embedding = EXCLUDED.embedding,
  application_date = EXCLUDED.application_date,
  job_title = EXCLUDED.job_title,
  embedding_model = EXCLUDED.embedding_model;
