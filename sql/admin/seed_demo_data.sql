WITH
settings AS (
  SELECT
    $1::text AS user_password_hash,
    $2::text AS admin_email,
    $3::text AS llm_model,
    $4::text AS embedding_model
),
admin_user AS (
  SELECT id
  FROM users
  WHERE email = (SELECT admin_email FROM settings)
  LIMIT 1
),
role_seed(seed_index, title, category, skills) AS (
  VALUES
    (1, 'Veterinarian - Small Animal Practice', 'clinical', ARRAY['veterinary registration', 'consultations', 'diagnostics', 'dentistry', 'client communication', 'treatment planning']::text[]),
    (2, 'Emergency Veterinarian - 24 Hour Hospital', 'clinical', ARRAY['emergency stabilisation', 'triage', 'critical care', 'surgery', 'diagnostics', 'client communication']::text[]),
    (3, 'Veterinary Surgeon - Referral Services', 'clinical', ARRAY['soft tissue surgery', 'orthopaedics', 'case planning', 'anaesthesia', 'surgical records', 'referral communication']::text[]),
    (4, 'Veterinary Nurse - Companion Animal Clinic', 'nursing', ARRAY['animal handling', 'anaesthetic monitoring', 'dental support', 'patient restraint', 'clinic records', 'client education']::text[]),
    (5, 'Senior Veterinary Nurse - Surgical Team', 'nursing', ARRAY['surgical nursing', 'sterilisation', 'anaesthetic monitoring', 'team mentoring', 'inventory control', 'patient recovery']::text[]),
    (6, 'Veterinary Technician - Imaging and Radiography', 'technical', ARRAY['radiography', 'ultrasound support', 'patient positioning', 'radiation safety', 'image records', 'equipment care']::text[]),
    (7, 'Laboratory Technician - Veterinary Pathology', 'laboratory', ARRAY['sample handling', 'haematology', 'biochemistry', 'microscopy', 'quality control', 'LIMS']::text[]),
    (8, 'Diagnostic Lab Assistant - Animal Health', 'laboratory', ARRAY['specimen accessioning', 'pathology samples', 'data entry', 'biosafety', 'sample tracking', 'turnaround times']::text[]),
    (9, 'Practice Manager - Veterinary Hospital', 'operations', ARRAY['rostering', 'team leadership', 'practice operations', 'client service', 'financial reporting', 'compliance']::text[]),
    (10, 'Clinic Operations Coordinator - Veterinary Group', 'operations', ARRAY['multi-site coordination', 'workflow improvement', 'supplier management', 'policy rollout', 'clinic reporting', 'stakeholder communication']::text[]),
    (11, 'Front Desk Receptionist - Veterinary Clinic', 'administration', ARRAY['appointment scheduling', 'customer service', 'EFTPOS', 'practice management software', 'client intake', 'phone triage']::text[]),
    (12, 'Office Administrator - Veterinary Services', 'administration', ARRAY['office administration', 'records management', 'invoicing', 'supplier coordination', 'calendar management', 'document control']::text[]),
    (13, 'Accounts Officer - Veterinary Services Group', 'finance', ARRAY['accounts payable', 'accounts receivable', 'reconciliations', 'Xero', 'invoice controls', 'month-end support']::text[]),
    (14, 'Accountant - Veterinary Services Group', 'finance', ARRAY['Xero', 'BAS', 'payroll', 'reconciliations', 'month-end close', 'management reporting']::text[]),
    (15, 'Payroll Officer - Animal Health Network', 'finance', ARRAY['payroll', 'award interpretation', 'timesheets', 'superannuation', 'leave reconciliation', 'employee queries']::text[]),
    (16, 'Software Developer - Veterinary Practice Platform', 'technology', ARRAY['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'API design', 'clinical workflows']::text[]),
    (17, 'Backend Developer - Animal Health Data Systems', 'technology', ARRAY['Node.js', 'PostgreSQL', 'API integrations', 'data pipelines', 'testing', 'security']::text[]),
    (18, 'IT Support Analyst - Veterinary Clinics', 'technology', ARRAY['help desk', 'practice systems', 'device support', 'network troubleshooting', 'user onboarding', 'vendor support']::text[]),
    (19, 'Data Analyst - Veterinary Operations', 'technology', ARRAY['SQL', 'dashboards', 'operations reporting', 'Power BI', 'data quality', 'stakeholder insights']::text[]),
    (20, 'Client Care Coordinator - Veterinary Hospital', 'client services', ARRAY['client communication', 'care plans', 'appointment follow-up', 'billing support', 'empathy', 'case coordination']::text[]),
    (21, 'Inventory Coordinator - Veterinary Supplies', 'operations', ARRAY['stock control', 'supplier ordering', 'controlled drugs records', 'cycle counts', 'procurement', 'clinic inventory']::text[]),
    (22, 'Animal Attendant - Boarding and Veterinary Care', 'animal care', ARRAY['animal handling', 'feeding routines', 'kennel hygiene', 'patient observation', 'safe restraint', 'welfare checks']::text[]),
    (23, 'Rehabilitation Assistant - Veterinary Physiotherapy', 'clinical support', ARRAY['rehabilitation plans', 'hydrotherapy support', 'patient handling', 'exercise programs', 'client education', 'progress notes']::text[]),
    (24, 'Compliance Officer - Veterinary Group', 'operations', ARRAY['clinical compliance', 'WHS', 'privacy', 'audit preparation', 'policy management', 'incident reporting']::text[]),
    (25, 'Marketing Coordinator - Veterinary Practices', 'marketing', ARRAY['local area marketing', 'content planning', 'campaign reporting', 'client communications', 'CRM', 'brand standards']::text[])
),
location_seed(seed_index, city, state_name, setting) AS (
  VALUES
    (1, 'Sydney', 'NSW', 'metropolitan companion animal network'),
    (2, 'Melbourne', 'VIC', 'multi-site veterinary group'),
    (3, 'Brisbane', 'QLD', 'busy small animal hospital'),
    (4, 'Perth', 'WA', 'growing animal health services business'),
    (5, 'Adelaide', 'SA', 'community veterinary clinic'),
    (6, 'Canberra', 'ACT', 'referral and general practice team'),
    (7, 'Hobart', 'TAS', 'regional veterinary services provider'),
    (8, 'Darwin', 'NT', 'mixed urban and regional veterinary operation')
),
posting_seed(seed_index, title, description, skills) AS (
  SELECT
    ((l.seed_index - 1) * 25) + r.seed_index AS seed_index,
    concat(r.title, ' - ', l.city) AS title,
    concat(
      l.city, ' ', l.setting, ' seeking a ', lower(r.title),
      ' to support Australian veterinary operations across ', lower(r.category),
      ' responsibilities. The role works with vets, nurses, administrators, clients, suppliers, and practice leaders where relevant. Key duties include ',
      array_to_string(r.skills, ', '),
      ', accurate records, clear communication, and practical problem solving in a veterinary environment.'
    ) AS description,
    r.skills
  FROM location_seed l
  CROSS JOIN role_seed r
),
name_seed(seed_index, first_name, last_name, city, state_name, profile, preferred_category) AS (
  VALUES
    (1, 'Amelia', 'Wilson', 'Sydney', 'NSW', 'veterinary receptionist with appointment scheduling, EFTPOS, client intake, and calm phone triage experience', 'administration'),
    (2, 'Noah', 'Taylor', 'Melbourne', 'VIC', 'software developer building healthcare workflows with TypeScript, React, Node.js, PostgreSQL, API integrations, and testing', 'technology'),
    (3, 'Charlotte', 'Anderson', 'Brisbane', 'QLD', 'veterinary nurse experienced in animal handling, anaesthetic monitoring, dental support, treatment notes, and client education', 'nursing'),
    (4, 'Oliver', 'Thomas', 'Perth', 'WA', 'accountant with Xero, BAS, payroll support, reconciliations, month-end close, and management reporting experience', 'finance'),
    (5, 'Isla', 'Jackson', 'Adelaide', 'SA', 'laboratory technician with sample handling, haematology, biochemistry, microscopy, quality control, and LIMS experience', 'laboratory'),
    (6, 'Leo', 'White', 'Canberra', 'ACT', 'practice operations coordinator with rostering, supplier management, policy rollout, reporting, and clinic workflow improvement experience', 'operations'),
    (7, 'Mia', 'Harris', 'Hobart', 'TAS', 'client care coordinator skilled in care plans, appointment follow-up, billing support, empathy, and case coordination', 'client services'),
    (8, 'Henry', 'Martin', 'Darwin', 'NT', 'IT support analyst with device support, user onboarding, network troubleshooting, help desk, and practice systems experience', 'technology'),
    (9, 'Ava', 'Thompson', 'Sydney', 'NSW', 'animal attendant with animal handling, feeding routines, kennel hygiene, safe restraint, welfare checks, and patient observation experience', 'animal care'),
    (10, 'Jack', 'Garcia', 'Melbourne', 'VIC', 'veterinarian registered in Australia with consultations, diagnostics, dentistry, treatment planning, and client communication experience', 'clinical'),
    (11, 'Grace', 'Martinez', 'Brisbane', 'QLD', 'office administrator with records management, invoicing, supplier coordination, calendar management, and document control experience', 'administration'),
    (12, 'William', 'Robinson', 'Perth', 'WA', 'data analyst with SQL dashboards, Power BI, operations reporting, data quality, and stakeholder insights experience', 'technology'),
    (13, 'Sophie', 'Clark', 'Adelaide', 'SA', 'senior veterinary nurse with surgical nursing, sterilisation, anaesthetic monitoring, team mentoring, and recovery experience', 'nursing'),
    (14, 'Lucas', 'Rodriguez', 'Canberra', 'ACT', 'payroll officer with award interpretation, timesheets, superannuation, leave reconciliation, and employee query support', 'finance'),
    (15, 'Chloe', 'Lewis', 'Hobart', 'TAS', 'rehabilitation assistant supporting hydrotherapy, patient handling, exercise programs, progress notes, and client education', 'clinical support'),
    (16, 'Thomas', 'Lee', 'Darwin', 'NT', 'inventory coordinator with stock control, controlled drugs records, supplier ordering, procurement, and cycle counts experience', 'operations'),
    (17, 'Ruby', 'Walker', 'Sydney', 'NSW', 'diagnostic lab assistant with specimen accessioning, pathology samples, data entry, biosafety, and sample tracking experience', 'laboratory'),
    (18, 'Ethan', 'Hall', 'Melbourne', 'VIC', 'backend developer with Node.js, PostgreSQL, data pipelines, API integrations, testing, and security experience', 'technology'),
    (19, 'Ella', 'Allen', 'Brisbane', 'QLD', 'marketing coordinator with local area marketing, content planning, CRM, campaign reporting, and veterinary client communications experience', 'marketing'),
    (20, 'James', 'Young', 'Perth', 'WA', 'emergency veterinarian with triage, critical care, emergency stabilisation, diagnostics, surgery, and client communication experience', 'clinical'),
    (21, 'Zoe', 'King', 'Adelaide', 'SA', 'front desk receptionist with multi-line phones, appointment books, patient arrivals, insurance forms, and customer service experience', 'administration'),
    (22, 'Liam', 'Wright', 'Canberra', 'ACT', 'veterinary technician specialising in radiography, patient positioning, radiation safety, image records, and equipment care', 'technical'),
    (23, 'Lily', 'Scott', 'Hobart', 'TAS', 'compliance officer with WHS, privacy, audit preparation, incident reporting, policy management, and clinical compliance experience', 'operations'),
    (24, 'Benjamin', 'Green', 'Darwin', 'NT', 'accounts officer with accounts payable, accounts receivable, invoice controls, reconciliations, Xero, and month-end support', 'finance'),
    (25, 'Matilda', 'Baker', 'Sydney', 'NSW', 'small animal veterinarian with Australian registration, consultations, diagnostics, treatment planning, dentistry, and mentoring experience', 'clinical')
),
first_name_pool(first_name) AS (
  VALUES
    ('Amelia'), ('Noah'), ('Charlotte'), ('Oliver'), ('Isla'), ('Leo'), ('Mia'), ('Henry'), ('Ava'), ('Jack'),
    ('Grace'), ('William'), ('Sophie'), ('Lucas'), ('Chloe'), ('Thomas'), ('Ruby'), ('Ethan'), ('Ella'), ('James'),
    ('Zoe'), ('Liam'), ('Lily'), ('Benjamin'), ('Matilda'), ('Harper'), ('Mason'), ('Evie'), ('Archie'), ('Sienna'),
    ('Harrison'), ('Willow'), ('Hudson'), ('Ivy'), ('Arlo'), ('Florence'), ('Oscar'), ('Poppy'), ('Hugo'), ('Georgia')
),
last_name_pool(last_name) AS (
  VALUES
    ('Wilson'), ('Taylor'), ('Anderson'), ('Thomas'), ('Jackson'), ('White'), ('Harris'), ('Martin'), ('Thompson'), ('Garcia'),
    ('Martinez'), ('Robinson'), ('Clark'), ('Rodriguez'), ('Lewis'), ('Lee'), ('Walker'), ('Hall'), ('Allen'), ('Young'),
    ('King'), ('Wright'), ('Scott'), ('Green'), ('Baker'), ('Adams'), ('Nelson'), ('Carter'), ('Mitchell'), ('Perez'),
    ('Roberts'), ('Turner'), ('Phillips'), ('Campbell'), ('Parker'), ('Evans'), ('Edwards'), ('Collins'), ('Stewart'), ('Morris')
),
human_name_seed(seed_index, first_name, last_name) AS (
  SELECT
    row_number() OVER (ORDER BY sort_key)::int AS seed_index,
    first_name,
    last_name
  FROM (
    SELECT
      first_name_pool.first_name,
      last_name_pool.last_name,
      md5(concat(first_name_pool.first_name, '.', last_name_pool.last_name)) AS sort_key
    FROM first_name_pool
    CROSS JOIN last_name_pool
    ORDER BY sort_key
    LIMIT 100
  ) randomized_names
),
user_seed(seed_index, name, email, resume_file_name, resume_text, applied_posting_index, fit_score, fit_level, recommendation) AS (
  SELECT
    g.seed_index,
    concat(h.first_name, ' ', h.last_name) AS name,
    concat(
      lower(h.first_name),
      '.',
      lower(h.last_name),
      '@example.com.au'
    ) AS email,
    'resume.md' AS resume_file_name,
    concat(
      h.first_name, ' ', h.last_name, ' is an Australian candidate based in ', n.city, ', ', n.state_name,
      ' with practical experience in ', n.profile,
      '. They have worked with veterinary teams, pet owners, practice managers, suppliers, and clinical records in Australian animal health settings. ',
      'Their resume highlights communication, compliance awareness, reliable documentation, and experience supporting veterinary services across ', n.city, '.'
    ) AS resume_text,
    (((g.seed_index - 1) % 200) + 1) AS applied_posting_index,
    CASE
      WHEN n.preferred_category IN ('clinical', 'nursing', 'technology', 'finance', 'laboratory') THEN 78 + (g.seed_index % 17)
      ELSE 68 + (g.seed_index % 22)
    END AS fit_score,
    CASE
      WHEN n.preferred_category IN ('clinical', 'nursing', 'technology', 'finance', 'laboratory') THEN 'high'
      ELSE 'medium'
    END AS fit_level,
    concat(
      'Seeded Australian demo profile. Interview should validate recent ', n.preferred_category,
      ' responsibilities, systems used, communication style, and ability to work in a veterinary environment.'
    ) AS recommendation
  FROM generate_series(1, 100) AS g(seed_index)
  JOIN name_seed n ON n.seed_index = (((g.seed_index - 1) % 25) + 1)
  JOIN human_name_seed h ON h.seed_index = g.seed_index
),
deleted_cache AS (
  DELETE FROM analysis_cache
  WHERE cache_key LIKE 'demo:%'
  RETURNING 1
),
deleted_jobs AS (
  DELETE FROM jobs
  WHERE user_id IN (
      SELECT id
      FROM users
      WHERE email LIKE '%@example.com.au'
    )
    OR job_posting_id IN (
      SELECT id
      FROM job_postings
      WHERE title IN (SELECT title FROM posting_seed)
        OR title IN (
          'Veterinary Technician - Companion Animal Clinic',
          'Veterinarian - Small Animal Practice',
          'Front Desk Receptionist - Veterinary Clinic',
          'Accountant - Veterinary Services Group'
        )
    )
  RETURNING 1
),
deleted_postings AS (
  DELETE FROM job_postings
  WHERE title IN (SELECT title FROM posting_seed)
    OR title IN (
      'Veterinary Technician - Companion Animal Clinic',
      'Veterinarian - Small Animal Practice',
      'Front Desk Receptionist - Veterinary Clinic',
      'Accountant - Veterinary Services Group'
    )
  RETURNING 1
),
deleted_demo_users AS (
  DELETE FROM users
  WHERE email LIKE '%@example.com.au'
    AND role <> 'admin'
    AND (SELECT COUNT(*) FROM deleted_postings) >= 0
  RETURNING 1
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
  ORDER BY ps.seed_index
  RETURNING id, title, description, skills
),
inserted_resume_versions AS (
  INSERT INTO resume_versions (
    user_id,
    version_number,
    file_name,
    content_type,
    file_size,
    file_bytes,
    character_count,
    resume_text,
    created_at
  )
  SELECT
    iu.id,
    1,
    us.resume_file_name,
    'text/markdown',
    octet_length(convert_to(us.resume_text, 'UTF8')),
    convert_to(us.resume_text, 'UTF8'),
    length(us.resume_text),
    us.resume_text,
    NOW()
  FROM inserted_users iu
  JOIN user_seed us ON us.email = iu.email
  RETURNING id
),
inserted_jobs AS (
  INSERT INTO jobs (
    user_id,
    job_posting_id,
    analysis_kind,
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
    'application',
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
      'candidateSummary', concat(iu.name, ' is an Australian candidate with relevant veterinary-sector experience for ', ip.title, '.'),
      'fitScore', us.fit_score,
      'fitLevel', us.fit_level,
      'strengths', jsonb_build_array('Australian workplace context', 'Veterinary-sector exposure', 'Clear operational responsibilities'),
      'gaps', jsonb_build_array('Confirm most recent systems, certifications, and role-specific scope during interview'),
      'risks', jsonb_build_array('Seeded demo analysis should be replaced by live LLM review for hiring decisions'),
      'recommendations', jsonb_build_array(us.recommendation),
      'suggestedKeywords', to_jsonb(ip.skills),
      'interviewQuestions', jsonb_build_array(
        'Which recent responsibilities best match this veterinary-sector role?',
        'What systems, records, tools, or compliance workflows did you use most often?'
      ),
      'requirementAssessments', jsonb_build_array(
        jsonb_build_object(
          'category', 'role_competency',
          'requirement', concat('Core responsibilities for ', ip.title),
          'importance', 'must_have',
          'status', 'met',
          'evidence', jsonb_build_array(left(us.resume_text, 220)),
          'rationale', 'The seeded resume text includes related veterinary-sector responsibilities.'
        )
      ),
      'scoreBreakdown', jsonb_build_object(
        'minimumQualifications', us.fit_score,
        'roleCompetencies', us.fit_score,
        'domainExperience', GREATEST(us.fit_score - 4, 0),
        'preferredQualifications', GREATEST(us.fit_score - 8, 0),
        'seniorityScope', us.fit_score,
        'evidenceQuality', 82
      ),
      'fairnessReview', jsonb_build_object(
        'ignoredFactors', jsonb_build_array('name', 'suburb', 'state-sensitive identity details'),
        'notes', jsonb_build_array('Seeded analysis focuses on role evidence and work history.')
      ),
      'evidence', jsonb_build_array(
        jsonb_build_object('id', 1, 'text', left(us.resume_text, 260), 'score', 0.86),
        jsonb_build_object('id', 2, 'text', ip.description, 'score', 0.8)
      )
    ),
    (SELECT llm_model FROM settings),
    (SELECT embedding_model FROM settings),
    NOW(),
    NOW()
  FROM inserted_users iu
  JOIN user_seed us ON us.email = iu.email
  JOIN posting_seed ps ON ps.seed_index = us.applied_posting_index
  JOIN inserted_postings ip ON ip.title = ps.title
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM inserted_users)::int AS users_seeded,
  (SELECT COUNT(*) FROM inserted_postings)::int AS job_postings_seeded,
  (SELECT COUNT(*) FROM inserted_resume_versions)::int AS resume_versions_seeded,
  (SELECT COUNT(*) FROM inserted_jobs)::int AS applications_seeded;
