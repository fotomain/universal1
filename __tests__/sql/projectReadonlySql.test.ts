// PART 51 (the READ-ONLY PROJECT) in the SQL files: the helper, the guard triggers on every table of project data, the quiet automatic writes, the delete file.
// The behaviour is tested on Postgres: kit8/docker/tests/44_project_readonly.sql.
import { codeSql, readSql, sqlPart, tablesSql } from './sqlFilesTestKit';

const part = sqlPart(codeSql, 51);
const deleteSql = readSql('delete_sql_structure.sql');

describe('PART 51: read-only project', () => {
  it('is a part of the code file only (no table: the switch is a key of project_table.rowJSON)', () => {
    expect(part).toContain('-- PART 51: create_project_readonly.sql');
    expect(sqlPart(tablesSql, 51)).toBe('');
    expect(tablesSql).toContain('--   51. create_project_readonly.sql');
  });
  it('project_is_readonly is defined in PART 1, before every function that asks it', () => {
    const at = codeSql.indexOf('CREATE OR REPLACE FUNCTION public.project_is_readonly(p_project uuid)');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(codeSql.indexOf('-- PART 2: '));
    expect(codeSql).toContain(`p."rowJSON"->'projectIsReadonly' = 'true'::jsonb`);
  });
  it('the guard looks at the session: a signed-in user is refused, the SQL editor and the workers pass', () => {
    expect(part).toContain('IF p_project IS NULL OR auth.uid() IS NULL THEN');
    expect(part).toMatch(/RAISE EXCEPTION 'Read-only project "%": nothing can be changed \(%\)/);
  });
  it('every table of project data has the trigger zz_project_readonly; project_table has aa_project_readonly', () => {
    for (const t of [
      'project_task_table', 'project_task_dependencies_table', 'task_line_table', 'task_payment_plan_lines', 'project_subproject_link', 'task_fact_header', 'task_fact_usage_timeline',
      'vendor_invoice_lines', 'purchase_order_lines', 'product_receipt_lines', 'customer_invoice_lines', 'project_payment_fact_lines', 'project_kanban_stage_table',
      'project_task_kanban_state_table', 'project_timesheet_lines', 'project_timesheet_lines_data_entered',
      'vendor_invoice_header', 'purchase_order_header', 'product_receipt_header', 'customer_invoice_header', 'project_payment_fact_header', 'project_timesheet_header',
    ]) {
      expect(part).toMatch(new RegExp(`\\('${t}',\\s+'project_readonly_guard_`));
    }
    expect(part).toContain("CREATE TRIGGER zz_project_readonly BEFORE INSERT OR UPDATE OR DELETE ON public.%I");
    // the personal view settings are NOT project data
    expect(part).not.toMatch(/\('project_user_settings_table'/);
  });
  it('the project row: only the switch may change, the project is not deleted', () => {
    expect(part).toContain(`(NEW."rowJSON" - 'projectIsReadonly') IS DISTINCT FROM (OLD."rowJSON" - 'projectIsReadonly')`);
    expect(part).toContain('it cannot be deleted (project_table)');
    expect(part).toContain('CREATE OR REPLACE FUNCTION public.project_set_readonly(p_project uuid, p_readonly boolean) RETURNS boolean');
    expect(part).toContain('GRANT EXECUTE ON FUNCTION public.project_set_readonly(uuid, boolean) TO authenticated;');
  });
  it('the automatic writes of an open dashboard are quiet, Post is refused, the interface is told', () => {
    const fn = (name: string) => codeSql.slice(codeSql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)).split('\n$$;')[0];
    expect(fn('pm_apply_schedule')).toContain('public.project_is_readonly(p_project_guid)');
    expect(fn('pm_set_task_last_edit_place')).toContain('public.project_is_readonly(');
    expect(fn('pm_kanban_ensure_project_stages')).toContain('public.project_is_readonly(p_project)');
    expect(fn('subproject_sync_origin_task')).toContain('public.project_is_readonly(l."rowProjectGUID")');
    expect(fn('create_task_line_plan')).toContain("public.project_readonly_check(v_project, 'task_line_plan')");
    expect(fn('post_task_payment_plan')).toContain('public.project_readonly_check(v_project,');
    expect(fn('unpost_task_payment_plan')).toContain('public.project_readonly_check(v_project,');
    expect(fn('perm_my_matrix')).toContain("'projectIsReadonly', p_project IS NOT NULL AND public.project_is_readonly(p_project)");
  });
  it('members, versions, chat and files are closed too', () => {
    for (const [t, f] of [
      ['version_project_table', 'project_readonly_guard_row_guid'], ['project_permission_profile_user_table', 'project_readonly_guard_owner_text'],
      ['chatMessagesTable', 'project_readonly_guard_chat_message'], ['chatThemeTable', 'project_readonly_guard_chat_theme'], ['mediaPostTable', 'project_readonly_guard_media_post'],
    ]) {
      expect(part).toMatch(new RegExp(`\\('${t}',\\s+'${f}'`));
    }
    const fn = (name: string) => codeSql.slice(codeSql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)).split('\n$$;')[0];
    expect(fn('files_authorize')).toContain(`'reason', 'projectReadonly'`);
    expect(fn('chat_member_add')).toContain(`public.project_readonly_check_theme(p_theme, 'chatMembersTable')`);
    expect(fn('chat_member_remove')).toContain(`public.project_readonly_check_theme(p_theme, 'chatMembersTable')`);
    expect(fn('chat_theme_list')).toContain(`'projectIsReadonly', public.project_is_readonly(`);
    // the read mark of a chat is the user's own: not closed
    expect(fn('chat_mark_read')).not.toContain('project_readonly');
  });
  it('a NEW project is never read-only: the key is taken off an inserted row', () => {
    expect(part).toContain('CREATE TRIGGER aa_project_readonly BEFORE INSERT OR UPDATE OR DELETE ON public.project_table');
    expect(part).toContain(`NEW."rowJSON" := NEW."rowJSON" - 'projectIsReadonly'`);
  });
  it('the delete file drops the triggers and the functions', () => {
    expect(deleteSql).toContain("t.tgname IN ('aa_project_readonly', 'zz_project_readonly')");
    expect(deleteSql).toContain("p.proname IN ('project_set_readonly', 'project_is_readonly')");
    expect(deleteSql).toContain('delete_project_readonly.sql');
  });
});
