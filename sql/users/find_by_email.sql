SELECT
  id::int,
  name,
  email,
  role,
  password_hash,
  created_at::text
FROM users
WHERE email = lower($1);
