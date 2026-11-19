#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
test_dir=$(mktemp -d)
db_role="wm_test_worker"
cleanup() {
  pg_ctl -D "$test_dir/db" -m immediate stop >/dev/null 2>&1 || true
  chmod -R u+w "$test_dir"
  find "$test_dir" -depth -delete
}
trap cleanup EXIT
export PGHOST="$test_dir" PGPORT=54687 PGDATABASE=postgres
export PGUSER="$(id -un)"
unset PGSERVICE PGSERVICEFILE
initdb -D "$test_dir/db" -A trust --no-locale >/dev/null
pg_ctl -D "$test_dir/db" -l "$test_dir/postgres.log"   -o "-c listen_addresses='' -k $test_dir -p $PGPORT" -w start >/dev/null
psql -Xq -v ON_ERROR_STOP=1 <<'SQL'
create role anon;
create role authenticated;
create role service_role;
SQL
psql -Xq -v ON_ERROR_STOP=1 -f supabase/migrations/20261119041000_website_machine_acquisition_queue.sql
psql -Xq -v ON_ERROR_STOP=1 -f supabase/migrations/20261119042000_website_machine_cloud_batch.sql
psql -Xq -v ON_ERROR_STOP=1 <<'SQL'
create role wm_test_worker login in role wm_preview_worker;
insert into wm_acquisition.preview_batch_input
    (batch_id, company_number, territory_slug, payload, approved_until)
values ('00000000-0000-4000-8000-000000000001', '00123456', 'cambridge-electricians',
        '{"businessName":"Example Electrical","industry":"Electrician","location":"Cambridge","verifiedInfo":"Residential electrical work","verifiedServices":"Lighting installation","verifiedEmail":"hello@example.invalid"}',
        now() + interval '1 hour'),
       ('00000000-0000-4000-8000-000000000002', '00123456', 'cambridge-electricians',
        '{"businessName":"Duplicate fixture","industry":"Electrician","location":"Cambridge","verifiedInfo":"Residential electrical work"}',
        now() + interval '1 hour'),
       ('00000000-0000-4000-8000-000000000003', '00123457', 'cambridge-electricians',
        '{}', now() - interval '1 hour');
SQL
export PGUSER="$db_role"
run=(node campaigns/cloud/batch.mjs --batch)
first=00000000-0000-4000-8000-000000000001
second=00000000-0000-4000-8000-000000000002
expired=00000000-0000-4000-8000-000000000003
"${run[@]}" "$first" --dry-run
[[ $(psql -XqAtc 'select count(*) from wm_acquisition.preview_generation') == 0 ]]
"${run[@]}" "$first" --write-results --out "$test_dir/output"
[[ -f "$test_dir/output/00123456/index.html" ]]
[[ $(psql -XqAtc 'select state from wm_acquisition.preview_generation') == rendered ]]
if "${run[@]}" "$second" --dry-run || "${run[@]}" "$expired" --dry-run; then
  echo "Unexpectedly accepted a duplicate or expired batch" >&2
  exit 1
fi
echo "Passed read-only dry run, recorded generation, cross-batch deduplication and approval expiry."
