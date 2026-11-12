// Chat - the calls to the chat_ RPCs (SQL PART 50). Every function takes the Supabase client (useSupabase) and returns { ok, data } or { ok: false, error }; none throws.
// The files of a chat go through kit8/files (scope 'chat'): uploadChatFile / listChatFiles below.
import { chatErrorText, type ChatCandidate, type ChatFileRef, type ChatMemberItem, type ChatMessageRow, type ChatThemeItem, type ChatUnread, type ChatUrlRef } from './chatModel';
import { listFiles, uploadPickedFile, type ApiResult, type PickedFile, type UploadHooks } from '../files/common/filesDriveApi';
import type { FileRow } from '../files/common/fileModel';

export type ChatResult<T> = { ok: true; data: T } | { ok: false; error: string };
type Client = { rpc: (fn: string, args?: Record<string, any>) => PromiseLike<{ data: any; error: any }> };

async function call<T>(supabase: Client | null | undefined, fn: string, args: Record<string, any> = {}): Promise<ChatResult<T>> {
  if (!supabase) return { ok: false, error: 'Not connected.' };
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return { ok: false, error: chatErrorText(error.message || String(error)) };
    return { ok: true, data: data as T };
  } catch (e: any) {
    return { ok: false, error: chatErrorText(e?.message || String(e)) };
  }
}

export const chatMainEnsure = (sb: Client | null | undefined) => call<{ rowGUID: string }>(sb, 'chat_main_ensure');
export const chatThemeList = (sb: Client | null | undefined) => call<ChatThemeItem[]>(sb, 'chat_theme_list');
export const chatUnreadCounts = (sb: Client | null | undefined) => call<ChatUnread[]>(sb, 'chat_unread_counts');
export const chatMarkRead = (sb: Client | null | undefined, theme: string) => call<boolean>(sb, 'chat_mark_read', { p_theme: theme });
export const chatTaskEnsure = (sb: Client | null | undefined, taskGUID: string) =>
  call<{ objectGUID: string; themeGUID: string; taskGUID: string; projectGUID: string; created: boolean }>(sb, 'chat_task_ensure', { p_task: taskGUID });
export const chatThemeCreate = (sb: Client | null | undefined, v: { themeGUID: string; title: string; description?: string; message?: string; members?: string[] }) =>
  call<{ rowGUID: string }>(sb, 'chat_theme_create', { p_theme: v.themeGUID, p_title: v.title, p_description: v.description || null, p_message: v.message || null, p_members: v.members || [] });
export const chatMessageSend = (sb: Client | null | undefined, v: { messageGUID: string; themeGUID: string; text?: string; urls?: ChatUrlRef[]; files?: Pick<ChatFileRef, 'fileGUID' | 'url'>[] }) =>
  call<ChatMessageRow>(sb, 'chat_message_send', { p_message: v.messageGUID, p_theme: v.themeGUID, p_text: v.text || null, p_urls: v.urls || [], p_files: v.files || [] });
export const chatMessageEdit = (sb: Client | null | undefined, messageGUID: string, text: string) => call<ChatMessageRow>(sb, 'chat_message_edit', { p_message: messageGUID, p_text: text });
export const chatMessageDelete = (sb: Client | null | undefined, messageGUID: string) => call<ChatMessageRow>(sb, 'chat_message_delete', { p_message: messageGUID });
export const chatMemberCandidates = (sb: Client | null | undefined) => call<ChatCandidate[]>(sb, 'chat_member_candidates');
export const chatThemeMembers = (sb: Client | null | undefined, theme: string) => call<ChatMemberItem[]>(sb, 'chat_theme_members', { p_theme: theme });
export const chatMemberAdd = (sb: Client | null | undefined, theme: string, users: string[]) => call<number>(sb, 'chat_member_add', { p_theme: theme, p_users: users });
export const chatMemberRemove = (sb: Client | null | undefined, theme: string, user: string) => call<boolean>(sb, 'chat_member_remove', { p_theme: theme, p_user: user });
export const chatCanManage = (sb: Client | null | undefined, theme: string) => call<boolean>(sb, 'chat_can_manage', { p_theme: theme });
export const chatSetMaxAttachmentSize = (sb: Client | null | undefined, mb: number) => call<number>(sb, 'chat_set_max_attachment_size', { p_mb: mb });

// ───────────── the files of a theme (kit8/files, scope chat) ─────────────
export const chatFileTarget = (themeGUID: string, projectGUID?: string | null) => ({ scope: 'chat' as const, guid: themeGUID, projectGUID: projectGUID ?? null });
export const uploadChatFile = (themeGUID: string, projectGUID: string | null | undefined, file: PickedFile, hooks?: UploadHooks): Promise<ApiResult<{ file: FileRow }>> =>
  uploadPickedFile(chatFileTarget(themeGUID, projectGUID), file, hooks);
export const listChatFiles = (themeGUID: string, projectGUID?: string | null) => listFiles(chatFileTarget(themeGUID, projectGUID));
