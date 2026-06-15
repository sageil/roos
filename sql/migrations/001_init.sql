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

CREATE TABLE IF NOT EXISTS analysis_cache (
  cache_key TEXT PRIMARY KEY,
  resume_hash TEXT NOT NULL,
  job_profile_hash TEXT NOT NULL,
  llm_model TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  analysis_json JSONB NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_match_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_text TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_match_profiles
  ALTER COLUMN embedding TYPE vector(768)
  USING embedding::vector(768);

CREATE TABLE IF NOT EXISTS job_posting_match_profiles (
  job_posting_id BIGINT PRIMARY KEY REFERENCES job_postings(id) ON DELETE CASCADE,
  profile_text TEXT NOT NULL,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE job_posting_match_profiles
  ALTER COLUMN embedding TYPE vector(768)
  USING embedding::vector(768);

CREATE INDEX IF NOT EXISTS resume_chunks_job_id_idx ON resume_chunks(job_id);
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_job_posting_id_idx ON jobs(job_posting_id);
CREATE INDEX IF NOT EXISTS job_postings_status_created_at_idx ON job_postings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS resume_versions_user_id_idx ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS analysis_cache_models_idx ON analysis_cache(llm_model, embedding_model);
CREATE INDEX IF NOT EXISTS user_match_profiles_embedding_model_idx ON user_match_profiles(embedding_model);
CREATE INDEX IF NOT EXISTS user_match_profiles_embedding_ivfflat_idx
  ON user_match_profiles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS job_posting_match_profiles_embedding_model_idx ON job_posting_match_profiles(embedding_model);
CREATE INDEX IF NOT EXISTS job_posting_match_profiles_embedding_ivfflat_idx
  ON job_posting_match_profiles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

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

CREATE OR REPLACE FUNCTION match_user_match_profiles(
  query_embedding vector(768),
  target_embedding_model TEXT,
  match_count INTEGER
)
RETURNS TABLE (
  user_id BIGINT,
  score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ump.user_id,
    1 - (ump.embedding <=> query_embedding) AS score
  FROM user_match_profiles ump
  WHERE ump.embedding_model = target_embedding_model
  ORDER BY ump.embedding <=> query_embedding
  LIMIT match_count
$$;

CREATE OR REPLACE FUNCTION match_job_posting_match_profiles(
  query_embedding vector(768),
  target_embedding_model TEXT,
  match_count INTEGER
)
RETURNS TABLE (
  job_posting_id BIGINT,
  score DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    jpmp.job_posting_id,
    1 - (jpmp.embedding <=> query_embedding) AS score
  FROM job_posting_match_profiles jpmp
  WHERE jpmp.embedding_model = target_embedding_model
  ORDER BY jpmp.embedding <=> query_embedding
  LIMIT match_count
$$;
