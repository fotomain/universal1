// The constants of kit8/pm/reports/monitor01 must be the values the database has (PART 25 of start_sql_structure.sql), and the SQL files must carry the same parts.
import * as fs from 'fs';
import * as path from 'path';
import {
  MONITOR01_BATCH_SIZE, MONITOR01_MAX_ATTEMPTS, MONITOR01_REFRESH_INTERVAL, MONITOR01_RUN_BUDGET_MS, MONITOR01_VIEW_TABLE, RPC_MONITOR01_SUM_SOURCES,
} from '../../../../kit8/pm/reports/monitor01/monitor01Constants';
import { FACT_HEADER_TABLE, FACT_STRONG_INPUT_SETTING, FACT_SUMMARY_TABLE, FACT_TIMELINE_TABLE, RPC_FACT_CREATE, RPC_FACT_POST, RPC_FACT_UNPOST } from '../../../../kit8/pm/fact/factInputModel';

const sqlDir = path.join(__dirname, '../../../../kit8/sql/start');
const read = (f: string) => fs.readFileSync(path.join(sqlDir, f), 'utf8');
const structure = read('start_sql_structure.sql');
const code = read('start_sql_code.sql');
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
  const names = [MONITOR01_VIEW_TABLE, FACT_HEADER_TABLE, FACT_TIMELINE_TABLE, FACT_SUMMARY_TABLE, RPC_MONITOR01_SUM_SOURCES, RPC_FACT_CREATE, RPC_FACT_POST, RPC_FACT_UNPOST];
  it.each(names)('%s', (name) => {
    expect(structure).toMatch(new RegExp(`(TABLE IF NOT EXISTS public\\.${name}\\b|FUNCTION public\\.${name}\\()`));
  });
  it('the project setting is read by the document creation', () => {
    expect(structure).toContain(`"rowJSON"->'${FACT_STRONG_INPUT_SETTING}'`);
  });
});

describe('the structure file, the code file and the delete file carry the same parts', () => {
  const body = (src: string, from: string) => { const i = src.indexOf(from); const j = src.indexOf('-- END of start_sql_structure.sql'); return src.slice(i, j); };
  const marker = '-- PART 24: create_task_fact_input.sql';
  it('PART 24 and 25 are mirrored 1:1 into start_sql_code.sql', () => {
    expect(structure).toContain(marker);
    expect(code).toContain(marker);
    expect(body(code, marker)).toBe(body(structure, marker));
  });
  it('the delete file removes every table the parts create', () => {
    for (const t of [MONITOR01_VIEW_TABLE, FACT_SUMMARY_TABLE, FACT_HEADER_TABLE, FACT_TIMELINE_TABLE, 'monitor01_dirty', 'monitor01_refresh_log']) expect(del).toContain(`DROP TABLE IF EXISTS public.${t}`);
    expect(del).toContain("cron.unschedule('monitor01_tick')");
  });
  it('every function of the parts is dropped by the delete file', () => {
    const part = body(structure, marker);
    const created = [...part.matchAll(/CREATE OR REPLACE (?:FUNCTION|PROCEDURE) public\.(\w+)\(/g)].map((m) => m[1]);
    expect(created.length).toBeGreaterThan(20);
    for (const fn of created) expect(del).toMatch(new RegExp(`DROP (?:FUNCTION|PROCEDURE) IF EXISTS public\\.${fn}\\(`));
  });
  it('the worker is scheduled with the interval function', () => {
    expect(structure).toContain("cron.schedule('monitor01_tick', public.monitor01_refresh_interval_seconds()::text || ' seconds'");
  });
});
