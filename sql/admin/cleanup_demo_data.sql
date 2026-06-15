DELETE FROM analysis_cache
WHERE cache_key LIKE 'demo:%';

DELETE FROM jobs
WHERE user_id IN (
    SELECT id
    FROM users
    WHERE email LIKE '%@example.com.au'
  )
  OR job_posting_id IN (
    SELECT id
    FROM job_postings
    WHERE (
      (
          title LIKE '% - Sydney'
          OR title LIKE '% - Melbourne'
          OR title LIKE '% - Brisbane'
          OR title LIKE '% - Perth'
          OR title LIKE '% - Adelaide'
          OR title LIKE '% - Canberra'
          OR title LIKE '% - Hobart'
          OR title LIKE '% - Darwin'
        )
        AND description LIKE '%Australian veterinary operations%'
      )
      OR title IN (
        'Veterinary Technician - Companion Animal Clinic',
        'Veterinarian - Small Animal Practice',
        'Front Desk Receptionist - Veterinary Clinic',
        'Accountant - Veterinary Services Group'
      )
  );

DELETE FROM job_postings
WHERE (
    (
      title LIKE '% - Sydney'
      OR title LIKE '% - Melbourne'
      OR title LIKE '% - Brisbane'
      OR title LIKE '% - Perth'
      OR title LIKE '% - Adelaide'
      OR title LIKE '% - Canberra'
      OR title LIKE '% - Hobart'
      OR title LIKE '% - Darwin'
    )
    AND description LIKE '%Australian veterinary operations%'
  )
  OR title IN (
    'Veterinary Technician - Companion Animal Clinic',
    'Veterinarian - Small Animal Practice',
    'Front Desk Receptionist - Veterinary Clinic',
    'Accountant - Veterinary Services Group'
  );

DELETE FROM users
WHERE email LIKE '%@example.com.au';
