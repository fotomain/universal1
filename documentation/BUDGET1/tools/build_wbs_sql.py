#!/usr/bin/env python3
"""
BUDGET1 step 3: the WBS + Gantt chart of the budgeting process of the book as SQL.

Run (after extract_doc.py):   python3 documentation/BUDGET1/tools/build_wbs_sql.py
Input : the specs spec_*.py (the WBS written with wbs_kit.py), budget1_catalogs.py (business units, role types, roles, budget items), the book (bookpages.py: the page of every name)
Output: documentation/BUDGET1/BUDGET1_WBS_DATA.sql   (one DO block, idempotent; the data are JSON documents inside it)
        documentation/BUDGET1/BUDGET1_WBS_REPORT.txt (what is in it: stages, tasks, lines, totals - checked against the book)
"""
import collections
import datetime as dt
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import budget1_catalogs as cat  # noqa: E402
import wbs_kit as k             # noqa: E402
from wbs_kit import Node, S, M  # noqa: E402

OUT_DIR = HERE.parent
SQL_OUT = OUT_DIR / 'BUDGET1_WBS_DATA.sql'
REPORT = OUT_DIR / 'BUDGET1_WBS_REPORT.txt'
PROJECT_START = dt.date(2001, 1, 8)


def assemble():
    import spec_ch01_02, spec_ch03, spec_ch04, spec_ch05, spec_ch06, spec_ch07, spec_ch08_09
    ms = S('MS', 'Вехи бюджетного цикла II квартала 2001 г.', None, [
        M('MS.START', 'Начало бюджетного периода (II квартал 2001 г.)', at='2001-04-02'),
        M('MS.END', 'Окончание бюджетного периода (30.06.2001)', at='2001-07-02'),
    ], side=True, at='2001-04-02')
    roots = [ms] + spec_ch01_02.NODES + spec_ch03.NODES + spec_ch04.NODES + spec_ch05.NODES + spec_ch06.NODES + spec_ch07.NODES + spec_ch08_09.NODES
    by = {n.code: n for n in k.walk(roots)}
    # the timeline of the example: preparation Jan-Feb, compilation of the Q2 budget Feb-Mar, execution + control + analysis from 2 April, the IT project from 22 Jan
    by['Глава 1'].at = '2001-01-08'
    by['Глава 5'].at = '2001-04-02'
    by['Глава 6'].at = '2001-04-02'
    by['Глава 7'].at = '2001-04-02'
    plan_the_work(roots, by)
    return roots


