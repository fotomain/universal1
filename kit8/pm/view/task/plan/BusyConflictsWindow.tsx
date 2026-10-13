// The window that lists the resources Post found busy (capacityModeWarn / capacityModeBlock): for each conflict the sentence, the other bookings by project GUID and task GUID
// (no titles: a colleague's plan is not exposed) and two buttons - Share (opens the mail program with the prepared text, To = the project managers that hold the booking,
// Cc = the manager of the project being posted) and Copy. The application NEVER sends the mail itself.
import React, { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { create } from 'zustand';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { pmT } from '../../../i18n/pmT';
import { CapacityMode, ResourceBusyConflict, busySentence, hoursText, shareMailto, shareState, shareText } from './busyControl';

interface BusyConflictsState {
  isOpen: boolean;
  conflicts: ResourceBusyConflict[];
  mode: CapacityMode;
  show: (conflicts: ResourceBusyConflict[], mode: CapacityMode) => void;
  hide: () => void;
}
export const useBusyConflictsStore = create<BusyConflictsState>((set) => ({
  isOpen: false,
  conflicts: [],
  mode: 'capacityModeOff',
  show: (conflicts, mode) => set({ isOpen: conflicts.length > 0, conflicts, mode }),
  hide: () => set({ isOpen: false, conflicts: [], mode: 'capacityModeOff' }),
}));
/** global helper, like showErrorModal */
export const showBusyConflicts = (conflicts: ResourceBusyConflict[], mode: CapacityMode) => useBusyConflictsStore.getState().show(conflicts, mode);

function ConflictRow({ c, testID }: { c: ResourceBusyConflict; testID: string }) {
  const { themeColors: colors } = useDesignSystem();
  const [copied, setCopied] = useState(false);
  const share = shareState(c);
  const mailto = shareMailto(c);
  const onShare = async () => {
    if (!mailto) return;
    try { await Linking.openURL(mailto); } catch { /* no mail program: Copy is there */ }
  };
  const onCopy = async () => {
    try { await Clipboard.setStringAsync(shareText(c)); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); }
  };
  return (
    <View style={[s.row, { borderColor: colors?.outline || '#cbd5e1' }]} testID={testID}>
      <Text style={[s.sentence, { color: colors?.onSurface || '#0f172a' }]}>{busySentence(c)}</Text>
      {c.others.map((o) => (
        <Text key={`${o.projectGUID}/${o.taskGUID}`} style={[s.other, { color: colors?.onSurfaceVariant || '#475569' }]} testID={`${testID}-other`}>
          {pmT('project {{project}} · task {{task}} · {{hours}} h', { project: o.projectGUID, task: o.taskGUID, hours: hoursText(o.hours) })}
        </Text>
      ))}
      <View style={s.buttons}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !share.enabled }}
          accessibilityHint={share.hint || undefined}
          disabled={!share.enabled}
          onPress={onShare}
          style={[s.button, { backgroundColor: share.enabled ? (colors?.primary || '#4f46e5') : '#cbd5e1' }]}
          testID={`${testID}-share`}
        >
          <Text style={s.buttonText}>{pmT('Share')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCopy} style={[s.button, { backgroundColor: colors?.secondary || '#64748b' }]} testID={`${testID}-copy`}>
          <Text style={s.buttonText}>{copied ? pmT('Copied') : pmT('Copy text')}</Text>
        </Pressable>
      </View>
      {!share.enabled ? <Text style={s.hint} testID={`${testID}-hint`}>{share.hint}</Text> : null}
    </View>
  );
}

export default function BusyConflictsWindow({ testID = 'busy-conflicts' }: { testID?: string }) {
  const { themeColors: colors, isDark } = useDesignSystem();
  const isOpen = useBusyConflictsStore((st) => st.isOpen);
  const conflicts = useBusyConflictsStore((st) => st.conflicts);
  const mode = useBusyConflictsStore((st) => st.mode);
  const hide = useBusyConflictsStore((st) => st.hide);
  if (!isOpen) return null;
  const blocked = mode === 'capacityModeBlock';
  return (
    <Modal transparent visible animationType="fade" onRequestClose={hide} testID={testID}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: isDark ? '#1f1e24' : '#ffffff' }]}>
          <Text style={[s.title, { color: colors?.onSurface || '#0f172a' }]}>{pmT('Resources are busy')}</Text>
          <Text style={[s.sub, { color: colors?.onSurfaceVariant || '#475569' }]} testID={`${testID}-mode`}>
            {blocked ? pmT('The lines of these resources were not posted. Move the task, change the resource or reduce the hours, then press Post again.')
                     : pmT('Posted with a warning: these resources are booked more than their calendar allows.')}
          </Text>
          <ScrollView style={s.list}>
            {conflicts.map((c, i) => <ConflictRow key={`${c.resourceGUID}-${c.day}-${i}`} c={c} testID={`${testID}-row-${i}`} />)}
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={hide} style={[s.close, { backgroundColor: colors?.primary || '#4f46e5' }]} testID={`${testID}-close`}>
            <Text style={s.buttonText}>{pmT('Close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 640, maxHeight: '86%', borderRadius: 16, padding: 18 },
  title: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 13, marginTop: 6, marginBottom: 10 },
  list: { flexGrow: 0 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, marginBottom: 8 },
  sentence: { fontSize: 14, fontWeight: '600' },
  other: { fontSize: 12, marginTop: 3 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  hint: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  close: { alignSelf: 'flex-end', marginTop: 8, paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8 },
});
