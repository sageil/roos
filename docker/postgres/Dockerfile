FROM pgvector/pgvector:pg17

ARG PG_TEXTSEARCH_VERSION=1.3.0

RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends ca-certificates curl unzip; \
  arch="$(dpkg --print-architecture)"; \
  curl -fsSL \
    "https://github.com/timescale/pg_textsearch/releases/download/v${PG_TEXTSEARCH_VERSION}/pg-textsearch-v${PG_TEXTSEARCH_VERSION}-pg17-${arch}.zip" \
    -o /tmp/pg_textsearch.zip; \
  unzip /tmp/pg_textsearch.zip -d /tmp/pg_textsearch; \
  apt-get install -y --no-install-recommends /tmp/pg_textsearch/*.deb; \
  rm -rf /tmp/pg_textsearch /tmp/pg_textsearch.zip /var/lib/apt/lists/*
