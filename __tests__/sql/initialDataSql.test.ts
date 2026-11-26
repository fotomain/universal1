// PART 60 (INITIAL PROGRAM DATA) in the SQL files: the functions, the whitelist (= the definition of the application), the grants, the delete file.
import { INITIAL_TABLES } from '../../kit8/initial/data/code/initialDataModel';
import { codeSql, readSql, sqlPart, tablesSql } from './sqlFilesTestKit';

const part2 = sqlPart(codeSql, 60);
const deleteSql = readSql('delete_sql_structure.sql');

describe('PART 60: initial program data', () => {
  it('has a banner in the code file and no table in the tables file', () => {
    expect(part2).toContain('-- PART 60: create_initial_data.sql');
    expect(tablesSql).not.toMatch(/^-- PART 60: /m);
    expect(tablesSql).toContain('create_initial_data.sql');
  });
  it('the whitelist of initial_data_tables() is the definition of the application: same tables, same mode, same key column, same write level', () => {
    const body = /initial_data_tables\(\)[\s\S]*?AS v\(tbl, mode, keycol, level\)/.exec(part2)![0];
    const rows = Array.from(body.matchAll(/\('([^']+)',\s*'(guid|json)',\s*(NULL|'[^']+'),\s*'(admin|application)'\)/g)).map((m) => ({ table: m[1], mode: m[2], key: m[3] === 'NULL' ? undefined : m[3].slice(1, -1), level: m[4] }));
    expect(rows.map((r) => r.table).sort()).toEqual(INITIAL_TABLES.map((t) => t.table).sort());
    for (const t of INITIAL_TABLES) {
      const r = rows.find((x) => x.table === t.table)!;
      expect(r.mode).toBe(t.mode);
      expect(r.key).toBe(t.keyColumn);
      expect(r.level).toBe(t.level ?? 'admin');
    }
  });
  it('the functions are SECURITY DEFINER with a fixed search_path and are granted to authenticated only', () => {
    for (const fn of ['initial_data_bootstrap_possible()', 'initial_data_can_write(p_level text DEFAULT', 'initial_data_status(p_check jsonb DEFAULT', 'initial_data_install(p_table text, p_rows jsonb)', 'initial_data_fill_calendars()', 'initial_data_bootstrap_admin()']) {
      const at = part2.indexOf(`FUNCTION public.${fn}`);
      expect(at).toBeGreaterThan(-1);
      const head = part2.slice(at, at + 260);
      expect(head).toContain('SECURITY DEFINER SET search_path = public, extensions');
    }
    for (const fn of ['initial_data_tables()', 'initial_data_email()', 'initial_data_bootstrap_possible()', 'initial_data_can_write(text)', 'initial_data_status(jsonb)', 'initial_data_install(text, jsonb)', 'initial_data_fill_calendars()', 'initial_data_bootstrap_admin()']) {
      expect(part2).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon;`);
      expect(part2).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO authenticated;`);
    }
  });
  it('install only inserts: ON CONFLICT DO NOTHING, no UPDATE, no DELETE, at most 1000 rows, the order of the array is kept', () => {
    const install = /FUNCTION public\.initial_data_install[\s\S]*?\$\$;\s/.exec(part2)![0];
    expect(install).toContain('ON CONFLICT DO NOTHING');
    expect(install).toContain('ORDER BY e.ord');
    expect(install).toContain('at most 1000 rows');
    expect(install).not.toMatch(/\bUPDATE\b|\bDELETE\b/);
  });
  it('the first administrator: the caller\'s own e-mail, one at a time, only while nobody is one and there is at most one registered user', () => {
    expect(part2).toContain('pg_advisory_xact_lock(hashtext(\'initial_data_bootstrap_admin\'))');
    expect(part2).toContain('(SELECT count(*) FROM public."userTable") <= 1');
    expect(part2).toContain('NOT EXISTS (SELECT 1 FROM public.application_permission_table');
    expect(part2).toContain(`'permissionApplicationAdmin:' || v_email`);
  });
  it('a RAISE of this part has as many arguments as placeholders', () => {
    for (const m of part2.matchAll(/RAISE EXCEPTION '([^']*)'([^;]*);/g)) {
      const placeholders = (m[1].match(/%/g) || []).length;
      const args = m[2].replace(/USING[\s\S]*$/, '').split(',').filter((x) => x.trim()).length;
      expect(args).toBe(placeholders);
    }
  });
  it('the delete file drops the functions, as the newest part (it runs first)', () => {
    expect(deleteSql).toContain('-- PART 1a-000000000000000000000000000: delete_initial_data.sql');
    for (const fn of ['initial_data_bootstrap_admin()', 'initial_data_fill_calendars()', 'initial_data_install(text, jsonb)', 'initial_data_status(jsonb)', 'initial_data_can_write(text)', 'initial_data_bootstrap_possible()', 'initial_data_email()', 'initial_data_tables()']) expect(deleteSql).toContain(`DROP FUNCTION IF EXISTS public.${fn};`);
    expect(deleteSql.indexOf('delete_initial_data.sql  (PART 60')).toBeLessThan(deleteSql.indexOf('delete_user_settings.sql  (PART 59'));
  });
});
