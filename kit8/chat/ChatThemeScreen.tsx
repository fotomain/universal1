// ChatThemeScreen - one theme (route /chat/theme?themeGUID=… or ?taskGUID=…): header (title + description; the title and the description of a TASK chat are the task's, live), the messages,
// the input with the cursor in it. The theme is marked read while this screen is focused and the window is visible.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { useChatClient } from './useChatClient';
import { pmT } from '../pm/i18n/pmT';
import { showErrorModal } from '../ui/components/common/ErrorModalWindow';
import { PMIconButton } from '../pm/inner/buttons/PMIconButton';
import { authorizeFiles, fetchDriveStatus } from '../files/common/filesDriveApi';
import { providerOfValue } from '../files/common/storageTypes';
import { providerTitleOf, type FileRow } from '../files/common/fileModel';
import { dayKeyOf, isDeleted, maxAttachmentBytesOf, newChatId, parseChatThemeParams, type ChatMessageRow } from './chatModel';
import { chatMarkRead, chatMessageDelete, chatMessageEdit, chatMessageSend, chatTaskEnsure, listChatFiles } from './chatApi';
import { openChatLink } from './chatNavigation';
import { useChatMembers, useChatMessages, useChatTaskLive, useChatThemes, useChatUnread } from './useChat';
import ChatMessageBubble from './ChatMessageBubble';
import ChatMessageInput, { type ChatSendPayload } from './ChatMessageInput';
import ChatMembersWindow from './ChatMembersWindow';
import { useMyOrganization } from '../catalog/organization/useMyOrganization';

/** the screen is the focused one of the navigator (drawer screens stay mounted) */
function useScreenFocused(): boolean {
  const navigation: any = useNavigation();
  const [focused, setFocused] = useState<boolean>(() => (typeof navigation?.isFocused === 'function' ? navigation.isFocused() : true));
  useEffect(() => {
    if (typeof navigation?.addListener !== 'function') return;
    const a = navigation.addListener('focus', () => setFocused(true));
    const b = navigation.addListener('blur', () => setFocused(false));
    return () => { a?.(); b?.(); };
  }, [navigation]);
  return focused;
}
/** the window is on the screen (a browser tab in front, an app that is not in the background) */
function useWindowVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const on = () => setVisible(document.visibilityState !== 'hidden');
      on();
      document.addEventListener('visibilitychange', on);
      return () => document.removeEventListener('visibilitychange', on);
    }
    const sub = AppState.addEventListener('change', (s) => setVisible(s === 'active'));
    return () => sub.remove();
  }, []);
  return visible;
}

