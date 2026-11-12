// Chat - the calls to the chat_ RPCs (kit8/chat/chatApi.ts): the names and arguments, the answer shape, the words of a refusal.
import * as api from '../../kit8/chat/chatApi';

const client = (answer: { data?: any; error?: any }) => {
  const rpc = jest.fn(() => Promise.resolve({ data: answer.data ?? null, error: answer.error ?? null }));
  return { rpc } as any;
};

describe('every call is one RPC with the arguments the SQL wants', () => {
  it.each([
    ['chatMainEnsure', [], 'chat_main_ensure', {}],
    ['chatThemeList', [], 'chat_theme_list', {}],
    ['chatUnreadCounts', [], 'chat_unread_counts', {}],
    ['chatMarkRead', ['T1'], 'chat_mark_read', { p_theme: 'T1' }],
    ['chatTaskEnsure', ['K1'], 'chat_task_ensure', { p_task: 'K1' }],
    ['chatMessageEdit', ['M1', 'new'], 'chat_message_edit', { p_message: 'M1', p_text: 'new' }],
    ['chatMessageDelete', ['M1'], 'chat_message_delete', { p_message: 'M1' }],
    ['chatMemberCandidates', [], 'chat_member_candidates', {}],
    ['chatThemeMembers', ['T1'], 'chat_theme_members', { p_theme: 'T1' }],
    ['chatMemberAdd', ['T1', ['U1']], 'chat_member_add', { p_theme: 'T1', p_users: ['U1'] }],
    ['chatMemberRemove', ['T1', 'U1'], 'chat_member_remove', { p_theme: 'T1', p_user: 'U1' }],
    ['chatCanManage', ['T1'], 'chat_can_manage', { p_theme: 'T1' }],
    ['chatSetMaxAttachmentSize', [20], 'chat_set_max_attachment_size', { p_mb: 20 }],
  ])('%s -> %s', async (fn, args, rpcName, rpcArgs) => {
    const sb = client({ data: 'x' });
    const r = await (api as any)[fn as string](sb, ...(args as any[]));
    expect(sb.rpc).toHaveBeenCalledWith(rpcName, rpcArgs);
    expect(r).toEqual({ ok: true, data: 'x' });
  });

  it('a new theme: title, description, first message and the members (maybe none)', async () => {
    const sb = client({ data: { rowGUID: 'T1' } });
    await api.chatThemeCreate(sb, { themeGUID: 'T1', title: 'Budget', description: 'About', message: 'Hello', members: ['U1'] });
    expect(sb.rpc).toHaveBeenCalledWith('chat_theme_create', { p_theme: 'T1', p_title: 'Budget', p_description: 'About', p_message: 'Hello', p_members: ['U1'] });
    await api.chatThemeCreate(sb, { themeGUID: 'T2', title: 'Only a title' });
    expect(sb.rpc).toHaveBeenLastCalledWith('chat_theme_create', { p_theme: 'T2', p_title: 'Only a title', p_description: null, p_message: null, p_members: [] });
  });

  it('a message: the id made by the client, the text, the separate urls and the file references', async () => {
    const sb = client({ data: { rowGUID: 'M1' } });
    await api.chatMessageSend(sb, { messageGUID: 'M1', themeGUID: 'T1', text: 'see', urls: [{ url: 'https://a.com' }], files: [{ fileGUID: 'F1', url: '/files/view?post=F1' }] });
    expect(sb.rpc).toHaveBeenCalledWith('chat_message_send', { p_message: 'M1', p_theme: 'T1', p_text: 'see', p_urls: [{ url: 'https://a.com' }], p_files: [{ fileGUID: 'F1', url: '/files/view?post=F1' }] });
    await api.chatMessageSend(sb, { messageGUID: 'M2', themeGUID: 'T1' });
    expect(sb.rpc).toHaveBeenLastCalledWith('chat_message_send', { p_message: 'M2', p_theme: 'T1', p_text: null, p_urls: [], p_files: [] });
  });
});

describe('a refusal comes back as words, never as a throw', () => {
  it('the technical prefix of the database is cut', async () => {
    const r = await api.chatMemberRemove(client({ error: { message: 'No permission: chat, only a project manager or an administrator excludes a member' } }), 'T1', 'U1');
    expect(r).toEqual({ ok: false, error: 'Only a project manager or an administrator excludes a member' });
  });
  it('no client, or a client that throws', async () => {
    expect(await api.chatThemeList(null)).toEqual({ ok: false, error: 'Not connected.' });
    const bad = { rpc: () => { throw new Error('network down'); } } as any;
    expect(await api.chatThemeList(bad)).toEqual({ ok: false, error: 'Network down' });
  });
});

describe('the files of a theme are the scope chat of the file attachments', () => {
  it('the target is the theme (and the project of a task chat)', () => {
    expect(api.chatFileTarget('T1', 'P1')).toEqual({ scope: 'chat', guid: 'T1', projectGUID: 'P1' });
    expect(api.chatFileTarget('T1')).toEqual({ scope: 'chat', guid: 'T1', projectGUID: null });
  });
});
