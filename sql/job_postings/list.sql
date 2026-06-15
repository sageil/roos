WITH filtered_postings AS (
  SELECT
    jp.*,
    array_position($3::bigint[], jp.id) AS semantic_rank
  FROM job_postings jp
  WHERE
    ($1::boolean OR jp.status = 'active')
    AND (
      COALESCE($2::text, '') = ''
      OR jp.id = ANY($3::bigint[])
      OR jp.title ILIKE '%' || $2 || '%'
      OR jp.description ILIKE '%' || $2 || '%'
      OR immutable_text_array_to_string(jp.skills, ' ') ILIKE '%' || $2 || '%'
    )
),
paged_postings AS (
  SELECT *
  FROM filtered_postings
  ORDER BY
    CASE WHEN semantic_rank IS NULL THEN 1 ELSE 0 END,
    semantic_rank NULLS LAST,
    created_at DESC,
    id DESC
  LIMIT $4
  OFFSET $5
)
SELECT
  paged.id::int,
  paged.created_by_user_id::int,
  paged.title,
  paged.description,
  paged.skills,
  paged.status,
  paged.created_at::text,
  paged.updated_at::text,
  COALESCE(application_stats.match_count, 0)::int AS match_count,
  COALESCE(application_stats.average_fit_score, 0)::int AS average_fit_score,
  COALESCE(application_stats.top_fit_score, 0)::int AS top_fit_score
FROM paged_postings paged
LEFT JOIN LATERAL (
  SELECT
    COUNT(j.id)::int AS match_count,
    COALESCE(ROUND(AVG(j.fit_score) FILTER (WHERE j.status = 'completed'))::int, 0) AS average_fit_score,
    COALESCE(MAX(j.fit_score) FILTER (WHERE j.status = 'completed'), 0)::int AS top_fit_score
  FROM jobs j
  WHERE j.job_posting_id = paged.id
) application_stats ON true
ORDER BY
  CASE WHEN paged.semantic_rank IS NULL THEN 1 ELSE 0 END,
  paged.semantic_rank NULLS LAST,
  paged.created_at DESC,
  paged.id DESC;
