#!/usr/bin/env bash
# Builds a database from prisma/migrations, in order, exactly as production was: the same SQL,
# one file at a time, stopping at the first error. Used by CI and the local check, never by the
# server (production migrations are applied by hand in the Neon SQL editor, see the runbook).
#
#   scripts/apply-migrations.sh "$DATABASE_URL"
set -euo pipefail
url=${1:?database url}
dir=$(cd "$(dirname "$0")/../prisma/migrations" && pwd)
for migration in $(ls "$dir" | grep -E '^[0-9]{4}_' | sort); do
  psql "$url" -q -v ON_ERROR_STOP=1 -f "$dir/$migration/migration.sql" >/dev/null
  echo "applied $migration"
done
