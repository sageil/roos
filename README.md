# Roos

> Roos uses AI to compare resumes with job requirements and give hiring teams a clear, evidence-based summary of each application.

Roos is a self-hosted resume screening app. Candidates can upload resume versions, apply to roles, and review their own applications. Hiring teams can create roles, compare candidates against those roles, and review structured application summaries.

Watch the demo video: [Roos demo on YouTube](https://youtu.be/OLbnwShWIG8).

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](./LICENSE)

## What Roos Does

- Compares resumes with job requirements using an AI service that supports the OpenAI API format.
- Keeps resume uploads as versions, so candidates can re-apply only after uploading a newer resume.
- Gives hiring teams clear application summaries, scores, evidence, risks, and recommendations.
- Supports candidate accounts, admin accounts, profile editing, password changes, and resume downloads.
- Runs locally with Docker Compose and PostgreSQL.

## Quick Start

The recommended setup is Docker Compose.

### 1. Copy the environment file

```bash
cp .env.example .env
```

Open `.env` and change these values before sharing the app with anyone else:

```bash
POSTGRES_ADMIN_PASSWORD=change-this-admin-password
APP_DB_PASSWORD=change-this-app-password
ADMIN_PASSWORD=ChangeThisAdminPassword123
```

### 2. Choose an AI provider

Roos needs two AI models:

- A chat model for resume summaries and recommendations.
- An embedding model for matching resumes, roles, and search results.

The default `.env.example` is set up for LM Studio running on your computer at `http://127.0.0.1:1234`.

In LM Studio, install and load both models before starting Roos:

- `google/gemma-4-e4b`
- `text-embedding-nomic-embed-text-v1.5-embedding`

For LM Studio with Docker Compose, keep:

```bash
OPENAI_API_KEY=not-needed
OPENAI_BASE_URL=http://host.docker.internal:1234/v1
LLM_MODEL=google/gemma-4-e4b
LLM_API_STYLE=chat
EMBEDDING_API_KEY=not-needed
EMBEDDING_BASE_URL=http://host.docker.internal:1234/v1
EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5-embedding
EMBEDDING_DIMENSIONS=768
```

For OpenAI, use:

```bash
OPENAI_API_KEY=sk-your-key
OPENAI_BASE_URL=
LLM_MODEL=gpt-5.5
LLM_API_STYLE=responses
EMBEDDING_API_KEY=
EMBEDDING_BASE_URL=
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=768
```

### 3. Start Roos

```bash
docker compose up --build
```

Open:

```text
https://localhost:8787
```

Your browser may warn about the local certificate. That is expected for this local setup. You can continue in the browser, or trust the generated local root certificate from `data/tls/root_ca.crt`.

### 4. Sign in as admin

Use the admin values from `.env`:

```text
Email: admin@example.com.au
Password: ChangeThisAdminPassword123
```

Change the password in `.env` before using real data.

## Common Commands

Commands that start with `pnpm` require pnpm and project dependencies:

```bash
pnpm install
```

Start the app:

```bash
docker compose up --build
```

Start in the background:

```bash
docker compose up --build -d nginx
```

Stop the app:

```bash
docker compose down
```

Stop the app and delete saved data:

```bash
docker compose down -v
```

Seed demo users, resumes, roles, and applications:

```bash
pnpm db:seed:demo
```

Reset demo and test data while keeping the admin account:

```bash
pnpm db:test:clean
```

Run checks:

```bash
pnpm typecheck
pnpm test:unit
pnpm build
```

Run browser tests in Docker:

```bash
pnpm e2e:docker
```

## Local Development

Use this path when you want to work on the code.

### Requirements

- Node.js 25 or a compatible recent Node.js version
- pnpm
- Docker Desktop or another Docker Compose runtime
- PostgreSQL with pgvector reachable from your computer

Install dependencies:

```bash
pnpm install
```

Run the app in development mode:

```bash
pnpm dev
```

Development URLs:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`
- Full Docker app: `https://localhost:8787`

When running the API directly on your computer, use local provider URLs in `.env`, for example:

```bash
OPENAI_BASE_URL=http://127.0.0.1:1234/v1
EMBEDDING_BASE_URL=http://127.0.0.1:1234/v1
DATABASE_URL=postgres://roos_app:change-this-app-password@127.0.0.1:5432/roos
```

