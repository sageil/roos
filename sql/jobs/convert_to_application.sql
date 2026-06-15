UPDATE jobs
SET
  analysis_kind = 'application',
  updated_at = NOW()
WHERE id = $1
  AND analysis_kind = 'candidate_assessment';
