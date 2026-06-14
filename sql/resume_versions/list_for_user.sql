SELECT
  id::int,
  user_id::int,
  version_number,
  file_name,
  content_type,
  character_count,
  created_at::text
FROM resume_versions
WHERE user_id = $1
ORDER BY version_number DESC;
