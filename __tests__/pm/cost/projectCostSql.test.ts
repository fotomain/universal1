// The SQL of the project cost total (PART 27) read as text: the same rule as the app, the pieces in the right files, the hook into the worker, the undo part.
// (The SQL itself runs on a real Postgres 15: kit8/docker/tests/80_project_cost.sql via test_fact_monitor01.sh.)
import { TASK_INPUT_DEFAULTS } from '../../../kit8/pm/model/taskInputScope';
import { codeSql, readSql, tablesSql } from '../../sql/sqlFilesTestKit';

const part27 = (src: string) => src.slice(src.search(/^-- PART 27: create_project_cost_total\.sql/m));
const deleteSql = readSql('delete_sql_structure.sql');

describe('project_cost_budget_on is the rule of projectCostBudgetOn', () => {
  const flags = [...part27(codeSql).matchAll(/project_cost_flag\(p_json, '(\w+)', (true|false)\)/g)].map((m) => [m[1], m[2] === 'true'] as const);
  it('reads the master and the four inputs, with the DEFAULTS of TASK_INPUT_DEFAULTS (a switch never saved reads as its default)', () => {
    const byKey = new Map(flags);
    for (const k of ['projectExpenseBudgetNeeded', 'projectTimeCostsNeeded', 'projectTimeOfPersonNeeded', 'projectTimeOfEquipmentNeeded', 'projectMaterialCostsNeeded', 'projectExpenseCostsNeeded'] as const) {
      expect(byKey.has(k)).toBe(true);
      expect(byKey.get(k)).toBe(TASK_INPUT_DEFAULTS[k]);
    }
    // a different default for the same key anywhere would be a different rule
    for (const [k, d] of flags) expect(d).toBe((TASK_INPUT_DEFAULTS as Record<string, boolean>)[k]);
  });
  it('reads only booleans (the app does the same)', () => {
    expect(codeSql).toContain("jsonb_typeof(p_json -> p_key) = 'boolean'");
  });
  it('is IMMUTABLE (used in a trigger WHEN clause)', () => {
    expect(codeSql).toMatch(/FUNCTION public\.project_cost_budget_on\(p_json jsonb\) RETURNS boolean\s+LANGUAGE sql IMMUTABLE/);
  });
});

describe('the tables are in start1, the code in start2, both as PART 27', () => {
  it('start1 has the two tables, start2 none', () => {
    expect(tablesSql).toContain('CREATE TABLE IF NOT EXISTS public.project_task_cost_total');
    expect(tablesSql).toContain('CREATE UNLOGGED TABLE IF NOT EXISTS public.project_cost_dirty');
    expect(codeSql).not.toMatch(/CREATE (UNLOGGED )?TABLE/);
  });
  it('the table has the numbers of the design: own + total in NUMERIC(18,2), the task key with a cascade, the owner user for the one-column policy', () => {
    const t = tablesSql.slice(tablesSql.indexOf('CREATE TABLE IF NOT EXISTS public.project_task_cost_total'));
    const ddl = t.slice(0, t.indexOf(');'));
    expect(ddl).toContain('"rowOwnerGUID"       UUID          NOT NULL REFERENCES public.project_task_table("rowGUID") ON DELETE CASCADE');
    expect(ddl).toContain('"costOwnForBudget"   NUMERIC(18,2) NOT NULL DEFAULT 0');
    expect(ddl).toContain('"costTotalForBudget" NUMERIC(18,2) NOT NULL DEFAULT 0');
    expect(ddl).toContain('"rowOwnerUserGUID"   UUID');
    expect(ddl).toContain('PRIMARY KEY ("rowOwnerGUID")');
  });
  it('start2 refuses nobody new: PART 27 comes after PART 26 in both files', () => {
    for (const src of [tablesSql, codeSql]) expect(src.search(/^-- PART 27: /m)).toBeGreaterThan(src.search(/^-- PART 26: /m));
  });
});

