# Task Tracker

Started: 2026-06-16

This tracker summarizes work from the existing project documentation and gives the team a place to record progress from today onward. Items marked as done are based on the current documentation in `README.md`, `docs/architecture.md`, and `docs/requirements.md`; they should be treated as documented status until individually re-verified.

## Status Key

- `[x]` Documented as complete or already present
- `[ ]` Not complete, not verified, or still needs follow-up
- `[~]` In progress or partially complete

## Documented As Done

### Core Product

- [x] Self-hosted resume screening app exists.
- [x] Candidate accounts support registration, login, profile editing, resume uploads, and application review.
- [x] Admin accounts support global user, job posting, application, candidate match, and system health views.
- [x] Admin and standard user access paths are documented separately.
- [x] Users can switch between `Launch`, `Icy Blue`, and `Crimson Lit` UI themes.
- [x] Theme selection persists locally in the browser.

### Resume Management

- [x] Resume uploads are stored as append-only versions.
- [x] Users can review their resume versions from their profile.
- [x] Users can download their own resume versions.
- [x] Admins can download user resume versions from the admin users page.
- [x] Uploaded resume filenames are normalized to neutral names while preserving the extension.
- [x] Resume text is redacted before storage, embedding, caching, indexing, or LLM use.
- [x] Privacy redaction covers authenticated profile name and email plus user-confirmed phone, address, and personal links.

### Job Postings And Applications

- [x] Admins can create job postings with required skills as tags.
- [x] Users can search active job postings.
- [x] Job postings are stored separately from application and match records.
- [x] Resume analyses can be linked to job postings.
- [x] Users and admins can select an active posting when analyzing a resume.
- [x] Admins can assess a stored candidate resume without creating a user-visible application.
- [x] Candidate assessments are hidden from standard user application history until converted by an admin.
- [x] Admins can convert candidate assessments into applications.
- [x] Candidate picker excludes users already assessed for the selected posting.
- [x] Users can review and expand their own submitted applications.

### Search And Matching

- [x] Resume analysis uses chunking, embeddings, and pgvector-backed evidence ranking.
- [x] Job search supports semantic matching through stored job posting profiles.
- [x] Admin user search supports semantic matching through stored user match profiles.
- [x] Admin user search preserves stronger exact text relevance ahead of broad semantic matches.
- [x] PostgreSQL is the source of truth for users, sessions, jobs, job postings, resume versions, analysis metadata, and embeddings.
- [x] pgvector IVFFlat indexes are documented for semantic matching.

### Analysis And Scoring

- [x] LLM output is structured for HR assessment.
- [x] Final fit score and fit level are computed deterministically by the server.
- [x] Scoring is documented as role-agnostic and not based on hardcoded job-title branches.
- [x] Analysis cache entries are stored in PostgreSQL.
- [x] Identical normalized resume/job/model inputs reuse cached structured analysis.

### Pagination

- [x] Page-facing list endpoints support `limit` and `offset`.
- [x] React list views request 10 records per page.
- [x] Infinite scroll uses `IntersectionObserver`.
- [x] Paginated endpoints cover jobs, applications, job postings, admin users, and selected posting applications.

### System Health And Operations

- [x] Docker Compose setup is documented.
- [x] Public Docker entrypoint is `https://localhost:8787`.
- [x] Nginx terminates local TLS and load-balances to two app instances.
- [x] App containers and PostgreSQL stay internal to Docker Compose.
- [x] Public `/api/health` endpoint is documented.
- [x] Private instance health and admin system health endpoints are documented.
- [x] Admin system health covers storage, provider configuration, and app instance status.
- [x] Standard users receive `403` for admin health endpoints.

### Security

- [x] Sessions store hashed bearer tokens only.
- [x] Passwords are hashed with scrypt.
- [x] The app uses a restricted PostgreSQL application user instead of the superuser.
- [x] Documentation forbids exposing secrets, bearer tokens, raw provider API keys, generated TLS material, or unredacted resume text.

### Demo Data

- [x] Demo seeding command is documented.
- [x] Demo cleanup command is documented.
- [x] Demo seed is documented as Australian.
- [x] Demo seed is documented as idempotent and scoped to demo-owned rows.

## Needs Verification

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test:unit`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm e2e:docker`.
- [ ] Verify Docker Compose startup from a clean `.env`.
- [ ] Verify local HTTPS entrypoint and certificate flow.
- [ ] Verify LM Studio default provider setup.
- [ ] Verify OpenAI provider setup.
- [ ] Confirm demo seed creates at least 100 demo users.
- [ ] Confirm demo seed creates at least 200 job postings across the required fields.
- [ ] Confirm all admin-only APIs reject standard users.
- [ ] Confirm standard users cannot see `candidate_assessment` jobs through any user-facing path.
- [ ] Confirm resume redaction is applied before every persistence, embedding, cache, index, and LLM boundary.
- [ ] Confirm semantic search relevance ordering for admin user search.
- [ ] Confirm semantic job search pagination stays stable across pages.

## Starting Backlog

- [ ] Decide whether this tracker should remain documentation-only or become the source of truth for release work.
- [ ] Add owner and target date columns if multiple people will update this file.
- [ ] Add a `Last verified` date to major areas after each test pass or manual review.
- [ ] Link requirements to tests where coverage exists.
- [ ] Add missing tests for any requirement without coverage.
- [ ] Keep this tracker updated when `docs/requirements.md` or `docs/architecture.md` changes.

## Daily Log

### 2026-06-16

- Created this tracker from the existing README, architecture notes, and product requirements.
- Initial status reflects documented behavior, not a fresh end-to-end verification pass.
