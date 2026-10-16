// The constants of kit8/pm/reports/monitor01 must be the values the database has (PART 25 of start1_sql_tables.sql + start2_sql_code.sql), and the SQL files must carry the same parts.
import * as fs from 'fs';
import * as path from 'path';
import { structureParts } from '../../../sql/sqlFilesTestKit';
import {
  MONITOR01_BATCH_SIZE, MONITOR01_MAX_ATTEMPTS, MONITOR01_POLL_INTERVAL_MS, MONITOR01_QUEUE_STALE_SECONDS, MONITOR01_REFRESH_INTERVAL, MONITOR01_RUN_BUDGET_MS, MONITOR01_VIEW_TABLE, RPC_MONITOR01_STAMP, RPC_MONITOR01_SUM_SOURCES,
} from '../../../../kit8/pm/reports/monitor01/monitor01Constants';
import { FACT_HEADER_TABLE, FACT_STRONG_INPUT_SETTING, FACT_SUMMARY_TABLE, FACT_USAGE_TIMELINE_TABLE, RPC_FACT_CREATE, RPC_FACT_POST, RPC_FACT_UNPOST } from '../../../../kit8/documents/fact/input/factInputModel';

const sqlDir = path.join(__dirname, '../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const tables = read('start1_sql_tables.sql');
const structure = tables + '\n' + read('start2_sql_code.sql');

const del = read('delete_sql_structure.sql');

const fnValue = (src: string, name: string): number => {
  const m = new RegExp(`FUNCTION public\\.${name}\\(\\) RETURNS integer LANGUAGE sql IMMUTABLE AS \\$\\$ SELECT (\\d+) \\$\\$`).exec(src);
  if (!m) throw new Error(`${name} not found`);
  return Number(m[1]);
};

describe('the constants are the values of the database', () => {
  it('the refresh interval is 2 seconds (the Google Doc: MONITOR01_REFRESH_INTERVAL=2 #seconds)', () => {
    expect(MONITOR01_REFRESH_INTERVAL).toBe(2);
    expect(fnValue(structure, 'monitor01_refresh_interval_seconds')).toBe(MONITOR01_REFRESH_INTERVAL);
  });
  it('batch size and run budget', () => {
    expect(fnValue(structure, 'monitor01_batch_size')).toBe(MONITOR01_BATCH_SIZE);
    expect(fnValue(structure, 'monitor01_run_budget_ms')).toBe(MONITOR01_RUN_BUDGET_MS);
  });
  it('a task is parked after MONITOR01_MAX_ATTEMPTS failures', () => {
    expect(structure).toContain(`"attempts" < ${MONITOR01_MAX_ATTEMPTS}`);
    expect(structure).toContain(`"attempts" >= ${MONITOR01_MAX_ATTEMPTS}`);
  });
});

describe('the names the app calls exist in the SQL', () => {
  const names = [MONITOR01_VIEW_TABLE, FACT_HEADER_TABLE, FACT_USAGE_TIMELINE_TABLE, FACT_SUMMARY_TABLE, RPC_MONITOR01_SUM_SOURCES, RPC_FACT_CREATE, RPC_FACT_POST, RPC_FACT_UNPOST];
  it.each(names)('%s', (name) => {
    expect(structure).toMatch(new RegExp(`(TABLE IF NOT EXISTS public\\.${name}\\b|FUNCTION public\\.${name}\\()`));
  });
  it('the project setting is read by the document creation', () => {
    expect(structure).toContain(`"rowJSON"->'${FACT_STRONG_INPUT_SETTING}'`);
  });
});

describe('the structure file, the code file and the delete file carry the same parts', () => {
  const partsText = structureParts(24, 25);
  it('PART 24 and 25: the tables are in start1_sql_tables.sql, the code (functions, triggers, policies, realtime, cron) in start2_sql_code.sql', () => {
    for (const n of [24, 25]) {
      expect(tables).toContain(`-- PART ${n}: `);
      expect(structure).toContain(`-- PART ${n}: `);
    }
    expect(partsText).toContain('CREATE TABLE IF NOT EXISTS public.task_fact_header');
    expect(tables).toContain('CREATE TABLE IF NOT EXISTS public.monitor01_view');
    expect(tables).not.toContain('CREATE OR REPLACE FUNCTION public.monitor01_apply');
    expect(read('start2_sql_code.sql')).toContain('CREATE OR REPLACE FUNCTION public.monitor01_apply');
    expect(read('start2_sql_code.sql')).not.toContain('CREATE TABLE IF NOT EXISTS public.monitor01_view');
  });
  it('the delete file removes every table the parts create', () => {
    for (const t of [MONITOR01_VIEW_TABLE, FACT_SUMMARY_TABLE, FACT_HEADER_TABLE, FACT_USAGE_TIMELINE_TABLE, 'monitor01_dirty', 'monitor01_refresh_log']) expect(del).toContain(`DROP TABLE IF EXISTS public.${t}`);
    expect(del).toContain("cron.unschedule('monitor01_tick')");
  });
  it('every function of the parts is dropped by the delete file', () => {
    const part = partsText;
    const created = [...part.matchAll(/CREATE OR REPLACE (?:FUNCTION|PROCEDURE) public\.(\w+)\(/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(20);
    for (const fn of created) expect(del).toMatch(new RegExp(`DROP (?:FUNCTION|PROCEDURE) IF EXISTS public\\.${fn}\\(`));
  });
  it('monitor01_view carries sumForBudget and qtyUsed (table, upgrade, fresh rows from the turnover, apply, verify) in the structure and the code file', () => {
    for (const src of [structure]) {
      expect(src).toMatch(/"sumForBudget"\s+NUMERIC\(18,2\) NOT NULL DEFAULT 0,\n  "qtyRestToContract"/);
      expect(src).toContain('ALTER TABLE public.monitor01_view ADD COLUMN IF NOT EXISTS "sumForBudget"');
      expect(src).toContain('DROP FUNCTION IF EXISTS public.monitor01_fresh_rows(uuid[]);');
      const rowsFn = src.indexOf('CREATE OR REPLACE FUNCTION public.monitor01_fresh_rows');
      const body = src.slice(rowsFn, src.indexOf('\n$$;\n', rowsFn));
      expect(body).toContain('t."qtyPlan", t."qtyPlanContracted", t."sumForBudgetPlan", t."qtyUsed", t."qtyInvoiced"');
      expect(src).toContain('"qtyContracted", "sumForBudget", "qtyUsed", "qtyInvoiced", "qtyOrdered", "lineCount", "hasStalePlan")');                // the apply column list
      expect(src.match(/[fv]\."qtyContracted", [fv]\."sumForBudget", [fv]\."qtyUsed", [fv]\."qtyInvoiced", [fv]\."qtyOrdered", [fv]\."lineCount"/g)!.length).toBeGreaterThanOrEqual(5);   // apply select + verify (4)
      expect(src).toContain('"sumForBudget" = EXCLUDED."sumForBudget", "qtyUsed" = EXCLUDED."qtyUsed", "qtyInvoiced" = EXCLUDED."qtyInvoiced", "qtyOrdered" = EXCLUDED."qtyOrdered", "lineCount" = EXCLUDED."lineCount"');
      expect(src).toContain('ALTER TABLE public.monitor01_view ADD COLUMN IF NOT EXISTS "qtyInvoiced"');
    }
  });
  it('the project status REGISTER: movements (qtyProjectStatus, kinds, snapshot dimensions) -> month turnover (renamed in place) -> the report; documents write it in their own transaction', () => {
    for (const src of [structure]) {
      expect(src).toContain('CREATE TABLE IF NOT EXISTS public.project_status_movements (');
      expect(src).toContain('"qtyProjectStatus"       NUMERIC(18,2) NOT NULL DEFAULT 0');
      expect(src).toContain("CHECK (\"rowMovementKind\" IN ('plan', 'ordered', 'received', 'invoiced', 'used', 'sold'))");
      expect(src).toContain('CREATE TABLE IF NOT EXISTS public.project_status_month_turnover (');
      expect(src).toContain('ALTER TABLE public.task_line_fact_for_monitor01 RENAME TO project_status_month_turnover;');   // in place: the rows are kept
      expect(src).not.toMatch(/CREATE TABLE IF NOT EXISTS public\.task_line_fact_for_monitor01/);
      for (const fn of ['project_status_unregister(p_registrator uuid)', 'project_status_register_plan(p_tasks uuid[])', 'project_status_register_fact(p_header uuid)', 'project_status_fresh_turnover(p_tasks uuid[])']) {
        expect(src).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
      }
      // the fact document registers in its post and unregisters in its unpost (the same transaction)
      expect(src).toContain('PERFORM public.project_status_register_fact(p_header);');
      expect(src).toContain('PERFORM public.project_status_unregister(p_header);');
      // the worker registers the plan of its batch, then sums the register (only changed rows)
      expect(src).toContain('PERFORM public.project_status_register_plan(p_tasks);');
      expect(src).toContain('WITH fresh AS MATERIALIZED (SELECT * FROM public.project_status_fresh_turnover(p_tasks))');
      // the plan movements never queue (the worker rewrites them), the others do
      expect(src).toContain('WHERE n."rowMovementKind" <> \'plan\' ON CONFLICT');
      // the turnover is streamed, the movements are not
      expect(src).toContain("ARRAY['monitor01_view', 'project_status_month_turnover']");
      expect(src).not.toMatch(/ADD TABLE public\.project_status_movements/);
      // upgrade: posted documents and plans that are not in the register are registered / queued
      expect(src).toContain('SELECT public.project_status_register_fact(h."rowGUID")');
      expect(src).toContain("SELECT DISTINCT m.\"rowOwnerGUID\", 'install' FROM public.task_line_plan_movements m");
    }
    for (const name of ['project_status_movements', 'project_status_month_turnover']) expect(del).toContain(`DROP TABLE IF EXISTS public.${name} CASCADE;`);
    for (const fn of ['project_status_fresh_turnover(uuid[])', 'project_status_register_plan(uuid[])', 'project_status_register_fact(uuid)', 'project_status_unregister(uuid)']) {
      expect(del).toContain(`DROP FUNCTION IF EXISTS public.${fn};`);
    }
  });
  it('the POSTED facts feed qtyUsed through the register; the drill-down "used" lists the fact lines; tasks with facts are queued on upgrade', () => {
    for (const src of [structure]) {
      expect(src).toContain("ELSIF p_measure IN ('fact', 'used') THEN");
      expect(src).toContain("ELSIF p_measure = 'delivered' THEN");
      // the report column Invoiced: monitor01_view.qtyInvoiced is made by the worker from the register ('invoiced' movements) and checked by monitor01_verify
      expect(src).toContain('"qtyUsed" numeric, "qtyInvoiced" numeric, "qtyOrdered" numeric, "lineCount" integer, "hasStalePlan" boolean)');
      expect(src).toContain('"qtyUsed" = EXCLUDED."qtyUsed", "qtyInvoiced" = EXCLUDED."qtyInvoiced"');
      expect(src).toContain("SELECT DISTINCT s.\"rowOwnerGUID\", 'install' FROM public.project_status_movements s WHERE s.\"rowMovementKind\" = 'invoiced'");
      expect(src).toMatch(/SELECT DISTINCT f\."rowOwnerGUID", 'install' FROM public\.task_fact_usage_timeline f/);
    }
  });
  it('the column Ordered (PART 28): qtyOrdered of the turnover and of monitor01_view, made from the \'ordered\' movements of the posted purchase orders; the drill-down "ordered"; tasks with orders are queued on upgrade', () => {
    for (const src of [structure]) {
      for (const c of ['qtyOrdered', 'sumForBudgetOrdered', 'sumForContractOrdered', 'sumForAccountingOrdered', 'vatForContractOrdered', 'vatForAccountingOrdered']) {
        expect(src).toContain(`ALTER TABLE public.project_status_month_turnover ADD COLUMN IF NOT EXISTS "${c}" NUMERIC(18,2) NOT NULL DEFAULT 0;`);
        expect(src).toContain(`FILTER (WHERE s."rowMovementKind" = 'ordered')`);
      }
      expect(src).toContain('ALTER TABLE public.monitor01_view ADD COLUMN IF NOT EXISTS "qtyOrdered" NUMERIC(18,2) NOT NULL DEFAULT 0;');
      expect(src).toContain("FILTER (WHERE s.\"rowMovementKind\" IN ('used', 'invoiced', 'ordered'))");
      expect(src).toContain("ELSIF p_measure = 'ordered' THEN");
      expect(src).toContain("JOIN public.purchase_order_header h ON h.\"rowGUID\" = s.\"rowRegistratorGUID\"");
      expect(src).toContain("SELECT DISTINCT s.\"rowOwnerGUID\", 'install' FROM public.project_status_movements s WHERE s.\"rowMovementKind\" = 'ordered'");
      expect(src).toContain('t."qtyUsed", t."qtyInvoiced", t."qtyOrdered", t."lineCount"');                  // monitor01_fresh_rows
      expect(src).toContain('"vatForContractOrdered" = EXCLUDED."vatForContractOrdered"');                  // the turnover is written with the ordered numbers
    }
  });
  it('monitor01_refresh_now exists in both files, is for the authenticated user (SECURITY DEFINER, own projects only) and is dropped by the delete file', () => {
    for (const src of [structure]) {
      expect(src).toContain('CREATE OR REPLACE FUNCTION public.monitor01_refresh_now(p_project uuid DEFAULT NULL, p_max integer DEFAULT 2000) RETURNS jsonb');
      expect(src).toContain('public.pm_owns_project(x.pr)');
      expect(src).toContain('GRANT EXECUTE ON FUNCTION public.monitor01_refresh_now(uuid, integer) TO authenticated;');
    }
    expect(del).toContain('DROP FUNCTION IF EXISTS public.monitor01_refresh_now(uuid, integer);');
  });
  it('monitor01_stamp (the safety net under Realtime) exists in both files, for the authenticated user, has its index and is dropped by the delete file', () => {
    for (const src of [structure]) {
      expect(src).toContain('CREATE OR REPLACE FUNCTION public.monitor01_stamp(p_project uuid DEFAULT NULL) RETURNS jsonb');
      expect(src).toContain('public.pm_owns_project');
      expect(src).toContain('REVOKE ALL ON FUNCTION public.monitor01_stamp(uuid) FROM PUBLIC, anon;');
      expect(src).toContain('GRANT EXECUTE ON FUNCTION public.monitor01_stamp(uuid) TO authenticated;');
      expect(src).toContain('idx_monitor01_view_updated');
    }
    expect(del).toContain('DROP FUNCTION IF EXISTS public.monitor01_stamp(uuid);');
  });
  it('the constants of the polling are the values the screen is built for', () => {
    expect(RPC_MONITOR01_STAMP).toBe('monitor01_stamp');
    expect(structure).toContain(`FUNCTION public.${RPC_MONITOR01_STAMP}(`);
    expect(MONITOR01_POLL_INTERVAL_MS).toBe(3000);
    expect(MONITOR01_QUEUE_STALE_SECONDS).toBe(MONITOR01_REFRESH_INTERVAL * 3);
  });
  it('the worker is scheduled with the interval function', () => {
    expect(structure).toContain("cron.schedule('monitor01_tick', public.monitor01_refresh_interval_seconds()::text || ' seconds'");
  });
});
