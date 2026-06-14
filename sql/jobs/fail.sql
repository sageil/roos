UPDATE jobs
SET status = 'failed', error_message = $1, updated_at = NOW()
WHERE id = $2;
