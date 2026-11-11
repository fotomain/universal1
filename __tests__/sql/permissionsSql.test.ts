// SQL PARTs 46 + 47 (documentation/PERMISSIONS_WBS.html): the permission tables, the functions, the seed generated from kit8/sql/permissions, the enforcement and the delete file.
// The behaviour is tested by Docker: kit8/docker/tests/49_permission_profiles.sql and 53_permission_enforcement.sql.
import * as fs from 'fs';
import * as path from 'path';
import { codeSql, readSql, sqlPart, tablesSql } from './sqlFilesTestKit';

const permDir = path.join(__dirname, '../../kit8/sql/permissions');
const matrixPy = fs.readFileSync(path.join(permDir, 'permission_matrix.py'), 'utf8');
const rewritePy = fs.readFileSync(path.join(permDir, 'rewrite_owner_checks.py'), 'utf8');
const guardPy = fs.readFileSync(path.join(permDir, 'guard_document_rpcs.py'), 'utf8');
const part46 = sqlPart(codeSql, 46);
const part47 = sqlPart(codeSql, 47);
const del = readSql('delete_sql_structure.sql');

describe('PART 46: the tables (start1) and the functions (start2)', () => {
  const tables = sqlPart(tablesSql, 46);
  it('five tables with the generic columns', () => {
    for (const t of ['project_permission_profile_catalog', 'project_permission_profile_crud_table', 'project_permission_profile_uxui_table', 'project_permission_profile_user_table', 'task_user_permission_table']) {
      expect(tables).toContain(`CREATE TABLE IF NOT EXISTS public.${t} (`);
    }
    expect(tables).toContain('uq_permission_crud');
    expect(tables).toContain('uq_permission_user');
    expect(tables).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY)/);
  });
  it('the functions of the plan are there', () => {
    for (const f of ['perm_profiles', 'perm_set_of', 'perm_can', 'perm_require', 'perm_my_matrix', 'pm_can_access_project', 'perm_field_check', 'perm_changed_fields', 'task_user_permission_rebuild', 'task_user_permission_verify', 'permission_backfill']) {
      expect(part46).toContain(`CREATE OR REPLACE FUNCTION public.${f}(`);
    }
    expect(part46).toContain('trg_project_permission_creator');
    expect(part46).toContain('zz_perm_task_lock');
    expect(part46).toContain('zz_perm_line_lock');
  });
  it('perm_can_in is plpgsql and defined next to pm_owns_project, so a LANGUAGE sql function of an early PART can call it', () => {
    const m = /CREATE OR REPLACE FUNCTION public\.perm_can_in\([\s\S]*?\$\$;/.exec(codeSql)![0];
    expect(m).toContain('LANGUAGE plpgsql');
    expect(codeSql.indexOf('FUNCTION public.perm_can_in(')).toBeLessThan(codeSql.indexOf('FUNCTION public.task_fact_header_state('));
  });
});

