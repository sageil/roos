SELECT
  trim(concat_ws(
    E'\n\n',
    concat_ws(E'\n', 'Role:', jp.title),
    concat_ws(E'\n', 'Skills:', array_to_string(COALESCE(jp.skills, ARRAY[]::text[]), ', ')),
    concat_ws(E'\n', 'Description:', jp.description)
  )) AS profile_text
FROM job_postings jp
WHERE jp.id = $1;
