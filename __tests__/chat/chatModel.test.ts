// Chat - the pure model (kit8/chat/chatModel.ts): the prefix and the title of a task chat, the limit of an attachment, links, the red number, merging of messages, routes.
import {
  attachmentError, badgeText, chatEnabledOfProject, chatErrorText, chatTaskTitle, chatThemePath, dayKeyOf, defaultPrefixOf, extractUrls, fileViewerUrl, isAppAddress, isDeleted, isSafeLink,
  isValidPrefix, maxAttachmentBytesOf, maxAttachmentError, maxAttachmentMbOf, mergeMessages, newChatId, normalizePrefix, parseChatThemeParams, prefixOfProject, sortMessages,
  splitTextWithLinks, unreadOfTheme, unreadTotal,
} from '../../kit8/chat/chatModel';

describe('the switch and the prefix of a project', () => {
  it('the chat switch is TRUE unless it is stored false', () => {
    expect(chatEnabledOfProject(undefined)).toBe(true);
    expect(chatEnabledOfProject({})).toBe(true);
    expect(chatEnabledOfProject({ chatFunctionalityEnabled: true })).toBe(true);
    expect(chatEnabledOfProject({ chatFunctionalityEnabled: false })).toBe(false);
  });
  it('the prefix is 4 letters / digits, upper case; typing is cleaned', () => {
    expect(normalizePrefix('ab-c d12')).toBe('ABCD');
    expect(normalizePrefix('  x ')).toBe('X');
    expect(normalizePrefix(null)).toBe('');
    expect(isValidPrefix('')).toBe(true);
    expect(isValidPrefix('ABCD')).toBe(true);
    expect(isValidPrefix('ABC')).toBe(false);
    expect(isValidPrefix('abcd')).toBe(false);
    expect(isValidPrefix('AB-D')).toBe(false);
  });
  it('letters of any alphabet count (Cyrillic, Latvian)', () => {
    expect(normalizePrefix('мост')).toBe('МОСТ');
    expect(defaultPrefixOf('Ūdens vadi')).toBe('ŪDEN');
  });
  it('a project without a prefix gets the first 4 letters of its name (computed, never stored)', () => {
    expect(defaultPrefixOf('Bridge works')).toBe('BRID');
    expect(defaultPrefixOf('A-1')).toBe('A1');
    expect(defaultPrefixOf(undefined)).toBe('');
    expect(prefixOfProject({ name: 'Bridge works' })).toBe('BRID');
    expect(prefixOfProject({ name: 'Bridge works', projectInnerPrefix: 'abcd' })).toBe('ABCD');
  });
  it('the title of a task chat = prefix, one space, the task text (the same rule as the SQL chat_task_title)', () => {
    expect(chatTaskTitle({ name: 'Bridge works' }, 'Pour concrete')).toBe('BRID Pour concrete');
    expect(chatTaskTitle({ name: 'Bridge works', projectInnerPrefix: 'RW26' }, 'Pour the slab')).toBe('RW26 Pour the slab');
    expect(chatTaskTitle({ name: '' }, 'Only text')).toBe('Only text');
    expect(chatTaskTitle(null, undefined)).toBe('');
  });
});

describe('the limit of a chat attachment', () => {
  it('default 10 MB, always a whole number from 1 to 100', () => {
    expect(maxAttachmentMbOf(undefined)).toBe(10);
    expect(maxAttachmentMbOf({})).toBe(10);
    expect(maxAttachmentMbOf({ maximumChatAttachmentFileSize: 25 })).toBe(25);
    expect(maxAttachmentMbOf({ maximumChatAttachmentFileSize: 0 })).toBe(1);
    expect(maxAttachmentMbOf({ maximumChatAttachmentFileSize: 500 })).toBe(100);
    expect(maxAttachmentMbOf({ maximumChatAttachmentFileSize: 7.9 })).toBe(7);
    expect(maxAttachmentMbOf({ maximumChatAttachmentFileSize: 'x' })).toBe(10);
    expect(maxAttachmentBytesOf({ maximumChatAttachmentFileSize: 5 })).toBe(5 * 1048576);
  });
  it('the field accepts only a whole number from 1 to 100', () => {
    expect(maxAttachmentError('20')).toBe('');
    expect(maxAttachmentError(' 100 ')).toBe('');
    expect(maxAttachmentError('0')).not.toBe('');
    expect(maxAttachmentError('101')).not.toBe('');
    expect(maxAttachmentError('2.5')).not.toBe('');
    expect(maxAttachmentError('')).not.toBe('');
  });
  it('a file above the limit is refused before the upload, a file on the limit is fine', () => {
    expect(attachmentError(5 * 1048576, 5 * 1048576)).toBe('');
    expect(attachmentError(5 * 1048576 + 1, 5 * 1048576)).toContain('5 MB');
  });
});

