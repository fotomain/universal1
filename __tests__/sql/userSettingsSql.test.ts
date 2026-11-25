// PART 59 (USER SETTINGS) in the SQL files: userSettingsTable, the column rowFolderGUID of the universal schema, the RPCs, the policies, the delete file.
// The behaviour is tested on Postgres: kit8/docker/tests/111_user_settings.sql.
import { codeSql, readSql, sqlPart, tablesSql } from './sqlFilesTestKit';

const part1 = sqlPart(tablesSql, 59);
const part2 = sqlPart(codeSql, 59);
const deleteSql = readSql('delete_sql_structure.sql');

describe('PART 59: user settings', () => {
  it('has the same title in both files', () => {
    expect(part1).toContain('-- PART 59: create_user_settings.sql');
    expect(part2).toContain('-- PART 59: create_user_settings.sql');
  });
  it('the table: user + device type + OS, unique, checked', () => {
    expect(part1).toContain('CREATE TABLE IF NOT EXISTS public."userSettingsTable" (');
    for (const col of ['"rowGUID"', '"rowOwnerGUID"', '"rowParentGUID"', '"rowFolderGUID"', '"orderInList"', '"rowJSON"']) expect(part1).toContain(col);
    expect(part1).toContain('CONSTRAINT user_settings_unique UNIQUE ("rowOwnerGUID", "rowParentGUID", "rowFolderGUID")');
    expect(part1).toContain(`"rowParentGUID" IN ('desktop', 'phone', 'tablet')`);
    expect(part1).toContain(`"rowFolderGUID" IN ('macos', 'windows', 'android', 'ios', 'ipados', 'linux', 'other')`);
  });
  it('rowFolderGUID joins the universal schema: every table with the five generic columns gets it, idempotently', () => {
    expect(part1).toContain(`ADD COLUMN IF NOT EXISTS "rowFolderGUID" TEXT NOT NULL DEFAULT ''empty''`);
    for (const col of ['rowGUID', 'rowOwnerGUID', 'rowParentGUID', 'orderInList', 'rowJSON']) expect(part1).toContain(`'${col}'`);
    expect(part1).toContain('NOT c.relispartition');
  });
  it('only the own rows are visible and writable; no anonymous access', () => {
    expect(part2).toContain(`PERFORM public.kit8_setup_def_table(t);`);
    expect(part2).toContain('REVOKE ALL ON public.%I FROM anon, authenticated');
    for (const op of ['select', 'insert', 'update', 'delete']) expect(part2).toContain(`t || '_${op}'`);
    expect(part2.match(/"rowOwnerGUID" = \(SELECT public\.app_user_guid\(\)\)::text/g)!.length).toBeGreaterThanOrEqual(5);
  });
  it('the RPCs: upsert merges, touch moves lastUsedAt only, copy_from refuses the same device; granted to signed-in users only', () => {
    for (const fn of ['user_settings_upsert', 'user_settings_touch', 'user_settings_copy_from']) {
      expect(part2).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
      expect(part2).toContain(`REVOKE ALL ON FUNCTION public.${fn}(`);
      expect(part2).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO authenticated`));
    }
    expect(part2).toContain('ON CONFLICT ON CONSTRAINT user_settings_unique');
    expect(part2).toContain(`public."userSettingsTable"."rowJSON" || EXCLUDED."rowJSON"`);
    expect(part2).toContain('the source and the target are the same device');
  });
  it('a guard keeps rowJSON an object with lastUsedAt and a uxuiState object', () => {
    expect(part2).toContain('CREATE TRIGGER aa_user_settings_guard BEFORE INSERT OR UPDATE ON public."userSettingsTable"');
    expect(part2).toContain(`'lastUsedAt'`);
    expect(part2).toContain('uxuiState must be a JSON object');
  });
  it('realtime is on; the RAISE placeholders match their arguments; the code refuses to run without the tables', () => {
    expect(part2).toContain(`ALTER PUBLICATION supabase_realtime ADD TABLE public."userSettingsTable"`);
    // a RAISE message of this part has no lone percent sign (only % placeholders with arguments)
    for (const m of part2.matchAll(/RAISE EXCEPTION '([^']*)'([^;]*);/g)) {
      const placeholders = (m[1].match(/%/g) || []).length;
      const args = m[2].replace(/USING[\s\S]*$/, '').split(',').filter((x) => x.trim()).length;
      expect(args).toBe(placeholders);
    }
    expect(part2).toContain('needs the tables: run start1_sql_tables.sql first');
  });
  it('the delete file drops the table, the functions and the guard, as the newest part (it runs first)', () => {
    expect(deleteSql).toContain('-- PART 1a-00000000000000000000000000: delete_user_settings.sql');
    expect(deleteSql).toContain('DROP TABLE IF EXISTS public."userSettingsTable" CASCADE;');
    for (const fn of ['user_settings_upsert(text, text, jsonb)', 'user_settings_touch(text, text)', 'user_settings_copy_from(text, text, text, text)', 'user_settings_guard()']) expect(deleteSql).toContain(`DROP FUNCTION IF EXISTS public.${fn};`);
    expect(deleteSql.indexOf('delete_user_settings.sql  (PART 59')).toBeLessThan(deleteSql.indexOf('delete_estimation_dashboard.sql  (PART 58'));
  });
  it('the table is in the permission matrix as an own table', () => {
    const matrix = readSql('../permissions/permission_matrix.py');
    expect(matrix).toContain('userSettingsTable');
  });
});
