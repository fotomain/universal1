// Chat - the pure model (no React, no Supabase): types, the settings, the title of a task chat, links, the red number, the limit of an attachment.
// SQL: PART 50 (kit8/sql/start). Design: documentation/CHAT_WBS.html. README: kit8/chat/README.md.
//   chatObject (a user = "Main", or ONE task) -> chatTheme -> messages; members = chatMembersTable (a task chat: the users of the Time lines = RACI, kept by a trigger).

export const CHAT_ROUTE = '/chat';
export const CHAT_THEME_ROUTE = '/chat/theme';

/** the tables and the redux entities (kit8/redux/SystemMetaData.ts) */
export const CHAT_TABLES = {
  object: { table: 'chatObjectTable', entity: 'chatObjectReusable', itemLabel: 'Chat object' },
  theme: { table: 'chatThemeTable', entity: 'chatThemeReusable', itemLabel: 'Chat theme' },
  member: { table: 'chatMembersTable', entity: 'chatMemberReusable', itemLabel: 'Chat member' },
  message: { table: 'chatMessagesTable', entity: 'chatMessageReusable', itemLabel: 'Chat message' },
} as const;

// ───────────── settings ─────────────
/** project switch: TRUE unless stored false (like the Vendor switches; SQL vendor_project_setting) */
export const CHAT_SWITCH_KEY = 'chatFunctionalityEnabled';
export const chatEnabledOfProject = (projectJSON: Record<string, any> | null | undefined): boolean => projectJSON?.[CHAT_SWITCH_KEY] !== false;

/** the 4 letters in front of the title of a task chat (Project settings, main tab) */
export const PREFIX_KEY = 'projectInnerPrefix';
export const PREFIX_LENGTH = 4;
/** what the field keeps while typing: letters and digits, upper case, at most 4 */
export const normalizePrefix = (v: unknown): string =>
  String(v ?? '').replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, PREFIX_LENGTH);
/** '' (= the default) or exactly 4 letters / digits */
export const isValidPrefix = (v: unknown): boolean => {
  const t = String(v ?? '');
  return t === '' || (normalizePrefix(t) === t && t.length === PREFIX_LENGTH);
};
/** the prefix a project without one gets: the first 4 letters of its name (computed, never stored) - the same rule as the SQL chat_task_title */
export const defaultPrefixOf = (projectName: unknown): string => String(projectName ?? '').replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, PREFIX_LENGTH);
export const prefixOfProject = (projectJSON: Record<string, any> | null | undefined): string => normalizePrefix(projectJSON?.[PREFIX_KEY]) || defaultPrefixOf(projectJSON?.name);
/** Title of a task chat = prefix, one space, the task name (the text of the task); the same rule as SQL chat_task_title */
export const chatTaskTitle = (projectJSON: Record<string, any> | null | undefined, taskText: unknown): string =>
  `${prefixOfProject(projectJSON)} ${String(taskText ?? '')}`.trim();

/** organization setting: the biggest attachment in MB (whole number 1..100, default 10) */
export const MAX_ATTACHMENT_KEY = 'maximumChatAttachmentFileSize';
export const MAX_ATTACHMENT_DEFAULT_MB = 10;
export const MAX_ATTACHMENT_MIN_MB = 1;
export const MAX_ATTACHMENT_MAX_MB = 100;
export function maxAttachmentMbOf(organizationJSON: Record<string, any> | null | undefined): number {
  const n = Math.floor(Number(organizationJSON?.[MAX_ATTACHMENT_KEY]));
  if (!Number.isFinite(n)) return MAX_ATTACHMENT_DEFAULT_MB;
  return Math.min(MAX_ATTACHMENT_MAX_MB, Math.max(MAX_ATTACHMENT_MIN_MB, n));
}
export const maxAttachmentBytesOf = (organizationJSON: Record<string, any> | null | undefined): number => maxAttachmentMbOf(organizationJSON) * 1048576;
/** '' = the field is fine */
export function maxAttachmentError(text: string): string {
  const t = String(text).trim();
  if (!/^\d+$/.test(t)) return 'A whole number of MB, from 1 to 100.';
  const n = Number(t);
  return n < MAX_ATTACHMENT_MIN_MB || n > MAX_ATTACHMENT_MAX_MB ? 'A whole number of MB, from 1 to 100.' : '';
}
/** the app refuses a file above the limit before the upload (the function and the database ask again); '' = fine */
export function attachmentError(sizeBytes: number, maxBytes: number): string {
  return sizeBytes > maxBytes ? `This file is bigger than the limit of ${Math.floor(maxBytes / 1048576)} MB for chat attachments.` : '';
}

// ───────────── rows ─────────────
export interface ChatFileRef { fileGUID: string; url: string; name?: string; size?: number; mime?: string; kind?: string }
export interface ChatUrlRef { url: string; title?: string }
export interface ChatMessageJSON {
  text?: string;
  urls?: ChatUrlRef[];
  files?: ChatFileRef[];
  editedAt?: string;
  deleted?: boolean;
  deletedAt?: string;
}
export interface ChatMessageRow { rowGUID: string; rowOwnerGUID: string; rowParentGUID: string; created_at?: string; rowJSON: ChatMessageJSON }

