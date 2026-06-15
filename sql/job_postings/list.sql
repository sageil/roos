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
LEFT JOIN LATERAL (
  SELECT array_position($3::bigint[], jp.id) AS rank
) semantic_match ON true
WHERE
  ($1::boolean OR jp.status = 'active')
  AND (
    COALESCE($2::text, '') = ''
    OR jp.id = ANY($3::bigint[])
    OR jp.title ILIKE '%' || $2 || '%'
    OR jp.description ILIKE '%' || $2 || '%'
    OR EXISTS (
      SELECT 1
      FROM unnest(COALESCE(jp.skills, ARRAY[]::text[])) skill
      WHERE skill ILIKE '%' || $2 || '%'
    )
  )
GROUP BY jp.id, semantic_match.rank
ORDER BY
  CASE WHEN semantic_match.rank IS NULL THEN 1 ELSE 0 END,
  semantic_match.rank NULLS LAST,
  jp.created_at DESC,
  jp.id DESC
LIMIT $4;
