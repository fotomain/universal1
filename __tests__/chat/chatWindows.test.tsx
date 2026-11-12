/** @jest-environment jsdom */
// Chat - the two windows: "New theme" (Scenario 1: Title, Description, Message, members - maybe none) and "Members" (add: the owner / a project manager / an administrator; EXCLUDE: only a project manager /
// an administrator; a member from the RACI is changed in task -> Time -> RACI, not here).
import React, { act } from 'react';

const mockCreate = jest.fn();
const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockShowError = jest.fn();
let mockCanManage = false;
let mockMembers: any[] = [];
const mockReload = jest.fn();
jest.mock('../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00', card: '#fff' } }),
}));
jest.mock('../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ label, errorMessage, helperText, leftIcons, heightVariant, hideClearIcon, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('../../kit8/ui/components/common/ErrorModalWindow', () => ({ showErrorModal: (...a: any[]) => mockShowError(...a) }));
jest.mock('../../kit8/chat/useChatClient', () => ({ useChatClient: () => ({}) }));
jest.mock('../../kit8/chat/chatApi', () => ({
  chatThemeCreate: (...a: any[]) => mockCreate(...a),
  chatMemberAdd: (...a: any[]) => mockAdd(...a),
  chatMemberRemove: (...a: any[]) => mockRemove(...a),
}));
jest.mock('../../kit8/chat/useChat', () => ({
  useChatCandidates: () => [{ userGUID: 'u-boris', email: 'boris@x.test', name: 'Boris M' }, { userGUID: 'u-clara', email: 'clara@x.test', name: 'Clara S' }],
  useChatCanManage: () => mockCanManage,
  useChatMembers: () => ({ members: mockMembers, reload: mockReload }),
}));

import ChatNewThemeWindow from '../../kit8/chat/ChatNewThemeWindow';
import ChatMembersWindow from '../../kit8/chat/ChatMembersWindow';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let host: HTMLElement;
const mount = (el: React.ReactElement) => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); act(() => root.render(el)); };
afterEach(() => { act(() => root?.unmount()); host?.remove(); jest.clearAllMocks(); mockCanManage = false; mockMembers = []; });
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const typeInto = (id: string, text: string) => act(() => {
  const el = q(id) as HTMLInputElement | HTMLTextAreaElement;
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('New theme', () => {
  it('needs a title; members are optional', async () => {
    const onCreated = jest.fn();
    mockCreate.mockResolvedValue({ ok: true, data: { rowGUID: 'x' } });
    mount(<ChatNewThemeWindow visible onClose={() => {}} onCreated={onCreated} />);
    press('chat-new-create');
    await settle();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(q('chat-new-error')!.textContent).toContain('title is required');
    typeInto('chat-new-title', 'Budget talk');
    press('chat-new-create');
    await settle();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][1]).toMatchObject({ title: 'Budget talk', description: '', message: '', members: [] });
    expect(onCreated).toHaveBeenCalledTimes(1);
  });
  it('sends the title, description, message and the picked members with an id made by the client', async () => {
    const onCreated = jest.fn();
    mockCreate.mockResolvedValue({ ok: true, data: { rowGUID: 'x' } });
    mount(<ChatNewThemeWindow visible onClose={() => {}} onCreated={onCreated} />);
    typeInto('chat-new-title', ' Budget talk ');
    typeInto('chat-new-description', 'About the budget');
    typeInto('chat-new-message', 'Hello team');
    press('chat-new-member-u-boris');
    press('chat-new-member-u-clara');
    press('chat-new-member-u-clara');   // picked and un-picked
    press('chat-new-create');
    await settle();
    const v = mockCreate.mock.calls[0][1];
    expect(v).toMatchObject({ title: 'Budget talk', description: 'About the budget', message: 'Hello team', members: ['u-boris'] });
    expect(v.themeGUID).toMatch(/^[0-9a-f-]{36}$/i);
    expect(onCreated).toHaveBeenCalledWith(v.themeGUID);
  });
  it('a refusal stays in the window with its words', async () => {
    mockCreate.mockResolvedValue({ ok: false, error: 'A member must be an active member of your organization' });
    const onCreated = jest.fn();
    mount(<ChatNewThemeWindow visible onClose={() => {}} onCreated={onCreated} />);
    typeInto('chat-new-title', 'x');
    press('chat-new-create');
    await settle();
    expect(q('chat-new-error')!.textContent).toContain('active member');
    expect(onCreated).not.toHaveBeenCalled();
  });
});

