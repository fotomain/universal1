#!/usr/bin/env bash
# Test of the BUDGET1 sample project (documentation/BUDGET1/BUDGET1_WBS_DATA.sql: the budgeting process of the book of K.V. Shiborsh as a WBS + Gantt chart with lines)
# on a throwaway database of the local Postgres (docker compose up -d first):
#   fresh database -> start1_sql_tables.sql + start2_sql_code.sql + start4_sql_insert_missing.sql -> a user with an organization -> BUDGET1_WBS_DATA.sql (twice: idempotent)
#   -> checks (names with the page of the book, lines on every leaf, the money of the book's example, dates and links) -> Post of EVERY task (create_task_line_plan, as the app does)
# Usage: ./test_budget1.sh        (needs: python3 documentation/BUDGET1/tools/build_wbs_sql.py was run, i.e. the .sql file exists)
set -euo pipefail
cd "$(dirname "$0")"
C=universal1-pgtest
DB=sqlbudget1
FILE=../../documentation/BUDGET1/BUDGET1_WBS_DATA.sql
[ -f "$FILE" ] || { echo "missing $FILE (python3 documentation/BUDGET1/tools/build_wbs_sql.py)"; exit 1; }
psqlc() { docker exec -i -e PGOPTIONS="-c client_min_messages=notice" "$C" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "== fresh database $DB + start1 + start2 + start4"
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB template supabase_stub" >/dev/null 2>&1
for f in start1_sql_tables.sql start2_sql_code.sql start4_sql_insert_missing.sql; do
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f /sql/$f >/dev/null
done
psqlc -d "$DB" -c "insert into auth.users(id,email) values ('43cdefd5-4a25-4667-973b-337635fe52aa','budget1@example.test')" >/dev/null

echo "== BUDGET1_WBS_DATA.sql, first run (a user without an organization: the script makes it) and second run (idempotent)"
psqlc -d "$DB" < "$FILE" 2>&1 | grep "NOTICE" | sed 's/^NOTICE:  /   /'
before=$(psqlc -d "$DB" -At -c "select (select count(*) from public.project_task_table), (select count(*) from public.task_line_table), (select count(*) from public.project_task_dependencies_table), (select count(*) from public.\"businessUnitTable\" where \"rowGUID\" like 'bu_b1_%'), (select count(*) from public.\"resourceRoleTable\" where \"rowOwnerGUID\" like 'bgt%')")
psqlc -d "$DB" < "$FILE" >/dev/null 2>&1
after=$(psqlc -d "$DB" -At -c "select (select count(*) from public.project_task_table), (select count(*) from public.task_line_table), (select count(*) from public.project_task_dependencies_table), (select count(*) from public.\"businessUnitTable\" where \"rowGUID\" like 'bu_b1_%'), (select count(*) from public.\"resourceRoleTable\" where \"rowOwnerGUID\" like 'bgt%')")
if [ "$before" = "$after" ]; then echo "   ok: a second run changes nothing ($before = tasks|lines|links|units|roles)"; else echo "   FAILED: $before -> $after"; exit 1; fi

echo "== checks"
psqlc -d "$DB" <<'EOF' 2>&1 | grep -E "ok:|ERROR|FAILED" | sed 's/^NOTICE:  /   /'
DO $$
DECLARE
  p uuid := md5('BUDGET1:project')::uuid;
  n bigint; s numeric; r record;
BEGIN
  -- the tree: depth 1..5, every row has a name that ends with the page of the book (except the milestone stage)
  SELECT count(*) INTO n FROM public.project_task_table WHERE "projectGUID" = p;
  IF n < 400 THEN RAISE EXCEPTION 'FAILED: only % rows of the WBS', n; END IF;
  RAISE NOTICE 'ok: % rows of the WBS', n;
  SELECT count(*) INTO n FROM public.project_task_table WHERE "projectGUID" = p AND "rowJSON"->>'wbsCode' NOT LIKE 'MS%' AND "rowJSON"->>'taskDescription' !~ ' \(\d+\)$';
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % rows without the page of the book in brackets at the end of the name', n; END IF;
  RAISE NOTICE 'ok: every stage / sub-stage / task name ends with the page of the book in brackets';
  SELECT max(nlevel("treePath") - 1) INTO n FROM public.project_task_table WHERE "projectGUID" = p;
  RAISE NOTICE 'ok: the WBS is % levels deep', n;
  -- rule 1 + the lines: every leaf task has at least one line, a stage has none
  SELECT count(*) INTO n FROM public.project_task_table t WHERE t."projectGUID" = p AND t."rowJSON"->>'rowKind' = 'task' AND NOT EXISTS (SELECT 1 FROM public.task_line_table l WHERE l."rowOwnerGUID" = t."rowGUID");
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % tasks without a line', n; END IF;
  SELECT count(*) INTO n FROM public.task_line_table l JOIN public.project_task_table t ON t."rowGUID" = l."rowOwnerGUID" WHERE l."rowProjectGUID" = p AND t."rowJSON"->>'rowKind' <> 'task';
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % lines on a stage / milestone', n; END IF;
  RAISE NOTICE 'ok: every task has lines, no stage has a line';
  SELECT count(*) INTO n FROM public.task_line_table l WHERE l."rowProjectGUID" = p AND (COALESCE(l."rowJSON"->>'budgetItemTaskLine','') = '' OR COALESCE(l."rowJSON"->>'resourceRoleItem','') = '' OR COALESCE(l."rowJSON"->>'businessUnitTaskLine','') = '');
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % lines without budget item / role / business unit', n; END IF;
  SELECT count(*) INTO n FROM public.task_line_table l WHERE l."rowProjectGUID" = p AND NOT EXISTS (SELECT 1 FROM public."resourceRoleTable" x WHERE x."rowGUID" = l."rowJSON"->>'resourceRoleItem');
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % lines with an unknown role', n; END IF;
  RAISE NOTICE 'ok: every line has a role, a budget item and a business unit (all of them exist)';
  -- the genus of the role = the genus of the line; the genus of the budget item = the genus of the line
  SELECT count(*) INTO n FROM public.task_line_table l JOIN public."resourceRoleTable" x ON x."rowGUID" = l."rowJSON"->>'resourceRoleItem' JOIN public."resourceRoleTypeTable" rt ON rt."rowGUID" = x."rowOwnerGUID"
   WHERE l."rowProjectGUID" = p AND rt."rowJSON"->>'managementGenus' <> l."rowParentGUID";
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % lines whose role belongs to another genus', n; END IF;
  SELECT count(*) INTO n FROM public.task_line_table l JOIN public."budgetItemTable" b ON b."rowGUID" = l."rowJSON"->>'budgetItemTaskLine'
   WHERE l."rowProjectGUID" = p AND b."rowJSON"->>'managementGenusItem' <> l."rowParentGUID";
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % lines whose budget item belongs to another genus', n; END IF;
  RAISE NOTICE 'ok: the genus of the role and of the budget item equals the genus of the line';
  -- the money of the book's example (RUB = 1000 x the thousand rubles of the book)
  FOR r IN SELECT * FROM (VALUES ('3.2.5', 691000), ('3.6.4', 173000), ('3.5.1', 213200), ('3.8.1', 208000), ('3.9.3', 38000), ('3.10.2', 57000), ('3.10.3', 13000)) v(code, thousand) LOOP
    SELECT COALESCE(sum((l."rowJSON"->>'sumForBudget')::numeric), 0) INTO s FROM public.task_line_table l JOIN public.project_task_table t ON t."rowGUID" = l."rowOwnerGUID"
     WHERE l."rowProjectGUID" = p AND t."rowJSON"->>'wbsCode' = r.code AND l."rowJSON"->>'description' LIKE '%тыс. руб.%';
    IF s <> r.thousand * 1000 THEN RAISE EXCEPTION 'FAILED: task % holds % RUB, the book says % thousand', r.code, s, r.thousand; END IF;
  END LOOP;
  SELECT COALESCE(sum((l."rowJSON"->>'sumForBudget')::numeric), 0) INTO s FROM public.task_line_table l JOIN public.project_task_table t ON t."rowGUID" = l."rowOwnerGUID"
   WHERE l."rowProjectGUID" = p AND t."rowJSON"->>'wbsCode' IN ('3.13.2','3.13.3','3.13.4','3.13.5') AND l."rowJSON"->>'description' LIKE '%тыс. руб.%';
  IF s <> 140000000 THEN RAISE EXCEPTION 'FAILED: the investment projects hold % RUB, the book (Table 19, income of the period) says 140 000 thousand', s; END IF;
  RAISE NOTICE 'ok: Tables 2, 5, 6, 9, 11, 12, 17 (taxes), 19 of the book = the money lines (691 000 / 213 200 / 173 000 / 208 000 / 38 000 / 57 000 / 13 000 / 140 000 thousand)';
  -- dates: a child lies inside its parent, a task starts before it ends, every link ends before the start of its task
  SELECT count(*) INTO n FROM public.project_task_table c JOIN public.project_task_table pr ON pr."treePath" = subpath(c."treePath", 0, nlevel(c."treePath") - 1)
   WHERE c."projectGUID" = p AND ((c."rowJSON"->>'startAt')::timestamptz < (pr."rowJSON"->>'startAt')::timestamptz OR c."rowDuration" > pr."rowDuration");
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % rows outside the dates of their parent', n; END IF;
  SELECT count(*) INTO n FROM public.project_task_table WHERE "projectGUID" = p AND "rowDuration" < (("rowJSON"->>'startAt')::timestamptz);
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % rows that end before they start', n; END IF;
  SELECT count(*) INTO n FROM public.project_task_dependencies_table d JOIN public.project_task_table a ON a."rowGUID" = d."rowDependsOnGUID" JOIN public.project_task_table b ON b."rowGUID" = d."rowGUID"
   WHERE d."projectGUID" = p AND a."rowDuration" > (b."rowJSON"->>'startAt')::timestamptz;
  IF n > 0 THEN RAISE EXCEPTION 'FAILED: % links that end after the start of their task', n; END IF;
  SELECT count(*) INTO n FROM public.project_task_dependencies_table WHERE "projectGUID" = p;
  RAISE NOTICE 'ok: the Gantt chart is consistent (% links, children inside parents, every link finish-to-start)', n;
  -- business units: cost lines on a cost-accepting unit, revenue lines on a revenue-accepting unit (also checked by Post below)
  SELECT count(*) INTO n FROM public."businessUnitTable" WHERE "rowGUID" LIKE 'bu_b1_%';
  RAISE NOTICE 'ok: % business units of the organisation of the book', n;
END $$;
EOF

echo "== Post of EVERY task (create_task_line_plan, uniform distribution over the working days of the task)"
psqlc -d "$DB" <<'EOF' 2>&1 | grep -E "ok:|ERROR|FAILED|POST FAILED" | sed 's/^NOTICE:  /   /'
DO $$
DECLARE
  v_project uuid := md5('BUDGET1:project')::uuid;
  v_owner uuid; t record; l record; v_days jsonb; v_lines jsonb; n int; v_posted int := 0; v_rows bigint := 0; res jsonb; v_sum numeric; v_plan numeric;
BEGIN
  SELECT "rowOwnerGUID" INTO v_owner FROM public.project_table WHERE "rowGUID" = v_project;
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_owner::text)::text, true);
  FOR t IN SELECT pt."rowGUID" g, pt."rowJSON"->>'wbsCode' code, (pt."rowJSON"->>'startAt')::date s, pt."rowDuration"::date f
             FROM public.project_task_table pt WHERE pt."projectGUID" = v_project AND pt."rowJSON"->>'rowKind' = 'task' ORDER BY pt."orderInList" LOOP
    SELECT jsonb_agg(jsonb_build_object('d', x::date, 'c', 0)) INTO v_days FROM generate_series(t.s::timestamp, (t.f - 1)::timestamp, interval '1 day') x WHERE extract(isodow FROM x) < 6;
    n := COALESCE(jsonb_array_length(v_days), 0);
    IF n = 0 THEN v_days := jsonb_build_array(jsonb_build_object('d', t.s, 'c', 1)); n := 1; END IF;
    SELECT jsonb_agg(jsonb_set(e, '{c}', to_jsonb(round(1.0 / n, 10)))) INTO v_days FROM jsonb_array_elements(v_days) e;
    v_lines := '[]'::jsonb;
    FOR l IN SELECT "rowGUID" g, "rowJSON" j FROM public.task_line_table WHERE "rowOwnerGUID" = t.g ORDER BY "orderInList" LOOP
      v_lines := v_lines || jsonb_build_array(jsonb_build_object('lineGUID', l.g, 'days', v_days, 'baseOfDistribution', 1, 'qtyTaskLine', (l.j->>'qtyTaskLine')::numeric,
         'sumForBudget', (l.j->>'sumForBudget')::numeric, 'sumForContract', (l.j->>'sumForContract')::numeric, 'sumForAccounting', (l.j->>'sumForAccounting')::numeric));
    END LOOP;
    BEGIN
      res := public.create_task_line_plan(jsonb_build_object('taskGUID', t.g, 'timeZone', 'UTC', 'lines', v_lines));
      v_posted := v_posted + 1; v_rows := v_rows + (res->>'rows')::bigint;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'POST FAILED %: %', t.code, SQLERRM;
    END;
  END LOOP;
  SELECT sum(("rowJSON"->>'sumForBudget')::numeric) INTO v_sum FROM public.task_line_table WHERE "rowProjectGUID" = v_project;
  SELECT sum("sumForBudget") INTO v_plan FROM public.task_line_plan_movements WHERE "rowProjectGUID" = v_project;
  IF v_sum <> v_plan THEN RAISE EXCEPTION 'FAILED: the plan movements (%) differ from the lines (%)', v_plan, v_sum; END IF;
  RAISE NOTICE 'ok: % tasks posted (% plan rows), the plan equals the lines: % RUB', v_posted, v_rows, to_char(v_plan, 'FM999G999G999G999D00');
END $$;
EOF
echo "ALL OK"
