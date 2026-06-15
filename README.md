# Resume Analyzer

A TypeScript resume analyzer with a React front end, Node/Express API, OpenAI text analysis, and configurable OpenAI-compatible embedding models.

## Project Docs

- Product requirements: `docs/requirements.md`
- Architecture: `docs/architecture.md`
- Agent workflow notes: `AGENT.md`

## What it does

- Uploads resumes as `.pdf`, `.docx`, `.txt`, or `.md`.
- Stores each analysis job in PostgreSQL with application date, job title, and LLM recommendation.
- Supports user and admin accounts with server-side password hashing.
- Users can review their own resumes, applied jobs, LLM match analysis, evidence, and recommendations.
- Users have a dedicated login page and profile page.
- Users have a dedicated jobs page to search roles by exact text and semantic meaning before matching a resume.
- Profile resume uploads are versioned append-only records; uploading a new resume never replaces earlier versions.
- Users can download their versioned resume uploads in the same file format they uploaded.
- Resume uploads ask users to confirm personal identifiers and redact them before storage, embedding, cache lookup, or LLM analysis.
- Admins have a dedicated jobs page to create postings, enter required skills as tags, and review candidate matches.
- Admins can search users by exact profile/application text and by semantic skill meaning using pgvector IVFFlat-backed user match profiles.
- Admins can download user profile resume versions in the same file format the user uploaded.
- Admins have a system health page for PostgreSQL, pgvector, provider configuration, and each app instance behind Nginx.
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

- `sql/migrations/001_init.sql` creates the pgvector extension, tables, analysis cache, indexes, `match_resume_chunks(...)`, `match_user_match_profiles(...)`, and `match_job_posting_match_profiles(...)`.
- `sql/analysis_cache/*.sql` contains cached analysis lookup and upsert queries.
- `sql/jobs/*.sql` contains job CRUD queries.
- `sql/job_posting_match_profiles/*.sql` contains semantic role search profile refresh and matching calls.
- `sql/users/*.sql` and `sql/sessions/*.sql` contain account, role, and session queries.
- `sql/resume_versions/*.sql` contains versioned profile resume upload queries.
- `sql/resume_chunks/*.sql` contains embedding upserts and vector search calls.
- `sql/user_match_profiles/*.sql` contains semantic admin user search profile refresh and matching calls.
- Admin semantic user search stores `text-embedding-nomic-embed-text-v1.5-embedding` profiles as `vector(768)` so pgvector can use IVFFlat.
- Semantic role search stores job posting profiles as `vector(768)` for the same IVFFlat-backed search path.

Admin seeding is controlled by:

```bash
ADMIN_NAME=Resume Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeThisAdminPassword123
```

Regular registrations create `user` accounts. The seeded admin account can access `/api/admin/overview`, `/api/admin/system-health`, the admin overview, and the System Health page in the UI.

Admins can create reusable job postings from the dedicated Admin Jobs page. Each posting includes required skills as tags. Users and admins can then select a posting when analyzing a resume; the resulting candidate match is linked to that posting and visible in the admin candidate-match overview.

The System Health page probes app instances from the API container using `APP_INSTANCE_URLS`. Docker Compose sets this to the private `app-1` and `app-2` instance health endpoints by default.

Repeated analyses for the same normalized resume text, job title, job description, LLM model, and embedding model reuse the cached structured analysis. Each application still gets its own job row and evidence chunks, but the fit score and recommendation remain consistent for identical inputs.

Resume privacy redaction runs locally in the API before any extracted resume text is stored for analysis or sent to an embedding or LLM provider. The server always includes the authenticated user's profile name and email in the redaction set, and the upload UI asks users to confirm any phone numbers, address lines, and personal links that should also be removed. Persisted upload filenames are replaced with neutral names such as `resume.pdf` to avoid leaking names through metadata. The original uploaded file bytes are stored separately so authorized users and admins can download the resume in the same file format.

For OpenAI:

```bash
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-5.5
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=768
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
EMBEDDING_DIMENSIONS=768
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
pnpm test:unit
pnpm build
pnpm e2e:docker
pnpm coverage:docker
```

The Docker-backed E2E flow starts the proxied app stack, refreshes the idempotent demo seed, and runs Playwright in a test container:

```bash
pnpm e2e:docker
```

Clean E2E-created database rows while keeping the seeded admin account:

```bash
pnpm db:test:clean
```

Seed local demo data for Australian candidates and realistic job postings:

```bash
pnpm db:seed:demo
```

The demo seed is idempotent and replaces only its owned rows. It creates users for a veterinary technician, veterinarian, front desk receptionist, and accountant, plus matching active job postings. Demo user accounts share `DemoUserPassword123` unless `DEMO_USER_PASSWORD` is set.

The host does not need browser binaries installed. The local `pnpm e2e` command is still available for developer machines with Playwright browsers installed and targets `https://127.0.0.1:8787` by default. Override with `E2E_BASE_URL` when testing another host.

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
