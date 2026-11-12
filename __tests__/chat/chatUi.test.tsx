/** @jest-environment jsdom */
// Chat - the pieces of the screens that carry the rules of the request: the red number of the app bar (and that it disappears), a message (text with links, link cards, files by URL,
// "file deleted", edit / delete of the author), the input (THE CURSOR IS IN IT, Enter sends, attach with the limit, add link).
import React, { act } from 'react';

const mockPick = jest.fn();
const mockUpload = jest.fn();
jest.mock('../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00', card: '#fff' } }),
}));
jest.mock('../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled, accessibilityState: { disabled: !!disabled } }, R.createElement(Text, null, icon)) };
});
jest.mock('../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ label, errorMessage, helperText, leftIcons, heightVariant, hideClearIcon, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../../kit8/chat/useChat', () => ({ useChatUnread: () => ({ counts: [], total: 0, reload: () => {} }) }));
jest.mock('../../kit8/files/common/pickFiles', () => ({ pickFiles: (...a: any[]) => mockPick(...a), fromWebFile: (f: any) => f }));
jest.mock('../../kit8/chat/chatApi', () => ({ ...jest.requireActual('../../kit8/chat/chatApi'), uploadChatFile: (...a: any[]) => mockUpload(...a) }));

import { ChatBadgeView } from '../../kit8/chat/ChatBadge';
import ChatMessageBubble from '../../kit8/chat/ChatMessageBubble';
import ChatMessageInput from '../../kit8/chat/ChatMessageInput';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

let root: any;
let host: HTMLElement;
const mount = (el: React.ReactElement) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(el));
};
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; mockPick.mockReset(); mockUpload.mockReset(); });

