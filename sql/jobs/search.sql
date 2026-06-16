WITH search_input AS (
  SELECT
    query.raw_query,
    GREATEST(($5::int + $6::int) * 5, 100) AS candidate_limit,
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
    SELECT NULLIF(trim($3::text), '') AS raw_query
  ) query
),
bm25_candidates AS (
  SELECT
    j.id,
    -(
      (
        repeat(COALESCE(j.job_title, '') || ' ', 8) ||
        repeat(COALESCE(j.resume_file_name, '') || ' ', 2) ||
        COALESCE(j.job_description, '') || ' ' ||
        COALESCE(j.llm_recommendation, '') || ' ' ||
        COALESCE(j.analysis_json::text, '')
      ) <@> to_bm25query(search_input.raw_query, 'jobs_bm25_search_idx')
    ) AS bm25_rank
  FROM jobs j
  CROSS JOIN search_input
  WHERE
    search_input.raw_query IS NOT NULL
    AND (
      $1::text = 'admin'
      OR (
        j.user_id = $2
        AND j.analysis_kind = 'application'
      )
    )
  ORDER BY
    (
      repeat(COALESCE(j.job_title, '') || ' ', 8) ||
      repeat(COALESCE(j.resume_file_name, '') || ' ', 2) ||
      COALESCE(j.job_description, '') || ' ' ||
      COALESCE(j.llm_recommendation, '') || ' ' ||
      COALESCE(j.analysis_json::text, '')
    ) <@> to_bm25query(search_input.raw_query, 'jobs_bm25_search_idx')
  LIMIT (SELECT candidate_limit FROM search_input)
),
semantic_candidates AS (
  SELECT
    semantic.job_id AS id,
    semantic.rank::int AS semantic_rank
  FROM unnest($4::bigint[]) WITH ORDINALITY AS semantic(job_id, rank)
),
candidate_jobs AS (
  SELECT id FROM bm25_candidates
  UNION
  SELECT id FROM semantic_candidates
  UNION
  SELECT j.id
  FROM jobs j
  CROSS JOIN search_input
  WHERE
    search_input.raw_query IS NULL
    AND (
      $1::text = 'admin'
      OR (
        j.user_id = $2
        AND j.analysis_kind = 'application'
      )
    )
),
scoped_jobs AS (
  SELECT
    j.id,
    j.user_id,
    j.job_posting_id,
    j.analysis_kind,
    jp.title AS job_posting_title,
    u.name AS user_name,
    u.email AS user_email,
    j.status,
    j.application_date,
    j.job_title,
    j.job_description,
    j.resume_file_name,
    j.character_count,
    j.chunk_count,
    j.llm_recommendation,
    j.fit_score,
    j.fit_level,
    j.analysis_json,
    j.error_message,
    j.created_at,
    j.updated_at,
    search_input.raw_query,
    search_input.text_query,
    search_input.prefix_query,
    semantic_candidates.semantic_rank,
    search_document.document,
    search_document.bm25_text,
    COALESCE(bm25_candidates.bm25_rank, 0) AS bm25_rank
  FROM candidate_jobs
  JOIN jobs j ON j.id = candidate_jobs.id
  LEFT JOIN users u ON u.id = j.user_id
  LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
  LEFT JOIN bm25_candidates ON bm25_candidates.id = j.id
  LEFT JOIN semantic_candidates ON semantic_candidates.id = j.id
  CROSS JOIN search_input
  CROSS JOIN LATERAL (
    SELECT
      setweight(to_tsvector('simple', COALESCE(j.job_title, '')), 'A') ||
      setweight(to_tsvector('simple', concat_ws(
        ' ',
        COALESCE(jp.title, ''),
        COALESCE(u.name, ''),
        COALESCE(u.email, ''),
        COALESCE(j.resume_file_name, '')
      )), 'B') ||
      setweight(to_tsvector('simple', concat_ws(
        ' ',
        COALESCE(j.job_description, ''),
        COALESCE(j.llm_recommendation, ''),
        COALESCE(j.analysis_json::text, '')
      )), 'C') AS document,
      concat_ws(
        ' ',
        repeat(COALESCE(j.job_title, '') || ' ', 8),
        repeat(COALESCE(jp.title, '') || ' ', 5),
        repeat(COALESCE(u.name, '') || ' ', 3),
        repeat(COALESCE(u.email, '') || ' ', 3),
        repeat(COALESCE(j.resume_file_name, '') || ' ', 2),
        COALESCE(j.job_description, ''),
        COALESCE(j.llm_recommendation, ''),
        COALESCE(j.analysis_json::text, '')
      ) AS bm25_text
  ) search_document
  WHERE
    (
      $1::text = 'admin'
      OR (
        j.user_id = $2
        AND j.analysis_kind = 'application'
      )
    )
),
scored_jobs AS (
  SELECT
    scoped_jobs.*,
    scoped_jobs.bm25_rank AS text_rank,
    CASE
      WHEN scoped_jobs.raw_query IS NULL THEN false
      ELSE (
        scoped_jobs.bm25_rank > 0
        OR COALESCE(scoped_jobs.document @@ scoped_jobs.text_query, false)
        OR COALESCE(scoped_jobs.document @@ scoped_jobs.prefix_query, false)
        OR scoped_jobs.job_title ILIKE '%' || scoped_jobs.raw_query || '%'
        OR COALESCE(scoped_jobs.job_description, '') ILIKE '%' || scoped_jobs.raw_query || '%'
        OR COALESCE(scoped_jobs.llm_recommendation, '') ILIKE '%' || scoped_jobs.raw_query || '%'
        OR COALESCE(scoped_jobs.analysis_json::text, '') ILIKE '%' || scoped_jobs.raw_query || '%'
        OR COALESCE(scoped_jobs.resume_file_name, '') ILIKE '%' || scoped_jobs.raw_query || '%'
        OR COALESCE(scoped_jobs.job_posting_title, '') ILIKE '%' || scoped_jobs.raw_query || '%'
        OR COALESCE(scoped_jobs.user_name, '') ILIKE '%' || scoped_jobs.raw_query || '%'
        OR COALESCE(scoped_jobs.user_email, '') ILIKE '%' || scoped_jobs.raw_query || '%'
      )
    END AS text_match
  FROM scoped_jobs
),
filtered_jobs AS (
  SELECT *
  FROM scored_jobs
  WHERE
    raw_query IS NULL
    OR semantic_rank IS NOT NULL
    OR text_match
),
ranked_jobs AS (
  SELECT
    filtered_jobs.*,
    CASE
      WHEN raw_query IS NULL OR NOT text_match THEN NULL
      ELSE row_number() OVER (
        PARTITION BY raw_query IS NOT NULL AND text_match
        ORDER BY text_rank DESC, created_at DESC, id DESC
      )
    END AS text_rank_position,
    MAX(text_rank) FILTER (WHERE text_match) OVER () AS max_text_rank
  FROM filtered_jobs
),
fused_jobs AS (
  SELECT
    ranked_jobs.*,
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
  FROM ranked_jobs
)
SELECT
  id::int,
  user_id::int,
  job_posting_id::int,
  COALESCE(analysis_kind, 'application') AS analysis_kind,
  job_posting_title,
  user_name,
  user_email,
  status,
  application_date::text,
  job_title,
  job_description,
  resume_file_name,
  character_count,
  chunk_count,
  llm_recommendation,
  fit_score,
  fit_level,
  analysis_json::text,
  error_message,
  created_at::text,
  updated_at::text
FROM fused_jobs
ORDER BY
  hybrid_rank DESC,
  text_rank DESC,
  CASE WHEN semantic_rank IS NULL THEN 1 ELSE 0 END,
  semantic_rank NULLS LAST,
  created_at DESC,
  id DESC
LIMIT $5
OFFSET $6;
