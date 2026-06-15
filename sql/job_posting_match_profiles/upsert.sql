INSERT INTO job_posting_match_profiles (
  job_posting_id,
  profile_text,
  embedding,
  embedding_model,
  updated_at
) VALUES (
  $1,
  $2,
  $3::vector(768),
  $4,
  NOW()
)
ON CONFLICT (job_posting_id) DO UPDATE SET
  profile_text = EXCLUDED.profile_text,
  embedding = EXCLUDED.embedding,
  embedding_model = EXCLUDED.embedding_model,
  updated_at = NOW();
