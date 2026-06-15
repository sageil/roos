SELECT
  id::int,
  user_id::int,
  version_number,
  file_name,
  content_type,
  file_size,
  file_bytes
FROM resume_versions
WHERE id = $1
  AND ($2 = 'admin' OR user_id = $3)
LIMIT 1;
