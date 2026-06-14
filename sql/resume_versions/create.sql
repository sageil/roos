WITH next_version AS (
  SELECT COALESCE(MAX(version_number), 0) + 1 AS version_number
  FROM resume_versions
  WHERE user_id = $1
)
INSERT INTO resume_versions (
  user_id,
  version_number,
  file_name,
  content_type,
  character_count,
  resume_text
)
SELECT
  $1,
  next_version.version_number,
  $2,
  $3,
  $4,
  $5
FROM next_version
RETURNING
  id::int,
  user_id::int,
  version_number,
  file_name,
  content_type,
  character_count,
  created_at::text;