export default function ChatThemeScreen() {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const supabase = useChatClient();
  const params = parseChatThemeParams(useLocalSearchParams());
  const [themeGUID, setThemeGUID] = useState(params.themeGUID);
  const [ensureError, setEnsureError] = useState('');
  const [limit, setLimit] = useState(200);
  const [sent, setSent] = useState<ChatMessageRow[]>([]);
  const [membersOpen, setMembersOpen] = useState(false);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [attach, setAttach] = useState<{ available: boolean; hint: string }>({ available: false, hint: '' });
  const scroller = useRef<ScrollView>(null);
  const focused = useScreenFocused();
  const visible = useWindowVisible();
  const { organizationJSON } = useMyOrganization();
  const myGUID: string = useSelector((s: any) => s?.activeUserState?.userGUID) || '';

  // a task chat opened from the task: the first call makes it (chat_task_ensure), every later call opens it
  useEffect(() => {
    setEnsureError('');
    if (params.themeGUID) { setThemeGUID(params.themeGUID); return; }
    if (!params.taskGUID || !supabase) return;
    let alive = true;
    chatTaskEnsure(supabase as any, params.taskGUID).then((r) => {
      if (!alive) return;
      if (r.ok) setThemeGUID(r.data.themeGUID); else setEnsureError(r.error);
    });
    return () => { alive = false; };
  }, [params.themeGUID, params.taskGUID, supabase]);

  const { themes, loading } = useChatThemes();
  const item = themes.find((t) => t.themeGUID === themeGUID);
  const isTask = item?.kind === 'task' || (!item && !!params.taskGUID);
  const live = useChatTaskLive(isTask ? item?.taskGUID || params.taskGUID : '');
  const title = isTask && live.title ? live.title : item?.title || '';
  const description = isTask ? live.description : item?.description || '';
  const projectGUID = item?.projectGUID || live.projectGUID || null;

  const { messages, hasMore } = useChatMessages(themeGUID, limit, sent);
  const { members } = useChatMembers(themeGUID, !!themeGUID);
  const nameOf = useMemo(() => new Map(members.map((m) => [m.userGUID, m.name])), [members]);
  const { counts } = useChatUnread();
  const unreadHere = counts.find((x) => x.theme === themeGUID)?.n ?? 0;

  // the files of the theme: the list to attach again, and the marks "file deleted"
  const loadFiles = useCallback(async () => {
    if (!themeGUID) return;
    const r = await listChatFiles(themeGUID, projectGUID);
    if (r.ok) setFiles(Array.isArray(r.data) ? (r.data as FileRow[]) : []);
  }, [themeGUID, projectGUID]);
  useEffect(() => { void loadFiles(); }, [loadFiles, messages.length]);
  const existing = useMemo(() => (files ? new Set(files.map((f) => f.rowGUID)) : null), [files]);

  // can files be attached: the right (files_authorize, scope chat) and a connected storage
  useEffect(() => {
    if (!themeGUID) return;
    let alive = true;
    (async () => {
      const a = await authorizeFiles('add', { scope: 'chat', guid: themeGUID, projectGUID });
      if (!alive) return;
      const data: any = a.ok ? a.data : null;
      if (!a.ok || !data?.allowed) { setAttach({ available: false, hint: a.ok ? pmT('Files are not available for this chat.') : a.error }); return; }
      const provider = providerOfValue(data.provider);
      const st = await fetchDriveStatus(provider === 'googleDrive' ? undefined : provider);
      if (!alive) return;
      const ok = st.ok && (st.data as any)?.state === 'ok';
      setAttach(ok ? { available: true, hint: '' } : { available: false, hint: pmT('{{provider}} is not connected. An administrator connects it in Project settings -> Files.', { provider: providerTitleOf(provider) }) });
    })();
    return () => { alive = false; };
  }, [themeGUID, projectGUID]);

  // mark read: the screen is focused, the window is visible and something is unread
  const lastIncoming = useMemo(() => messages.filter((m) => !isDeleted(m)).reduce((s, m) => (m.created_at && m.created_at > s ? m.created_at : s), ''), [messages]);
  useEffect(() => {
    if (!themeGUID || !focused || !visible || !supabase) return;
    if (unreadHere <= 0 && !lastIncoming) return;
    const id = setTimeout(() => { void chatMarkRead(supabase as any, themeGUID); }, 250);
    return () => clearTimeout(id);
  }, [themeGUID, focused, visible, supabase, lastIncoming, unreadHere]);

  useEffect(() => { const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 50); return () => clearTimeout(id); }, [messages.length, themeGUID]);

  const onSend = useCallback(async (m: ChatSendPayload) => {
    const r = await chatMessageSend(supabase as any, { messageGUID: newChatId(), themeGUID, text: m.text, urls: m.urls, files: m.files });
    if (!r.ok) { showErrorModal(r.error, pmT('The message was not sent')); return false; }
    setSent((l) => [...l, r.data]);
    return true;
  }, [supabase, themeGUID]);
  const onEdit = useCallback(async (id: string, text: string) => {
    const r = await chatMessageEdit(supabase as any, id, text);
    if (!r.ok) showErrorModal(r.error, pmT('The message was not changed')); else setSent((l) => [...l.filter((x) => x.rowGUID !== id), r.data]);
  }, [supabase]);
  const onDelete = useCallback(async (id: string) => {
    const r = await chatMessageDelete(supabase as any, id);
    if (!r.ok) showErrorModal(r.error, pmT('The message was not deleted')); else setSent((l) => [...l.filter((x) => x.rowGUID !== id), r.data]);
  }, [supabase]);

  if (ensureError) {
    return (
      <View testID="chat-theme-error" style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.error, textAlign: 'center' }}>{ensureError}</Text>
      </View>
    );
  }
  if (!themeGUID) {
    return <View testID="chat-theme-empty" style={[styles.center, { backgroundColor: c.background }]}><Text style={{ color: c.text, opacity: 0.7 }}>{pmT('Choose a theme in the list.')}</Text></View>;
  }
  if (isTask && live.gone) {
    return <View testID="chat-theme-task-gone" style={[styles.center, { backgroundColor: c.background }]}><Text style={{ color: c.text }}>{pmT('This task no longer exists.')}</Text></View>;
  }
  let lastDay = '';
  return (
    <View testID="chat-theme" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { borderColor: c.border, backgroundColor: c.surface }]}>
        <View style={{ flex: 1 }}>
          <Text testID="chat-theme-title" style={{ color: c.text, fontSize: 17, fontWeight: '700' }} numberOfLines={2}>{title || (loading ? '' : pmT('Chat'))}</Text>
          {description ? <Text testID="chat-theme-description" style={{ color: c.text, opacity: 0.7, fontSize: 13 }}>{description}</Text> : null}
        </View>
        <PMIconButton tipScope="app" testID="chat-theme-members-button" icon="group" title={pmT('Members')} color={c.text} badge={item?.members} onPress={() => setMembersOpen(true)} />
      </View>
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {hasMore ? <Pressable testID="chat-theme-older" onPress={() => setLimit((n) => n + 200)} style={{ alignItems: 'center', padding: 8 }}><Text style={{ color: c.primary }}>{pmT('Show older messages')}</Text></Pressable> : null}
        {messages.length === 0 ? <Text testID="chat-theme-no-messages" style={{ color: c.text, opacity: 0.6, textAlign: 'center', padding: 24 }}>{pmT('No messages yet. Write the first one.')}</Text> : null}
        {messages.map((m) => {
          const day = dayKeyOf(m.created_at);
          const sep = day && day !== lastDay;
          if (day) lastDay = day;
          return (
            <React.Fragment key={m.rowGUID}>
              {sep ? <Text style={{ color: c.text, opacity: 0.55, textAlign: 'center', fontSize: 12, paddingVertical: 4 }}>{day}</Text> : null}
              <ChatMessageBubble
                message={m}
                mine={!!myGUID && m.rowOwnerGUID === myGUID}
                authorName={nameOf.get(m.rowOwnerGUID) || pmT('Former member')}
                existingFiles={existing}
                onOpenLink={(u) => { void openChatLink(u, router); }}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </React.Fragment>
          );
        })}
      </ScrollView>
      <ChatMessageInput
        themeGUID={themeGUID}
        projectGUID={projectGUID}
        maxBytes={maxAttachmentBytesOf(organizationJSON)}
        attachAvailable={attach.available}
        attachHint={attach.hint}
        files={files || []}
        onFilesChanged={() => void loadFiles()}
        onSend={onSend}
      />
      <ChatMembersWindow visible={membersOpen} themeGUID={themeGUID} isOwner={item?.role === 'owner'} kind={isTask ? 'task' : 'user'} onClose={() => setMembersOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1 },
});
