# Product Requirements

## Purpose

Resume Analyzer helps users compare resumes against job profiles and gives admins a structured view of job postings, candidate matches, and system status.

## User Accounts

- Users can register, log in, update profile details, upload resumes, and review their own applications and LLM analysis.
- Admins can access global user, job posting, application, candidate match, and system health views.
- Standard users must not be able to access admin APIs or admin-only UI pages.

## Resume Management

- Profile resume uploads are versioned append-only records.
- Uploading a new resume must never replace or overwrite an older resume version.
- Users can review resume versions from their profile.

## Job Postings And Applications

- Admins have a dedicated jobs page to create job postings, enter required skills as tags, and review postings plus candidate matches.
- Admins have a dedicated users page to search users by name, email, resume filename, job history, posting skills, and stored match evidence.
- Admins can review each user's latest resume metadata, matched terms, and recent applied jobs from the users page.
- Resume analyses can be linked to `job_postings` through `jobs.job_posting_id`.
- Job postings must stay separate from application and match records.
- Users and admins can select an active posting when analyzing a resume.
- Users can review their own applied jobs and expand application details from the profile page.
- Admins can view all job postings, users, applications, and candidate matches.

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
- Do not expose secrets, bearer tokens, raw provider API keys, generated TLS material, or full resume text unnecessarily.
