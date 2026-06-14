SELECT chunk_id, document, score
FROM match_resume_chunks($1, $2::vector, $3);