describe('the code of PART 27', () => {
  const p = part27(codeSql);
  it('is the step 3 of monitor01_apply, isolated so that a cost error never stops Monitor01', () => {
    const apply = codeSql.slice(codeSql.indexOf('CREATE OR REPLACE FUNCTION public.monitor01_apply'));
    const body = apply.slice(0, apply.indexOf('$$;', apply.indexOf('p_deleted  :=')));
    expect(body).toContain('PERFORM public.project_cost_apply(p_tasks);');
    expect(body.indexOf('project_cost_apply')).toBeGreaterThan(body.indexOf('monitor01_view AS v'));      // after step 2
    expect(body).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE WARNING 'project_cost_apply failed/);
  });
  it('the worker rebuilds the queued projects (moved / deleted stages) at the start of every batch', () => {
    const batch = codeSql.slice(codeSql.indexOf('CREATE OR REPLACE FUNCTION public.monitor01_process_batch'));
    expect(batch.slice(0, batch.indexOf('RETURN 0;'))).toContain('PERFORM public.project_cost_process_dirty();');
  });
  it('the stages are read from the labels of the path: no join, no subtree scan', () => {
    expect(p).toContain("replace(lbl, '_', '-')::uuid");
    expect(p).toContain("unnest(string_to_array(ltree2text(subpath(");
    expect(p).not.toMatch(/treePath"\s*<@|<@\s+[a-z_.]*"treePath"/);
  });
  it('the delta: new own - stored own, added to the task and to every stage above it; only changed rows are written', () => {
    expect(p).toContain('t.new_own - COALESCE(c."costOwnForBudget", 0) AS d');
    expect(p).toContain('"costTotalForBudget" = c."costTotalForBudget" + EXCLUDED."costTotalForBudget"');
    expect(p).toContain('c."costOwnForBudget" = 0 AND c."costTotalForBudget" = 0');
  });
  it('one cost step per project at a time (advisory lock) in the worker, the rebuild and the command', () => {
    expect((p.match(/pg_advisory_xact_lock\(hashtext\('project_cost'\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
  it('the source is the plan of the turnover: Time + Material + Expense, not used / invoiced', () => {
    expect(p).toContain('SUM(m."sumForBudgetPlan")');
    expect(p).not.toContain('sumForBudgetUsed');
    expect(p).not.toContain('sumForBudgetInvoiced');
  });
  it('the rule is checked in the three places: the worker, the rebuild, the trigger of the project', () => {
    expect((p.match(/project_cost_budget_on\(/g) || []).length).toBeGreaterThanOrEqual(6);
    expect(p).toContain('WHEN (public.project_cost_budget_on(OLD."rowJSON") IS DISTINCT FROM public.project_cost_budget_on(NEW."rowJSON"))');
  });
  it('a moved or deleted stage queues the project (row triggers: a transition table cannot be used with a column list)', () => {
    expect(p).toContain('AFTER UPDATE OF "treePath" ON public.project_task_table');
    expect(p).toContain('AFTER DELETE ON public.project_task_table');
  });
  it('read policy by the owner column; nobody writes; realtime and full replica identity; the command is for authenticated, the internals are not', () => {
    expect(p).toContain('USING ("rowOwnerUserGUID" = public.app_user_guid())');
    expect(p).toContain('GRANT SELECT ON public.project_task_cost_total TO authenticated');
    expect(p).toContain('REVOKE ALL ON public.project_task_cost_total FROM anon, authenticated');
    expect(p).toContain('REPLICA IDENTITY FULL');
    expect(p).toContain("ADD TABLE public.project_task_cost_total");
    expect(p).toContain('GRANT EXECUTE ON FUNCTION public.update_project_cost_total(uuid) TO authenticated');
    for (const fn of ['project_cost_rebuild(uuid)', 'project_cost_apply(uuid[])', 'project_cost_process_dirty()', 'project_cost_verify(uuid)']) expect(p).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated`);
  });
  it('the command refuses a project that is not yours', () => {
    expect(p).toContain("pm_owns_project(p_project)");
    expect(p).toContain('is not yours');
  });
});

describe('the undo part drops everything PART 27 made', () => {
  const objects = [...part27(codeSql).matchAll(/CREATE OR REPLACE FUNCTION public\.(project_cost_\w+|update_project_cost_total)\(([^)]*)\)/g)].map((m) => m[1]);
  it('every function, both tables and the three triggers', () => {
    expect(objects.length).toBeGreaterThanOrEqual(10);
    for (const fn of new Set(objects)) expect(deleteSql).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}\\(`));
    expect(deleteSql).toContain('DROP TABLE IF EXISTS public.project_task_cost_total CASCADE');
    expect(deleteSql).toContain('DROP TABLE IF EXISTS public.project_cost_dirty CASCADE');
    for (const t of ['trg_project_cost_task_moved', 'trg_project_cost_task_deleted', 'trg_project_cost_budget']) expect(deleteSql).toContain(`DROP TRIGGER IF EXISTS ${t} ON`);
  });
  it('the triggers are dropped before their functions', () => {
    expect(deleteSql.indexOf('DROP TRIGGER IF EXISTS trg_project_cost_budget')).toBeLessThan(deleteSql.indexOf('DROP FUNCTION IF EXISTS public.project_cost_trg_project_budget'));
  });
});