The PostgreSQL service in `docker-compose.yml` is private to Docker and is not published on `127.0.0.1:5432`. For host-based development, run your own local PostgreSQL with pgvector, or update Compose to publish the database port for your machine.

## Configuration

Most setup is controlled by `.env`.

| Setting | What it does |
| --- | --- |
| `ADMIN_EMAIL` | Admin sign-in email created on startup. |
| `ADMIN_PASSWORD` | Admin password created or refreshed on startup. |
| `OPENAI_API_KEY` | API key for the chat model provider. |
| `OPENAI_BASE_URL` | Optional OpenAI-compatible provider URL. |
| `LLM_MODEL` | Chat model used for application summaries. |
| `LLM_API_STYLE` | Use `responses` for OpenAI Responses API or `chat` for chat-completions providers. |
| `EMBEDDING_API_KEY` | API key for the embedding provider. Leave blank to reuse `OPENAI_API_KEY`. |
| `EMBEDDING_BASE_URL` | Optional embedding provider URL. Leave blank to reuse `OPENAI_BASE_URL`. |
| `EMBEDDING_MODEL` | Model used to compare resumes, roles, and evidence. |
| `EMBEDDING_DIMENSIONS` | Vector size for the embedding model. The default is `768`. |
| `SMTP_*` | Optional email settings for meeting invites. |

### Gmail Meeting Invites

For Gmail, use an app password:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=your-account@gmail.com
EMAIL_FROM_NAME=Roos Admin
```

## Demo Data

Use demo data when you want to try Roos without creating users, resumes, and roles by hand.

### Seed demo data

Start the Docker database, then run:

```bash
pnpm db:seed:demo
```

This command creates:

- 100 demo candidate accounts
- 200 demo roles
- 100 resume versions
- 100 completed applications

Demo candidate accounts use this password unless you set `DEMO_USER_PASSWORD` first:

```text
DemoUserPassword123
```

The command resets existing demo and test data before seeding. It keeps the admin account from `.env`.

### Reset demo data

To remove demo and test data without adding new demo rows:

```bash
pnpm db:test:clean
```

This removes:

- Non-admin users
- Resume versions
- Applications and candidate assessments
- Job postings
- Sessions
- Saved analysis cache
- Search profiles

It keeps admin users, so you can still sign in with the admin account from `.env`.

To reset everything, including the database volume:

```bash
docker compose down -v
docker compose up --build
```

Use this only when you want to delete all local Roos data.

## How Data Is Stored

- PostgreSQL stores users, roles, applications, resume versions, and analysis results.
- Resume uploads are versioned. A new upload does not replace older uploads.
- Candidates cannot apply to the same role again unless they upload a newer resume version.
- Resume text is redacted before it is stored for analysis or sent to AI providers.
- Docker stores database data in the `postgres_data` volume.

## Troubleshooting

### The app opens, but analysis fails

Check that your AI provider is running and that `.env` points to it correctly.

For LM Studio with Docker Compose:

```bash
OPENAI_BASE_URL=http://host.docker.internal:1234/v1
LLM_API_STYLE=chat
EMBEDDING_BASE_URL=http://host.docker.internal:1234/v1
```

Make sure both required LM Studio models are installed and loaded:

- `google/gemma-4-e4b`
- `text-embedding-nomic-embed-text-v1.5-embedding`

### PostgreSQL is unhealthy

If you changed database passwords after creating the Docker volume, reset the local database:

```bash
docker compose down -v
docker compose up --build
```

This deletes local Roos data.

### Browser warns about HTTPS

Docker creates a local certificate in `data/tls/`. The warning is normal for local development. You can continue in the browser or install `data/tls/root_ca.crt` into your system trust store.

## Tests

Run fast checks:

```bash
pnpm typecheck
pnpm test:unit
```

Run the production build:

```bash
pnpm build
```

Run end-to-end tests in Docker:

```bash
pnpm e2e:docker
```

## Project Docs

- Product requirements: [docs/requirements.md](./docs/requirements.md)
- Architecture notes: [docs/architecture.md](./docs/architecture.md)
- Agent workflow notes: [AGENT.md](./AGENT.md)

## License

AGPL-3.0-only. See [LICENSE](./LICENSE).
