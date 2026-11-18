#!/usr/bin/env bash
# Read-only comparison after a separate operator has restored a FULL staging
# PostgreSQL backup into an independent recovery project.
# IMPORTANT: source must be QUIESCED to compare the same snapshot timestamp.
# It never performs pg_restore or mutates either database.
set -euo pipefail
: "${TERCIS_STAGING_DATABASE_URL:?Source staging database URL is required}"
: "${TERCIS_RECOVERY_STAGING_DATABASE_URL:?Independent recovery database URL is required}"
: "${TERCIS_STAGING_PROJECT_REF:?Source project ref is required}"
: "${TERCIS_RECOVERY_STAGING_PROJECT_REF:?Recovery project ref is required}"
: "${TERCIS_STAGING_CONFIRM:?Confirm the source project}"
: "${TERCIS_RECOVERY_STAGING_CONFIRM:?Confirm the recovery project}"
[[ "$TERCIS_STAGING_PROJECT_REF" =~ ^[a-z0-9]{20}$ ]]
[[ "$TERCIS_RECOVERY_STAGING_PROJECT_REF" =~ ^[a-z0-9]{20}$ ]]
[[ "$TERCIS_STAGING_PROJECT_REF" != "$TERCIS_RECOVERY_STAGING_PROJECT_REF" ]]
[[ "$TERCIS_STAGING_CONFIRM" == "$TERCIS_STAGING_PROJECT_REF" ]]
[[ "$TERCIS_RECOVERY_STAGING_CONFIRM" == "$TERCIS_RECOVERY_STAGING_PROJECT_REF" ]]
[[ "$TERCIS_STAGING_DATABASE_URL" != "$TERCIS_RECOVERY_STAGING_DATABASE_URL" ]]
# Only direct database hosts bound to the confirmed project refs are allowed.
# Do not accept custom hosts, production poolers, or lookalike hostnames.
for role in SOURCE TARGET; do
  if [[ "$role" == SOURCE ]]; then
    url="$TERCIS_STAGING_DATABASE_URL"; ref="$TERCIS_STAGING_PROJECT_REF"
  else
    url="$TERCIS_RECOVERY_STAGING_DATABASE_URL"; ref="$TERCIS_RECOVERY_STAGING_PROJECT_REF"
  fi
  expected="db.$ref.supabase.co"
  host="${url#*@}"
  host="${host%%/*}"
  host="${host%%:*}"
  [[ "$url" == postgres://* || "$url" == postgresql://* ]] || {
    echo "RESTORE AUDIT REFUSED: PostgreSQL connection URL is required" >&2
    exit 1
  }
  [[ "$host" == "$expected" ]] || {
    echo "RESTORE AUDIT REFUSED: database host does not match confirmed staging ref" >&2
    exit 1
  }
done
export PGCONNECT_TIMEOUT=10
export PGSSLMODE=require
source_url="$TERCIS_STAGING_DATABASE_URL"
dest_url="$TERCIS_RECOVERY_STAGING_DATABASE_URL"
query() { psql -X -q -v ON_ERROR_STOP=1 -At --dbname="$1" --command="$2"; }
# Never print connection strings or table contents.
for url in "$source_url" "$dest_url"; do
  test "$(query "$url" "SELECT current_setting('server_version_num')::integer >= 160000")" = "t"
done
list="SELECT schemaname||'.'||tablename FROM pg_tables WHERE schemaname IN ('public','auth','storage') ORDER BY 1;"
src_tables="$(query "$source_url" "$list")"
dst_tables="$(query "$dest_url" "$list")"
[[ -n "$src_tables" && "$src_tables" == "$dst_tables" ]] || {
  echo "RESTORE FAILED: missing or extra application/Auth/Storage tables" >&2
  exit 1
}
count=0
while IFS= read -r table; do
  [[ "$table" =~ ^(public|auth|storage)\.[a-zA-Z0-9_]+$ ]] || exit 1
  schema="${table%%.*}"
  table_name="${table#*.}"
  # Sorted row JSON digests make results order independent. No personal data
  # leaves the database: only count and a single MD5 checksum are printed.
  sql="SELECT count(*)||'|'||md5(coalesce(string_agg(md5(to_jsonb(t)::text),'|' ORDER BY md5(to_jsonb(t)::text)),'')) FROM \"$schema\".\"$table_name\" t;"
  src="$(query "$source_url" "$sql")"
  dst="$(query "$dest_url" "$sql")"
  if [[ "$src" != "$dst" ]]; then
    echo "RESTORE FAILED: table content mismatch for $table" >&2
    exit 1
  fi
  count=$((count+1))
done <<< "$src_tables"
[[ "$count" -ge 20 ]] || { echo "RESTORE FAILED: unexpectedly few schema tables" >&2; exit 1; }
# Compare RLS policies, so recovery isn't silently exposing data.
policies="SELECT md5(coalesce(string_agg(row_to_json(p)::text,'|' ORDER BY p.schemaname,p.tablename,p.policyname),''))
 FROM pg_policies p WHERE p.schemaname IN ('public','auth','storage');"
[[ "$(query "$source_url" "$policies")" == "$(query "$dest_url" "$policies")" ]] || {
  echo "RESTORE FAILED: RLS policy mismatch" >&2
  exit 1
}
echo "STAGING POSTGRES RESTORE AUDIT PASS: $count restored tables and RLS policies match"
echo "This compares CURRENT data and policies; operator must verify matching backup point, credentials and PITR separately."
