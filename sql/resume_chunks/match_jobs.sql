SELECT
  rc.job_id::int,
  MAX(1 - (rc.embedding <=> $1::vector)) AS score
FROM resume_chunks rc
JOIN jobs j ON j.id = rc.job_id
WHERE
  rc.embedding_model = $2
  AND (
    $3::text = 'admin'
    OR (
      j.user_id = $4
      AND j.analysis_kind = 'application'
    )
  )
GROUP BY rc.job_id
ORDER BY MIN(rc.embedding <=> $1::vector)
LIMIT $5;