def plan_the_work(roots, by):
    """the timeline rules of the model (the specs only say what depends on what in the book):
       chapters 1-4 (preparation + compilation of the budget): the supporting analyses of a sub-stage run in PARALLEL, the document of the step (the last task) follows them; durations are halved
         (a document is prepared by a team in a day or two; the hours of the lines are the effort);
       chapter 5 (accounting, in the budget period) and chapter 6 (control): everything of a sub-stage starts together (operations run through the quarter; end-of-period operations wait for the milestone);
       chapter 3 / 4 start together (the organisational regulation runs along the compilation)."""
    import math

    def chapter_of(n):
        while n.parent:
            n = n.parent
        return n.code
    for n in k.walk(roots):
        ch = chapter_of(n)
        if n.kids and all(not c.kids for c in n.kids):
            kids = n.kids
            if ch in ('Глава 1', 'Глава 2', 'Глава 3', 'Глава 4'):
                for c in kids[1:-1]:
                    c.par = True
            elif ch in ('Глава 5', 'Глава 6'):
                for c in kids[1:]:
                    c.par = True
        if ch in ('Глава 1', 'Глава 2', 'Глава 3', 'Глава 4') and not n.kids and n.kind == 'task':
            n.d = max(1, int(math.ceil(n.d / 2.0)))
    for code in ('5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '5.9'):
        by[code].par = True
    by['Глава 3'].at = '2001-01-08'
    by['Глава 9'].at = '2001-01-15'


def check_codes(roots):
    seen = collections.Counter(n.code for n in k.walk(roots))
    dup = [c for c, v in seen.items() if v > 1]
    if dup:
        raise SystemExit('duplicate codes: %s' % dup)


def leaves_of(n):
    if not n.kids:
        return [n]
    out = []
    for c in n.kids:
        out += leaves_of(c)
    return out


def end_leaves(n):
    return [x for x in leaves_of(n) if x.f == n.f]


def dependencies(roots):
    """finish-to-start links between leaves / milestones that explain the start of every row (the preceding group of siblings, `after`, the parent's own predecessors)"""
    index = {n.code: n for n in k.walk(roots)}
    preds = {}

    def go(nodes, inherited):
        prev_nodes = []
        prev_own = None
        for n in nodes:
            after = []
            for c in n.after:
                after += end_leaves(index[c])
            if n.at:
                own = []
            elif not prev_nodes:
                own = list(inherited)
            elif n.par:
                own = list(prev_own)
            else:
                mx = max(p.f for p in prev_nodes)
                own = []
                for p in prev_nodes:
                    if p.f == mx:
                        own += end_leaves(p)
            own = own + after
            # an exact start (`at`) pins the row; `ss` = start-to-start (not used)
            uniq = []
            for x in own:
                if x not in uniq:
                    uniq.append(x)
            if n.kids:
                go(n.kids, uniq)
            else:
                preds[n.code] = [x.code for x in uniq if x.code != n.code]
            if not n.side:
                prev_nodes.append(n)
                prev_own = uniq
    go(roots, [])
    return preds


def iso(d):
    return d.isoformat() + 'T00:00:00Z'


def working_days(a, b):
    n = 0
    d = a
    while d < b:
        if k.is_wd(d):
            n += 1
        d += dt.timedelta(days=1)
    return n


def build():
    roots = assemble()
    check_codes(roots)
    pf = k.schedule(roots, PROJECT_START)
    if k.ANCHOR_ERRORS:
        print('ANCHOR ERRORS:')
        for e in k.ANCHOR_ERRORS:
            print('  ', e)
        raise SystemExit(1)
    preds = dependencies(roots)

    tasks, lines, deps = [], [], []
    order = {}
    nodes = list(k.walk(roots))
    for n in nodes:
        sibs = n.parent.kids if n.parent else roots
        order[n.code] = (sibs.index(n) + 1) * 1024
    for n in nodes:
        is_stage = bool(n.kids)
        kind = 'milestone' if n.kind == 'milestone' else ('stage' if is_stage else 'task')
        page = n.page
        note = n.note or ''
        if page and not is_stage and n.anchor:
            note = (note + ' ' if note else '') + 'Страница книги: %d (оценка по оглавлению).' % page
        tasks.append({
            'code': n.code, 'parent': n.parent.code if n.parent else None, 'kind': kind, 'ord': order[n.code], 'name': n.name, 'note': note,
            'start': iso(n.s), 'finish': iso(n.f), 'days': working_days(n.s, n.f),
        })
        if not is_stage:
            for i, ln in enumerate(n.lines, 1):
                lines.append({'task': n.code, 'ord': i * 1024, 'genus': ln.genus, 'role': ln.role, 'qty': ln.qty, 'unit': ln.unit, 'price': ln.price, 'item': ln.item, 'bu': ln.bu, 'note': ln.note})
            for p in preds.get(n.code, []):
                deps.append({'task': n.code, 'dependsOn': p})
    # sanity: every task (leaf) has a line; every dependency ends before the start of its task
    byc = {t['code']: t for t in tasks}
    for n in nodes:
        if not n.kids and n.kind != 'milestone' and not n.lines:
            raise SystemExit('task without lines: %s' % n.code)
    for d in deps:
        if byc[d['dependsOn']]['finish'] > byc[d['task']]['start']:
            raise SystemExit('dependency %s -> %s ends after the start' % (d['dependsOn'], d['task']))
    project = {'start': iso(PROJECT_START), 'finish': iso(pf)}
    emit(tasks, lines, deps, project, roots)
    report(tasks, lines, deps, project, roots)


# ------------------------------------------------------------------ SQL
HEAD = r"""-- ===============================================================================================
-- UNIVERSAL1 - BUDGET1: the budgeting process of an industrial enterprise (K.V. Shiborsh, "Budgeting of the activity of industrial enterprises of Russia", 2001)
-- as a PROJECT: WBS (stages > sub-stages > tasks) + Gantt chart + the lines of every task.   File: documentation/BUDGET1/BUDGET1_WBS_DATA.sql
-- Generated by documentation/BUDGET1/tools/build_wbs_sql.py from the specs there (do not edit by hand: change the spec and run the script again).
--
-- THE RULES OF THE MODEL
--   * the WBS follows the book: chapter = stage, section of the book = sub-stage, every budgeting DOCUMENT (a table of the book) and every OPERATION (a posting of Table 26, a step of the
--     compilation, a stage of the organisational regulation) = exactly ONE task. The name of every row ends with the page of the book in brackets, e.g. "... (37)".
--     The page of a stage / sub-stage is EXACT (the table of contents of the book); the page of a task is an ESTIMATE (+-1..2 pages: the .doc stores no page breaks).
--   * every task at the lowest level has lines (the tabs of the Finances view of the task):
--       revenue lines (= deliverables)   the sales of the example (products A and B, Table 2)
--       cost lines  Material             purchases of materials, packing, equipment of the investment projects
--                   Expense              overheads, commercial and fixed expenses, taxes in the cost, construction works
--                   Time                 the hours of the roles that prepare the document (planners, accountants, analysts ...) and the labour of the production workers
--     The money of the book's example (II quarter 2001) is carried by the tasks that PLAN it: the amounts are in RUB (the book counts in thousand rubles: 1 000 RUB = 1 thousand rubles
--     of the book); quantities that the book does not give (hours) are chosen so that the sum equals the book's figure and the line says so. All other lines are the
--     (illustrative) working time of the roles; the hourly rates of the roles are illustrative too (the book gives one: 2,05 thousand rubles for a production worker).
--   * business units = the organisation of the book (chapters 4, 6.2, 8.2): the apparatus of management, the production units (cost centres), the sales department (revenue centre) ...
--   * the Gantt chart: the dates are an ILLUSTRATIVE plan of one budget cycle (preparation from 15.01.2001, the budget of the II quarter compiled in Feb-Mar, executed 02.04-30.06.2001);
--     every row is pinned by "start no earlier than" and linked finish-to-start to what it follows, so the chart opens exactly as planned; Monday-Friday calendar.
--   * NOT done here: the plan of the task lines is NOT posted (the task lines show as "Post needed"): press Project actions > "Post unposted tasks" in the app (the plan movements,
--     Monitor01 and the project cost total are made by that command).
--
-- Needs start1_sql_tables.sql + start2_sql_code.sql + start4_sql_insert_missing.sql. Safe and idempotent: it REPLACES the earlier BUDGET1 project (fixed GUIDs) and upserts its catalogs.
-- ===============================================================================================

BEGIN;

DO $b1$
DECLARE
  v_owner_email text := NULL;           -- optional: the e-mail of the user who will own the project (NULL = the owner of your newest project, else the only user)
  v_owner     uuid;
  v_cnt       integer;
  v_org       text;
  v_project   uuid := md5('BUDGET1:project')::uuid;
  v_ptask     uuid;
  v_units     jsonb := $j$%(units)s$j$::jsonb;
  v_rtypes    jsonb := $j$%(rtypes)s$j$::jsonb;
  v_roles     jsonb := $j$%(roles)s$j$::jsonb;
  v_items     jsonb := $j$%(items)s$j$::jsonb;
  v_munits    jsonb := $j$%(munits)s$j$::jsonb;
  v_tasks     jsonb := $j$%(tasks)s$j$::jsonb;
  v_lines     jsonb := $j$%(lines)s$j$::jsonb;
  v_deps      jsonb := $j$%(deps)s$j$::jsonb;
  v_paths     jsonb := '{}'::jsonb;
  v_path      ltree;
  v_ppath     ltree;
  v_guid      uuid;
  v_n_tasks   integer := 0;
  v_n_lines   integer := 0;
  v_n_deps    integer := 0;
  v_json      jsonb;
  v_sum       numeric;
  r           record;
BEGIN
  -- ---------------------------------------------------------------------------------------------
  -- 0. PREREQUISITES + the owner of the project
  -- ---------------------------------------------------------------------------------------------
  IF to_regclass('public."budgetItemGenericKeyTable"') IS NULL OR to_regprocedure('public.kit8_budget_item_key_direction(text)') IS NULL THEN
    RAISE EXCEPTION 'BUDGET1: the activity genus (PART 32) is not installed - run start1_sql_tables.sql, start2_sql_code.sql and start4_sql_insert_missing.sql (kit8/sql/start) first';
  END IF;
  IF to_regclass('public."businessUnitTable"') IS NULL OR to_regclass('public."resourceRoleTypeTable"') IS NULL OR to_regclass('public.task_line_table') IS NULL THEN
    RAISE EXCEPTION 'BUDGET1: the structure is not installed - run start1_sql_tables.sql and start2_sql_code.sql first';
  END IF;
  IF (SELECT count(*) FROM public."budgetItemTable" WHERE "rowGUID" IN (%(std_items)s)) <> %(std_items_n)s THEN
    RAISE EXCEPTION 'BUDGET1: the standard budget items are missing - run start4_sql_insert_missing.sql (PART 32) first';
  END IF;

  v_owner := public.app_user_guid();
  IF v_owner IS NULL AND v_owner_email IS NOT NULL AND to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'SELECT id FROM auth.users WHERE lower(email) = lower($1)' INTO v_owner USING v_owner_email;
  END IF;
  IF v_owner IS NULL THEN                              -- the SQL Editor of Supabase runs as postgres: take the owner of the newest project
    SELECT "rowOwnerGUID" INTO v_owner FROM public.project_table WHERE "rowGUID" <> v_project ORDER BY "created_at" DESC LIMIT 1;
  END IF;
  IF v_owner IS NULL AND to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM auth.users' INTO v_cnt;
    IF v_cnt = 1 THEN
      EXECUTE 'SELECT id FROM auth.users' INTO v_owner;
    ELSIF v_cnt > 1 THEN
      RAISE EXCEPTION 'BUDGET1: % users and none owns a project yet - write your e-mail into v_owner_email at the top of this block and run it again', v_cnt;
    END IF;
  END IF;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'BUDGET1: no user found - sign in to the app once (it makes your user and organization) and run this file again';
  END IF;

  SELECT public.organization_of_user(v_owner::text) INTO v_org;
  IF (v_org IS NULL OR v_org = '') AND to_regclass('auth.users') IS NOT NULL THEN           -- a user who never opened the app has no organization yet: make it (what the login does)
    EXECUTE 'SELECT email FROM auth.users WHERE id = $1' INTO v_owner_email USING v_owner;
    IF v_owner_email IS NOT NULL THEN
      PERFORM public.organization_ensure_user(v_owner_email, v_owner::text, 'BUDGET1', 'Owner');
      SELECT public.organization_of_user(v_owner::text) INTO v_org;
    END IF;
  END IF;
  IF v_org IS NULL OR v_org = '' THEN
    SELECT "rowParentGUID" INTO v_org FROM public.project_table WHERE "rowOwnerGUID" = v_owner AND "rowParentGUID" IS NOT NULL LIMIT 1;
  END IF;
  IF v_org IS NULL OR v_org = '' THEN
    SELECT "rowGUID" INTO v_org FROM public."organizationTable" LIMIT 1;
  END IF;
  IF v_org IS NULL OR v_org = '' THEN
    v_org := '50cba041-0d84-4688-a641-cca6fdeda5a1';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, false);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_owner::text)::text, false);
  RAISE NOTICE 'BUDGET1: owner = %, organization = %', v_owner, v_org;

  -- ---------------------------------------------------------------------------------------------
  -- 1. CATALOGS: currency, measure units, business units, role types, roles (+ hourly rates), budget items
  -- ---------------------------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public."currencyTable" WHERE "rowJSON"->>'currencyCode' = 'RUB') THEN
    INSERT INTO public."currencyTable" ("orderInList", "rowJSON")
    VALUES (6144, jsonb_build_object('currencyCode', 'RUB', 'currencyName', 'Russian Ruble', 'currencySymbol', '₽', 'currencyNumericCode', '643', 'decimalDigits', 2, 'isActive', true));
  END IF;

  FOR r IN SELECT * FROM jsonb_to_recordset(v_munits) AS x(id text, title text, code text) LOOP
    INSERT INTO public."measureUnitTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    VALUES (r.id, 'measureUnitCatalog', 'empty', 7000, jsonb_build_object('title', r.title, 'code', r.code))
    ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";
  END LOOP;

  FOR r IN SELECT * FROM jsonb_to_recordset(v_units) AS x(id text, parent text, title text, cfr text, ord numeric) ORDER BY ord LOOP
    INSERT INTO public."businessUnitTable" ("rowGUID", "rowParentGUID", "orderInList", "rowJSON")
    VALUES (r.id, r.parent, r.ord, jsonb_strip_nulls(jsonb_build_object('title', r.title, 'code', upper(substr(r.id, 7)), 'cfrAssigned', r.cfr, 'isActive', true)))
    ON CONFLICT ("rowGUID") DO UPDATE SET "rowParentGUID" = EXCLUDED."rowParentGUID", "orderInList" = EXCLUDED."orderInList", "rowJSON" = EXCLUDED."rowJSON";
  END LOOP;

  FOR r IN SELECT * FROM jsonb_to_recordset(v_rtypes) AS x(id text, title text, genus text, unit text, descr text, kind text, ord numeric) ORDER BY ord LOOP
    INSERT INTO public."resourceRoleTypeTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    VALUES (r.id, 'resourceRoleTypeCatalog', 'empty', r.ord,
            jsonb_strip_nulls(jsonb_build_object('title', r.title, 'description', r.descr, 'baseUnit', r.unit, 'roleVATDefaultRate', 'vat_0', 'managementGenus', r.genus,
                                                 'variantMode', 'none', 'resourceKind', r.kind, 'isActive', true)))
    ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON", "orderInList" = EXCLUDED."orderInList";
  END LOOP;

  FOR r IN SELECT * FROM jsonb_to_recordset(v_roles) AS x(id text, rtype text, title text, rate numeric, unit text, ord numeric) ORDER BY ord LOOP
    INSERT INTO public."resourceRoleTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    VALUES (r.id, r.rtype, 'empty', r.ord, jsonb_build_object('title', r.title, 'description', r.title, 'roleVATRate', NULL, 'isActive', true))
    ON CONFLICT ("rowGUID") DO UPDATE SET "rowOwnerGUID" = EXCLUDED."rowOwnerGUID", "rowJSON" = EXCLUDED."rowJSON", "orderInList" = EXCLUDED."orderInList";
    -- the rate of one unit (rule R14: rates live only in rolePriceTable); the cost price type of the seeds
    IF to_regclass('public."rolePriceTable"') IS NOT NULL AND r.rate IS NOT NULL
       AND (to_regclass('public."priceTypeTable"') IS NULL OR EXISTS (SELECT 1 FROM public."priceTypeTable" WHERE "rowGUID" = 'pt_cost')) THEN
      INSERT INTO public."rolePriceTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
      VALUES ('rp_' || r.id || '_cost', r.id, 'empty', r.ord, jsonb_build_object('priceTypeGUID', 'pt_cost', 'price', r.rate, 'measureUnit', r.unit, 'validFrom', '2001-01-01'))
      ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";
    END IF;
  END LOOP;

  FOR r IN SELECT * FROM jsonb_to_recordset(v_items) AS x(id text, title text, genus text, gkey text, direction text, ifrs text, ord numeric) ORDER BY ord LOOP
    INSERT INTO public."budgetItemTable" ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    VALUES (r.id, 'budgetItemCatalog', 'costsBudgetFolder', r.ord,
            jsonb_build_object('title', r.title, 'description', 'BUDGET1: ' || r.title, 'managementGenusItem', r.genus, 'budgetItemGenericKey', r.gkey, 'direction', r.direction, 'isPolicyItem', false,
                               'webIfrsName', r.ifrs, 'd365foName', 'Main account type Expense', 'sapName', 'Primary cost element'))
    ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON", "orderInList" = EXCLUDED."orderInList";
  END LOOP;

  -- ---------------------------------------------------------------------------------------------
  -- 2. THE PROJECT: clean the earlier run, insert the project row
  -- ---------------------------------------------------------------------------------------------
  UPDATE public.project_table SET "rowOwnerGUID" = v_owner WHERE "rowGUID" = v_project;
  DELETE FROM public.project_status_movements WHERE "rowProjectGUID" = v_project;
  DELETE FROM public.task_line_plan_movements WHERE "rowProjectGUID" = v_project;
  DELETE FROM public.task_line_plan_timeline WHERE "rowProjectGUID" = v_project;
  DELETE FROM public.task_line_table WHERE "rowProjectGUID" = v_project;
  DELETE FROM public.project_task_dependencies_table WHERE "projectGUID" = v_project;
  DELETE FROM public.project_task_kanban_state_table WHERE "rowOwnerGUID" = v_project;
  DELETE FROM public.project_task_table WHERE "projectGUID" = v_project;
  DELETE FROM public.project_user_settings_table WHERE "rowOwnerGUID" = v_project;
  DELETE FROM public.project_kanban_stage_table WHERE "rowOwnerGUID" = v_project;
  DELETE FROM public.project_table WHERE "rowGUID" = v_project;

  INSERT INTO public.project_table ("rowGUID", "treePath", "rowOwnerGUID", "rowParentGUID", "rowDuration", "rowProgress", "orderInList", "rowJSON", "created_at", "updated_at")
  VALUES (v_project, public.pm_ltree_label(v_project), v_owner, v_org, '%(finish)s'::timestamptz, 0, 8192,
    jsonb_build_object(
      'name', 'BUDGET1: Бюджетирование деятельности промышленного предприятия (по книге К.В. Щиборщ) - бюджетный цикл II квартала 2001 г.',
      'projectCode', 'BUDGET1', 'rowKind', 'project',
      'projectStartAt', '%(start)s', 'projectStartDate', '%(start_d)s', 'projectFinishDate', '%(finish_d)s',
      'durationDays', %(project_days)s, 'skipWeekends', true,
      'currencyForBudget', 'RUB', 'currencyForContract', 'RUB', 'currencyForAccounting', 'RUB',
      'budgetScenarioForPlan', 'planScenarioProject1', 'budgetScenarioForFact', 'factScenarioProject1',
      'calendarForTaskPlan', 'workingDaysCalendar', 'planDateInputFormat', 'DD.MM.YYYY',
      'projectExpenseCostsNeeded', true, 'projectMaterialCostsNeeded', true, 'projectTimeCostsNeeded', true, 'projectExpenseBudgetNeeded', true, 'projectRevenueBudgetNeeded', true,
      'projectTimeOfPersonNeeded', true, 'projectTimeOfEquipmentNeeded', false,
      'customerInvoiceFunctionalityEnabled', true, 'multiProjectVendorInvoceNeeded', false, 'factStrongInputByTaskLine', false,
      'projectCostCenter', 'bu_b1_apparat', 'projectRevenueCenter', 'bu_b1_sales', 'projectProfitCenter', 'bu_b1_profit', 'projectInvestmentCenter', 'bu_b1_root',
      'uxuiSettings', jsonb_build_object('projectTreeContextCommandsMode', 'onRightClickMenuMode', 'projectGanttChartContextCommandsMode', 'onRightClickMenuMode')),
    NOW(), NOW());

  -- ---------------------------------------------------------------------------------------------
  -- 3. THE WBS: stages, sub-stages, tasks, milestones (a parent before its children)
  -- ---------------------------------------------------------------------------------------------
  FOR r IN SELECT x.* FROM jsonb_array_elements(v_tasks) WITH ORDINALITY AS e(value, n),
           LATERAL jsonb_to_record(e.value) AS x(code text, parent text, kind text, ord numeric, name text, note text, start text, finish text, days integer)
           ORDER BY e.n LOOP
    v_guid  := md5('BUDGET1:task:' || r.code)::uuid;
    v_ppath := CASE WHEN r.parent IS NULL THEN public.pm_ltree_label(v_project) ELSE (v_paths->>r.parent)::ltree END;
    v_path  := v_ppath || public.pm_ltree_label(v_guid);
    v_paths := v_paths || jsonb_build_object(r.code, v_path::text);
    v_json  := jsonb_strip_nulls(jsonb_build_object(
                 'rowKind', r.kind, 'taskDescription', r.name, 'name', r.name, 'startAt', r.start, 'durationDays', r.days,
                 'manualStartAt', CASE WHEN r.kind = 'stage' THEN NULL ELSE r.start END,
                 'notes', NULLIF(r.note, ''), 'wbsCode', r.code));
    INSERT INTO public.project_task_table ("rowGUID", "treePath", "projectGUID", "rowOwnerGUID", "rowDuration", "rowProgress", "orderInList", "rowJSON", "created_at", "updated_at")
    VALUES (v_guid, v_path, v_project, v_owner, r.finish::timestamptz, 0, r.ord, v_json, NOW(), NOW());
    v_n_tasks := v_n_tasks + 1;
  END LOOP;

  -- ---------------------------------------------------------------------------------------------
  -- 4. THE LINES of the tasks (Time / Material / Expense / Revenue = deliverable)
  -- ---------------------------------------------------------------------------------------------
  FOR r IN SELECT x.* FROM jsonb_array_elements(v_lines) WITH ORDINALITY AS e(value, n),
           LATERAL jsonb_to_record(e.value) AS x(task text, ord numeric, genus text, role text, qty numeric, unit text, price numeric, item text, bu text, note text)
           ORDER BY e.n LOOP
    v_sum := round(r.qty * r.price, 2);
    INSERT INTO public.task_line_table ("rowGUID", "rowProjectGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
    VALUES (md5('BUDGET1:line:' || r.task || ':' || r.ord::text)::uuid, v_project, md5('BUDGET1:task:' || r.task)::uuid, r.genus, r.ord,
            jsonb_strip_nulls(jsonb_build_object(
              'taskManagementGenusLine', r.genus, 'distributionForBudgetTaskLine', 'uniformDistribution',
              'resourceRoleItem', r.role, 'measureUnitTaskLine', r.unit, 'qtyTaskLine', r.qty, 'priceTaskLine', r.price, 'vatRatioTaskLine', 0,
              'sumForContract', v_sum, 'sumForBudget', v_sum, 'sumForAccounting', v_sum,
              'budgetItemTaskLine', r.item, 'budgetItemItem', r.item,
              'businessUnitTaskLine', r.bu, 'businessUnitAutoTaskLine', r.bu, 'businessUnitSourceTaskLine', 'line',
              'description', NULLIF(r.note, ''))));
    v_n_lines := v_n_lines + 1;
  END LOOP;

  -- ---------------------------------------------------------------------------------------------
  -- 5. THE LINKS of the Gantt chart (finish-to-start)
  -- ---------------------------------------------------------------------------------------------
  FOR r IN SELECT x.* FROM jsonb_array_elements(v_deps) AS e(value), LATERAL jsonb_to_record(e.value) AS x(task text, "dependsOn" text) LOOP
    INSERT INTO public.project_task_dependencies_table ("rowGUID", "rowDependsOnGUID", "projectGUID", "rowOwnerGUID", "linkType", "lagDays")
    VALUES (md5('BUDGET1:task:' || r.task)::uuid, md5('BUDGET1:task:' || r."dependsOn")::uuid, v_project, v_owner, 'FS', 0)
    ON CONFLICT DO NOTHING;
    v_n_deps := v_n_deps + 1;
  END LOOP;

  -- ---------------------------------------------------------------------------------------------
  -- 6. kanban stages and the screen settings of the owner (the Gantt chart, the tree and the finances open at once)
  -- ---------------------------------------------------------------------------------------------
  IF to_regprocedure('public.pm_kanban_ensure_project_stages(uuid)') IS NOT NULL THEN
    PERFORM public.pm_kanban_ensure_project_stages(v_project);
  END IF;
  INSERT INTO public.project_user_settings_table ("rowGUID", "rowOwnerGUID", "rowParentGUID", "orderInList", "rowJSON")
  VALUES (md5('BUDGET1:settings')::uuid, v_project, v_owner, 1024,
          jsonb_build_object('uxuiSettings', jsonb_build_object(
            'projectTreeContextCommandsMode', 'onRightClickMenuMode', 'projectGanttChartContextCommandsMode', 'onRightClickMenuMode',
            'viewButtonsOrder', jsonb_build_array('showGanttChart', 'showFinancesView', 'showKanbanView', 'showNetworkView', 'showVersionsView', 'showReportsView', 'showPlanView'),
            'treeColumnsOrder', jsonb_build_array('wbs', 'name', 'taskStartDate', 'taskFinishDate', 'taskDuration', 'progress'),
            'ganttArrowsForm', 'smoothForm', 'dragAndDropTaskInTree', true, 'showTreeHierarchyNumbers', true)))
  ON CONFLICT ("rowGUID") DO UPDATE SET "rowJSON" = EXCLUDED."rowJSON";

  RAISE NOTICE 'BUDGET1: project % - % rows of the WBS, % lines, % links; lines total % RUB',
    v_project, v_n_tasks, v_n_lines, v_n_deps,
    (SELECT to_char(sum(("rowJSON"->>'sumForBudget')::numeric), 'FM999G999G999G999D00') FROM public.task_line_table WHERE "rowProjectGUID" = v_project);
END
$b1$;

COMMIT;

-- Check (read only):
--   SELECT nlevel("treePath") - 1 AS level, "rowJSON"->>'rowKind' AS kind, "rowJSON"->>'taskDescription' AS name, "rowJSON"->>'startAt' AS start, "rowDuration" AS finish
--     FROM public.project_task_table WHERE "projectGUID" = md5('BUDGET1:project')::uuid ORDER BY "treePath";
--   SELECT "rowParentGUID" AS genus, count(*), sum(("rowJSON"->>'sumForBudget')::numeric) FROM public.task_line_table WHERE "rowProjectGUID" = md5('BUDGET1:project')::uuid GROUP BY 1;
"""


def emit(tasks, lines, deps, project, roots):
    def js(x):
        s = json.dumps(x, ensure_ascii=False, separators=(',', ':'))
        assert '$j$' not in s
        return s
    units = [{'id': u[0], 'parent': u[1], 'title': u[2], 'cfr': u[3], 'ord': (i + 1) * 10} for i, u in enumerate(cat.BUSINESS_UNITS)]
    rtypes = [{'id': t[0], 'title': t[1], 'genus': t[2], 'unit': t[3], 'descr': t[4], 'kind': 'person' if t[2] == 'timeGenus' else None, 'ord': 20000 + i * 1000} for i, t in enumerate(cat.ROLE_TYPES)]
    roles = [{'id': rid, 'rtype': v[0], 'title': v[1], 'rate': v[2], 'unit': {'timeGenus': 'unit_hour'}.get(next(t[2] for t in cat.ROLE_TYPES if t[0] == v[0]), next(t[3] for t in cat.ROLE_TYPES if t[0] == v[0])), 'ord': 30000 + i * 100}
             for i, (rid, v) in enumerate(cat.ROLES.items())]
    items = [{'id': it[0], 'title': it[1], 'genus': it[2], 'gkey': it[3], 'direction': it[4], 'ifrs': it[5], 'ord': 21000 + i * 100} for i, it in enumerate(cat.NEW_BUDGET_ITEMS)]
    munits = [{'id': u[0], 'title': u[1], 'code': u[2]} for u in cat.UNITS]
    std = cat.STANDARD_ITEMS
    d0 = dt.date.fromisoformat(project['start'][:10])
    d1 = dt.date.fromisoformat(project['finish'][:10])
    mapping = {
        'units': js(units), 'rtypes': js(rtypes), 'roles': js(roles), 'items': js(items), 'munits': js(munits), 'tasks': js(tasks), 'lines': js(lines), 'deps': js(deps),
        'std_items': ', '.join("'%s'" % x for x in std), 'std_items_n': len(std),
        'start': project['start'], 'finish': project['finish'], 'start_d': d0.isoformat(), 'finish_d': (d1 - dt.timedelta(days=1)).isoformat(), 'project_days': working_days(d0, d1),
    }
    import re
    text = re.sub(r'%\((\w+)\)s', lambda m: str(mapping[m.group(1)]), HEAD)
    SQL_OUT.write_text(text, encoding='utf-8')
    print('written', SQL_OUT, '%.0f KB' % (len(text.encode('utf-8')) / 1024))


def report(tasks, lines, deps, project, roots):
    nodes = list(k.walk(roots))
    stages = [n for n in nodes if n.kids]
    leaves = [n for n in nodes if not n.kids and n.kind != 'milestone']
    ms = [n for n in nodes if n.kind == 'milestone']
    tot = collections.defaultdict(float)
    cnt = collections.Counter()
    for ln in lines:
        tot[ln['genus']] += round(ln['qty'] * ln['price'], 2)
        cnt[ln['genus']] += 1
    out = ['BUDGET1 - WBS and Gantt chart of the budgeting process (generated)', '',
           'rows of the WBS: %d  (stages and sub-stages %d, tasks %d, milestones %d)' % (len(nodes), len(stages), len(leaves), len(ms)),
           'lines: %d   links (finish-to-start): %d   project: %s .. %s' % (len(lines), len(deps), project['start'][:10], (dt.date.fromisoformat(project['finish'][:10]) - dt.timedelta(days=1)).isoformat()), '',
           'lines by genus (count, amount in RUB):']
    for g in ('revenueGenus', 'materialGenus', 'expenseGenus', 'timeGenus'):
        out.append('  %-14s %5d  %18s' % (g, cnt[g], '{:,.2f}'.format(tot[g]).replace(',', ' ')))
    out += ['', 'the example of the book (II quarter 2001) in the lines, thousand rubles of the book (amount / 1000):']

    def sumbytask(codes, genus=None):
        s = 0.0
        for ln in lines:
            if ln['task'] in codes and (genus is None or ln['genus'] == genus):
                s += ln['qty'] * ln['price']
        return s / 1000.0
    checks = [
        ('Table 2  sales budget (revenue)', ['3.2.5'], 691000), ('Table 6  purchases of materials', ['3.6.4'], 173000), ('Table 5  direct labour of production workers', ['3.5.1'], 213200),
        ('Table 9  overheads (ОПР)', ['3.8.1'], 208000), ('Table 11 direct commercial expenses', ['3.9.3'], 38000), ('Table 12 fixed expenses', ['3.10.2'], 57000),
        ('Table 17 taxes in the cost (4.3)', ['3.10.3'], 13000), ('Table 19 investments (income of the period)', ['3.13.2', '3.13.3', '3.13.4', '3.13.5'], 140000)]
    ok = True
    for name, codes, expected in checks:
        g = 'revenueGenus' if 'revenue' in name else None
        # only the money lines of the example (not the working time of the roles): lines with a note that starts with the item of the book
        s = sum(ln['qty'] * ln['price'] for ln in lines if ln['task'] in codes and ln['note'] and ('тыс. руб.' in ln['note'])) / 1000.0
        flag = 'OK ' if abs(s - expected) < 0.01 else 'DIFF'
        ok &= flag == 'OK '
        out.append('  %s %-48s %12.2f   (book: %d)' % (flag, name, s, expected))
    out += ['', 'ALL CHECKS OK' if ok else 'CHECKS FAILED', '', 'WBS:']
    for n in nodes:
        depth = 0
        p = n.parent
        while p:
            depth += 1
            p = p.parent
        t = next(x for x in tasks if x['code'] == n.code)
        out.append('%s%s%s  [%s .. %s]%s' % ('  ' * depth, '' if n.kids else ('* ' if n.kind != 'milestone' else '◆ '), n.name, t['start'][:10], t['finish'][:10], '  {%d lines}' % len(n.lines) if n.lines else ''))
    REPORT.write_text('\n'.join(out), encoding='utf-8')
    print('written', REPORT)
    print('\n'.join(out[:14]))
    if not ok:
        raise SystemExit('the money lines do not match the book')


if __name__ == '__main__':
    build()
