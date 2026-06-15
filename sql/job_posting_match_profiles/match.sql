SELECT job_posting_id::int, score
FROM match_job_posting_match_profiles($1::vector(768), $2, $3);
