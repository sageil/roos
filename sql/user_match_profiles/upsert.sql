INSERT INTO user_match_profiles (
  user_id,
  profile_text,
  embedding,
  embedding_model,
  updated_at
) VALUES (
  $1,
  $2,
  $3::vector,
  $4,
  NOW()
)
ON CONFLICT (user_id) DO UPDATE SET
  profile_text = EXCLUDED.profile_text,
  embedding = EXCLUDED.embedding,
  embedding_model = EXCLUDED.embedding_model,
  updated_at = NOW();
