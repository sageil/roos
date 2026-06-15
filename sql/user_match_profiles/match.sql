SELECT user_id::int, score
FROM match_user_match_profiles($1::vector, $2, $3);