const member = (userGUID: string, over: any = {}) => ({ userGUID, role: 'member', raci: false, manual: true, email: `${userGUID}@x.test`, name: userGUID.toUpperCase(), ...over });
const members = (isOwner: boolean, kind: 'user' | 'task' = 'user') => mount(<ChatMembersWindow visible themeGUID="t1" isOwner={isOwner} kind={kind} onClose={() => {}} />);

describe('Members', () => {
  beforeEach(() => {
    mockMembers = [member('anna', { role: 'owner' }), member('boris'), member('clara', { raci: true, manual: false }), member('dora', { raci: true, manual: true })];
  });
  it('lists the members with the owner and RACI marks', () => {
    members(false);
    expect(q('chat-members-row-anna')!.textContent).toContain('owner');
    expect(q('chat-members-row-clara')!.textContent).toContain('RACI');
    expect(q('chat-members-row-boris')!.textContent).not.toContain('RACI');
  });
  it('a plain member (not the owner, not a manager) can neither add nor exclude', () => {
    members(false);
    expect(q('chat-members-add-u-boris')).toBeNull();
    expect(q('chat-members-remove-boris')).toBeNull();
  });
  it('the OWNER of the theme may add members but NOT exclude anybody (only a project manager or an administrator excludes)', async () => {
    mockAdd.mockResolvedValue({ ok: true, data: 1 });
    members(true);
    expect(q('chat-members-add-u-boris')).not.toBeNull();
    expect(q('chat-members-remove-boris')).toBeNull();
    press('chat-members-add-u-clara');
    await settle();
    expect(mockAdd).toHaveBeenCalledWith({}, 't1', ['u-clara']);
    expect(mockReload).toHaveBeenCalled();
  });
  it('a project manager / administrator excludes a member added by hand; not the owner, not a member who comes from the RACI only', async () => {
    mockCanManage = true;
    mockRemove.mockResolvedValue({ ok: true, data: true });
    members(false, 'task');
    expect(q('chat-members-remove-anna')).toBeNull();
    expect(q('chat-members-remove-clara')).toBeNull();
    expect(q('chat-members-remove-boris')).not.toBeNull();
    expect(q('chat-members-remove-dora')).not.toBeNull();   // RACI and added by hand: only the hand part goes
    press('chat-members-remove-boris');
    await settle();
    expect(mockRemove).toHaveBeenCalledWith({}, 't1', 'boris');
  });
  it('the chat of a task of a READ-ONLY project: the list is shown, nobody is added or excluded - also not by the owner or a manager', () => {
    mockCanManage = true;
    mount(<ChatMembersWindow visible themeGUID="t1" isOwner kind="task" readOnly onClose={() => {}} />);
    expect(q('chat-members-row-boris')).not.toBeNull();
    expect(q('chat-members-add-u-boris')).toBeNull();
    expect(q('chat-members-remove-boris')).toBeNull();
    expect(q('chat-members-remove-dora')).toBeNull();
  });
  it('a refusal of the database is shown in the error window', async () => {
    mockCanManage = true;
    mockRemove.mockResolvedValue({ ok: false, error: 'Only a project manager or an administrator excludes a member' });
    members(false);
    press('chat-members-remove-boris');
    await settle();
    expect(mockShowError).toHaveBeenCalled();
    expect(mockShowError.mock.calls[0][0]).toContain('excludes a member');
  });
});