describe('the seed is generated from the matrix data', () => {
  const s4 = readSql('start4_sql_insert_missing.sql');
  const s5 = readSql('start5_sql_upsert_all.sql');
  const block = (s: string) => /-- BEGIN GENERATED PERMISSION SEED[\s\S]*?-- END GENERATED PERMISSION SEED/.exec(s)![0];
  it('start4 inserts, start5 upserts, with the same rows', () => {
    const a = block(s4);
    const b = block(s5);
    expect(a).toContain('ON CONFLICT ("rowGUID") DO NOTHING');
    expect(b).toContain('DO UPDATE SET');
    expect(a.replace(/ON CONFLICT[^;]*;/g, '')).toBe(b.replace(/ON CONFLICT[^;]*;/g, ''));
  });
  it('11 profiles, 135 tables and 25 interface objects', () => {
    const a = block(s4);
    expect(a.match(/\('permission[A-Za-z]+', 'permissionCatalog', 'empty'/g)).toHaveLength(11);
    const crud = a.slice(a.indexOf('INSERT INTO public."project_permission_profile_crud_table"'), a.indexOf('INSERT INTO public."project_permission_profile_uxui_table"'));
    expect(crud.match(/^ {4}\('[A-Za-z0-9_]+', ARRAY\[/gm)).toHaveLength(135);
    const ux = a.slice(a.indexOf('INSERT INTO public."project_permission_profile_uxui_table"'));
    expect(ux.match(/^ {4}\('permission[A-Za-z0-9]+', ARRAY\[/gm)).toHaveLength(25);
  });
  it('the matrix data names every table once and the sets are known letters', () => {
    expect(matrixPy).toContain("'project_task_table': row('R', 'CRUD', 'R', 'R', 'R', 'R', 'R', 'RU', 'RU', 'R', 'R')");
    expect(matrixPy).toContain("('permissionTaskResponsible', 'project_task_table'): {'permissionWritableFields': ['rowProgress']}");
  });
  it('every table of the seed exists in the structure files (a typo would silently be a table in no row)', () => {
    const a = block(s4);
    const crud = a.slice(a.indexOf('INSERT INTO public."project_permission_profile_crud_table"'), a.indexOf('INSERT INTO public."project_permission_profile_uxui_table"'));
    const names = Array.from(crud.matchAll(/^ {4}\('([A-Za-z0-9_]+)', ARRAY\[/gm)).map((m) => m[1]);
    const known = (n: string) => new RegExp(`(CREATE TABLE IF NOT EXISTS|CREATE TABLE) (public\\.)?"?${n}"?\\b`).test(tablesSql) || new RegExp(`(CREATE|ALTER) (TABLE|VIEW) (IF NOT EXISTS )?(public\\.)?"?${n}"?\\b`).test(codeSql + tablesSql);
    // the tables the app creates by kit8_setup_def_table(...) / loops are found by name anywhere in the structure
    const anywhere = (n: string) => (tablesSql + codeSql).includes(n);
    expect(names.filter((n) => !known(n) && !anywhere(n))).toEqual([]);
  });
});

describe('PART 47: the enforcement', () => {
  it('the matrix policies sit next to the owner floor (PERMISSIVE) and use the set functions', () => {
    expect(part47).toContain('perm_projects(%L, %L)');
    expect(part47).toContain('perm_tasks(%L, %L)');
    expect(part47).toContain("'_perm_select'");
    expect(part47).toContain('AS RESTRICTIVE FOR DELETE');
  });
  it('the project is created only with the right C; the catalogs are written by the administrator (insert: project manager)', () => {
    expect(part47).toContain("perm_can('project_table', 'C')");
    expect(part47).toContain("perm_can(%L, %L)");
  });
  it('the owner policies are NOT rewritten: no DROP POLICY of a floor policy except project_table_insert and the catalogs', () => {
    expect(part47).not.toMatch(/DROP POLICY IF EXISTS (task_line|project_task|task_payment_plan)_(select|update|delete|insert)/);
  });
  it('the RPC rewrite left no owner test in the mapped functions', () => {
    const names = Array.from(rewritePy.matchAll(/^\s+'([a-z0-9_]+)': \('[a-z0-9_]+', '[CRUD]'\)/gm)).map((m) => m[1]);
    for (const m of Array.from(rewritePy.matchAll(/'([a-z0-9_]+)': \('[a-z0-9_]+', '[CRUD]'\)/g))) if (!names.includes(m[1])) names.push(m[1]);
    expect(names.length).toBeGreaterThan(50);
    for (const n of names) {
      const defs = Array.from(codeSql.matchAll(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${n}\\([\\s\\S]*?\\n\\$\\$;`, 'g'))).map((x) => x[0]);
      expect(defs.length).toBeGreaterThan(0);
      for (const d of defs) expect(d).not.toContain('pm_owns_project(');
    }
  });
  it('the document RPCs without a project start with the matrix', () => {
    const names = Array.from(guardPy.matchAll(/'([a-z0-9_]+)': \('[a-z0-9_]+', '[CRUD]'\)/g)).map((m) => m[1]);
    expect(names.length).toBe(16);
    for (const n of names) for (const d of Array.from(codeSql.matchAll(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${n}\\([\\s\\S]*?\\n\\$\\$;`, 'g'))).map((x) => x[0])) expect(d).toContain('perm_require(');
  });
  it('pm_apply_schedule writes the dates only for who may change them', () => {
    const f = /CREATE OR REPLACE FUNCTION public\.pm_apply_schedule\([\s\S]*?\n\$\$;/.exec(codeSql)![0];
    expect(f).toContain("perm_field_check('project_task_table', p_project_guid, NULL, ARRAY['startAt', 'rowDuration'])");
  });
});

describe('the delete file drops what the two parts created', () => {
  it('has its own section, first, and names every function and table', () => {
    expect(del.indexOf('PART 1a-00000000000000')).toBeLessThan(del.indexOf('PART 1a-0000000000000:'));
    const created = Array.from((part46 + part47).matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_0-9]+)\(/g)).map((m) => m[1]);
    created.push('perm_can_in');
    expect(created.length).toBeGreaterThan(25);
    for (const f of created) expect(del).toContain(`public.${f}(`);
    for (const t of ['project_permission_profile_catalog', 'project_permission_profile_crud_table', 'project_permission_profile_uxui_table', 'project_permission_profile_user_table', 'task_user_permission_table']) expect(del).toContain(`DROP TABLE IF EXISTS public.${t}`);
  });
});
