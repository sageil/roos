# Product Requirements

## Purpose

Roos helps users compare resumes against job profiles and gives admins a structured view of job postings, candidate matches, and system status.

## User Accounts

- Users can register, log in, update profile details, upload resumes, and review their own applications and LLM analysis.
- Admins can access global user, job posting, application, candidate match, and system health views.
- Standard users must not be able to access admin APIs or admin-only UI pages.
- Users can switch between available UI themes, and the selected theme should persist locally for that browser.

## Resume Management

- Profile resume uploads are versioned append-only records.
- Uploading a new resume must never replace or overwrite an older resume version.
- Users can review resume versions from their profile.
- Users can download their own resume versions in the same file format they uploaded.
- Admins can download user resume versions from the admin users page.
- Resume uploads must prompt users to confirm name, email, phone, address, and personal link values that should be removed.
- Confirmed privacy values and the authenticated user's profile name and email must be redacted before resume text is stored, embedded, cached, indexed, or sent to an LLM.
- Persisted resume filenames must use neutral names that preserve only the file type extension.

## Job Postings And Applications

- Admins have a dedicated jobs page to create job postings, enter required skills as tags, and review postings plus candidate matches.
- Users have a dedicated jobs page to search active job postings by title, skills, responsibilities, and related meaning.
- Job search must support meaning-based role discovery with embeddings stored in PostgreSQL and queried through pgvector IVFFlat indexes.
- Admins have a dedicated users page to search users by name, email, resume filename, job history, posting skills, and stored match evidence.
- Admin user search must support meaning-based skill/profile matching with embeddings stored in PostgreSQL and queried through pgvector IVFFlat indexes.
- Admin user search must rank stronger text matches, such as profile, title, skill, and evidence matches, ahead of broad semantic matches.
- Admins can review each user's latest resume metadata, matched terms, and recent applied jobs from the users page.
- Resume analyses can be linked to `job_postings` through `jobs.job_posting_id`.
- Job postings must stay separate from application and match records.
- Users and admins can select an active posting when analyzing a resume.
- Admins can assess a stored candidate resume against a selected job posting without creating a user-visible application.
- Candidate assessments must not appear in a standard user's submitted applications unless an admin explicitly converts the assessment to an application.
- Admins must not be shown candidates already assessed for the selected posting in the candidate picker.
- Users can review their own applied jobs and expand application details from the profile page.
- Admins can view all job postings, users, applications, and candidate matches.
- Page-level entity lists must initially render 10 records and load additional records as the user scrolls.
- Paginated lists must support users, applications, job postings, selected posting applications, and admin job-posting lists.

## UI Themes

- The default theme is `Launch`.
- Additional supported themes are `Icy Blue` and `Crimson Lit`.
- Themes should be implemented through shared CSS variables so controls, cards, badges, modals, and list states stay visually consistent.
- The theme selector should be available in the header and placed before sign out for authenticated users.

## Resume Analysis

- Resume analysis chunks uploaded text, creates embeddings, stores vectors in PostgreSQL with pgvector, and ranks evidence for the LLM response.
- LLM analysis is structured for HR review: requirement assessment, score breakdown, fairness review, strengths, gaps, risks, recommendations, keywords, and interview questions.
- The LLM extracts evidence and category assessments only.
- The server computes final `fitScore` and `fitLevel` deterministically from role-agnostic HR criteria.
- Scoring must not depend on job-title keyword branches or industry-specific hardcoded roles.
- Identical normalized resume/job/model analysis inputs should reuse cached structured analysis so repeat fit scores and recommendations remain consistent.

## System Health

- Admins have a System Health page backed by `/api/admin/system-health`.
- The health page shows PostgreSQL, pgvector, provider configuration, and each app instance behind Nginx.
- Standard users must receive `403` for admin health endpoints.

## Security Requirements

- Sessions store hashed bearer tokens only.
- Passwords are hashed with scrypt.
- Do not expose secrets, bearer tokens, raw provider API keys, generated TLS material, or unredacted resume text.

## Demo Data

- Demo data must be Australian.
- The demo seed should provide at least 100 demo users.
- The demo seed should provide at least 200 job postings across varied fields including software, veterinary, veterinary technician, lab technician, accounting, office administration, and related veterinary-sector roles.
- Demo seeding should be idempotent and replace only rows owned by the demo seed.