const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const settle = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const typeInto = (id: string, text: string) => act(() => {
  const el = q(id) as HTMLInputElement | HTMLTextAreaElement;
  if (!el) throw new Error(`${id} not found`);
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const key = (id: string, k: string, shiftKey = false) => act(() => { q(id)!.dispatchEvent(new KeyboardEvent('keydown', { key: k, shiftKey, bubbles: true, cancelable: true })); });

describe('the red number of the application bar', () => {
  it('is not there while nothing is unread - the icon disappears when everything is read', () => {
    mount(<ChatBadgeView total={0} color="#000" onPress={() => {}} />);
    expect(q('appbar-chat')).toBeNull();
  });
  it('shows the chat icon and the number; above 99 it says 99+; a press opens the chat', () => {
    const onPress = jest.fn();
    mount(<ChatBadgeView total={3} color="#000" onPress={onPress} />);
    expect(q('appbar-chat-icon')!.textContent).toBe('chat');
    expect(q('appbar-chat-count')!.textContent).toBe('3');
    press('appbar-chat');
    expect(onPress).toHaveBeenCalledTimes(1);
    act(() => root.render(<ChatBadgeView total={150} color="#000" onPress={onPress} />));
    expect(q('appbar-chat-count')!.textContent).toBe('99+');
    act(() => root.render(<ChatBadgeView total={0} color="#000" onPress={onPress} />));
    expect(q('appbar-chat')).toBeNull();
  });
});

const msg = (over: any = {}, json: any = {}) => ({ rowGUID: 'm1', rowOwnerGUID: 'u1', rowParentGUID: 't1', created_at: '2026-11-11T10:15:00', rowJSON: { text: 'hello', ...json }, ...over });
const bubble = (message: any, props: Record<string, any> = {}) => {
  const onOpenLink = jest.fn(); const onEdit = jest.fn(); const onDelete = jest.fn();
  mount(<ChatMessageBubble message={message} mine={false} authorName="Anna K" existingFiles={null} onOpenLink={onOpenLink} onEdit={onEdit} onDelete={onDelete} {...props} />);
  return { onOpenLink, onEdit, onDelete };
};

describe('a message', () => {
  it('shows the text, the author, and a link of the text opens by its address', () => {
    const { onOpenLink } = bubble(msg({}, { text: 'see https://example.com/a. thanks' }));
    expect(q('chat-message-m1')!.textContent).toContain('Anna K');
    expect(q('chat-message-m1-text')!.textContent).toBe('see https://example.com/a. thanks');
    act(() => { q('chat-message-m1-textlink-1')!.click(); });
    expect(onOpenLink).toHaveBeenCalledWith('https://example.com/a');
  });
  it('a link sent apart from the text is a card that opens its address; a file is a chip that opens its URL (the viewer), name and size shown', () => {
    const { onOpenLink } = bubble(msg({}, { text: undefined, urls: [{ url: 'https://example.com/x', title: 'The site' }], files: [{ fileGUID: 'F1', url: '/files/view?post=F1', name: 'plan.pdf', size: 2097152, kind: 'pdf' }] }));
    expect(q('chat-message-m1-url-0')!.textContent).toContain('The site');
    expect(q('chat-message-m1-file-0')!.textContent).toContain('plan.pdf');
    expect(q('chat-message-m1-file-0')!.textContent).toContain('2.0 MB');
    press('chat-message-m1-url-0');
    press('chat-message-m1-file-0');
    expect(onOpenLink.mock.calls).toEqual([['https://example.com/x'], ['/files/view?post=F1']]);
  });
  it('the same file attached at two places gives two chips with the same URL', () => {
    const f = { fileGUID: 'F1', url: '/files/view?post=F1', name: 'a.txt', size: 10 };
    const { onOpenLink } = bubble(msg({}, { files: [f, f] }));
    press('chat-message-m1-file-0'); press('chat-message-m1-file-1');
    expect(onOpenLink.mock.calls).toEqual([['/files/view?post=F1'], ['/files/view?post=F1']]);
  });
  it('a file that was deleted from the theme says so and does not open; the others still open', () => {
    const { onOpenLink } = bubble(msg({}, { files: [{ fileGUID: 'F1', url: '/files/view?post=F1', name: 'gone.txt' }, { fileGUID: 'F2', url: '/files/view?post=F2', name: 'here.txt' }] }), { existingFiles: new Set(['F2']) });
    expect(q('chat-message-m1-file-gone-0')!.textContent).toContain('file deleted');
    expect(q('chat-message-m1-file-0')).toBeNull();
    press('chat-message-m1-file-1');
    expect(onOpenLink).toHaveBeenCalledWith('/files/view?post=F2');
  });
  it('a deleted message shows only "This message was deleted."', () => {
    bubble(msg({}, { deleted: true, text: undefined }));
    expect(q('chat-message-m1-deleted')!.textContent).toBe('This message was deleted.');
    expect(q('chat-message-m1-text')).toBeNull();
  });
  it('only the author edits or deletes: the buttons are on my message only', () => {
    bubble(msg());
    expect(q('chat-message-m1-edit')).toBeNull();
    expect(q('chat-message-m1-delete')).toBeNull();
    act(() => root.unmount());
    host.remove();
    const { onEdit, onDelete } = bubble(msg({}, { editedAt: '2026-11-11T11:00:00' }), { mine: true });
    expect(q('chat-message-m1')!.textContent).toContain('edited');
    press('chat-message-m1-delete');
    expect(onDelete).toHaveBeenCalledWith('m1');
    press('chat-message-m1-edit');
    typeInto('chat-message-m1-edit-input', 'changed text');
    press('chat-message-m1-edit-save');
    expect(onEdit).toHaveBeenCalledWith('m1', 'changed text');
  });
  it('the chat of a task of a READ-ONLY project: my message has no Edit / Delete', () => {
    bubble(msg(), { mine: true, readOnly: true });
    expect(q('chat-message-m1')).not.toBeNull();
    expect(q('chat-message-m1-edit')).toBeNull();
    expect(q('chat-message-m1-delete')).toBeNull();
  });
});

const input = (props: Record<string, any> = {}) => {
  const onSend = jest.fn(() => Promise.resolve(true));
  const onFilesChanged = jest.fn();
  mount(<ChatMessageInput themeGUID="t1" projectGUID="p1" maxBytes={5 * 1048576} attachAvailable files={[]} onFilesChanged={onFilesChanged} onSend={onSend} {...props} />);
  return { onSend, onFilesChanged };
};

describe('the input of a theme', () => {
  it('THE CURSOR IS IN THE INPUT when the theme opens', async () => {
    input();
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    expect(document.activeElement).toBe(q('chat-input-text'));
  });
  it('Send is off while there is nothing to send; the text is sent trimmed, the input is emptied and keeps the cursor', async () => {
    const { onSend } = input();
    expect((q('chat-input-send') as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true');
    typeInto('chat-input-text', '  hello team  ');
    press('chat-input-send');
    await settle();
    expect(onSend).toHaveBeenCalledWith({ text: 'hello team', urls: [], files: [] });
    expect((q('chat-input-text') as HTMLTextAreaElement).value).toBe('');
    expect(document.activeElement).toBe(q('chat-input-text'));
  });
  it('Enter sends, Shift+Enter does not', async () => {
    const { onSend } = input();
    typeInto('chat-input-text', 'one');
    key('chat-input-text', 'Enter', true);
    await settle();
    expect(onSend).not.toHaveBeenCalled();
    key('chat-input-text', 'Enter', false);
    await settle();
    expect(onSend).toHaveBeenCalledTimes(1);
  });
  it('a refused send keeps the text', async () => {
    const onSend = jest.fn(() => Promise.resolve(false));
    mount(<ChatMessageInput themeGUID="t1" maxBytes={1048576} attachAvailable files={[]} onFilesChanged={() => {}} onSend={onSend} />);
    typeInto('chat-input-text', 'keep me');
    press('chat-input-send');
    await settle();
    expect((q('chat-input-text') as HTMLTextAreaElement).value).toBe('keep me');
  });
  it('Attach is off with the reason when files are not available (no storage connected)', () => {
    input({ attachAvailable: false, attachHint: 'Google Drive is not connected.' });
    expect(q('chat-input-attach')!.getAttribute('aria-disabled')).toBe('true');
  });
  it('a file above the organization limit is refused BEFORE the upload; a file under it is uploaded into the theme and goes with the message as a URL', async () => {
    const { onSend, onFilesChanged } = input();
    press('chat-input-attach');
    mockPick.mockResolvedValue([{ name: 'big.bin', mime: 'application/octet-stream', size: 6 * 1048576, blob: {} }]);
    await act(async () => { q('chat-input-upload')!.click(); await Promise.resolve(); });
    await settle();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(q('chat-input-error')!.textContent).toContain('5 MB');
    press('chat-input-attach');
    mockPick.mockResolvedValue([{ name: 'small.txt', mime: 'text/plain', size: 1000, blob: {} }]);
    mockUpload.mockResolvedValue({ ok: true, file: { rowGUID: 'F9', rowJSON: { fileName: 'small.txt', fileSizeBytes: 1000 } } });
    await act(async () => { q('chat-input-upload')!.click(); await Promise.resolve(); });
    await settle();
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload.mock.calls[0][0]).toBe('t1');
    expect(mockUpload.mock.calls[0][1]).toBe('p1');
    expect(onFilesChanged).toHaveBeenCalled();
    expect(q('chat-input-pending-F9')!.textContent).toContain('small.txt');
    press('chat-input-send');
    await settle();
    expect(onSend).toHaveBeenCalledWith({ text: '', urls: [], files: [{ fileGUID: 'F9', url: '/files/view?post=F9' }] });
  });
  it('a file of the theme is attached again WITHOUT an upload, as the same URL', async () => {
    const { onSend } = input({ files: [{ rowGUID: 'F1', rowOwnerGUID: 'o', rowParentGUID: 't1', orderInList: 1, rowJSON: { fileName: 'plan.pdf', mediaPostTitle: 'plan.pdf', fileSizeBytes: 2048, fileSourceKind: 'chat' } }] });
    press('chat-input-attach');
    press('chat-input-reuse-F1');
    expect(mockUpload).not.toHaveBeenCalled();
    typeInto('chat-input-text', 'again');
    press('chat-input-send');
    await settle();
    expect(onSend).toHaveBeenCalledWith({ text: 'again', urls: [], files: [{ fileGUID: 'F1', url: '/files/view?post=F1' }] });
  });
  it('a link is sent apart from the text; a javascript: address is refused', async () => {
    const { onSend } = input();
    press('chat-input-link');
    typeInto('chat-input-link-url', 'javascript:alert(1)');
    press('chat-input-link-add');
    expect(q('chat-input-error')).not.toBeNull();
    typeInto('chat-input-link-url', 'https://example.com/doc');
    typeInto('chat-input-link-title', 'The doc');
    press('chat-input-link-add');
    expect(q('chat-input-pending-url-0')!.textContent).toContain('The doc');
    press('chat-input-send');
    await settle();
    expect(onSend).toHaveBeenCalledWith({ text: '', urls: [{ url: 'https://example.com/doc', title: 'The doc' }], files: [] });
  });
});
