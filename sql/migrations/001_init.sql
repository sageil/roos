CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_textsearch;

CREATE OR REPLACE FUNCTION immutable_text_array_to_string(items TEXT[], delimiter TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT array_to_string(items, delimiter)
$$;

CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  job_posting_id BIGINT,
  analysis_kind TEXT NOT NULL DEFAULT 'application' CHECK (analysis_kind IN ('application', 'candidate_assessment')),
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

ALTER TABLE IF EXISTS jobs
  ADD COLUMN IF NOT EXISTS analysis_kind TEXT NOT NULL DEFAULT 'application';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_analysis_kind_check'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_analysis_kind_check CHECK (analysis_kind IN ('application', 'candidate_assessment'));
  END IF;
END $$;

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
  file_size INTEGER NOT NULL DEFAULT 0,
  file_bytes BYTEA NOT NULL DEFAULT ''::bytea,
  character_count INTEGER NOT NULL,
  resume_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, version_number)
);

ALTER TABLE resume_versions
  ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS file_bytes BYTEA NOT NULL DEFAULT ''::bytea;

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

DO $$
BEGIN
  IF to_regclass('app_setings') IS NOT NULL
    AND to_regclass('app_settings') IS NULL
  THEN
    ALTER TABLE app_setings RENAME TO app_settings;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_setings_embedding_dimensions_range_check'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_embedding_dimensions_range_check'
  ) THEN
    ALTER TABLE app_settings
      RENAME CONSTRAINT app_setings_embedding_dimensions_range_check
      TO app_settings_embedding_dimensions_range_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_setings_smtp_port_range_check'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_smtp_port_range_check'
  ) THEN
    ALTER TABLE app_settings
      RENAME CONSTRAINT app_setings_smtp_port_range_check
      TO app_settings_smtp_port_range_check;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  openai_api_key TEXT,
  openai_base_url TEXT,
  llm_model TEXT,
  llm_api_style TEXT CHECK (llm_api_style IS NULL OR llm_api_style IN ('responses', 'chat')),
  embedding_api_key TEXT,
  embedding_base_url TEXT,
  embedding_model TEXT,
  embedding_dimensions INTEGER CHECK (embedding_dimensions IS NULL OR (embedding_dimensions > 0 AND embedding_dimensions <= 16000)),
  smtp_host TEXT,
  smtp_port INTEGER CHECK (smtp_port IS NULL OR (smtp_port > 0 AND smtp_port <= 65535)),
  smtp_secure BOOLEAN,
  smtp_user TEXT,
  smtp_pass TEXT,
  email_from TEXT,
  email_from_name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_embedding_dimensions_range_check'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_embedding_dimensions_range_check
      CHECK (embedding_dimensions IS NULL OR (embedding_dimensions > 0 AND embedding_dimensions <= 16000));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'app_settings_smtp_port_range_check'
  ) THEN
    ALTER TABLE app_settings
      ADD CONSTRAINT app_settings_smtp_port_range_check
      CHECK (smtp_port IS NULL OR (smtp_port > 0 AND smtp_port <= 65535));
  END IF;
END $$;

DO $$
DECLARE
  user_match_profiles_table regclass := to_regclass('user_match_profiles');
  job_posting_match_profiles_table regclass := to_regclass('job_posting_match_profiles');
BEGIN
  IF user_match_profiles_table IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = user_match_profiles_table
        AND attname = 'embedding'
        AND format_type(atttypid, atttypmod) = 'vector(768)'
    )
  THEN
    DROP INDEX IF EXISTS user_match_profiles_embedding_ivfflat_idx;
  END IF;

  IF job_posting_match_profiles_table IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = job_posting_match_profiles_table
        AND attname = 'embedding'
        AND format_type(atttypid, atttypmod) = 'vector(768)'
    )
  THEN
    DROP INDEX IF EXISTS job_posting_match_profiles_embedding_ivfflat_idx;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_match_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile_text TEXT NOT NULL,
  embedding vector NOT NULL,
  embedding_model TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  user_match_profiles_table regclass := to_regclass('user_match_profiles');
