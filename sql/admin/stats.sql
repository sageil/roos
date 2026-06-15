SELECT
  (SELECT COUNT(*)::int FROM users) AS user_count,
  (SELECT COUNT(*)::int FROM jobs WHERE analysis_kind = 'application') AS job_count,
  (SELECT COUNT(*)::int FROM jobs WHERE status = 'completed' AND analysis_kind = 'application') AS completed_job_count,
  (SELECT COUNT(*)::int FROM jobs WHERE status = 'failed' AND analysis_kind = 'application') AS failed_job_count,
  (SELECT COUNT(*)::int FROM job_postings) AS job_posting_count;
