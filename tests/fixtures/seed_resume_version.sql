INSERT INTO resume_versions (
  user_id,
  version_number,
  file_name,
  content_type,
  character_count,
  resume_text
) VALUES (
  $1,
  COALESCE((SELECT MAX(version_number) + 1 FROM resume_versions WHERE user_id = $1), 1),
  $2,
  'text/markdown',
  2400,
  'Seeded resume text with TypeScript and PostgreSQL experience.'
);
