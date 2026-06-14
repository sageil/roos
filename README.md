# Resume Analyzer

A TypeScript resume analyzer with a React front end, Node/Express API, OpenAI text analysis, and configurable OpenAI-compatible embedding models.

## What it does

- Uploads resumes as `.pdf`, `.docx`, `.txt`, or `.md`.
- Stores each analysis job in PostgreSQL with application date, job title, and LLM recommendation.
- Supports user and admin accounts with server-side password hashing.
- Users can review their own resumes, applied jobs, LLM match analysis, evidence, and recommendations.
- Users have a dedicated login page and profile page.
- Profile resume uploads are versioned append-only records; uploading a new resume never replaces earlier versions.
- Admins can review all registered users, job postings, applications, and analysis status.
- Chunks the resume, embeds the chunks, stores vectors in PostgreSQL with pgvector, and ranks the strongest evidence.
- Generates a structured analysis with fit score, strengths, gaps, risks, and prioritized recommendations.

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env` with your provider settings.

## Docker Compose

The recommended local stack runs the app and PostgreSQL with pgvector together:

```bash
docker compose up --build
```

Open the app at `http://localhost:8787`.

Compose persists:

- Jobs, analysis metadata, and resume vectors in the `postgres_data` volume.
- Registered users with scrypt password hashes in the same volume.

PostgreSQL is only exposed inside the Docker network. The app connects with the restricted `APP_DB_USER` role; the bootstrap admin password is only supplied to the database container.

When the app runs in Docker, it connects to:

```bash
APP_DB_USER=<set in .env>
APP_DB_PASSWORD=<set in .env>
DATABASE_URL=postgres://<APP_DB_USER>:<APP_DB_PASSWORD>@postgres:5432/resume_analyzer
EMBEDDING_BASE_URL=http://host.docker.internal:1234/v1
```

Keep LM Studio running on your host at `http://127.0.0.1:1234`. Docker uses `host.docker.internal` to reach it from the app container.

Stop the stack with:

```bash
docker compose down
```

Remove persisted data only when you intentionally want to reset everything:

```bash
docker compose down -v
```

For local development outside Docker, run PostgreSQL with pgvector and set:

```bash
APP_DB_USER=<set in .env>
APP_DB_PASSWORD=<set in .env>
DATABASE_URL=postgres://<APP_DB_USER>:<APP_DB_PASSWORD>@127.0.0.1:5432/resume_analyzer
```

The app creates the `vector` extension and required tables on startup.

Database SQL is kept outside the TypeScript store:

- `sql/migrations/001_init.sql` creates the pgvector extension, tables, indexes, and `match_resume_chunks(...)`.
- `sql/jobs/*.sql` contains job CRUD queries.
- `sql/users/*.sql` and `sql/sessions/*.sql` contain account, role, and session queries.
- `sql/resume_versions/*.sql` contains versioned profile resume upload queries.
- `sql/resume_chunks/*.sql` contains embedding upserts and vector search calls.

Admin seeding is controlled by:

```bash
ADMIN_NAME=Resume Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeThisAdminPassword123
```

Regular registrations create `user` accounts. The seeded admin account can access `/api/admin/overview` and the admin overview in the UI.

For OpenAI:

```bash
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-5.5
EMBEDDING_MODEL=text-embedding-3-small
```

For an OpenAI-compatible embeddings provider:

```bash
EMBEDDING_BASE_URL=http://127.0.0.1:1234/v1
EMBEDDING_API_KEY=not-needed
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5-embedding
```

If your LLM provider does not support the Responses API, use:

```bash
LLM_API_STYLE=chat
OPENAI_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-chat-model
```

## Development

```bash
pnpm dev
```

The app runs at `http://localhost:5173` and the API at `http://localhost:8787`.

## Verification

```bash
pnpm typecheck
pnpm build
pnpm e2e:docker
```

The Docker-backed E2E flow starts the app stack and runs Playwright in a test container:

```bash
pnpm e2e:docker
```

The host does not need browser binaries installed. The local `pnpm e2e` command is still available for developer machines with Playwright browsers installed and targets `http://127.0.0.1:8787` by default. Override with `E2E_BASE_URL` when testing another host.
