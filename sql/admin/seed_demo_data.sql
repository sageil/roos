WITH
settings AS (
  SELECT
    $1::text AS user_password_hash,
    $2::text AS admin_email,
    $3::text AS llm_model,
    $4::text AS embedding_model
),
demo_users(email) AS (
  VALUES
    ('olivia.harris.au@example.com'),
    ('james.nguyen.au@example.com'),
    ('priya.patel.au@example.com'),
    ('michael.oconnor.au@example.com')
),
demo_postings(title) AS (
  VALUES
    ('Veterinary Technician - Companion Animal Clinic'),
    ('Veterinarian - Small Animal Practice'),
    ('Front Desk Receptionist - Veterinary Clinic'),
    ('Accountant - Veterinary Services Group')
),
deleted_cache AS (
  DELETE FROM analysis_cache
  WHERE cache_key LIKE 'demo:%'
  RETURNING 1
),
deleted_jobs AS (
  DELETE FROM jobs
  WHERE user_id IN (SELECT id FROM users WHERE email IN (SELECT email FROM demo_users))
    OR job_posting_id IN (SELECT id FROM job_postings WHERE title IN (SELECT title FROM demo_postings))
  RETURNING 1
),
deleted_postings AS (
  DELETE FROM job_postings
  WHERE title IN (SELECT title FROM demo_postings)
    AND (SELECT COUNT(*) FROM deleted_jobs) >= 0
  RETURNING 1
),
admin_user AS (
  SELECT id
  FROM users
  WHERE email = (SELECT admin_email FROM settings)
  LIMIT 1
),
user_seed(name, email, resume_file_name, resume_text, applied_title, fit_score, fit_level, recommendation) AS (
  VALUES
    (
      'Olivia Harris',
      'olivia.harris.au@example.com',
      'olivia-harris-vet-technician.md',
      'Olivia Harris is a Brisbane-based veterinary technician with seven years of companion animal clinic experience. She supports triage, patient restraint, anaesthetic monitoring, dental procedures, pathology sample handling, radiography workflows, medication preparation, client education, and stock control. Olivia has worked with practice management systems, maintained treatment notes, supported emergency presentations, and coordinated discharge instructions with veterinarians and pet owners across Queensland clinics.',
      'Veterinary Technician - Companion Animal Clinic',
      88,
      'high',
      'Strong fit for technician work. Prioritise discussion around anaesthetic monitoring, dental support, and client communication in a busy small animal clinic.'
    ),
    (
      'Dr James Nguyen',
      'james.nguyen.au@example.com',
      'james-nguyen-veterinarian.md',
      'Dr James Nguyen is a Melbourne veterinarian registered in Australia with nine years of small animal practice experience. He performs consultations, diagnostic workups, soft tissue surgery, dentistry, vaccination programs, chronic disease management, emergency stabilisation, imaging interpretation, pathology review, and client communication. James has mentored graduate vets, improved clinical protocols, and worked with nurses and reception teams to improve continuity of care.',
      'Veterinarian - Small Animal Practice',
      91,
      'high',
      'Excellent fit for the veterinarian role. Validate registration status, surgical case mix, emergency confidence, and approach to client communication.'
    ),
    (
      'Priya Patel',
      'priya.patel.au@example.com',
      'priya-patel-front-desk.md',
      'Priya Patel is a Sydney front desk receptionist with six years of healthcare and veterinary reception experience. She manages appointment books, multi-line phones, payment processing, client intake, patient arrivals, vaccination reminders, insurance paperwork, retail product enquiries, and sensitive conversations with pet owners. Priya has used cloud booking systems, EFTPOS terminals, and practice management software while coordinating urgent visits with clinical teams.',
      'Front Desk Receptionist - Veterinary Clinic',
      84,
      'high',
      'Strong fit for reception. Interview should focus on high-volume scheduling, distressed client handling, billing accuracy, and coordination with clinical staff.'
    ),
    (
      'Michael O''Connor',
      'michael.oconnor.au@example.com',
      'michael-oconnor-accountant.md',
      'Michael O''Connor is a Perth accountant with eight years of experience across small business, payroll, BAS preparation, accounts payable, accounts receivable, reconciliations, month-end close, management reporting, budgeting, and Xero. He has supported multi-site service businesses, worked with external tax advisors, improved invoice approval processes, and prepared financial packs for operational managers.',
      'Accountant - Veterinary Services Group',
      86,
      'high',
      'Strong fit for accounting support. Validate BAS ownership, payroll complexity, Xero reporting, and comfort supporting a multi-site veterinary services group.'
    )
),
posting_seed(title, description, skills) AS (
  VALUES
    (
      'Veterinary Technician - Companion Animal Clinic',
      'Busy Brisbane companion animal clinic seeking a veterinary technician to support patient care, triage, anaesthetic monitoring, dental procedures, sample collection, radiography preparation, medication preparation, accurate treatment notes, client education, and stock control. The role works closely with veterinarians and reception staff in a high-volume small animal environment.',
      ARRAY['animal handling', 'anaesthetic monitoring', 'dental support', 'radiography', 'client education', 'clinic records']::text[]
    ),
    (
      'Veterinarian - Small Animal Practice',
      'Melbourne small animal practice seeking a veterinarian for consultations, diagnostics, soft tissue surgery, dentistry, vaccination programs, emergency stabilisation, pathology review, imaging interpretation, treatment planning, client communication, and mentoring junior clinical staff. Australian veterinary registration is required.',
      ARRAY['veterinary registration', 'consultations', 'diagnostics', 'soft tissue surgery', 'dentistry', 'client communication']::text[]
    ),
    (
      'Front Desk Receptionist - Veterinary Clinic',
      'Sydney veterinary clinic seeking a front desk receptionist to manage appointment scheduling, phones, client intake, patient arrivals, payments, vaccination reminders, insurance forms, retail enquiries, and urgent visit coordination. The role requires calm communication with pet owners and close coordination with vets and nurses.',
      ARRAY['appointment scheduling', 'customer service', 'EFTPOS', 'practice management software', 'client intake', 'phone triage']::text[]
    ),
    (
      'Accountant - Veterinary Services Group',
      'Perth veterinary services group seeking an accountant to own reconciliations, payroll support, BAS preparation, accounts payable, accounts receivable, month-end close, budgeting support, management reporting, invoice controls, and Xero reporting for a growing multi-site service business.',
      ARRAY['Xero', 'BAS', 'payroll', 'reconciliations', 'month-end close', 'management reporting']::text[]
    )
),
inserted_users AS (
  INSERT INTO users (
    name,
    email,
    role,
    password_hash,
    created_at
  )
  SELECT
    us.name,
    us.email,
    'user',
    (SELECT user_password_hash FROM settings),
    NOW()
  FROM user_seed us
  ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    password_hash = EXCLUDED.password_hash
  RETURNING id, name, email
),
inserted_postings AS (
  INSERT INTO job_postings (
    created_by_user_id,
    title,
    description,
    skills,
    status,
    created_at,
    updated_at
  )
  SELECT
    (SELECT id FROM admin_user),
    ps.title,
    ps.description,
    ps.skills,
    'active',
    NOW(),
    NOW()
  FROM posting_seed ps
  RETURNING id, title, description, skills
),
inserted_resume_versions AS (
  INSERT INTO resume_versions (
    user_id,
    version_number,
    file_name,
    content_type,
    character_count,
    resume_text,
    created_at
  )
  SELECT
    iu.id,
    1,
    us.resume_file_name,
    'text/markdown',
    length(us.resume_text),
    us.resume_text,
    NOW()
  FROM inserted_users iu
  JOIN user_seed us ON us.email = iu.email
  ON CONFLICT (user_id, version_number) DO UPDATE SET
    file_name = EXCLUDED.file_name,
    content_type = EXCLUDED.content_type,
    character_count = EXCLUDED.character_count,
    resume_text = EXCLUDED.resume_text,
    created_at = EXCLUDED.created_at
  RETURNING id
),
inserted_jobs AS (
  INSERT INTO jobs (
    user_id,
    job_posting_id,
    status,
    application_date,
    job_title,
    job_description,
    resume_file_name,
    character_count,
    chunk_count,
    llm_recommendation,
    fit_score,
    fit_level,
    analysis_json,
    llm_model,
    embedding_model,
    created_at,
    updated_at
  )
  SELECT
    iu.id,
    ip.id,
    'completed',
    CURRENT_DATE,
    ip.title,
    ip.description,
    us.resume_file_name,
    length(us.resume_text),
    2,
    us.recommendation,
    us.fit_score,
    us.fit_level,
    jsonb_build_object(
      'candidateSummary', concat(iu.name, ' is an Australian candidate with directly relevant experience for ', ip.title, '.'),
      'fitScore', us.fit_score,
      'fitLevel', us.fit_level,
      'strengths', jsonb_build_array('Relevant industry experience', 'Clear operational responsibilities', 'Australian workplace context'),
      'gaps', jsonb_build_array('Confirm recent systems and compliance requirements during interview'),
      'risks', jsonb_build_array('Seeded demo analysis should be replaced by live LLM review for hiring decisions'),
      'recommendations', jsonb_build_array(us.recommendation),
      'suggestedKeywords', to_jsonb(ip.skills),
      'interviewQuestions', jsonb_build_array(
        'Which recent responsibilities best match this role?',
        'What systems, records, or compliance workflows did you use most often?'
      ),
      'requirementAssessments', jsonb_build_array(
        jsonb_build_object(
          'category', 'role_competency',
          'requirement', concat('Core responsibilities for ', ip.title),
          'importance', 'must_have',
          'status', 'met',
          'evidence', jsonb_build_array(left(us.resume_text, 180)),
          'rationale', 'The seeded resume text includes directly related responsibilities.'
        )
      ),
      'scoreBreakdown', jsonb_build_object(
        'minimumQualifications', us.fit_score,
        'roleCompetencies', us.fit_score,
        'domainExperience', us.fit_score,
        'preferredQualifications', GREATEST(us.fit_score - 8, 0),
        'seniorityScope', us.fit_score,
        'evidenceQuality', 82
      ),
      'fairnessReview', jsonb_build_object(
        'ignoredFactors', jsonb_build_array('name', 'location-sensitive identity details'),
        'notes', jsonb_build_array('Seeded analysis focuses on role evidence and work history.')
      ),
      'evidence', jsonb_build_array(
        jsonb_build_object('id', 1, 'text', left(us.resume_text, 220), 'score', 0.86),
        jsonb_build_object('id', 2, 'text', ip.description, 'score', 0.8)
      )
    ),
    (SELECT llm_model FROM settings),
    (SELECT embedding_model FROM settings),
    NOW(),
    NOW()
  FROM inserted_users iu
  JOIN user_seed us ON us.email = iu.email
  JOIN inserted_postings ip ON ip.title = us.applied_title
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM inserted_users)::int AS users_seeded,
  (SELECT COUNT(*) FROM inserted_postings)::int AS job_postings_seeded,
  (SELECT COUNT(*) FROM inserted_resume_versions)::int AS resume_versions_seeded,
  (SELECT COUNT(*) FROM inserted_jobs)::int AS applications_seeded;
