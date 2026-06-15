UPDATE jobs
SET
  analysis_json = jsonb_set(analysis_json, '{interviewQuestions}', $2::jsonb, true),
  updated_at = NOW()
WHERE id = $1
  AND analysis_json IS NOT NULL;
