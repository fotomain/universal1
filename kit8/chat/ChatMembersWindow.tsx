// ChatMembersWindow - the members of a theme. Add: the owner of the theme, a project manager or an administrator. EXCLUDE: only a project manager or an administrator (the owner stays).
// A member of a task chat who comes from Time -> RACI is removed by changing the RACI column, not here.
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { useChatClient } from './useChatClient';
import { pmT } from '../pm/i18n/pmT';
import { showErrorModal } from '../ui/components/common/ErrorModalWindow';
import { chatMemberAdd, chatMemberRemove } from './chatApi';
import { useChatCandidates, useChatCanManage, useChatMembers } from './useChat';

export interface ChatMembersWindowProps { visible: boolean; themeGUID: string; isOwner: boolean; kind: 'user' | 'task'; onClose: () => void; testID?: string; /** the chat of a task of a read-only project: the list is shown, nobody is added or excluded */ readOnly?: boolean }

export default function ChatMembersWindow({ visible, themeGUID, isOwner, kind, onClose, testID = 'chat-members', readOnly = false }: ChatMembersWindowProps) {
  const { themeColors: c } = useDesignSystem();
  const supabase = useChatClient();
  const { members, reload } = useChatMembers(themeGUID, visible);
  const canManage = useChatCanManage(visible ? themeGUID : '') && !readOnly;
  const candidates = useChatCandidates(visible);
  const [busy, setBusy] = useState(false);
  const canAdd = !readOnly && (canManage || isOwner);
  const free = candidates.filter((u) => !members.some((m) => m.userGUID === u.userGUID));
  const add = async (u: string) => {
    setBusy(true);
    const r = await chatMemberAdd(supabase as any, themeGUID, [u]);
    setBusy(false);
    if (!r.ok) showErrorModal(r.error, pmT('Cannot add the member')); else reload();
  };
  const remove = async (u: string) => {
    setBusy(true);
    const r = await chatMemberRemove(supabase as any, themeGUID, u);
    setBusy(false);
    if (!r.ok) showErrorModal(r.error, pmT('Cannot exclude the member')); else reload();
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.window, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>{pmT('Members')}</Text>
          {kind === 'task' ? <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT('The members of a task chat are the users of the Time lines of the task (RACI); you can add more.')}</Text> : null}
          <ScrollView style={{ maxHeight: 240 }}>
            {members.map((m) => {
              const fromRaci = m.raci && !m.manual;
              const canExclude = canManage && m.role !== 'owner' && !fromRaci;
              return (
                <View key={m.userGUID} testID={`${testID}-row-${m.userGUID}`} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '600' }}>{m.name}</Text>
                    <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{`${m.email}${m.role === 'owner' ? `  ·  ${pmT('owner')}` : ''}${m.raci ? `  ·  ${pmT('RACI')}` : ''}`}</Text>
                  </View>
                  {canExclude ? <Pressable testID={`${testID}-remove-${m.userGUID}`} disabled={busy} onPress={() => void remove(m.userGUID)}><Text style={{ color: c.error }}>{pmT('Exclude')}</Text></Pressable> : null}
                </View>
              );
            })}
          </ScrollView>
          {canAdd ? (
            <>
              <Text style={{ color: c.text, fontWeight: '700' }}>{pmT('Add a member')}</Text>
              <ScrollView style={{ maxHeight: 160 }}>
                {free.length === 0 ? <Text style={{ color: c.text, opacity: 0.6 }}>{pmT('Nobody else to add.')}</Text> : null}
                {free.map((u) => (
                  <Pressable key={u.userGUID} testID={`${testID}-add-${u.userGUID}`} disabled={busy} onPress={() => void add(u.userGUID)} style={styles.row}>
                    <Text style={{ color: c.primary }}>{`+  ${u.name}  (${u.email})`}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
          <Pressable testID={`${testID}-close`} onPress={onClose}><Text style={{ color: c.primary, fontWeight: '700', textAlign: 'right' }}>{pmT('Close')}</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  window: { width: '100%', maxWidth: 520, borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
});
