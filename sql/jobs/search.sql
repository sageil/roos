WITH search_input AS (
  SELECT
    query.raw_query,
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
scored_jobs AS (
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
    array_position($4::bigint[], j.id) AS semantic_rank,
    CASE
      WHEN search_input.text_query IS NULL THEN 0::real
      ELSE
        COALESCE(ts_rank_cd(search_document.document, search_input.text_query, 32), 0) +
        COALESCE(ts_rank_cd(search_document.document, search_input.prefix_query, 32), 0)
    END AS text_rank,
    CASE
      WHEN search_input.raw_query IS NULL THEN false
      ELSE (
        COALESCE(search_document.document @@ search_input.text_query, false)
        OR COALESCE(search_document.document @@ search_input.prefix_query, false)
        OR j.job_title ILIKE '%' || search_input.raw_query || '%'
        OR COALESCE(j.job_description, '') ILIKE '%' || search_input.raw_query || '%'
        OR COALESCE(j.llm_recommendation, '') ILIKE '%' || search_input.raw_query || '%'
        OR COALESCE(j.analysis_json::text, '') ILIKE '%' || search_input.raw_query || '%'
        OR COALESCE(j.resume_file_name, '') ILIKE '%' || search_input.raw_query || '%'
        OR COALESCE(jp.title, '') ILIKE '%' || search_input.raw_query || '%'
        OR COALESCE(u.name, '') ILIKE '%' || search_input.raw_query || '%'
        OR COALESCE(u.email, '') ILIKE '%' || search_input.raw_query || '%'
      )
    END AS text_match
  FROM jobs j
  LEFT JOIN users u ON u.id = j.user_id
  LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
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
      )), 'C') AS document
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
