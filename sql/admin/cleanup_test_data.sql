DELETE FROM analysis_cache;
DELETE FROM jobs;
DELETE FROM resume_versions;
DELETE FROM sessions;
DELETE FROM job_posting_match_profiles;
DELETE FROM job_postings;
DELETE FROM user_match_profiles;
DELETE FROM users WHERE role <> 'admin';

SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY role;
SELECT COUNT(*) AS jobs FROM jobs;
SELECT COUNT(*) AS resume_versions FROM resume_versions;
SELECT COUNT(*) AS sessions FROM sessions;
SELECT COUNT(*) AS job_postings FROM job_postings;
SELECT COUNT(*) AS analysis_cache FROM analysis_cache;
SELECT COUNT(*) AS user_match_profiles FROM user_match_profiles;
SELECT COUNT(*) AS job_posting_match_profiles FROM job_posting_match_profiles;
