SELECT
  jp.id::int,
  jp.created_by_user_id::int,
  jp.title,
  jp.description,
  jp.skills,
  jp.status,
  jp.created_at::text,
  jp.updated_at::text,
  COUNT(j.id)::int AS match_count,
  COALESCE(ROUND(AVG(j.fit_score) FILTER (WHERE j.status = 'completed'))::int, 0) AS average_fit_score,
  COALESCE(MAX(j.fit_score) FILTER (WHERE j.status = 'completed'), 0)::int AS top_fit_score
FROM job_postings jp
LEFT JOIN jobs j ON j.job_posting_id = jp.id
WHERE ($1::boolean OR jp.status = 'active')
GROUP BY jp.id
ORDER BY jp.created_at DESC, jp.id DESC;
