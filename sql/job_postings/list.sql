WITH search_input AS (
  SELECT
    query.raw_query,
    GREATEST(($4::int + $5::int) * 5, 100) AS candidate_limit,
    CASE
      WHEN query.raw_query IS NULL THEN NULL
      ELSE websearch_to_tsquery('simple', query.raw_query)
    END AS text_query,
    (
      SELECT to_tsquery('simple', string_agg(token || ':*', ' & '))
      FROM (
        SELECT regexp_replace(value, '[^[:alnum:]_]+', '', 'g') AS token
        FROM regexp_split_to_table(COALESCE(query.raw_query, ''), '\s+') AS split(value)
      ) tokens
      WHERE token <> ''
    ) AS prefix_query
  FROM (
    SELECT NULLIF(trim($2::text), '') AS raw_query
  ) query
),
bm25_candidates AS (
  SELECT
    jp.id,
    -(
      (
        repeat(COALESCE(jp.title, '') || ' ', 8) ||
        repeat(immutable_text_array_to_string(COALESCE(jp.skills, ARRAY[]::text[]), ' ') || ' ', 4) ||
        COALESCE(jp.description, '')
      ) <@> to_bm25query(search_input.raw_query, 'job_postings_bm25_search_idx')
    ) AS bm25_rank
  FROM job_postings jp
  CROSS JOIN search_input
  WHERE
    search_input.raw_query IS NOT NULL
    AND ($1::boolean OR jp.status = 'active')
  ORDER BY
    (
      repeat(COALESCE(jp.title, '') || ' ', 8) ||
      repeat(immutable_text_array_to_string(COALESCE(jp.skills, ARRAY[]::text[]), ' ') || ' ', 4) ||
      COALESCE(jp.description, '')
    ) <@> to_bm25query(search_input.raw_query, 'job_postings_bm25_search_idx')
  LIMIT (SELECT candidate_limit FROM search_input)
),
semantic_candidates AS (
  SELECT
    semantic.job_posting_id AS id,
    semantic.rank::int AS semantic_rank
  FROM unnest($3::bigint[]) WITH ORDINALITY AS semantic(job_posting_id, rank)
),
candidate_postings AS (
  SELECT id FROM bm25_candidates
  UNION
  SELECT id FROM semantic_candidates
  UNION
  SELECT jp.id
  FROM job_postings jp
  CROSS JOIN search_input
  WHERE
    search_input.raw_query IS NULL
    AND ($1::boolean OR jp.status = 'active')
),
scored_postings AS (
  SELECT
    jp.*,
    search_input.raw_query,
    semantic_candidates.semantic_rank,
    COALESCE(bm25_candidates.bm25_rank, 0) AS text_rank,
    CASE
      WHEN search_input.raw_query IS NULL THEN false
      ELSE (
        COALESCE(bm25_candidates.bm25_rank, 0) > 0
        OR COALESCE(search_document.document @@ search_input.text_query, false)
        OR COALESCE(search_document.document @@ search_input.prefix_query, false)
        OR jp.title ILIKE '%' || search_input.raw_query || '%'
        OR jp.description ILIKE '%' || search_input.raw_query || '%'
        OR immutable_text_array_to_string(jp.skills, ' ') ILIKE '%' || search_input.raw_query || '%'
      )
    END AS text_match
  FROM candidate_postings
  JOIN job_postings jp ON jp.id = candidate_postings.id
  LEFT JOIN bm25_candidates ON bm25_candidates.id = jp.id
  LEFT JOIN semantic_candidates ON semantic_candidates.id = jp.id
  CROSS JOIN search_input
  CROSS JOIN LATERAL (
    SELECT
      setweight(to_tsvector('simple', COALESCE(jp.title, '')), 'A') ||
      setweight(to_tsvector('simple', immutable_text_array_to_string(COALESCE(jp.skills, ARRAY[]::text[]), ' ')), 'B') ||
      setweight(to_tsvector('simple', COALESCE(jp.description, '')), 'C') AS document
  ) search_document
  WHERE $1::boolean OR jp.status = 'active'
),
filtered_postings AS (
  SELECT *
  FROM scored_postings
  WHERE
    raw_query IS NULL
    OR semantic_rank IS NOT NULL
    OR text_match
),
ranked_postings AS (
  SELECT
    filtered_postings.*,
    CASE
      WHEN raw_query IS NULL OR NOT text_match THEN NULL
      ELSE row_number() OVER (
        PARTITION BY raw_query IS NOT NULL AND text_match
        ORDER BY text_rank DESC, created_at DESC, id DESC
      )
    END AS text_rank_position,
    MAX(text_rank) FILTER (WHERE text_match) OVER () AS max_text_rank
  FROM filtered_postings
),
fused_postings AS (
  SELECT
    ranked_postings.*,
    CASE
      WHEN raw_query IS NULL THEN 0::double precision
      ELSE
        (
          0.75 * COALESCE(
            text_rank / NULLIF(max_text_rank, 0),
            (1.0 / (60 + text_rank_position)) / (1.0 / 61),
            0
          )
        ) +
        (
          0.25 * COALESCE((1.0 / (60 + semantic_rank)) / (1.0 / 61), 0)
        )
    END AS hybrid_rank
  FROM ranked_postings
),
paged_postings AS (
  SELECT *
  FROM fused_postings
  ORDER BY
    hybrid_rank DESC,
    text_rank DESC,
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
  paged.hybrid_rank DESC,
  paged.text_rank DESC,
  CASE WHEN paged.semantic_rank IS NULL THEN 1 ELSE 0 END,
  paged.semantic_rank NULLS LAST,
  paged.created_at DESC,
  paged.id DESC;
