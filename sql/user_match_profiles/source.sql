SELECT
  trim(concat_ws(
    E'\n\n',
    concat_ws(' ', 'User:', u.name, u.email),
    concat_ws(
      E'\n',
      'Latest resume:',
      latest_resume.file_name,
      left(COALESCE(latest_resume.resume_text, ''), 12000)
    ),
    concat_ws(
      E'\n',
      'Applications and matches:',
      COALESCE(application_text.profile_text, '')
    )
  )) AS profile_text
FROM users u
LEFT JOIN LATERAL (
  SELECT
    rv.file_name,
    rv.resume_text
  FROM resume_versions rv
  WHERE rv.user_id = u.id
  ORDER BY rv.version_number DESC
  LIMIT 1
) latest_resume ON true
LEFT JOIN LATERAL (
  SELECT string_agg(
    concat_ws(
      E'\n',
      j.job_title,
      j.job_description,
      jp.title,
      array_to_string(COALESCE(jp.skills, ARRAY[]::text[]), ', '),
      j.llm_recommendation,
      j.analysis_json::text
    ),
    E'\n\n'
    ORDER BY j.created_at DESC, j.id DESC
  ) AS profile_text
  FROM jobs j
  LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
  WHERE j.user_id = u.id
) application_text ON true
WHERE u.id = $1;
