UPDATE users
SET
  name = $2,
  email = lower($3)
WHERE id = $1
RETURNING
  id::int,
  name,
  email,
  role,
  created_at::text;
