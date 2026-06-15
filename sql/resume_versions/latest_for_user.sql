SELECT
  id::int,
  user_id::int,
  version_number,
  file_name,
  content_type,
  file_size,
  character_count,
  resume_text,
  created_at::text
FROM resume_versions
WHERE user_id = $1
ORDER BY version_number DESC
LIMIT 1;
