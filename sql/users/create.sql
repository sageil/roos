INSERT INTO users (
  name,
  email,
  role,
  password_hash
)
VALUES ($1, lower($2), 'user', $3)
RETURNING
  id::int,
  name,
  email,
  role,
  created_at::text;
