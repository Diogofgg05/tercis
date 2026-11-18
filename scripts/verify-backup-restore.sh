#!/usr/bin/env bash
# Restore drill for the isolated PostgreSQL 16 CI database. No external
# credentials, no production access, no backups retained by GitHub artifacts.
set -euo pipefail
: "${PGDATABASE:?PGDATABASE must point to a disposable CI database}"
if [[ "$PGDATABASE" != "tercis_test" ]]; then
  echo "Refusing backup drill outside isolated tercis_test database" >&2
  exit 1
fi
archive="$(mktemp /tmp/tercis-backup-XXXXXX.sql)"
trap 'rm -f "$archive"' EXIT
restore_db="tercis_restored_ci"
createdb --template=template0 "$restore_db"
# GitHub's default client may be newer than the PostgreSQL 16 service.
# Use a plain dump and remove only PG17's unsupported session setting.
pg_dump --format=plain --clean --if-exists --no-owner --no-acl --file="$archive" "$PGDATABASE"
sed -i '/^SET transaction_timeout = 0;$/d' "$archive"
psql -X -v ON_ERROR_STOP=1 -d "$restore_db" -f "$archive" >/dev/null
tables=(
  profiles companies budgets budget_items budget_versions audit_logs
  custom_catalog_items budget_attachments quote_email_outbox
  quote_email_webhook_events
)
for table in "${tables[@]}"; do
  original="$(psql -XAt -d "$PGDATABASE" -c "SELECT count(*) FROM public.$table")"
  restored="$(psql -XAt -d "$restore_db" -c "SELECT count(*) FROM public.$table")"
  if [[ "$original" != "$restored" ]]; then
    echo "Restore mismatch for $table: original=$original restored=$restored" >&2
    exit 1
  fi
done
for table in profiles budgets budget_items; do
  count="$(psql -XAt -d "$restore_db" -c "SELECT count(*) FROM public.$table")"
  if [[ "$count" -lt 1 ]]; then
    echo "Restore drill was not meaningful: $table has no records" >&2
    exit 1
  fi
done
src="$(psql -XAt -d "$PGDATABASE" -c "
 SELECT md5(coalesce(string_agg(id::text||':'||coalesce(ref,'')||':'||version::text,',' ORDER BY id),'')) FROM public.budgets")"
dst="$(psql -XAt -d "$restore_db" -c "
 SELECT md5(coalesce(string_agg(id::text||':'||coalesce(ref,'')||':'||version::text,',' ORDER BY id),'')) FROM public.budgets")"
if [[ "$src" != "$dst" ]]; then
  echo "Restored budget identities/versions do not match" >&2
  exit 1
fi
echo "PASS: PostgreSQL CI backup can be restored, checked and queried in a fresh DB"
