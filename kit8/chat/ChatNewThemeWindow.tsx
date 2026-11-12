// ChatNewThemeWindow - "New theme" (Scenario 1): Title, Description, Message and the chat members (maybe none, maybe other users of the organization). Create = ONE call (chat_theme_create).
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { useChatClient } from './useChatClient';
import { pmT } from '../pm/i18n/pmT';
import TextInputApp from '../ui/components/common/TextInputApp';
import { newChatId } from './chatModel';
import { chatThemeCreate } from './chatApi';
import { useChatCandidates } from './useChat';

export interface ChatNewThemeWindowProps { visible: boolean; onClose: () => void; onCreated: (themeGUID: string) => void; testID?: string }

export default function ChatNewThemeWindow({ visible, onClose, onCreated, testID = 'chat-new' }: ChatNewThemeWindowProps) {
  const { themeColors: c } = useDesignSystem();
  const supabase = useChatClient();
  const candidates = useChatCandidates(visible);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = () => { setTitle(''); setDescription(''); setMessage(''); setMembers([]); setError(''); };
  const toggle = (u: string) => setMembers((l) => (l.includes(u) ? l.filter((x) => x !== u) : [...l, u]));
  const create = async () => {
    if (!title.trim()) { setError(pmT('The title is required.')); return; }
    setBusy(true);
    const themeGUID = newChatId();
    const r = await chatThemeCreate(supabase as any, { themeGUID, title: title.trim(), description: description.trim(), message: message.trim(), members });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    reset();
    onCreated(themeGUID);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.window, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{pmT('New theme')}</Text>
          <TextInputApp testID={`${testID}-title`} label={pmT('Title')} value={title} onChangeText={setTitle} />
          <TextInputApp testID={`${testID}-description`} label={pmT('Description')} value={description} onChangeText={setDescription} multiline numberOfLines={2} />
          <TextInputApp testID={`${testID}-message`} label={pmT('Message')} value={message} onChangeText={setMessage} multiline numberOfLines={3} />
          <Text style={{ color: c.text, fontWeight: '700' }}>{pmT('Chat members')}</Text>
          <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('Optional: you are the owner of the theme. Pick other users of your organization.')}</Text>
          <ScrollView style={{ maxHeight: 180 }}>
            {candidates.length === 0 ? <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('No other users yet.')}</Text> : null}
            {candidates.map((u) => {
              const on = members.includes(u.userGUID);
              return (
                <Pressable key={u.userGUID} testID={`${testID}-member-${u.userGUID}`} onPress={() => toggle(u.userGUID)} style={styles.memberRow}>
                  <Text style={{ color: on ? c.primary : c.text, fontWeight: on ? '700' : '400' }}>{`${on ? '☑' : '☐'}  ${u.name}  (${u.email})`}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {error ? <Text testID={`${testID}-error`} style={{ color: c.error }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
            <Pressable testID={`${testID}-cancel`} onPress={() => { reset(); onClose(); }}><Text style={{ color: c.text }}>{pmT('Cancel')}</Text></Pressable>
            <Pressable testID={`${testID}-create`} disabled={busy} onPress={() => void create()}><Text style={{ color: c.primary, fontWeight: '700' }}>{pmT('Create')}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  window: { width: '100%', maxWidth: 520, borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  memberRow: { paddingVertical: 6 },
});
