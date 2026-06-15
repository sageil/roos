#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sql_file="${repo_root}/sql/admin/cleanup_test_data.sql"

if [[ ! -f "${sql_file}" ]]; then
  echo "Cleanup SQL not found: ${sql_file}" >&2
  exit 1
fi

docker compose exec -T postgres \
  psql \
  -U postgres \
  -d roos \
  -v ON_ERROR_STOP=1 \
  -f - < "${sql_file}"
