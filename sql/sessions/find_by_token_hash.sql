SELECT
  u.id::int,
  u.name,
  u.email,
  u.role,
  u.created_at::text
FROM sessions s
JOIN users u ON u.id = s.user_id
WHERE s.token_hash = $1
  AND s.expires_at > NOW();
