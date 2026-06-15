# Agent Notes

Use this file as the working contract for AI agents and automation touching this repo.

## Read First

- Product requirements live in `docs/requirements.md`.
- System architecture and deployment decisions live in `docs/architecture.md`.
- Keep this file focused on agent workflow, repository conventions, and engineering guardrails.

## Working Rules

- Package manager: pnpm only. Do not add npm or yarn lockfiles.
- Runtime target: Docker Compose is the preferred local environment.
- Local dev URLs: Vite at `http://localhost:5173`; Docker app entrypoint at `https://localhost:8787`.
- Use Conventional Commits for committed changes.
- Prefer small, coherent commits when possible.
- Do not commit `.env`, local data directories, build output, coverage output, dependency caches, generated TLS material, or Playwright artifacts.

## Commands

Install dependencies:

```bash
pnpm install
```

Run local development:

```bash
pnpm dev
```

Run Docker stack:

```bash
pnpm docker:up
```

Stop Docker stack:

```bash
pnpm docker:down
```

Validate locally:

```bash
pnpm typecheck
pnpm test:unit
pnpm coverage
pnpm build
```

Validate in containers:

```bash
pnpm coverage:docker
pnpm e2e:docker
```

The containerized commands should be preferred when validating changes for handoff because they avoid relying on host-installed browsers or test tooling.

## Code Organization Guardrails

- Keep SQL out of TypeScript business logic. Use SQL files under `sql/`.
- Migrations live in `sql/migrations/`.
- Query files are grouped by domain:
  - `sql/jobs/`
  - `sql/job_postings/`
  - `sql/users/`
  - `sql/sessions/`
  - `sql/resume_versions/`
  - `sql/resume_chunks/`
  - `sql/analysis_cache/`
  - `sql/admin/`
- If adding or changing database behavior, update the relevant SQL file and add focused tests around the TypeScript mapping and call contract.
- The LLM extracts evidence and category assessments only; the server computes final `fitScore` and `fitLevel` deterministically from role-agnostic HR criteria. Do not add job-title keyword scoring or industry-specific scoring branches.

## Testing Expectations

- Unit tests use Vitest and live under `tests/unit/`.
- E2E tests use Playwright and live under `tests/e2e/`.
- Coverage uses V8 through `@vitest/coverage-v8`.
- Keep coverage thresholds meaningful. Do not lower thresholds to hide untested behavior.
- Mock PostgreSQL for unit tests; use Docker Compose for full app/E2E validation.
- Add E2E coverage for user-visible auth, profile, resume upload/versioning, admin, health, and application flows.
- Docker E2E should target the HTTPS Nginx proxy alias `resume-analyzer-web`, not an individual app instance.

## UI Notes

- The UI uses React with a shadcn-inspired component style and a palette based on the requested Octet colors.
- Keep operational screens dense, readable, and direct. Avoid landing-page-style hero sections for app workflows.
- Use lucide-react icons for common UI actions where appropriate.
- Ensure mobile and desktop layouts do not overlap text or controls.

## Security Notes

- PostgreSQL should stay internal to Docker Compose unless a task explicitly requires host exposure.
- App containers should stay internal to Docker Compose; publish traffic through Nginx.
- Public Docker traffic must be HTTPS only. Do not publish app containers or an HTTP Nginx listener.
- Keep local TLS material under ignored `data/tls/`; never commit generated keys or certificates.
- Keep the app using the restricted `APP_DB_USER`; do not connect the app as the Postgres superuser.
- Preserve hashed sessions and scrypt password hashing.
- Do not log secrets, bearer tokens, passwords, raw provider API keys, or full resume text unnecessarily.

## Commit Style

Use Conventional Commits:

```text
feat: add profile resume versioning
fix: hash session tokens before persistence
test: add containerized coverage command
docs: document agent workflow
```
