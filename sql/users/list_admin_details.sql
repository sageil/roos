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
FROM users u
LEFT JOIN LATERAL (
  SELECT array_position($2::bigint[], u.id) AS rank
) semantic_match ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS application_count
  FROM jobs j
  WHERE j.user_id = u.id
) job_counts ON true
LEFT JOIN LATERAL (
  SELECT jsonb_build_object(
    'id', rv.id::int,
    'userId', rv.user_id::int,
    'versionNumber', rv.version_number,
    'fileName', rv.file_name,
    'contentType', rv.content_type,
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
      'llmModel', recent.llm_model,
      'embeddingModel', recent.embedding_model,
      'createdAt', recent.created_at::text,
      'updatedAt', recent.updated_at::text
    )
    ORDER BY recent.created_at DESC, recent.id DESC
  ) AS jobs_json
  FROM (
    SELECT
      j.*,
      jp.title AS job_posting_title
    FROM jobs j
    LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
    WHERE j.user_id = u.id
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

    UNION ALL

    SELECT jsonb_array_elements_text(j.analysis_json->'suggestedKeywords') AS term
    FROM jobs j
    WHERE j.user_id = u.id
      AND jsonb_typeof(j.analysis_json->'suggestedKeywords') = 'array'
  ) raw_terms
  WHERE trim(term) <> ''
) matched_terms ON true
WHERE
  COALESCE($1::text, '') = ''
  OR u.id = ANY($2::bigint[])
  OR u.name ILIKE '%' || $1 || '%'
  OR u.email ILIKE '%' || $1 || '%'
  OR EXISTS (
    SELECT 1
    FROM resume_versions rv
    WHERE rv.user_id = u.id
      AND rv.file_name ILIKE '%' || $1 || '%'
  )
  OR EXISTS (
    SELECT 1
    FROM jobs j
    LEFT JOIN job_postings jp ON jp.id = j.job_posting_id
    WHERE j.user_id = u.id
      AND (
        j.job_title ILIKE '%' || $1 || '%'
        OR COALESCE(j.job_description, '') ILIKE '%' || $1 || '%'
        OR COALESCE(j.llm_recommendation, '') ILIKE '%' || $1 || '%'
        OR COALESCE(j.analysis_json::text, '') ILIKE '%' || $1 || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(jp.skills, ARRAY[]::text[])) skill
          WHERE skill ILIKE '%' || $1 || '%'
        )
      )
  )
ORDER BY
  CASE WHEN semantic_match.rank IS NULL THEN 1 ELSE 0 END,
  semantic_match.rank NULLS LAST,
  u.created_at DESC,
  u.id DESC
LIMIT $3;
