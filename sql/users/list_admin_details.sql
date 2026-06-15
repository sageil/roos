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
    SELECT NULLIF(trim($1::text), '') AS raw_query
  ) query
),
scored_users AS (
  SELECT
    u.*,
    search_input.raw_query,
    array_position($2::bigint[], u.id) AS semantic_rank,
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
        OR search_document.raw_text ILIKE '%' || search_input.raw_query || '%'
      )
    END AS text_match
  FROM users u
  CROSS JOIN search_input
  CROSS JOIN LATERAL (
    SELECT
      string_agg(rv.file_name, ' ') AS file_names
    FROM resume_versions rv
    WHERE rv.user_id = u.id
  ) resume_search
  CROSS JOIN LATERAL (
    SELECT
      string_agg(j.job_title, ' ') AS job_titles,
      string_agg(
        concat_ws(
          ' ',
          j.job_description,
          j.llm_recommendation,
          j.analysis_json::text,
          jp.title,
          immutable_text_array_to_string(COALESCE(jp.skills, ARRAY[]::text[]), ' ')
        ),
        ' '
      ) AS job_details
    FROM jobs j
    LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
    WHERE j.user_id = u.id
      AND j.analysis_kind = 'application'
  ) job_search
  CROSS JOIN LATERAL (
    SELECT
      concat_ws(
        ' ',
        u.name,
        u.email,
        resume_search.file_names,
        job_search.job_titles,
        job_search.job_details
      ) AS raw_text,
      setweight(to_tsvector('simple', concat_ws(' ', u.name, u.email)), 'A') ||
      setweight(to_tsvector('simple', COALESCE(job_search.job_titles, '')), 'B') ||
      setweight(to_tsvector('simple', concat_ws(
        ' ',
        resume_search.file_names,
        job_search.job_details
      )), 'C') AS document
  ) search_document
  WHERE
    $4::bigint IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM jobs assessed
      WHERE assessed.user_id = u.id
        AND assessed.job_posting_id = $4::bigint
        AND assessed.status <> 'failed'
    )
),
filtered_users AS (
  SELECT *
  FROM scored_users
  WHERE
    raw_query IS NULL
    OR semantic_rank IS NOT NULL
    OR text_match
),
ranked_users AS (
  SELECT
    filtered_users.*,
    CASE
      WHEN raw_query IS NULL OR NOT text_match THEN NULL
      ELSE row_number() OVER (
        PARTITION BY raw_query IS NOT NULL AND text_match
        ORDER BY text_rank DESC, created_at DESC, id DESC
      )
    END AS text_rank_position,
    MAX(text_rank) FILTER (WHERE text_match) OVER () AS max_text_rank
  FROM filtered_users
),
fused_users AS (
  SELECT
    ranked_users.*,
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
  FROM ranked_users
)
SELECT
  u.id::int,
  u.name,
  u.email,
  u.role,
  u.created_at::text,
  COALESCE(job_counts.application_count, 0)::int AS application_count,
  latest_resume.resume_json,
  COALESCE(recent_jobs.jobs_json, '[]'::jsonb) AS recent_jobs_json,
  COALESCE(matched_terms.terms, ARRAY[]::text[]) AS matched_terms
FROM fused_users u
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS application_count
  FROM jobs j
  WHERE j.user_id = u.id
    AND j.analysis_kind = 'application'
) job_counts ON true
LEFT JOIN LATERAL (
  SELECT jsonb_build_object(
    'id', rv.id::int,
    'userId', rv.user_id::int,
    'versionNumber', rv.version_number,
    'fileName', rv.file_name,
    'contentType', rv.content_type,
    'fileSize', rv.file_size,
    'characterCount', rv.character_count,
    'createdAt', rv.created_at::text
  ) AS resume_json
  FROM resume_versions rv
  WHERE rv.user_id = u.id
  ORDER BY rv.version_number DESC
  LIMIT 1
) latest_resume ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', recent.id::int,
      'userId', recent.user_id::int,
      'jobPostingId', recent.job_posting_id::int,
      'analysisKind', recent.analysis_kind,
      'jobPostingTitle', recent.job_posting_title,
      'userName', u.name,
      'userEmail', u.email,
      'status', recent.status,
      'applicationDate', recent.application_date::text,
      'jobTitle', recent.job_title,
      'jobDescription', recent.job_description,
      'resumeFileName', recent.resume_file_name,
      'characterCount', recent.character_count,
      'chunkCount', recent.chunk_count,
      'llmRecommendation', recent.llm_recommendation,
      'analysis', recent.analysis_json,
      'fitScore', recent.fit_score,
      'fitLevel', recent.fit_level,
      'errorMessage', recent.error_message,
      'createdAt', recent.created_at::text,
      'updatedAt', recent.updated_at::text
    )
    ORDER BY recent.created_at DESC, recent.id DESC
  ) AS jobs_json
  FROM (
    SELECT
      j.id,
      j.user_id,
      j.job_posting_id,
      j.analysis_kind,
      j.status,
      j.application_date,
      j.job_title,
      j.job_description,
      j.resume_file_name,
      j.character_count,
      j.chunk_count,
      j.llm_recommendation,
      j.analysis_json,
      j.fit_score,
      j.fit_level,
      j.error_message,
      j.created_at,
      j.updated_at,
      jp.title AS job_posting_title
    FROM jobs j
    LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
    WHERE j.user_id = u.id
      AND j.analysis_kind = 'application'
    ORDER BY j.created_at DESC, j.id DESC
    LIMIT 5
  ) recent
) recent_jobs ON true
LEFT JOIN LATERAL (
  SELECT array_agg(DISTINCT term ORDER BY term) AS terms
  FROM (
    SELECT unnest(jp.skills) AS term
    FROM jobs j
    JOIN job_postings jp ON jp.id = j.job_posting_id
    WHERE j.user_id = u.id
      AND j.analysis_kind = 'application'

    UNION ALL

    SELECT jsonb_array_elements_text(j.analysis_json->'suggestedKeywords') AS term
    FROM jobs j
    WHERE j.user_id = u.id
      AND j.analysis_kind = 'application'
      AND jsonb_typeof(j.analysis_json->'suggestedKeywords') = 'array'
  ) raw_terms
  WHERE trim(term) <> ''
) matched_terms ON true
ORDER BY
  u.hybrid_rank DESC,
  u.text_rank DESC,
  CASE WHEN u.semantic_rank IS NULL THEN 1 ELSE 0 END,
  u.semantic_rank NULLS LAST,
  u.created_at DESC,
  u.id DESC
LIMIT $3
OFFSET $5;