BEGIN
  IF user_match_profiles_table IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = user_match_profiles_table
        AND attname = 'embedding'
        AND format_type(atttypid, atttypmod) <> 'vector'
    )
  THEN
    ALTER TABLE user_match_profiles
      ALTER COLUMN embedding TYPE vector
      USING embedding::vector;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS job_posting_match_profiles (
  job_posting_id BIGINT PRIMARY KEY REFERENCES job_postings(id) ON DELETE CASCADE,
  profile_text TEXT NOT NULL,
  embedding vector NOT NULL,
  embedding_model TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  job_posting_match_profiles_table regclass := to_regclass('job_posting_match_profiles');
BEGIN
  IF job_posting_match_profiles_table IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM pg_attribute
      WHERE attrelid = job_posting_match_profiles_table
        AND attname = 'embedding'
        AND format_type(atttypid, atttypmod) <> 'vector'
    )
  THEN
    ALTER TABLE job_posting_match_profiles
      ALTER COLUMN embedding TYPE vector
      USING embedding::vector;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS resume_chunks_job_id_idx ON resume_chunks(job_id);
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_job_posting_id_idx ON jobs(job_posting_id);
CREATE INDEX IF NOT EXISTS jobs_created_at_id_idx ON jobs(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS jobs_user_application_created_at_id_idx
  ON jobs(user_id, created_at DESC, id DESC)
  WHERE analysis_kind = 'application';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'jobs_job_posting_created_at_id_idx'
      AND position(' WHERE ' in indexdef) > 0
  ) THEN
    DROP INDEX jobs_job_posting_created_at_id_idx;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS jobs_job_posting_created_at_id_idx
  ON jobs(job_posting_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS jobs_user_posting_active_idx
  ON jobs(user_id, job_posting_id)
  WHERE status <> 'failed';
CREATE INDEX IF NOT EXISTS jobs_user_posting_active_application_latest_idx
  ON jobs(user_id, job_posting_id, created_at DESC, id DESC)
  WHERE analysis_kind = 'application'
    AND status <> 'failed';
CREATE INDEX IF NOT EXISTS jobs_job_title_trgm_idx ON jobs USING gin (job_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_job_description_trgm_idx ON jobs USING gin (job_description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_llm_recommendation_trgm_idx ON jobs USING gin (llm_recommendation gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_resume_file_name_trgm_idx ON jobs USING gin (resume_file_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_analysis_json_trgm_idx ON jobs USING gin ((analysis_json::text) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS jobs_bm25_search_idx ON jobs USING bm25 ((
  repeat(COALESCE(job_title, '') || ' ', 8) ||
  repeat(COALESCE(resume_file_name, '') || ' ', 2) ||
  COALESCE(job_description, '') || ' ' ||
  COALESCE(llm_recommendation, '') || ' ' ||
  COALESCE(analysis_json::text, '')
)) WITH (text_config = 'simple');
CREATE INDEX IF NOT EXISTS job_postings_status_created_at_idx ON job_postings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS job_postings_created_at_id_idx ON job_postings(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS job_postings_title_trgm_idx ON job_postings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS job_postings_description_trgm_idx ON job_postings USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS job_postings_skills_trgm_idx ON job_postings USING gin ((immutable_text_array_to_string(skills, ' ')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS job_postings_search_tsv_idx ON job_postings USING gin ((
  setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('simple', immutable_text_array_to_string(COALESCE(skills, ARRAY[]::text[]), ' ')), 'B') ||
  setweight(to_tsvector('simple', COALESCE(description, '')), 'C')
));
CREATE INDEX IF NOT EXISTS job_postings_bm25_search_idx ON job_postings USING bm25 ((
  repeat(COALESCE(title, '') || ' ', 8) ||
  repeat(immutable_text_array_to_string(COALESCE(skills, ARRAY[]::text[]), ' ') || ' ', 4) ||
  COALESCE(description, '')
)) WITH (text_config = 'simple');
CREATE INDEX IF NOT EXISTS users_created_at_id_idx ON users(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_email_trgm_idx ON users USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS users_bm25_search_idx ON users USING bm25 ((
  repeat(COALESCE(name, '') || ' ', 5) ||
  repeat(COALESCE(email, '') || ' ', 3)
)) WITH (text_config = 'simple');
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS resume_versions_user_id_idx ON resume_versions(user_id);
CREATE INDEX IF NOT EXISTS resume_versions_user_version_desc_idx ON resume_versions(user_id, version_number DESC);
CREATE INDEX IF NOT EXISTS resume_versions_file_name_trgm_idx ON resume_versions USING gin (file_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS analysis_cache_models_idx ON analysis_cache(llm_model, embedding_model);
CREATE INDEX IF NOT EXISTS resume_chunks_embedding_model_job_id_idx ON resume_chunks(embedding_model, job_id);
CREATE INDEX IF NOT EXISTS resume_chunks_embedding_ivfflat_idx
  ON resume_chunks USING ivfflat ((embedding::vector(768)) vector_cosine_ops) WITH (lists = 100)
  WHERE vector_dims(embedding) = 768;
CREATE INDEX IF NOT EXISTS user_match_profiles_embedding_model_idx ON user_match_profiles(embedding_model);
CREATE INDEX IF NOT EXISTS user_match_profiles_embedding_ivfflat_idx
  ON user_match_profiles USING ivfflat ((embedding::vector(768)) vector_cosine_ops) WITH (lists = 100)
  WHERE vector_dims(embedding) = 768;
CREATE INDEX IF NOT EXISTS user_match_profiles_bm25_search_idx ON user_match_profiles USING bm25 (profile_text)
  WITH (text_config = 'simple');
CREATE INDEX IF NOT EXISTS job_posting_match_profiles_embedding_model_idx ON job_posting_match_profiles(embedding_model);
CREATE INDEX IF NOT EXISTS job_posting_match_profiles_embedding_ivfflat_idx
  ON job_posting_match_profiles USING ivfflat ((embedding::vector(768)) vector_cosine_ops) WITH (lists = 100)
  WHERE vector_dims(embedding) = 768;

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
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF vector_dims(query_embedding) = 768 THEN
    RETURN QUERY
    SELECT
      rc.chunk_id,
      rc.document,
      1 - (rc.embedding::vector(768) <=> query_embedding::vector(768)) AS score
    FROM resume_chunks rc
    WHERE rc.job_id = target_job_id
      AND vector_dims(rc.embedding) = 768
    ORDER BY rc.embedding::vector(768) <=> query_embedding::vector(768)
    LIMIT match_count;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    rc.chunk_id,
    rc.document,
    1 - (rc.embedding <=> query_embedding) AS score
  FROM resume_chunks rc
  WHERE rc.job_id = target_job_id
    AND vector_dims(rc.embedding) = vector_dims(query_embedding)
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_user_match_profiles(
  query_embedding vector,
  target_embedding_model TEXT,
  match_count INTEGER
)
RETURNS TABLE (
  user_id BIGINT,
  score DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF vector_dims(query_embedding) = 768 THEN
    RETURN QUERY
    SELECT
      ump.user_id,
      1 - (ump.embedding::vector(768) <=> query_embedding::vector(768)) AS score
    FROM user_match_profiles ump
    WHERE vector_dims(ump.embedding) = 768
      AND ump.embedding_model = target_embedding_model
    ORDER BY ump.embedding::vector(768) <=> query_embedding::vector(768)
    LIMIT match_count;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fallback.user_id,
    fallback.score
  FROM (
    SELECT
      ump.user_id,
      1 - (ump.embedding <=> query_embedding) AS score
    FROM user_match_profiles ump
    WHERE vector_dims(ump.embedding) = vector_dims(query_embedding)
      AND ump.embedding_model = target_embedding_model
    ORDER BY ump.embedding <=> query_embedding
    LIMIT match_count
  ) fallback
  ORDER BY fallback.score DESC
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_job_posting_match_profiles(
  query_embedding vector,
  target_embedding_model TEXT,
  match_count INTEGER
)
RETURNS TABLE (
  job_posting_id BIGINT,
  score DOUBLE PRECISION
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF vector_dims(query_embedding) = 768 THEN
    RETURN QUERY
    SELECT
      jpmp.job_posting_id,
      1 - (jpmp.embedding::vector(768) <=> query_embedding::vector(768)) AS score
    FROM job_posting_match_profiles jpmp
    WHERE vector_dims(jpmp.embedding) = 768
      AND jpmp.embedding_model = target_embedding_model
    ORDER BY jpmp.embedding::vector(768) <=> query_embedding::vector(768)
    LIMIT match_count;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    fallback.job_posting_id,
    fallback.score
  FROM (
    SELECT
      jpmp.job_posting_id,
      1 - (jpmp.embedding <=> query_embedding) AS score
    FROM job_posting_match_profiles jpmp
    WHERE vector_dims(jpmp.embedding) = vector_dims(query_embedding)
      AND jpmp.embedding_model = target_embedding_model
    ORDER BY jpmp.embedding <=> query_embedding
    LIMIT match_count
  ) fallback
  ORDER BY fallback.score DESC
  LIMIT match_count;
END;
$$;
