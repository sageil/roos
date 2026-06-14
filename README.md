# Resume Analyzer

A TypeScript resume analyzer with a React front end, Node/Express API, OpenAI text analysis, and configurable OpenAI-compatible embedding models.

## What it does

- Uploads resumes as `.pdf`, `.docx`, `.txt`, or `.md`.
- Stores each analysis job in PostgreSQL with application date, job title, and LLM recommendation.
- Supports user and admin accounts with server-side password hashing.
- Users can review their own resumes, applied jobs, LLM match analysis, evidence, and recommendations.
- Users have a dedicated login page and profile page.
- Profile resume uploads are versioned append-only records; uploading a new resume never replaces earlier versions.
- Admins have a dedicated jobs page to create postings, enter required skills as tags, and review candidate matches.
- Chunks the resume, embeds the chunks, stores vectors in PostgreSQL with pgvector, and ranks the strongest evidence.
- Generates an HR-style structured analysis with fit score, requirement assessment, score breakdown, fairness review, strengths, gaps, risks, and prioritized recommendations.

## Setup

```bash
pnpm install
cp .env.example .env
```

Edit `.env` with your provider settings.

## Docker Compose

The recommended local stack runs Nginx, two app instances, and PostgreSQL with pgvector together:

```bash
docker compose up --build
```

Open the app through the Nginx proxy at `https://localhost:8787`.

The public request path is:

```text
browser -> nginx:443/TLS -> app-1:8787 / app-2:8787 -> postgres:5432
```

Only Nginx publishes a host port, and it publishes HTTPS only. The app instances and PostgreSQL stay on the private Compose network.

Compose uses a one-shot Smallstep CLI container to generate a local development root CA and Nginx server certificate in `data/tls/`. That directory is ignored by Git.

To trust the local development certificate in your browser, install the generated root CA:

```bash
step certificate install data/tls/root_ca.crt
```

Compose persists:

- Jobs, analysis metadata, and resume vectors in the `postgres_data` volume.
- Registered users with scrypt password hashes in the same volume.

PostgreSQL is only exposed inside the Docker network. The app connects with the restricted `APP_DB_USER` role; the bootstrap admin password is only supplied to the database container.

When the app instances run in Docker, they connect to:

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

- `sql/migrations/001_init.sql` creates the pgvector extension, tables, analysis cache, indexes, and `match_resume_chunks(...)`.
- `sql/analysis_cache/*.sql` contains cached analysis lookup and upsert queries.
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

Admins can create reusable job postings from the dedicated Admin Jobs page. Each posting includes required skills as tags. Users and admins can then select a posting when analyzing a resume; the resulting candidate match is linked to that posting and visible in the admin candidate-match overview.

Repeated analyses for the same normalized resume text, job title, job description, LLM model, and embedding model reuse the cached structured analysis. Each application still gets its own job row and evidence chunks, but the fit score and recommendation remain consistent for identical inputs.

For OpenAI:

```bash
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-5.5
EMBEDDING_MODEL=text-embedding-3-small
```

For LM Studio as the LLM provider outside Docker:

```bash
OPENAI_API_KEY=not-needed
OPENAI_BASE_URL=http://127.0.0.1:1234/v1
LLM_MODEL=<your-lm-studio-chat-model>
LLM_API_STYLE=chat
```

For LM Studio as the LLM provider from Docker Compose:

```bash
OPENAI_API_KEY=not-needed
OPENAI_BASE_URL=http://host.docker.internal:1234/v1
LLM_MODEL=<your-lm-studio-chat-model>
LLM_API_STYLE=chat
```

Use `LLM_API_STYLE=chat` for LM Studio unless your local LM Studio server explicitly supports the OpenAI Responses API.

For Ollama as the LLM provider, first pull a local model:

```bash
ollama pull llama3.2
```

Then use Ollama's OpenAI-compatible API outside Docker:

```bash
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=llama3.2
LLM_API_STYLE=chat
```

From Docker Compose, point the app at the host Ollama server:

```bash
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://host.docker.internal:11434/v1
LLM_MODEL=llama3.2
LLM_API_STYLE=chat
```

Ollama ignores the API key but OpenAI-compatible clients still require one. Ollama also supports `/v1/responses` in recent versions, but `LLM_API_STYLE=chat` is the more portable default.

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

The Vite dev server runs at `http://localhost:5173` for local frontend iteration. The Docker app entrypoint runs at `https://localhost:8787`.

## Verification

```bash
pnpm typecheck
pnpm build
pnpm e2e:docker
```

The Docker-backed E2E flow starts the proxied app stack and runs Playwright in a test container:

```bash
pnpm e2e:docker
```

The host does not need browser binaries installed. The local `pnpm e2e` command is still available for developer machines with Playwright browsers installed and targets `https://127.0.0.1:8787` by default. Override with `E2E_BASE_URL` when testing another host.
