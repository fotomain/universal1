// SQL PART 52 (documentation/CONSOLIDATION_WBS.html) as TEXT: the twin columns, the obligatory currency, the files. The behaviour is tested by Docker: kit8/docker/tests/100_consolidation.sql.
import { codeSql, readSql, sqlPart, tablesSql } from './sqlFilesTestKit';

const t52 = sqlPart(tablesSql, 52);
const c52 = sqlPart(codeSql, 52);
const del = readSql('delete_sql_structure.sql');
const cron = readSql('start3_sql_pg_cron.sql');

describe('PART 52 tables (start1): only tables', () => {
  it('the twin columns of the four movement tables, the queue and the gap table', () => {
    for (const col of ['sumForConsolidation', 'vatForConsolidation', 'vatInCostForConsolidation']) expect(t52).toContain(`public.project_status_movements ADD COLUMN IF NOT EXISTS "${col}"`);
    for (const tbl of ['cash_account_ledger_movements', 'partner_balance_movements', 'task_payment_plan_movements']) expect(t52).toContain(`public.${tbl} ADD COLUMN IF NOT EXISTS "sumForConsolidation"`);
    expect(t52).toContain('CREATE UNLOGGED TABLE IF NOT EXISTS public.consolidation_dirty');
    expect(t52).toContain('CREATE TABLE IF NOT EXISTS public.consolidation_gap_table');
    expect(t52).not.toMatch(/^\s*CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/m);
  });
  it('NO document / line table has a consolidation column', () => {
    const tables = [...tablesSql.matchAll(/CREATE (?:UNLOGGED )?TABLE IF NOT EXISTS (?:public\.)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/g)];
    const withCol = tables.filter((m) => /consolidation/i.test(m[2]) && m[1] !== 'consolidation_dirty' && m[1] !== 'consolidation_gap_table').map((m) => m[1]);
    expect(withCol).toEqual([]);
    const alters = [...t52.matchAll(/ALTER TABLE public\.(\w+) ADD COLUMN IF NOT EXISTS "(\w*Consolidation)"/g)].map((m) => m[1]);
    expect([...new Set(alters)].sort()).toEqual(['cash_account_ledger_movements', 'partner_balance_movements', 'project_status_movements', 'task_payment_plan_movements']);
  });
});

describe('PART 52 code (start2)', () => {
  it('the functions of the plan', () => {
    for (const f of ['consolidation_settings', 'fx_consolidation_currency', 'fx_consolidation_rate_type', 'consolidation_amount', 'consolidation_factor', 'consolidation_apply', 'consolidation_rebuild', 'consolidation_retry_gaps',
      'consolidation_process_dirty', 'consolidation_refresh_now', 'consolidation_status', 'consolidation_report', 'consolidation_gap_list', 'consolidation_verify', 'organization_consolidation_guard', 'project_currency_guard']) {
      expect(c52).toContain(`CREATE OR REPLACE FUNCTION public.${f}(`);
    }
  });
  it('the currency is obligatory: the guard refuses an empty / malformed one, fills a missing one and protects the state', () => {
    expect(c52).toContain("obligatory (a 3 letter ISO code)");
    expect(c52).toContain("trg_organizationTable_consolidation BEFORE INSERT OR UPDATE ON public.\"organizationTable\"");
    expect(c52).toContain('app.consolidation_system');
    expect(c52).toContain('UPDATE public."organizationTable" o SET "rowJSON" = o."rowJSON" WHERE NOT (o."rowJSON" ? \'currencyForConsolidation\')'); // Q12: the old organizations
  });
  it('the apply is set-based (one factor per project + day, MATERIALIZED) and never refuses a Post (a gap row instead)', () => {
    expect(c52).toContain('k AS MATERIALIZED (SELECT DISTINCT prj, d FROM n)');
    expect(c52).toContain('consolidation_gap_table');
    expect(c52).not.toMatch(/consolidation_apply[\s\S]{0,4000}RAISE EXCEPTION 'consolidation_apply: no rate/);
  });
  it('the partner register guard lets the apply pass; the clients cannot call the worker', () => {
    expect(codeSql).toContain("current_setting('app.consolidation_apply', true), '') = 'on' THEN RETURN NEW");
    expect(c52).toContain('REVOKE ALL ON FUNCTION public.consolidation_process_dirty(integer, text) FROM PUBLIC, anon, authenticated');
    expect(c52).toContain('REVOKE ALL ON FUNCTION public.consolidation_verify(text) FROM PUBLIC, anon, authenticated');
    expect(c52).toContain('GRANT EXECUTE ON FUNCTION public.consolidation_status() TO authenticated');
  });
  it('the report is SECURITY INVOKER (the policies decide which projects the user sees)', () => {
    const report = /CREATE OR REPLACE FUNCTION public\.consolidation_report\([\s\S]*?\$\$;/.exec(c52)![0];
    expect(report).not.toContain('SECURITY DEFINER');
  });
  it('the two VAT switches act at read time: the amount function reads them, the worker is not queued by them', () => {
    expect(c52).toContain('p_include_purchase boolean, p_include_sale boolean');
    expect(/v_changed := [^;]*consolidationInclude/.test(c52)).toBe(false);
  });
});

describe('the other files', () => {
  it('the pg_cron job consolidation_tick every 10 seconds', () => {
    expect(cron).toContain("cron.schedule('consolidation_tick', '10 seconds', 'SELECT public.consolidation_process_dirty()')");
    expect(cron).toContain("'consolidation_tick', 'files_cleanup_tick'");
  });
  it('the delete file drops PART 52 first (the newest) with the job, the triggers, the functions, the tables and the columns', () => {
    const first = del.indexOf('delete_consolidation.sql  (PART 52');
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(del.indexOf('delete_project_readonly.sql  (PART 51'));
    const body = del.slice(first, del.indexOf('delete_project_readonly.sql  (PART 51'));
    for (const x of ["cron.unschedule('consolidation_tick')", 'DROP TABLE IF EXISTS public.consolidation_gap_table', 'DROP TABLE IF EXISTS public.consolidation_dirty', 'DROP COLUMN IF EXISTS', 'trg_project_table_currency_guard', 'trg_consolidation_rate']) {
      expect(body).toContain(x);
    }
  });
});
