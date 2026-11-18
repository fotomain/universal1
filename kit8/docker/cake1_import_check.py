#!/usr/bin/env python3
"""CAKE1 (both runs) import + Post + numbers, on the local Docker Postgres, exactly as the app does it (documentation/CAKE1). Called by test_cake1.sh.
   argv: <cake1_plan_json.json> <payloads.json (the output of create_task_line_plan inputs made by the app's own calculateTaskLinePlan)>
   fresh database -> start1 + start2 + start4 -> a user -> the project -> tasks (RPC project_import_tasks, 500) -> links (500) -> lines (250), role authenticated, statement_timeout 8 s
   -> Post of every task (create_task_line_plan) -> the Monitor01 worker -> assertions on every sum."""
import json, subprocess, sys, time
C, DB, USER = 'universal1-pgtest', 'cake1import', '99999999-9999-9999-9999-999999999999'
doc, payloads = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
FAIL = []


def psql(sql, db=DB, check=True):
    p = subprocess.run(['docker', 'exec', '-i', '-e', 'PGOPTIONS=-c client_min_messages=warning', C, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-F', '|'], input=sql, capture_output=True, text=True)
    if check and p.returncode:
        raise SystemExit(p.stderr[-2000:])
    return p.stdout.strip(), p.stderr


def ok(cond, what):
    print(('   ok: ' if cond else '   FAILED: ') + what)
    if not cond:
        FAIL.append(what)


psql('drop database if exists cake1import with (force)', 'postgres')
psql('create database cake1import template supabase_stub', 'postgres')
for f in ('start1_sql_tables', 'start2_sql_code', 'start4_sql_insert_missing'):
    subprocess.run(f'docker exec -i -e PGOPTIONS="-c client_min_messages=warning" {C} psql -U postgres -d {DB} -v ON_ERROR_STOP=1 -q -f /sql/{f}.sql > /dev/null', shell=True, check=True)
pg = doc['project']['rowGUID']
# the catalogs the lines refer to (real persons, products, suppliers ...): CAKE2_CATALOG_DATA.sql next to the json, when the run has one
import os
CATALOG = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), 'CAKE2_CATALOG_DATA.sql')
has_catalog = os.path.exists(CATALOG) and any(l['rowJSON'].get('taskResourceItem') for l in doc['taskLines'])
if has_catalog:
    psql(open(CATALOG, encoding='utf-8').read())
org = json.loads(psql(f"SELECT public.organization_ensure_user('cake@acme.test', '{USER}', 'Cake', 'C')::text")[0])['organizationGUID']
# the organization of the app (Supabase) works with capacityModeBlock: a person booked above his calendar loses the rows of the line - so the test runs in that mode
psql(f"""UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{{"resourceCapacityStrongMode": "capacityModeBlock"}}' WHERE "rowGUID" = '{org}';
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('{pg}', public.pm_ltree_label('{pg}'), '{USER}', '{org}', '{{"name":"CAKE1 target","rowKind":"project"}}');""")
AS = f"""SET ROLE authenticated; select set_config('request.jwt.claims','{{"email":"cake@acme.test","sub":"{USER}","role":"authenticated"}}',false), set_config('request.jwt.claim.sub','{USER}',false); SET statement_timeout = '8s';\n"""
worst = 0.0


def run(sql):
    global worst
    t0 = time.time()
    out, err = psql(AS + sql, check=False)
    worst = max(worst, time.time() - t0)
    if 'ERROR' in err:
        raise SystemExit('ERROR: ' + err[-600:])
    return out


tasks = sorted(doc['tasks'], key=lambda t: (len(t['treePath'].split('.')), t['orderInList']))
for i in range(0, len(tasks), 500):
    run(f"select public.project_import_tasks('{pg}', $j${json.dumps([{**t, 'rowOwnerGUID': USER} for t in tasks[i:i + 500]])}$j$::jsonb);")
