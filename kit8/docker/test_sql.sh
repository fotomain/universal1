#!/usr/bin/env bash
# Tests kit8/sql/start on a throwaway database of the local Postgres (docker compose up -d first):
#   1. fresh database  2. start_sql_structure.sql + start_sql_insert.sql (twice = idempotent: the same objects AND the same number of rows in every table)
#   3. delete_sql_structure.sql (must leave NOTHING of the app)  4. start_sql_structure.sql + start_sql_insert.sql again on the emptied database
# Usage: ./test_sql.sh
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqltest
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

# Everything of the schema public (and the realtime publication) in one comparable list.
inventory() {
  psqlc -d "$DB" -At <<'SQL'
select 'table '||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S','f')
union all select 'function '||p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
union all select 'type '||t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype in ('e','d','c') and not exists (select 1 from pg_class c where c.reltype=t.oid)
union all select 'trigger '||tgname||' on '||tgrelid::regclass::text from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'pg\_%'
union all select 'policy '||polname||' on '||polrelid::regclass::text from pg_policy
union all select 'publication '||pubname||' '||schemaname||'.'||tablename from pg_publication_tables
union all select 'sequence '||sequencename from pg_sequences where schemaname='public'
order by 1;
SQL
}

# the number of rows of every table of public (a second run of the seeds must not add one)
rowcounts() {
  psqlc -d "$DB" -At <<'SQL'
select c.relname||' '||(xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '')))[1]::text
  from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' order by 1;
SQL
}

echo "== fresh database $DB"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub"
inventory > /tmp/inv_empty.txt
echo "   objects in empty db: $(wc -l < /tmp/inv_empty.txt)"

echo "== start_sql_structure.sql + start_sql_insert.sql (1st run)"
psqlc -d "$DB" -f /sql/start_sql_structure.sql >/dev/null
psqlc -d "$DB" -f /sql/start_sql_insert.sql >/dev/null
inventory > /tmp/inv_started.txt
rowcounts > /tmp/rows_started.txt
echo "   rows in all tables: $(awk '{s+=$2} END {print s}' /tmp/rows_started.txt)"
echo "   objects: $(wc -l < /tmp/inv_started.txt)  tables: $(grep -c '^table ' /tmp/inv_started.txt)  functions: $(grep -c '^function ' /tmp/inv_started.txt)"

echo "== start_sql_structure.sql + start_sql_insert.sql (2nd run, must not fail or change anything)"
psqlc -d "$DB" -f /sql/start_sql_structure.sql >/dev/null
psqlc -d "$DB" -f /sql/start_sql_insert.sql >/dev/null
inventory > /tmp/inv_started2.txt
diff /tmp/inv_started.txt /tmp/inv_started2.txt
rowcounts > /tmp/rows_started2.txt
diff /tmp/rows_started.txt /tmp/rows_started2.txt
echo "   same objects, same rows"

echo "== start_sql_structure.sql alone has no seed rows in the catalogs (start_sql_insert.sql fills them)"
psqlc -d postgres -c "drop database if exists ${DB}_bare with (force)" -c "create database ${DB}_bare template supabase_stub" >/dev/null
psqlc -d "${DB}_bare" -f /sql/start_sql_structure.sql >/dev/null
bare=$(psqlc -d "${DB}_bare" -At -c "select (select count(*) from public.\"countryTable\") + (select count(*) from public.\"currencyTable\") + (select count(*) from public.\"currencyExchangeRateTable\") + (select count(*) from public.\"productTable\") + (select count(*) from public.\"resourceRoleTable\") + (select count(*) from public.\"managementGenusTable\") + (select count(*) from public.\"businessUnitTable\") + (select count(*) from public.\"managementCalendarTable\")")
psqlc -d postgres -c "drop database if exists ${DB}_bare with (force)" >/dev/null
if [ "$bare" = "0" ]; then echo "   OK: 0 rows"; else echo "   FAILED: $bare seed rows are still in the structure file"; exit 1; fi

echo "== delete_sql_structure.sql (1st run)"
psqlc -d "$DB" -f /sql/delete_sql_structure.sql >/dev/null
inventory > /tmp/inv_deleted.txt
if diff /tmp/inv_empty.txt /tmp/inv_deleted.txt; then echo "   OK: nothing of the app is left"; else echo "   LEFT OVER (lines starting with > ):"; exit 1; fi

echo "== delete_sql_structure.sql (2nd run, must not fail)"
psqlc -d "$DB" -f /sql/delete_sql_structure.sql >/dev/null
echo "   OK"

echo "== start_sql_structure.sql + start_sql_insert.sql on the emptied database"
psqlc -d "$DB" -f /sql/start_sql_structure.sql >/dev/null
psqlc -d "$DB" -f /sql/start_sql_insert.sql >/dev/null
inventory > /tmp/inv_restarted.txt
diff /tmp/inv_started.txt /tmp/inv_restarted.txt
rowcounts > /tmp/rows_restarted.txt
diff /tmp/rows_started.txt /tmp/rows_restarted.txt
echo "   same objects and rows as the first start"
echo "ALL OK"
