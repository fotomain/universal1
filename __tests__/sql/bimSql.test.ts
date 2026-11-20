// SQL PART 55 (BIM): the files, the numbering, the matrix, the delete scripts. The behaviour is tested in Docker (kit8/docker/tests/104_bim.sql, test_bim_example1.sh).
import * as fs from 'fs';
import * as path from 'path';

const dir = path.join(__dirname, '..', '..', 'kit8', 'sql', 'start');
const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
const TABLES = ['bim_model_table', 'bim_storey_table', 'bim_chunk_table', 'bim_element_table', 'bim_property_table', 'bim_import_job_table', 'bim_storage_cleanup_table'];
const RPCS = ['bim_import_begin', 'bim_import_add_rows', 'bim_import_commit', 'bim_import_fail', 'bim_delete_model', 'bim_model_manifest', 'bim_elements_page', 'bim_property_get', 'bim_elements_of_task', 'bim_task_of_element', 'bim_storage_cleanup_confirm', 'bim_storage_cleanup_pending', 'bim_storage_setup'];

describe('SQL PART 55 (BIM)', () => {
  const s1 = read('start1_sql_tables.sql');
  const s2 = read('start2_sql_code.sql');
  const del = read('delete_sql_structure.sql');

  it('start1 has the PART 55 banner and the seven tables, start2 the same part number', () => {
    expect(s1).toMatch(/^-- PART 55: create_bim\.sql$/m);
    expect(s2).toMatch(/^-- PART 55: create_bim\.sql$/m);
    for (const t of TABLES) expect(s1).toContain(`CREATE TABLE IF NOT EXISTS public.${t}`);
  });

  it('start1 holds only tables (no function / trigger / policy of PART 55)', () => {
    const part = s1.slice(s1.indexOf('-- PART 55: create_bim.sql'), s1.indexOf('-- END of start1_sql_tables.sql'));
    expect(part).not.toMatch(/CREATE (OR REPLACE )?(FUNCTION|TRIGGER|POLICY|VIEW)/i);
    expect(part).not.toMatch(/GRANT /i);
  });

  it('every table is read only for a client: RLS on, SELECT policy, no insert / update / delete grant', () => {
    for (const t of TABLES.filter((x) => x !== 'bim_storage_cleanup_table')) expect(s2).toContain(`'${t}'`);
    expect(s2).toMatch(/GRANT SELECT ON public\.%I TO authenticated/);
    expect(s2).not.toMatch(/GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*bim_/i);
    expect(s2).toMatch(/ALTER TABLE public\.bim_storage_cleanup_table ENABLE ROW LEVEL SECURITY/);
  });

  it('the RPCs exist, are SECURITY DEFINER and are granted to authenticated, not to anon', () => {
    for (const f of RPCS) expect(s2).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${f}\\(`));
    expect(s2).toMatch(/REVOKE ALL ON FUNCTION public\.%s FROM PUBLIC, anon/);
    for (const f of ['bim_import_begin', 'bim_import_commit', 'bim_delete_model']) {
      const body = s2.slice(s2.indexOf(`FUNCTION public.${f}(`));
      expect(body.slice(0, 1200)).toMatch(/SECURITY DEFINER/);
    }
  });

  it('every write RPC asks the permission and the read-only guard', () => {
    for (const f of ['bim_import_begin', 'bim_delete_model']) {
      const start = s2.indexOf(`FUNCTION public.${f}(`);
      const body = s2.slice(start, s2.indexOf('$$;', start));
      expect(body).toMatch(/perm_require\('bim_model_table'/);
      expect(body).toMatch(/project_readonly_check\(/);
    }
    const imp = s2.slice(s2.indexOf('FUNCTION public.bim_import_model('), s2.indexOf('FUNCTION public.bim_import_add_rows('));
    expect(imp).toMatch(/perm_require/);
    expect(imp).toMatch(/project_readonly_check/);
  });

  it('projectIsBIMBased is a switch of the user: no guard trigger is created (an old one is dropped), the RPCs set it', () => {
    expect(s2).not.toMatch(/CREATE TRIGGER ab_project_bim/);
    expect(s2).toMatch(/DROP TRIGGER IF EXISTS ab_project_bim ON public\.project_table/);
    expect(s2).toMatch(/DROP FUNCTION IF EXISTS public\.bim_project_guard\(\)/);
    expect(s2).toMatch(/'\{"projectIsBIMBased": true\}'/);
  });

  it('a template / copy does not carry the BIM keys of a task', () => {
    const fn = s2.slice(s2.lastIndexOf('FUNCTION public.task_template_clean_task('));
    expect(fn.slice(0, 900)).toMatch(/'bimIfcGuid' - 'bimGroupKey' - 'bimStoreyGuid' - 'bimIfcClass'/);
  });

  it('the Storage bucket and its policies are made by one idempotent function, called in start2', () => {
    expect(s2).toMatch(/FUNCTION public\.bim_storage_setup\(\)/);
    expect(s2).toMatch(/^SELECT public\.bim_storage_setup\(\);$/m);
    for (const p of ['bim_objects_select', 'bim_objects_insert', 'bim_objects_delete']) expect(s2).toContain(p);
    expect(s2).toMatch(/DROP POLICY IF EXISTS bim_objects_select/);
  });

  it('delete_sql_structure.sql drops every table and function of the part, first (newest)', () => {
    expect(del).toMatch(/^-- PART 1a-0000000000000000000000: delete_bim\.sql/m);
    for (const t of TABLES) expect(del).toContain(`DROP TABLE IF EXISTS public.${t} CASCADE`);
    for (const f of [...RPCS, 'bim_project_guard', 'bim_chunk_after_delete', 'bim_import_model', 'bim_storage_project', 'bim_storage_upload_ok']) expect(del).toContain(`DROP FUNCTION IF EXISTS public.${f}(`);
    expect(del.indexOf('delete_bim.sql')).toBeLessThan(del.indexOf('delete_application_admin.sql  (PART 54'));
  });

  it('delete_bim_data.sql: the two switches, the queue, no direct delete from storage.objects', () => {
    const d = read('delete_bim_data.sql');
    expect(d).toMatch(/v_project\s+uuid\s+:= NULL/);
    expect(d).toMatch(/v_delete_tasks boolean := false/);
    expect(d).toContain('bim_storage_cleanup_table');
    expect(d).not.toMatch(/DELETE FROM storage\.objects/i);
    expect(d).toMatch(/projectIsBIMBased/);
  });

  it('the seven tables are in the permission matrix (project group: project manager CRUD, the others read)', () => {
    const m = fs.readFileSync(path.join(__dirname, '..', '..', 'kit8', 'sql', 'permissions', 'permission_matrix.py'), 'utf8');
    for (const t of TABLES) expect(m).toContain(t);
    const seed = read('start4_sql_insert_missing.sql');
    for (const t of TABLES) expect(seed).toContain(`'${t}'`);
  });
});