describe('links', () => {
  it('only http(s) and an address of the app are links', () => {
    expect(isSafeLink('https://example.com/a?b=1')).toBe(true);
    expect(isSafeLink('http://example.com')).toBe(true);
    expect(isSafeLink('/files/view?post=1')).toBe(true);
    expect(isSafeLink('javascript:alert(1)')).toBe(false);
    expect(isSafeLink('data:text/html,x')).toBe(false);
    expect(isSafeLink('//evil.com')).toBe(false);
    expect(isSafeLink('https://a b.com')).toBe(false);
    expect(isSafeLink('')).toBe(false);
    expect(isSafeLink(null)).toBe(false);
  });
  it('an address of this app is told from an external one', () => {
    expect(isAppAddress('/pm/project/dashboard?x=1')).toBe(true);
    expect(isAppAddress('https://example.com')).toBe(false);
  });
  it('urls are found in a text without the dot or bracket that ends a sentence, each once', () => {
    expect(extractUrls('see https://a.com/x. and (https://b.com/y) and https://a.com/x again!')).toEqual(['https://a.com/x', 'https://b.com/y']);
    expect(extractUrls('no links here')).toEqual([]);
    expect(extractUrls(null)).toEqual([]);
  });
  it('a text is cut into plain parts and links', () => {
    expect(splitTextWithLinks('go to https://a.com/x, then home')).toEqual([
      { type: 'text', value: 'go to ' }, { type: 'link', value: 'https://a.com/x' }, { type: 'text', value: ', then home' },
    ]);
    expect(splitTextWithLinks('plain')).toEqual([{ type: 'text', value: 'plain' }]);
    expect(splitTextWithLinks('')).toEqual([]);
  });
  it('the address of a file is the viewer route (never a storage link)', () => {
    expect(fileViewerUrl('abc-1')).toBe('/files/view?post=abc-1');
    expect(isSafeLink(fileViewerUrl('abc-1'))).toBe(true);
  });
});

describe('the red number', () => {
  const counts = [{ theme: 't1', n: 2 }, { theme: 't2', n: 5 }, { theme: 't3', n: 0 }, { theme: 't4', n: -1 }];
  it('is the sum of the unread messages; nothing negative', () => {
    expect(unreadTotal(counts)).toBe(7);
    expect(unreadTotal([])).toBe(0);
    expect(unreadTotal(undefined)).toBe(0);
    expect(unreadOfTheme(counts, 't2')).toBe(5);
    expect(unreadOfTheme(counts, 'nope')).toBe(0);
  });
  it('shows nothing at 0, the number up to 99, 99+ above', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(1)).toBe('1');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });
});

describe('messages', () => {
  const m = (id: string, at: string, over: any = {}) => ({ rowGUID: id, rowOwnerGUID: 'u', rowParentGUID: 't', created_at: at, rowJSON: { text: id, ...over } });
  it('oldest first, the same time by id', () => {
    const rows = [m('b', '2026-01-02T10:00:00Z'), m('a', '2026-01-02T10:00:00Z'), m('c', '2026-01-01T10:00:00Z')];
    expect(sortMessages(rows).map((x) => x.rowGUID)).toEqual(['c', 'a', 'b']);
  });
  it('the echo of a sent message and the realtime row are ONE message, and the store wins', () => {
    const sent = [m('a', '2026-01-01T10:00:00Z', { text: 'old' })];
    const store = [m('a', '2026-01-01T10:00:00Z', { text: 'edited' }), m('b', '2026-01-01T11:00:00Z')];
    const merged = mergeMessages(store, sent);
    expect(merged.map((x) => x.rowGUID)).toEqual(['a', 'b']);
    expect(merged[0].rowJSON.text).toBe('edited');
    expect(mergeMessages([], sent)).toHaveLength(1);
  });
  it('a deleted message is told by its flag; the day of a time stamp', () => {
    expect(isDeleted(m('a', 'x', { deleted: true }))).toBe(true);
    expect(isDeleted(m('a', 'x'))).toBe(false);
    expect(isDeleted(null)).toBe(false);
    expect(dayKeyOf('2026-11-11T10:00:00Z')).toBe('2026-11-11');
    expect(dayKeyOf(undefined)).toBe('');
  });
  it('a new id looks like a uuid and is not repeated', () => {
    const a = newChatId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(newChatId()).not.toBe(a);
  });
});

describe('routes and words', () => {
  it('a theme link has the theme and/or the task', () => {
    expect(chatThemePath({ themeGUID: 'T1' })).toBe('/chat/theme?themeGUID=T1');
    expect(chatThemePath({ themeGUID: 'T1', taskGUID: 'K1' })).toBe('/chat/theme?themeGUID=T1&taskGUID=K1');
    expect(chatThemePath({ taskGUID: 'K 1' })).toBe('/chat/theme?taskGUID=K%201');
    expect(chatThemePath({})).toBe('/chat/theme');
  });
  it('the params of the route are read safely', () => {
    expect(parseChatThemeParams({ themeGUID: ' T1 ', taskGUID: ['K1'] })).toEqual({ themeGUID: 'T1', taskGUID: 'K1' });
    expect(parseChatThemeParams({ themeGUID: 5 })).toEqual({ themeGUID: '', taskGUID: '' });
    expect(parseChatThemeParams(null)).toEqual({ themeGUID: '', taskGUID: '' });
    expect(parseChatThemeParams({ themeGUID: 'x'.repeat(200) })).toEqual({ themeGUID: '', taskGUID: '' });
  });
  it('the words of a refusal lose the technical prefix', () => {
    expect(chatErrorText('No permission: chat, only a project manager or an administrator excludes a member')).toBe('Only a project manager or an administrator excludes a member');
    expect(chatErrorText('chat: the title is required (at most 200 characters)')).toBe('The title is required (at most 200 characters)');
    expect(chatErrorText('')).toBe('The chat action was refused.');
  });
});