deps = doc['dependencies']
for i in range(0, len(deps), 500):
    run(f"""INSERT INTO public.project_task_dependencies_table ("rowGUID","rowDependsOnGUID","projectGUID","rowOwnerGUID","linkType","lagDays","rowJSON")
SELECT x."rowGUID", x."rowDependsOnGUID", x."projectGUID", '{USER}', x."linkType", x."lagDays", x."rowJSON"
FROM jsonb_to_recordset($j${json.dumps(deps[i:i + 500])}$j$::jsonb) AS x("rowGUID" uuid, "rowDependsOnGUID" uuid, "projectGUID" uuid, "linkType" text, "lagDays" numeric, "rowJSON" jsonb);""")
lines = doc['taskLines']
for i in range(0, len(lines), 250):
    run(f"""INSERT INTO public.task_line_table ("rowGUID","rowOwnerGUID","rowParentGUID","orderInList","rowJSON")
SELECT x."rowGUID", x."rowOwnerGUID", x."rowParentGUID", x."orderInList", x."rowJSON"
FROM jsonb_to_recordset($j${json.dumps(lines[i:i + 250])}$j$::jsonb) AS x("rowGUID" uuid, "rowOwnerGUID" uuid, "rowParentGUID" text, "orderInList" numeric, "rowJSON" jsonb);""")
print('== imported')
q = lambda sql: psql(sql)[0]
n_t, n_d, n_l = q('select (select count(*) from public.project_task_table), (select count(*) from public.project_task_dependencies_table), (select count(*) from public.task_line_table)').split('|')
ok((int(n_t), int(n_d), int(n_l)) == (len(doc['tasks']), len(doc['dependencies']), len(lines)), f'{n_t} tasks, {n_d} links, {n_l} lines in the database')
ok(worst < 8, f'the slowest import statement took {worst:.1f} s (limit 8 s)')
ok(q('select count(*) from public.task_line_table where "rowProjectGUID" <> \'%s\'' % pg) == '0', 'every line got its project from its task (trigger)')

if has_catalog:
    print('== the catalogs the lines book (real persons, products, partners)')
    def refs(sql):
        return q(sql)
    ok(refs('''select count(*) from public.task_line_table l where l."rowParentGUID" = 'timeGenus' and not exists (select 1 from public."personTable" p where p."rowGUID" = l."rowJSON"->>'taskResourceItem')''') == '0', 'every Time line books a person of the catalog')
    ok(refs('''select count(*) from public.task_line_table l where l."rowParentGUID" = 'timeGenus' and not exists (select 1 from public."contractTable" c where c."rowGUID" = l."rowJSON"->>'taskResourceContract' and c."rowOwnerGUID" = l."rowJSON"->>'taskResourceItem')''') == '0', 'the contract of every Time line is a contract of THAT person')
    ok(refs('''select count(*) from public.task_line_table l where l."rowParentGUID" in ('timeGenus','materialGenus','revenueGenus') and not exists (select 1 from public."resourceRoleTable" r where r."rowGUID" = l."rowJSON"->>'resourceRoleItem')''') == '0', 'every line has a role of the catalog')
    ok(refs('''select count(*) from public.task_line_table l where l."rowParentGUID" in ('materialGenus','revenueGenus') and not exists (select 1 from public."productTable" p where p."rowGUID" = l."rowJSON"->>'taskResourceItem')''') == '0', 'every Material and Deliverable line books a product of the catalog')
    ok(refs('''select count(*) from public.task_line_table l where l."rowParentGUID" in ('materialGenus','revenueGenus') and not exists (select 1 from public."contractTable" c where c."rowGUID" = l."rowJSON"->>'taskLinePartnerContract' and c."rowOwnerGUID" = l."rowJSON"->>'taskLinePartnerItem')''') == '0', 'every Material / Deliverable line has the partner and a contract of THAT partner')
    ok(refs('''select count(*) from public.task_line_table l join public."productPriceTable" pp on pp."rowOwnerGUID" = l."rowJSON"->>'taskResourceItem' and pp."rowJSON"->>'priceTypeGUID' = (case when l."rowParentGUID" = 'revenueGenus' then 'pt_wholesale' else 'pt_purchase' end) where l."rowParentGUID" in ('materialGenus','revenueGenus') and (pp."rowJSON"->>'price')::numeric <> (l."rowJSON"->>'priceTaskLine')::numeric''') == '0', 'the price of every Material / Deliverable line = the price of the product in the catalog')
    ok(refs('''select count(*) from public.task_line_table l join public."contractTable" c on c."rowGUID" = l."rowJSON"->>'taskResourceContract' where l."rowParentGUID" = 'timeGenus' and round((c."rowJSON"->>'contractSumBeforeVAT')::numeric / 168, 2) <> (l."rowJSON"->>'priceTaskLine')::numeric''') == '0', 'the price of every Time line = the hour of the contract of its person (month sum / 168 h)')

print('== Post of every task (create_task_line_plan)')
posted = rows = busy = 0
modes = set()
for i in range(0, len(payloads), 100):
    out = run(''.join(f"select public.create_task_line_plan($j${json.dumps(p)}$j$::jsonb)::text;\n" for p in payloads[i:i + 100]))
    for ln in out.splitlines():
        if ln.startswith('{') and '"lines"' in ln:
            posted += 1
            res = json.loads(ln)
            rows += res['rows']
            busy += len(res.get('busy') or [])
            modes.add(res.get('mode'))
