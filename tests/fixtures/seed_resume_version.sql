INSERT INTO resume_versions (
  user_id,
  version_number,
  file_name,
  content_type,
  file_size,
  file_bytes,
  character_count,
  resume_text
) VALUES (
  $1,
  COALESCE((SELECT MAX(version_number) + 1 FROM resume_versions WHERE user_id = $1), 1),
  $2,
  'text/markdown',
  octet_length(convert_to('Seeded resume text with client intake, appointment scheduling, and EFTPOS experience.', 'UTF8')),
  convert_to('Seeded resume text with client intake, appointment scheduling, and EFTPOS experience.', 'UTF8'),
  2400,
  'Seeded resume text with client intake, appointment scheduling, and EFTPOS experience.'
);
