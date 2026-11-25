// PART 57 (PROJECT ESTIMATION) in the SQL files: no table, three functions, the guard trigger of the key, the delete file.
// The behaviour is tested on Postgres: kit8/docker/tests/107_project_estimation.sql.
import { codeSql, readSql, sqlPart, tablesSql } from './sqlFilesTestKit';

const part = sqlPart(codeSql, 57);
const deleteSql = readSql('delete_sql_structure.sql');

describe('PART 57: project estimation', () => {
  it('is a part of the code file only (no table: the link is a key of project_table.rowJSON)', () => {
    expect(part).toContain('-- PART 57: create_project_estimation.sql');
    expect(sqlPart(tablesSql, 57)).toBe('');
    expect(tablesSql).toContain('--   57. create_project_estimation.sql');
    expect(codeSql).toContain('--   57. create_project_estimation.sql');
  });
  it('the functions are SECURITY INVOKER (the policies decide) and granted to authenticated only', () => {
    for (const f of ['project_estimation_project(uuid)', 'project_estimation_summary(uuid, uuid)', 'project_delete_task_roots(uuid, uuid[])']) {
      expect(part).toContain(`REVOKE ALL ON FUNCTION public.${f} FROM PUBLIC, anon;`);
      expect(part).toContain(`GRANT EXECUTE ON FUNCTION public.${f} TO authenticated;`);
    }
    expect(part).not.toMatch(/SECURITY DEFINER/);
  });
  it('the summary reads the saved budget sums of the task lines per budget item and refuses an unreadable source', () => {
    expect(part).toContain(`l."rowJSON"->>'budgetItemTaskLine'`);
    expect(part).toContain(`jsonb_typeof(l."rowJSON"->'sumForBudget') = 'number'`);
    expect(part).toContain(`RAISE EXCEPTION 'No permission: the estimation project does not exist or you cannot read it'`);
    expect(part).toContain(`public.perm_can_in('project_task_table', 'C', p_target)`);
  });
  it('the delete of roots is a bulk delete that honours the read-only project and refuses a row that is not a top-level row', () => {
    expect(part).toContain(`PERFORM set_config('app.task_bulk', 'on', true);`);
    expect(part).toContain(`public.project_readonly_check(p_project, 'project_task_table')`);
    expect(part).toContain('nlevel(t."treePath") = 2');
    expect(part).toContain('are not top-level rows of this project');
  });
  it('the guard checks only a CHANGE of the key, never itself, same organization; clearing is free', () => {
    expect(part).toContain('IF v_new IS NULL OR v_new IS NOT DISTINCT FROM v_old THEN');
    expect(part).toContain('A project cannot be its own estimation');
    expect(part).toContain('The estimation project belongs to another organization');
    expect(part).toContain('CREATE TRIGGER trg_project_estimation_guard BEFORE INSERT OR UPDATE ON public.project_table');
  });
  it('the delete file drops them in the newest part, before PART 56', () => {
    expect(deleteSql).toMatch(/^-- PART 1a-000000000000000000000000: delete_project_estimation\.sql/m);
    expect(deleteSql.indexOf('PART 1a-000000000000000000000000:')).toBeLessThan(deleteSql.indexOf('PART 1a-00000000000000000000000:'));
    for (const d of ['DROP TRIGGER IF EXISTS trg_project_estimation_guard ON public.project_table;', 'DROP FUNCTION IF EXISTS public.project_estimation_guard();',
      'DROP FUNCTION IF EXISTS public.project_estimation_summary(uuid, uuid);', 'DROP FUNCTION IF EXISTS public.project_estimation_project(uuid);',
      'DROP FUNCTION IF EXISTS public.project_delete_task_roots(uuid, uuid[]);']) expect(deleteSql).toContain(d);
  });
  it('nothing in the seed files', () => {
    expect(readSql('start4_sql_insert_missing.sql')).not.toMatch(/-- PART 57:/);
    expect(readSql('start5_sql_upsert_all.sql')).not.toMatch(/-- PART 57:/);
  });
});
