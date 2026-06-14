INSERT INTO sessions (
  user_id,
  token_hash,
  expires_at
)
VALUES ($1, $2, NOW() + ($3::text || ' seconds')::interval)
RETURNING expires_at::text;
