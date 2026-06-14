SELECT
  (SELECT COUNT(*)::int FROM users) AS user_count,
  (SELECT COUNT(*)::int FROM jobs) AS job_count,
  (SELECT COUNT(*)::int FROM jobs WHERE status = 'completed') AS completed_job_count,
  (SELECT COUNT(*)::int FROM jobs WHERE status = 'failed') AS failed_job_count,
  (SELECT COUNT(*)::int FROM job_postings) AS job_posting_count;
