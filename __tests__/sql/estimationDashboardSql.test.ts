// PART 58 (ESTIMATION DASHBOARD) in the SQL files: ten estimation_ tables with the generic shape, the permission, the policies, the guards, the seeds, the delete file.
// The behaviour is tested on Postgres: kit8/docker/tests/108_estimation_dashboard.sql.
import { codeSql, readSql, sqlPart, tablesSql } from './sqlFilesTestKit';

const CATALOGS = ['estimation_norm_book_catalog', 'estimation_norm_catalog', 'estimation_resource_catalog', 'estimation_coefficient_catalog', 'estimation_export_template_catalog', 'estimation_index_history', 'estimation_overhead_profit_table'];
const PROJECT = ['estimation_document_table', 'estimation_line_table', 'estimation_market_quote_table'];
const part1 = sqlPart(tablesSql, 58);
const part2 = sqlPart(codeSql, 58);
const deleteSql = readSql('delete_sql_structure.sql');

describe('PART 58: estimation dashboard', () => {
  it('has the same title in both files and every table starts with estimation_', () => {
    expect(part1).toContain('-- PART 58: create_estimation_dashboard.sql');
    expect(part2).toContain('-- PART 58: create_estimation_dashboard.sql');
    for (const t of [...CATALOGS, ...PROJECT]) expect(part1).toContain(`CREATE TABLE IF NOT EXISTS public.${t} (`);
    expect((part1.match(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g) ?? []).every((m) => m.includes('public.estimation_'))).toBe(true);
  });
  it('every table has the generic shape rowGUID / rowOwnerGUID / rowParentGUID / rowJSON / orderInList', () => {
    const tables = part1.split('CREATE TABLE IF NOT EXISTS').slice(1);
    expect(tables.length).toBe(10);
    for (const t of tables) for (const col of ['"rowGUID"', '"rowOwnerGUID"', '"rowParentGUID"', '"rowJSON"', '"orderInList"']) expect(t).toContain(col);
  });
  it('all tables go through kit8_setup_def_table; the catalogs are read by everybody and written by the managers, the project data by project access', () => {
    for (const t of [...CATALOGS, ...PROJECT]) expect(part2).toContain(`'${t}'`);
    expect(part2).toContain('PERFORM public.kit8_setup_def_table(t);');
    expect(part2).toContain('FOR SELECT TO authenticated USING (true)');
    expect(part2).toContain('WITH CHECK (public.permission_estimation_manager())');
    expect(part2).toContain('public.estimation_project_access("rowOwnerGUID", true)');
  });
  it('permissionEstimationManager: organization administrator, project manager, application administrator, or an assignment row; perm_my_matrix answers it', () => {
    expect(part2).toContain('CREATE OR REPLACE FUNCTION public.permission_estimation_manager()');
    expect(part2).toContain('public.permission_application_admin()');
    expect(part2).toContain('public.organization_is_admin(v_org)');
    expect(part2).toContain(`'permissionProjectManager' = ANY`);
    expect(part2).toContain(`'permissionEstimationManager'`);
    expect(codeSql).toContain(`'canManageEstimation', public.permission_estimation_manager()`);
  });
  it('a read-only project is never written (PART 51) and a uuid check protects the project column', () => {
    expect(part2).toContain('IF public.project_is_readonly(v) THEN RETURN false; END IF;');
    expect(part2).toContain('[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}');
  });
  it('the money of a line is checked in all three currencies; a deleted project takes its estimate data', () => {
    for (const k of ['sumForBudget', 'sumForAccounting', 'sumForConsolidation']) expect(part2).toContain(`'${k}'`);
    expect(part2).toContain('CREATE TRIGGER trg_project_estimation_data_delete AFTER DELETE ON public.project_table');
  });
  it('the seeds are the tree World Norms (v2) -> 6 continents -> Russia, in start4 and start5', () => {
    for (const f of ['start4_sql_insert_missing.sql', 'start5_sql_upsert_all.sql']) {
      const s = readSql(f);
      expect(s).toContain(`'estWorldNorms2'`);
      expect(s).toContain('World Norms (v2)');
      for (const c of ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania']) expect(s).toContain(`"title": "${c}"`);
    }
  });
  it('the delete file drops the tables (data included) in the newest part', () => {
    expect(deleteSql).toContain('-- PART 1a-0000000000000000000000000: delete_estimation_dashboard.sql');
    for (const t of [...CATALOGS, ...PROJECT]) expect(deleteSql).toContain(`DROP TABLE IF EXISTS public.${t} CASCADE;`);
    expect(deleteSql).toContain('DROP FUNCTION IF EXISTS public.permission_estimation_manager();');
    expect(deleteSql.indexOf('PART 1a-0000000000000000000000000:')).toBeLessThan(deleteSql.indexOf('PART 1a-000000000000000000000000:'));
  });
});
