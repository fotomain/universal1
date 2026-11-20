#!/usr/bin/env python3
"""BIM4 Sixty5 cost + time plan (documentation/BIM4_SIXTY5) through the real schema on the local Docker Postgres. Called by test_sixty5.sh.
   fresh database -> start1 + start2 + start4 -> an organization in capacityModeBlock -> the project with the 1658 rows of the BIM import (same ids as the real project)
   -> 01_catalog 02_calendar 03_project_tasks 04_lines_* 05_post_* exactly as generated (role postgres, like the Supabase Management API) -> assertions on every sum.
   argv: <outdir of build_sixty5_plan.py>"""
import json, os, subprocess, sys, time, glob, re
C, DB, USER = 'universal1-pgtest', 'sixty5', '99999999-9999-9999-9999-999999999999'
OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
DOC = os.path.join(HERE, '..', '..', 'documentation', 'BIM4_SIXTY5')
tree = json.load(open(os.path.join(DOC, 'sixty5_tree.json'), encoding='utf8'))
PROJECT = '6c70450d-4e27-4a56-8e7f-4698e30e2ac4'
FAIL = []


def psql(sql, db=DB, check=True):
    p = subprocess.run(['docker', 'exec', '-i', '-e', 'PGOPTIONS=-c client_min_messages=warning', C, 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-At', '-F', '|'],
                       input=sql, capture_output=True, text=True)
    if check and p.returncode:
        raise SystemExit(p.stderr[-2500:])
    return p.stdout.strip(), p.stderr


def ok(cond, what):
    print(('   ok: ' if cond else '   FAILED: ') + what)
    if not cond: FAIL.append(what)


def q(sql): return psql(sql)[0]


psql('drop database if exists sixty5 with (force)', 'postgres')
psql('create database sixty5 template supabase_stub', 'postgres')
for f in ('start1_sql_tables', 'start2_sql_code', 'start4_sql_insert_missing'):
    subprocess.run(f'docker exec -i -e PGOPTIONS="-c client_min_messages=warning" {C} psql -U postgres -d {DB} -v ON_ERROR_STOP=1 -q -f /sql/{f}.sql > /dev/null', shell=True, check=True)
print('== schema installed')
org = json.loads(psql(f"SELECT public.organization_ensure_user('sixty5@acme.test', '{USER}', 'Sixty5', 'S')::text")[0])['organizationGUID']
proj = {'rowKind': 'project', 'name': 'BIM4 Sixty5', 'currencyForBudget': 'USD', 'currencyForAccounting': 'EUR', 'currencyForContract': 'GBP', 'calendarForTaskPlan': 'workingDaysCalendar',
        'skipWeekends': True, 'planDay': True, 'projectIsBIMBased': True, 'projectBusinessUnitsRequired': True, 'projectCostCenter': 'bu_team1costs', 'projectStartDate': '2026-11-20'}
psql(f"""UPDATE public."organizationTable" SET "rowJSON" = "rowJSON" || '{{"resourceCapacityStrongMode": "capacityModeBlock"}}' WHERE "rowGUID" = '{org}';
INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowJSON") VALUES ('{PROJECT}', public.pm_ltree_label('{PROJECT}'), '{USER}', '{org}', $j${json.dumps(proj)}$j$::jsonb);""")
rows = []
for t in sorted(tree, key=lambda t: (len(t['treePath'].split('.')), t['order'])):
    j = ({'rowKind': 'stage', 'taskDescription': t['desc'], 'durationDays': 0, 'startAt': '2026-11-20T00:00:00+00:00'} if t['kind'] == 'stage' else
         {'rowKind': 'task', 'taskDescription': t['desc'], 'durationDays': 1, 'manualStartAt': '2026-11-20T00:00:00.000Z', 'startAt': '2026-11-20T00:00:00+00:00'})
    rows.append({'rowGUID': t['guid'], 'treePath': t['treePath'], 'projectGUID': PROJECT, 'rowOwnerGUID': USER, 'rowDuration': '2026-11-21 00:00:00+00', 'rowProgress': 0, 'orderInList': 1024, 'rowJSON': j})
for i in range(0, len(rows), 500):
    psql(f"select public.project_import_tasks('{PROJECT}', $j${json.dumps(rows[i:i + 500])}$j$::jsonb);")
ok(q('select count(*) from public.project_task_table') == str(len(tree)), f'{len(tree)} rows of the BIM import (19 stages + 1639 tasks) are in the project')


def run_file(path):
    t0 = time.time()
    out, err = psql(open(path, encoding='utf8').read(), check=False)
    if 'ERROR' in err: raise SystemExit('ERROR in %s: %s' % (os.path.basename(path), err[-1500:]))
    return out, time.time() - t0


print('== the SQL files, in order')
for f in ('01_catalog.sql', '02_calendar.sql', '03_project_tasks.sql'):
    _, dt = run_file(os.path.join(OUT, f))
    print('   %s %.1f s' % (f, dt))
worst = 0.0
for f in sorted(glob.glob(os.path.join(OUT, '04_lines_*.sql'))):
    _, dt = run_file(f); worst = max(worst, dt)
n_lines = int(q('select count(*) from public.task_line_table'))
ok(n_lines == json.load(open(os.path.join(OUT, 'manifest.json')))['nlines'], f'{n_lines} task lines inserted (slowest file {worst:.1f} s)')
ok(q('select count(*) from public.task_line_table where "rowProjectGUID" <> \'%s\'' % PROJECT) == '0', 'every line got its project from its task (trigger)')

print('== the catalog the lines book')
def zero(sql, what): ok(q(sql) == '0', what)
zero('''select count(*) from public.task_line_table l where l."rowParentGUID" = 'timeGenus' and not exists (select 1 from public."personTable" p where p."rowGUID" = l."rowJSON"->>'taskResourceItem')''', 'every Time line books a person of the catalog')
zero('''select count(*) from public.task_line_table l where not exists (select 1 from public."resourceRoleTable" r where r."rowGUID" = l."rowJSON"->>'resourceRoleItem')''', 'every line has a role of the catalog')
zero('''select count(*) from public.task_line_table l where l."rowParentGUID" in ('materialGenus','expenseGenus') and not exists (select 1 from public."productTable" p where p."rowGUID" = l."rowJSON"->>'taskResourceItem')''', 'every Material / Expense line books a product of the catalog')
zero('''select count(*) from public.task_line_table l where l."rowParentGUID" in ('materialGenus','expenseGenus') and not exists (select 1 from public."contractTable" c where c."rowGUID" = l."rowJSON"->>'taskLinePartnerContract' and c."rowOwnerGUID" = l."rowJSON"->>'taskLinePartnerItem')''', 'every Material / Expense line has a partner and a contract of THAT partner')
zero('''select count(*) from public.task_line_table l join public."productPriceTable" pp on pp."rowOwnerGUID" = l."rowJSON"->>'taskResourceItem' and pp."rowJSON"->>'priceTypeGUID' = 'pt_purchase' where l."rowParentGUID" in ('materialGenus','expenseGenus') and (pp."rowJSON"->>'price')::numeric <> (l."rowJSON"->>'priceTaskLine')::numeric''', 'the price of every Material / Expense line = the purchase price of its product')
zero('''select count(*) from public.task_line_table l join public."rolePriceTable" rp on rp."rowOwnerGUID" = l."rowJSON"->>'resourceRoleItem' where l."rowParentGUID" = 'timeGenus' and (rp."rowJSON"->>'price')::numeric <> (l."rowJSON"->>'priceTaskLine')::numeric''', 'the price of every Time line = the cost rate of its role')
zero('''select count(*) from public.task_line_table l where not exists (select 1 from public."budgetItemTable" b where b."rowGUID" = l."rowJSON"->>'budgetItemTaskLine')''', 'every line has a budget item of the catalog')
zero('''select count(*) from public.task_line_table l where round((l."rowJSON"->>'qtyTaskLine')::numeric * (l."rowJSON"->>'priceTaskLine')::numeric, 2) <> (l."rowJSON"->>'sumForBudget')::numeric''', 'sum = qty x price on every line')
zero('''select count(*) from (select "rowOwnerGUID" from public.task_line_table where "rowParentGUID" = 'timeGenus' and "rowJSON"->>'raciItem' = 'raciAccountableGUID' group by 1 having count(*) > 1) x''', 'at most one Accountable per task')

print('== the dates')
pr = json.loads(q("select \"rowJSON\"::text from public.project_table where \"rowGUID\" = '%s'" % PROJECT))
ok(pr['currencyForBudget'] == pr['currencyForAccounting'] == pr['currencyForContract'] == 'EUR', 'the project works in EUR')
ok(q("select count(*) from public.project_task_table where \"rowJSON\"->>'rowKind' = 'task' and (\"rowJSON\"->>'durationDays')::int > 0 and \"rowDuration\"::date > (\"rowJSON\"->>'startAt')::date") == '1639', 'every task has a start, a duration and a finish')
ok(q("select count(*) from public.project_task_table where \"rowJSON\"->>'rowKind' = 'stage' and \"rowDuration\"::date > (\"rowJSON\"->>'startAt')::date") == '19', 'every stage spans its tasks')

print('== Post of every task (create_task_line_plan) with capacityModeBlock')
posted = rows_ = busy = 0
modes = set()
worst = 0.0
for f in sorted(glob.glob(os.path.join(OUT, '05_post_*.sql'))):
    out, dt = run_file(f); worst = max(worst, dt)
    for ln in out.splitlines():
        parts = ln.split('|')
        if len(parts) == 4:
            posted += 1; rows_ += int(parts[2]); busy += len(json.loads(parts[3]))
ok(posted == 1639, f'{posted} tasks posted, {rows_} plan rows (slowest file {worst:.1f} s)')
ok(busy == 0, f'no person is over his calendar (capacityModeBlock reported {busy} busy lines)')
want = float(q('select round(sum(("rowJSON"->>\'sumForBudget\')::numeric), 2) from public.task_line_table'))
mv = q('select count(*), round(sum("sumForBudget"), 2) from public.task_line_plan_movements').split('|')
ok(float(mv[1]) == want, f'plan movements {mv[0]} rows = {mv[1]} EUR = the lines {want}')
ok(q("select count(*) from public.task_line_table where (\"rowJSON\"->>'taskIsPosted') is distinct from 'true'") == '0', 'every line is marked posted (none lost to the capacity check)')
for genus in ('timeGenus', 'materialGenus', 'expenseGenus'):
    w = q(f"select round(sum((\"rowJSON\"->>'sumForBudget')::numeric), 2) from public.task_line_table where \"rowParentGUID\" = '{genus}'")
    g = q(f"select round(sum(\"sumForBudget\"), 2) from public.task_line_plan_movements where \"rowJSON\"->>'taskManagementGenusLine' = '{genus}'")
    ok(w == g, f'{genus}: plan {g} EUR = lines {w}')
mx = q('''select max(h) from (select sum(m."qtyTaskLine") h from public.task_line_plan_movements m join public.task_line_table l on l."rowGUID" = m."rowParentGUID"
            where l."rowParentGUID" = 'timeGenus' group by l."rowJSON"->>'taskResourceItem', m."periodDay") x''')
ok(float(mx) <= 8.0, f'the busiest person-day has {mx} h (calendar 8 h)')
d0, d1 = q('select min("periodDay"), max("periodDay") from public.task_line_plan_movements').split('|')
pj = json.loads(q("select \"rowJSON\"::text from public.project_table where \"rowGUID\" = '%s'" % PROJECT))
print('   plan days %s .. %s, project %s .. %s' % (d0, d1, pj['projectStartDate'], pj['projectFinishDate']))
ok(d1 <= pj['projectFinishDate'] and d0 >= pj['projectStartDate'], 'every posted day lies inside the project dates')
print('== Monitor01')
psql('call public.monitor01_process_dirty(2000, 3000)')
ok(q('select count(*) from public.monitor01_dirty') == '0', 'the Monitor01 queue is empty')
rg = q("select count(*), round(sum(\"sumForBudget\"), 2) from public.project_status_movements where \"rowMovementKind\" = 'plan'").split('|')
ok(float(rg[1]) == want, f'status register: {rg[0]} plan rows = {rg[1]} EUR')
print('\nALL OK' if not FAIL else '\nFAILED: %d' % len(FAIL))
sys.exit(1 if FAIL else 0)
