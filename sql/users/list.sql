SELECT
  u.id::int,
  u.name,
  u.email,
  u.role,
  u.created_at::text,
  COUNT(j.id)::int AS application_count
FROM users u
LEFT JOIN jobs j ON j.user_id = u.id
GROUP BY u.id
ORDER BY u.created_at DESC, u.id DESC
LIMIT $1;
