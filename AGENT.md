# Agent Notes

Use this file as the working contract for AI agents and automation touching this repo.

## Project Shape

- Stack: TypeScript, React, Vite, Node/Express, PostgreSQL, pgvector, OpenAI-compatible APIs.
- Package manager: pnpm only. Do not add npm or yarn lockfiles.
- Runtime target: Docker Compose is the preferred local environment.
- App URL in Docker: `http://localhost:8787` through Nginx.
- Docker topology: `nginx` is the only public service; it load balances to `app-1` and `app-2` on the private Compose network.
- Local dev URLs: Vite at `http://localhost:5173`, API at `http://localhost:8787`.

## Core Behavior

- Users can register, log in, update profile details, upload resumes, and review their own applications and LLM analysis.
- Admins can review all users, job postings, applications, and analysis status.
- Resume profile uploads are versioned append-only records. Never replace or overwrite an older resume version.
- Resume analysis chunks uploaded text, creates embeddings, stores vectors in PostgreSQL with pgvector, and ranks evidence for the LLM response.
- Sessions store hashed bearer tokens only.
- Passwords are hashed with scrypt.

## Provider Configuration

- LM Studio embeddings are expected at host URL `http://127.0.0.1:1234`.
- Docker reaches LM Studio through `http://host.docker.internal:1234/v1`.
- Default embedding model: `text-embedding-nomic-embed-text-v1.5-embedding`.
- OpenAI-compatible local providers can use `not-needed` as the API key.
- If the LLM provider does not support the Responses API, set `LLM_API_STYLE=chat`.

## Database Rules

- PostgreSQL is the source of truth for users, sessions, jobs, resume versions, analysis metadata, and embeddings.
- pgvector is used for embedding storage and matching.
- Keep SQL out of TypeScript business logic. Use SQL files under `sql/`.
- Migrations live in `sql/migrations/`.
- Query files are grouped by domain:
  - `sql/jobs/`
  - `sql/users/`
  - `sql/sessions/`
  - `sql/resume_versions/`
  - `sql/resume_chunks/`
  - `sql/admin/`
- If adding or changing database behavior, update the relevant SQL file and add focused tests around the TypeScript mapping and call contract.

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

## Testing Expectations

- Unit tests use Vitest and live under `tests/unit/`.
- E2E tests use Playwright and live under `tests/e2e/`.
- Coverage uses V8 through `@vitest/coverage-v8`.
- Keep coverage thresholds meaningful. Do not lower thresholds to hide untested behavior.
- Mock PostgreSQL for unit tests; use Docker Compose for full app/E2E validation.
- Add E2E coverage for user-visible auth, profile, resume upload/versioning, admin, and application flows.
- Docker E2E should target the Nginx proxy alias `resume-analyzer-web`, not an individual app instance.

## UI Notes

- The UI uses React with a shadcn-inspired component style and a palette based on the requested Octet colors.
- Keep operational screens dense, readable, and direct. Avoid landing-page-style hero sections for app workflows.
- Use lucide-react icons for common UI actions where appropriate.
- Ensure mobile and desktop layouts do not overlap text or controls.

## Security Notes

- Do not commit `.env`, local data directories, build output, coverage output, or dependency caches.
- PostgreSQL should stay internal to Docker Compose unless a task explicitly requires host exposure.
- App containers should stay internal to Docker Compose; publish traffic through Nginx.
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

Prefer small, coherent commits when possible. For broad scaffold work, one `feat:` commit is acceptable.