n_owner = len({l['rowOwnerGUID'] for l in lines})
ok(posted == len(payloads) == n_owner, f'{posted} tasks posted, {rows} plan rows')
ok(modes == {'capacityModeBlock'} or not has_catalog, f'the capacity check ran in the mode of the organization: {sorted(m for m in modes if m)}')
ok(busy == 0, f'no person is over his calendar (capacityModeBlock reported {busy} busy lines) - no resource leveling is needed')
want = round(sum(l['rowJSON']['sumForBudget'] for l in lines), 2)
mv = q('select count(*), round(sum("sumForBudget"),2), round(sum("qtyTaskLine"),2) from public.task_line_plan_movements').split('|')
ok(int(mv[0]) == len(lines) and float(mv[1]) == want, f'plan movements {mv[0]} rows = {mv[1]} EUR = the lines {want}')
ok(q("select count(*) from public.task_line_table where (\"rowJSON\"->>'taskIsPosted') is distinct from 'true'") == '0', 'every line is marked posted')
for genus in ('timeGenus', 'materialGenus', 'revenueGenus'):
    w = round(sum(l['rowJSON']['sumForBudget'] for l in lines if l['rowParentGUID'] == genus), 2)
    g = q(f"select round(sum(\"sumForBudget\"),2) from public.task_line_plan_movements where \"rowJSON\"->>'taskManagementGenusLine' = '{genus}'")
    ok(float(g) == w, f'{genus}: plan {g} EUR = lines {w}')
for item in ('employeeWagesBudgetItem', 'rawMaterialsBudgetItem', 'consumablesBudgetItem', 'saleOfGoodsBudgetItem'):
    w = round(sum(l['rowJSON']['sumForBudget'] for l in lines if l['rowJSON']['budgetItemTaskLine'] == item), 2)
    g = q(f"select round(sum(\"sumForBudget\"),2) from public.task_line_plan_movements where \"rowJSON\"->>'budgetItemTaskLine' = '{item}'")
    ok(float(g) == w, f'{item}: plan {g} EUR = lines {w}')
d0, d1 = q('select min("rowPeriodDatetime")::date, max("rowPeriodDatetime")::date from public.task_line_plan_movements').split('|')
owners = {l['rowOwnerGUID'] for l in lines}
tday = lambda t: t['rowJSON']['manualStartAt'][:10]
import datetime as _dt
w0 = min(tday(t) for t in doc['tasks'] if t['rowGUID'] in owners)
w1 = max((_dt.date.fromisoformat(tday(t)) + _dt.timedelta(days=max(t['rowJSON']['durationDays'], 1) - 1)).isoformat() for t in doc['tasks'] if t['rowGUID'] in owners)
ok(d0 == w0 and d1 == w1, f'the plan days are {d0} .. {d1} (= the first and the last day of the tasks that have lines)')

print('== the register and Monitor01')
psql('call public.monitor01_process_dirty(2000, 3000)')
ok(q('select count(*) from public.monitor01_dirty') == '0', 'the Monitor01 queue is empty')
rg = q("select count(*), round(sum(\"sumForBudget\"),2) from public.project_status_movements where \"rowMovementKind\" = 'plan'").split('|')
ok(int(rg[0]) == len(lines) and float(rg[1]) == want, f'status register: {rg[0]} plan rows = {rg[1]} EUR')
# Monitor01 never sees the Revenue lines (they reach it only through customer invoices): the cost lines alone
cost_want = round(sum(l['rowJSON']['sumForBudget'] for l in lines if l['rowParentGUID'] != 'revenueGenus'), 2)
cost_qty = q('select round(sum("qtyTaskLine"),2) from public.task_line_plan_movements where "rowJSON"->>\'taskManagementGenusLine\' <> \'revenueGenus\'')
mv1 = q('select count(*), round(sum("sumForBudget"),2), round(sum("qtyPlanned"),2) from public.monitor01_view').split('|')
ok(float(mv1[1]) == cost_want and float(mv1[2]) == float(cost_qty), f'monitor01_view: {mv1[0]} rows, {mv1[1]} EUR, {mv1[2]} units (task x genus x month) = the Time + Material lines, no revenue')
ok(q('select public.monitor01_verify(NULL)') == '0', 'monitor01_verify finds no difference between the register and the view')
print('ALL OK' if not FAIL else f'{len(FAIL)} FAILED')
sys.exit(1 if FAIL else 0)
