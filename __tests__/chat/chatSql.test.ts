// Chat - the SQL files (PART 50): the part is in both structure files with the same title, the objects exist, the rules of the owner are in the code, the delete file drops it,
// the permission matrix knows the tables. The behaviour itself is tested in Docker: kit8/docker/tests/59_chat.sql.
import { codeSql, readSql, sqlPart, tablesSql } from '../sql/sqlFilesTestKit';

const code = sqlPart(codeSql, 50);
const tables = sqlPart(tablesSql, 50);

describe('PART 50 is in both structure files', () => {
  it('has the same title in start1 and start2', () => {
    expect(tables.split('\n')[0]).toBe('-- PART 50: create_chat.sql');
    expect(code.split('\n')[0]).toBe('-- PART 50: create_chat.sql');
  });
  it('start1 has only the four tables (no function, no trigger, no policy)', () => {
    for (const t of ['chatObjectTable', 'chatThemeTable', 'chatMembersTable', 'chatMessagesTable']) expect(tables).toContain(`CREATE TABLE IF NOT EXISTS public."${t}"`);
    expect(tables).not.toMatch(/CREATE (OR REPLACE )?FUNCTION/);
    expect(tables).not.toMatch(/CREATE (OR REPLACE )?TRIGGER/);
    expect(tables).not.toMatch(/CREATE POLICY/);
  });
  it('one chat object per user and per task; one member row per theme and user', () => {
    expect(tables).toMatch(/uq_chatObject_user[\s\S]*chatKind' = 'user'/);
    expect(tables).toMatch(/uq_chatObject_task[\s\S]*chatKind' = 'task'/);
    expect(tables).toMatch(/uq_chatMembers_theme_user/);
  });
  it('start2 refuses to run without the tables', () => {
    expect(code).toContain('PART 50 needs the tables: run start1_sql_tables.sql first');
  });
});

describe('the rules in the code', () => {
  it('a client only READS the chat tables (no insert / update / delete grant), by membership', () => {
    expect(code).toMatch(/GRANT SELECT ON public\."chatObjectTable", public\."chatThemeTable", public\."chatMembersTable", public\."chatMessagesTable" TO authenticated/);
    expect(code).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*chat(Object|Theme|Members|Messages)Table/);
    for (const p of ['chatObject_select', 'chatTheme_select', 'chatMembers_select', 'chatMessages_select']) expect(code).toContain(`CREATE POLICY "${p}"`);
    expect(code).not.toMatch(/CREATE POLICY "chat\w+_(insert|update|delete)"/);
  });
  it('the RPCs of the chat exist and are granted to signed-in users only', () => {
    const rpcs = ['chat_main_ensure', 'chat_theme_create', 'chat_task_ensure', 'chat_member_add', 'chat_member_remove', 'chat_member_candidates', 'chat_theme_members', 'chat_theme_list',
      'chat_unread_counts', 'chat_mark_read', 'chat_message_send', 'chat_message_edit', 'chat_message_delete', 'chat_set_max_attachment_size'];
    for (const f of rpcs) {
      expect(code).toMatch(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${f}\\(`));
      expect(code).toContain(`public.${f}(`);
    }
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.chat_main_ensure\(\)[\s\S]*FROM PUBLIC, anon;/);
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION public\.chat_main_ensure\(\)[\s\S]*TO authenticated;/);
  });
  it('the members of a task chat follow the Time lines (RACI) through statement triggers', () => {
    expect(code).toContain('trg_task_line_chat_ins');
    expect(code).toContain('trg_task_line_chat_upd');
    expect(code).toContain('trg_task_line_chat_del');
    expect(code).toContain("current_setting('app.task_bulk', true) = 'on'");
    expect(code).toContain('chat_task_raci_users');
  });
  it('only a project manager or an administrator excludes a member; a member from the RACI is removed by the RACI', () => {
    const fn = /CREATE OR REPLACE FUNCTION public\.chat_member_remove[\s\S]*?\n\$\$;/.exec(code)![0];
    expect(fn).toContain('chat_can_manage');
    expect(fn).toContain('comes from Time -> RACI');
    expect(fn).toContain('owner of the theme stays');
    expect(code).not.toMatch(/CREATE OR REPLACE FUNCTION public\.chat_member_leave/);
  });
  it('a link must be http(s) or an address of the app; the file reference comes from the file row', () => {
    const fn = /CREATE OR REPLACE FUNCTION public\.chat_message_insert[\s\S]*?\n\$\$;/.exec(code)![0];
    expect(fn).toContain('https?://');
    expect(fn).toContain("m.\"rowJSON\"->>'fileSourceKind' = 'chat'");
    expect(fn).toContain('chat_max_attachment_bytes');
  });
  it('the limit of an attachment: 1..100 MB, default 10, changed by an administrator or a project manager', () => {
    expect(code).toContain('LEAST(100, GREATEST(1,');
    expect(code).toContain('maximumChatAttachmentFileSize');
    const fn = /CREATE OR REPLACE FUNCTION public\.chat_set_max_attachment_size[\s\S]*?\n\$\$;/.exec(code)![0];
    expect(fn).toContain("'permissionOrganizationAdmin'");
    expect(fn).toContain("'permissionProjectManager'");
  });
  it('the task delete and the organization delete take the chats with them; realtime is on', () => {
    expect(code).toContain('trg_chat_task_delete');
    expect(code).toContain('trg_chat_organization_delete');
    expect(code).toContain("ARRAY['chatObjectTable', 'chatThemeTable', 'chatMembersTable', 'chatMessagesTable']");
  });
  it('a RAISE message has no lone percent sign (a placeholder is %, a percent sign %%) and no COALESCE among its arguments', () => {
    for (const m of code.matchAll(/RAISE EXCEPTION '([^']*)'([^;]*);/g)) {
      const placeholders = (m[1].match(/%(?!%)/g) || []).length - (m[1].match(/%%/g) || []).length * 0;
      const args = (m[2].match(/^\s*,/) ? m[2].split(' USING')[0].split(',').filter((x) => x.trim()).length : 0);
      expect(placeholders).toBe(args);
      expect(m[2]).not.toMatch(/COALESCE\(/);
    }
  });
});

describe('the scope chat of the file attachments (PART 49 changed in place)', () => {
  const files = sqlPart(codeSql, 49);
  it('files_authorize knows the scope chat: the member, the limit, the kind and the reference of the folder', () => {
    const fn = /CREATE OR REPLACE FUNCTION public\.files_authorize[\s\S]*?\n\$\$;/.exec(files)![0];
    expect(fn).toContain("'document', 'chat')");
    expect(fn).toContain('public.chat_is_member(p_guid)');
    expect(fn).toContain("'maxBytes'");
    expect(fn).toContain("'chatKind'");
    expect(fn).toContain("'chatRefGUID'");
    expect(fn).toContain("p_action <> 'move'");
  });
  it('files_list, files_add, files_update, files_delete, files_replace and files_move know it', () => {
    expect(files).toMatch(/WHEN 'chat' THEN m\."rowParentGUID" = p_guid/);
    expect(files).toContain("a chat attachment is at most %");
    expect((files.match(/chat_file_manage_check\(v_row\)/g) || []).length).toBe(3);
    expect(files).toContain('a file never moves into a chat');
  });
  it('the storage of a task chat is the one of its project', () => {
    expect(files).toContain("(lower(COALESCE(p_scope, '')) = 'chat' AND p_project IS NOT NULL)");
  });
  it('the file rows of a chat are read by the members of the theme only (the policy of PART 50 replaces the one of PART 49)', () => {
    expect(code).toMatch(/DROP POLICY IF EXISTS "mediaPost_select"[\s\S]*fileSourceKind' = 'chat' AND "rowParentGUID" IN \(SELECT public\.chat_my_themes\(\)\)/);
    expect(code).toContain(`"rowJSON"->>'fileSourceKind' <> 'chat'`);
  });
});

describe('the delete file and the permission matrix', () => {
  it('delete_sql_structure.sql drops PART 50 first (it is the newest)', () => {
    const del = readSql('delete_sql_structure.sql');
    expect(del).toMatch(/PART 1a-00000000000000000: delete_chat\.sql/);
    for (const t of ['chatMessagesTable', 'chatMembersTable', 'chatThemeTable', 'chatObjectTable']) expect(del).toContain(`DROP TABLE IF EXISTS public."${t}" CASCADE`);
    expect(del.indexOf('delete_chat.sql')).toBeLessThan(del.indexOf('PART 1a-0000000000000000: delete_files.sql'));
  });
  it('the four tables are in the permission matrix with no letters (membership rules)', () => {
    const matrix = require('fs').readFileSync(require('path').join(__dirname, '../../kit8/sql/permissions/permission_matrix.py'), 'utf8');
    for (const t of ['chatObjectTable', 'chatThemeTable', 'chatMembersTable', 'chatMessagesTable']) expect(matrix).toContain(`'${t}': row(*['N'] * 11)`);
  });
});