/** one line of the RPC chat_theme_list */
export interface ChatThemeItem {
  themeGUID: string;
  objectGUID: string;
  kind: 'user' | 'task';
  title: string;
  description?: string | null;
  taskGUID?: string | null;
  projectGUID?: string | null;
  lastMessageAt?: string | null;
  role?: 'owner' | 'member';
  lastText?: string | null;
  unread: number;
  members: number;
}
export interface ChatUnread { theme: string; n: number }
export interface ChatMemberItem { userGUID: string; role: 'owner' | 'member'; raci: boolean; manual: boolean; email: string; name: string }
export interface ChatCandidate { userGUID: string; email: string; name: string }

export const isDeleted = (m: { rowJSON?: ChatMessageJSON } | null | undefined): boolean => m?.rowJSON?.deleted === true;

/** oldest first; the same time -> by id, so two devices show the same order */
export function sortMessages<T extends { rowGUID: string; created_at?: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.rowGUID.localeCompare(b.rowGUID));
}
/** the rows of the store + the messages this device just sent (the answer of the RPC), one per rowGUID (the store wins: it has the newest state) */
export function mergeMessages<T extends { rowGUID: string; created_at?: string }>(fromStore: readonly T[], sentHere: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of sentHere) byId.set(r.rowGUID, r);
  for (const r of fromStore) byId.set(r.rowGUID, r);
  return sortMessages([...byId.values()]);
}
/** day of a time stamp for the date separators ('' when there is none) */
export const dayKeyOf = (iso: string | null | undefined): string => (iso ? String(iso).slice(0, 10) : '');

// ───────────── the red number ─────────────
export const unreadTotal = (counts: readonly ChatUnread[] | null | undefined): number => (counts || []).reduce((s, c) => s + (Number(c?.n) > 0 ? Number(c.n) : 0), 0);
/** 0 -> '' (no icon number), 1..99 -> '7', above 99 -> '99+' */
export const badgeText = (n: number): string => (n > 99 ? '99+' : n > 0 ? String(Math.floor(n)) : '');
export const unreadOfTheme = (counts: readonly ChatUnread[] | null | undefined, theme: string): number => (counts || []).find((c) => c.theme === theme)?.n ?? 0;

// ───────────── links ─────────────
/** only http(s) and an address of this app ("/route?query") are links; javascript:, data: and the rest are plain text */
export function isSafeLink(url: unknown): boolean {
  const u = String(url ?? '').trim();
  if (!u || u.length > 2000 || /\s/.test(u)) return false;
  return /^https?:\/\/[^\s]+$/i.test(u) || /^\/[^/\s][^\s]*$/.test(u);
}
/** an address of this app (opened by the router), not an external one */
export const isAppAddress = (url: string): boolean => /^\/[^/\s]/.test(url.trim());

/** the http(s) addresses inside a text, in order, without the dot / comma / bracket that ends a sentence */
export function extractUrls(text: string | null | undefined): string[] {
  const out: string[] = [];
  const re = /https?:\/\/[^\s<>"']+/gi;
  let m: RegExpExecArray | null;
  const t = String(text ?? '');
  while ((m = re.exec(t))) {
    const url = m[0].replace(/[.,;:!?)\]}]+$/, '');
    if (isSafeLink(url) && !out.includes(url)) out.push(url);
  }
  return out;
}
export interface TextPart { type: 'text' | 'link'; value: string }
/** the text cut into plain parts and links (for the bubble) */
export function splitTextWithLinks(text: string | null | undefined): TextPart[] {
  const t = String(text ?? '');
  const parts: TextPart[] = [];
  const re = /https?:\/\/[^\s<>"']+/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const url = m[0].replace(/[.,;:!?)\]}]+$/, '');
    if (m.index > last) parts.push({ type: 'text', value: t.slice(last, m.index) });
    if (isSafeLink(url)) parts.push({ type: 'link', value: url });
    else parts.push({ type: 'text', value: url });
    last = m.index + url.length;
    re.lastIndex = last;
  }
  if (last < t.length) parts.push({ type: 'text', value: t.slice(last) });
  return parts;
}

/** the address of the viewer of a file (kit8/files FileViewer, route app/files/view): what a message keeps instead of a storage link */
export const fileViewerUrl = (postGUID: string): string => `/files/view?post=${encodeURIComponent(postGUID)}`;

// ───────────── routes ─────────────
export interface ChatThemeLink { themeGUID?: string | null; taskGUID?: string | null }
export function chatThemeParams(link: ChatThemeLink): Record<string, string> {
  return { ...(link.themeGUID ? { themeGUID: link.themeGUID } : {}), ...(link.taskGUID ? { taskGUID: link.taskGUID } : {}) };
}
export function chatThemePath(link: ChatThemeLink): string {
  const q = Object.entries(chatThemeParams(link)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return q ? `${CHAT_THEME_ROUTE}?${q}` : CHAT_THEME_ROUTE;
}
const cleanParam = (v: unknown): string => {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === 'string' && t.length <= 80 ? t.trim() : '';
};
export const parseChatThemeParams = (params: Record<string, unknown> | null | undefined): { themeGUID: string; taskGUID: string } => ({
  themeGUID: cleanParam(params?.themeGUID),
  taskGUID: cleanParam(params?.taskGUID),
});

/** a new random id for a message / theme (the client makes it, so the sender's echo and the realtime event are the same row) */
export function newChatId(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const h = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${h(8)}-${h(4)}-4${h(3)}-${'89ab'[Math.floor(Math.random() * 4)]}${h(3)}-${h(12)}`;
}

/** words of a refusal of the database / function for the user */
export function chatErrorText(message: string | null | undefined): string {
  const m = String(message ?? '').replace(/^.*?(No permission: chat, |chat: )/, '').trim();
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : 'The chat action was refused.';
}
