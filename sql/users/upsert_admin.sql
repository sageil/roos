INSERT INTO users (
  name,
  email,
  role,
  password_hash
)
VALUES ($1, lower($2), 'admin', $3)
ON CONFLICT (email)
DO UPDATE SET
  name = EXCLUDED.name,
  role = 'admin',
  password_hash = EXCLUDED.password_hash
RETURNING
  id::int,
  name,
  email,
  role,
  created_at::text;
