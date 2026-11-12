// ChatListScreen - the Drawer item "Chat" (route /chat): the themes the user may see (created by them, or where they are a member; the chats of the tasks they work on), unread first.
// The Main chat object of the user is made on the first visit. "New theme" = Scenario 1.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { useChatClient } from './useChatClient';
import { pmT } from '../pm/i18n/pmT';
import IconApp from '../ui/components/common/IconApp';
import { badgeText, type ChatThemeItem } from './chatModel';
import { chatMainEnsure } from './chatApi';
import { openChatTheme } from './chatNavigation';
import { useChatThemes } from './useChat';
import ChatNewThemeWindow from './ChatNewThemeWindow';

/** unread themes first, the rest as the server sent them (newest message first) */
export const unreadFirst = (themes: readonly ChatThemeItem[]): ChatThemeItem[] => [...themes].sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0));

const timeText = (iso?: string | null) => (iso ? String(iso).slice(0, 16).replace('T', ' ') : '');

export default function ChatListScreen() {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const supabase = useChatClient();
  const { themes, loading, error, reload } = useChatThemes();
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void chatMainEnsure(supabase as any).then(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return (
    <View testID="chat-list" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', flex: 1 }}>{pmT('Chat')}</Text>
        <Pressable testID="chat-list-new" onPress={() => setNewOpen(true)} style={[styles.newBtn, { backgroundColor: c.primary }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{pmT('New theme')}</Text>
        </Pressable>
      </View>
      <ScrollView>
        {error ? <Text testID="chat-list-error" style={{ color: c.error, padding: 16 }}>{error}</Text> : null}
        {!loading && !error && themes.length === 0 ? <Text testID="chat-list-empty" style={{ color: c.text, opacity: 0.65, padding: 24, textAlign: 'center' }}>{pmT('No themes yet. Press New theme, or open the chat of a task from its menu.')}</Text> : null}
        {unreadFirst(themes).map((t) => (
          <Pressable key={t.themeGUID} testID={`chat-list-item-${t.themeGUID}`} onPress={() => openChatTheme({ themeGUID: t.themeGUID, taskGUID: t.taskGUID }, router, { newWindow: false })} style={[styles.row, { borderColor: c.border }]}>
            <IconApp testID={`chat-list-icon-${t.themeGUID}`} name={t.kind === 'task' ? 'task_alt' : 'chat'} size={22} color={c.text} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: t.unread > 0 ? '800' : '600', fontSize: 15 }} numberOfLines={1}>{t.title || pmT('(no title)')}</Text>
              <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }} numberOfLines={1}>{t.lastText || t.description || ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: c.text, opacity: 0.55, fontSize: 11 }}>{timeText(t.lastMessageAt)}</Text>
              {t.unread > 0 ? <View testID={`chat-list-unread-${t.themeGUID}`} style={styles.count}><Text style={styles.countText}>{badgeText(t.unread)}</Text></View> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <ChatNewThemeWindow visible={newOpen} onClose={() => setNewOpen(false)} onCreated={(themeGUID) => { setNewOpen(false); reload(); openChatTheme({ themeGUID }, router, { newWindow: false }); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, gap: 8 },
  newBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  count: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  countText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
