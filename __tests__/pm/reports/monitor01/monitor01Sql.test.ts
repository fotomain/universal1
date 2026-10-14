// The constants of kit8/pm/reports/monitor01 must be the values the database has (PART 25 of start1_sql_structure.sql), and the SQL files must carry the same parts.
import * as fs from 'fs';
import * as path from 'path';
import {
  MONITOR01_BATCH_SIZE, MONITOR01_MAX_ATTEMPTS, MONITOR01_REFRESH_INTERVAL, MONITOR01_RUN_BUDGET_MS, MONITOR01_VIEW_TABLE, RPC_MONITOR01_SUM_SOURCES,
} from '../../../../kit8/pm/reports/monitor01/monitor01Constants';
import { FACT_HEADER_TABLE, FACT_STRONG_INPUT_SETTING, FACT_SUMMARY_TABLE, FACT_USAGE_TIMELINE_TABLE, RPC_FACT_CREATE, RPC_FACT_POST, RPC_FACT_UNPOST } from '../../../../kit8/pm/fact/factInputModel';

const sqlDir = path.join(__dirname, '../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const structure = read('start1_sql_structure.sql');
const code = read('start2_sql_code.sql');
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
  const body = (src: string, from: string) => { const i = src.indexOf(from); const j = src.indexOf('-- END of start1_sql_structure.sql'); return src.slice(i, j); };
  const marker = '-- PART 24: create_task_fact_input.sql';
  it('PART 24 and 25 are mirrored 1:1 into start2_sql_code.sql', () => {
    expect(structure).toContain(marker);
    expect(code).toContain(marker);
    expect(body(code, marker)).toBe(body(structure, marker));
  });
  it('the delete file removes every table the parts create', () => {
    for (const t of [MONITOR01_VIEW_TABLE, FACT_SUMMARY_TABLE, FACT_HEADER_TABLE, FACT_USAGE_TIMELINE_TABLE, 'monitor01_dirty', 'monitor01_refresh_log']) expect(del).toContain(`DROP TABLE IF EXISTS public.${t}`);
    expect(del).toContain("cron.unschedule('monitor01_tick')");
  });
  it('every function of the parts is dropped by the delete file', () => {
    const part = body(structure, marker);
    const created = [...part.matchAll(/CREATE OR REPLACE (?:FUNCTION|PROCEDURE) public\.(\w+)\(/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(20);
    for (const fn of created) expect(del).toMatch(new RegExp(`DROP (?:FUNCTION|PROCEDURE) IF EXISTS public\\.${fn}\\(`));
  });
  it('monitor01_view carries sumForBudget (table, upgrade, fresh rows, apply, verify) in the structure and the code file', () => {
    for (const src of [structure, code]) {
      expect(src).toMatch(/"sumForBudget"\s+NUMERIC\(18,2\) NOT NULL DEFAULT 0,\n  "qtyRestToContract"/);
      expect(src).toContain('ALTER TABLE public.monitor01_view ADD COLUMN IF NOT EXISTS "sumForBudget"');
      expect(src).toContain('DROP FUNCTION IF EXISTS public.monitor01_fresh_rows(uuid[]);');
      expect(src).toContain('SUM(COALESCE(m."sumForBudget", 0)) AS budget');
      expect(src).toContain('"qtyContracted", "sumForBudget", "qtyUsed", "lineCount", "hasStalePlan")');                // the apply column list
      expect(src.match(/[fv]\."qtyContracted", [fv]\."sumForBudget", [fv]\."qtyUsed", [fv]\."lineCount"/g)!.length).toBeGreaterThanOrEqual(5);   // apply select + verify (4)
      expect(src).toContain('"sumForBudget" = EXCLUDED."sumForBudget", "qtyUsed" = EXCLUDED."qtyUsed", "lineCount" = EXCLUDED."lineCount"');
    }
  });
  it('the POSTED facts feed qtyUsed: fresh rows = plan FULL JOIN monitor01_fresh_fact_rows (defined before it), the drill-down "used" lists the fact lines, tasks with facts are queued on upgrade', () => {
    for (const src of [structure, code]) {
      const factFn = src.indexOf('CREATE OR REPLACE FUNCTION public.monitor01_fresh_fact_rows');
      const rowsFn = src.indexOf('CREATE OR REPLACE FUNCTION public.monitor01_fresh_rows');
      expect(factFn).toBeGreaterThan(0);
      expect(factFn).toBeLessThan(rowsFn);                                                          // a SQL function body is checked when it is created
      const body = src.slice(rowsFn, src.indexOf('\n$$;\n', rowsFn));
      expect(body).toContain('public.monitor01_fresh_fact_rows(p_tasks)');
      expect(body).toContain('"qtyUsed" numeric');
      expect(body).toContain('UNION SELECT task, genus, role, unit, month FROM fact');             // a fact without a plan still gets its row
      expect(src).toContain("ELSIF p_measure IN ('fact', 'used') THEN");
      expect(src).toContain("ELSIF p_measure = 'delivered' THEN");
      expect(src).toMatch(/SELECT DISTINCT f\."rowOwnerGUID", 'install' FROM public\.task_fact_usage_timeline f/);
    }
  });
  it('monitor01_refresh_now exists in both files, is for the authenticated user (SECURITY DEFINER, own projects only) and is dropped by the delete file', () => {
    for (const src of [structure, code]) {
      expect(src).toContain('CREATE OR REPLACE FUNCTION public.monitor01_refresh_now(p_project uuid DEFAULT NULL, p_max integer DEFAULT 2000) RETURNS jsonb');
      expect(src).toContain('public.pm_owns_project(x.pr)');
      expect(src).toContain('GRANT EXECUTE ON FUNCTION public.monitor01_refresh_now(uuid, integer) TO authenticated;');
    }
    expect(del).toContain('DROP FUNCTION IF EXISTS public.monitor01_refresh_now(uuid, integer);');
  });
  it('the worker is scheduled with the interval function', () => {
    expect(structure).toContain("cron.schedule('monitor01_tick', public.monitor01_refresh_interval_seconds()::text || ' seconds'");
  });
});
