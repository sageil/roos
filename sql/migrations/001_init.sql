CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  job_posting_id BIGINT,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  application_date DATE NOT NULL,
  job_title TEXT NOT NULL,
  job_description TEXT,
  resume_file_name TEXT,
  character_count INTEGER,
  chunk_count INTEGER,
  llm_recommendation TEXT,
  fit_score INTEGER,
  fit_level TEXT CHECK (fit_level IN ('low', 'medium', 'high')),
  analysis_json JSONB,
  error_message TEXT,
  llm_model TEXT,
  embedding_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_postings (
  id BIGSERIAL PRIMARY KEY,
  created_by_user_id BIGINT,
  title TEXT NOT NULL CHECK (length(trim(title)) >= 2),
  description TEXT NOT NULL CHECK (length(trim(description)) >= 10),
  skills TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) >= 2),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND position('@' IN email) > 1),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

ALTER TABLE IF EXISTS jobs
  ADD COLUMN IF NOT EXISTS user_id BIGINT;

ALTER TABLE IF EXISTS jobs
  ADD COLUMN IF NOT EXISTS job_posting_id BIGINT;

ALTER TABLE IF EXISTS job_postings
  ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_user_id_fkey'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'job_postings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_postings_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE job_postings
      ADD CONSTRAINT job_postings_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'job_postings'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_job_posting_id_fkey'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_job_posting_id_fkey FOREIGN KEY (job_posting_id) REFERENCES job_postings(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS resume_chunks (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  chunk_id INTEGER NOT NULL,
  document TEXT NOT NULL,
  embedding vector NOT NULL,
  application_date DATE NOT NULL,
  job_title TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, chunk_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resume_versions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  character_count INTEGER NOT NULL,
  resume_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, version_number)
);

CREATE INDEX IF NOT EXISTS resume_chunks_job_id_idx ON resume_chunks(job_id);
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_job_posting_id_idx ON jobs(job_posting_id);
CREATE INDEX IF NOT EXISTS job_postings_status_created_at_idx ON job_postings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS resume_versions_user_id_idx ON resume_versions(user_id);

CREATE OR REPLACE FUNCTION match_resume_chunks(
  target_job_id BIGINT,
  query_embedding vector,
  match_count INTEGER
)
RETURNS TABLE (
  chunk_id INTEGER,
  document TEXT,
  score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    rc.chunk_id,
    rc.document,
    1 - (rc.embedding <=> query_embedding) AS score
  FROM resume_chunks rc
  WHERE rc.job_id = target_job_id
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count
$$;
