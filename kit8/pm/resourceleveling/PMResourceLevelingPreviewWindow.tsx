// PMResourceLevelingPreviewWindow - the preview and the result of a run (documentation/RESOURCE_LEVELING_WBS.html 9): what moves, the project dates before and after, what could not be
// solved, and which POSTED tasks would lose their posting (the question of 7.7 comes first). Nothing is written before Apply.
// Mounted once by PMResourceLevelingBarButton; driven by useResourceLevelingUiStore.
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { formatDateISO } from '../view/project/scheduling';
import { pmT } from '../i18n/pmT';
import PMResourceLevelingConflictsList from './PMResourceLevelingConflictsList';
import PMResourceLevelingPostedTasksDialog from './PMResourceLevelingPostedTasksDialog';
import { moveReasonText } from './resourceLevelingText';
import { useResourceLevelingUiStore } from './resourceLevelingUiStore';
import type { PostedChoice } from './resourceLevelingRun';

export default function PMResourceLevelingPreviewWindow({ onApply }: { onApply: (choice?: PostedChoice) => void }) {
  const { themeColors: c, isDark } = useDesignSystem();
  const preview = useResourceLevelingUiStore((st) => st.preview);
  const postedDialog = useResourceLevelingUiStore((st) => st.postedDialog);
  const busy = useResourceLevelingUiStore((st) => st.busy);
  const close = () => useResourceLevelingUiStore.getState().setPreview(null);
  if (!preview) return null;
  const { plan } = preview;
  const backward = plan.direction === 'backward';
  const movedWord = backward ? pmT('earlier') : pmT('later');
  const nothing = plan.changes.length === 0;
  const row = (label: string, value: string, testID: string) => (
    <View style={s.sumRow}><Text style={{ color: c.text, opacity: 0.7 }}>{label}</Text><Text style={{ color: c.text, fontWeight: '700' }} testID={testID}>{value}</Text></View>
  );
  return (
    <>
      <Modal transparent visible animationType="fade" onRequestClose={close}>
        <View style={s.backdrop}>
          <View style={[s.card, { backgroundColor: isDark ? '#1f1e24' : '#ffffff' }]} testID="pm-resource-leveling-preview">
            <Text style={[s.title, { color: c.text }]}>{plan.effective.method === 'smoothing' ? pmT('Resource optimization – Smoothing') : pmT('Resource optimization – Leveling')}</Text>
            <View style={s.summary}>
              {row(pmT('Over-allocated now'), String(plan.conflictsBefore), 'pm-resource-leveling-preview-before')}
              {row(pmT('Not solved after the run'), String(plan.conflictsAfter), 'pm-resource-leveling-preview-after')}
              {row(pmT('Tasks moved'), String(plan.changes.length), 'pm-resource-leveling-preview-moved')}
              {row(pmT('Project start'), `${formatDateISO(plan.current.projectStartMs)} → ${formatDateISO(plan.after.projectStartMs)}`, 'pm-resource-leveling-preview-start')}
              {row(pmT('Project finish'), `${formatDateISO(plan.current.projectFinishMs - 86400000)} → ${formatDateISO(plan.after.projectFinishMs - 86400000)}`, 'pm-resource-leveling-preview-finish')}
              {plan.postedChanges.length > 0 && row(pmT('Posted tasks that move'), String(plan.postedChanges.length), 'pm-resource-leveling-preview-posted')}
            </View>
            {backward && <Text style={[s.note, { color: c.text }]}>{pmT('The project is planned from its finish date: the tasks move earlier, the finish date stays.')}</Text>}
            <ScrollView style={s.list} testID="pm-resource-leveling-preview-list">
              {nothing && <Text style={{ color: c.text, opacity: 0.7 }}>{pmT('No task needs to move.')}</Text>}
              {plan.changes.map((m, i) => (
                <View key={m.task} style={[s.item, { borderColor: c.border }]} testID={`pm-resource-leveling-preview-row-${i}`}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>{m.name}{m.posted ? ' ✓' : ''}</Text>
                  <Text style={{ color: c.text, fontSize: 12 }}>
                    {pmT('{{from}} → {{to}} ({{days}} working day(s) {{when}})', { from: formatDateISO(m.startBeforeMs), to: formatDateISO(m.startAfterMs), days: m.delayAfter, when: movedWord })}
                  </Text>
                  {!!m.reason && <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{moveReasonText(m.reason)}</Text>}
                </View>
              ))}
              <PMResourceLevelingConflictsList conflicts={plan.unresolved} />
            </ScrollView>
            <View style={s.buttons}>
              <Pressable testID="pm-resource-leveling-preview-cancel" accessibilityRole="button" onPress={close} style={s.btn}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{pmT('Cancel')}</Text>
              </Pressable>
              <Pressable
                testID="pm-resource-leveling-preview-apply"
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || nothing }}
                disabled={busy || nothing}
                onPress={() => onApply()}
                style={[s.btn, { backgroundColor: busy || nothing ? '#cbd5e1' : c.primary }]}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>{pmT('Apply')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {postedDialog && (
        <PMResourceLevelingPostedTasksDialog
          tasks={plan.postedChanges}
          onChoose={(choice: PostedChoice) => { useResourceLevelingUiStore.getState().setPostedDialog(false); onApply(choice); }}
          onCancel={() => useResourceLevelingUiStore.getState().setPostedDialog(false)}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 680, maxHeight: '92%', borderRadius: 16, padding: 18 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  summary: { marginBottom: 6 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  note: { fontSize: 12, opacity: 0.75, marginBottom: 6 },
  list: { flexGrow: 0, maxHeight: 360, marginVertical: 6 },
  item: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, padding: 8, marginBottom: 6 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  btn: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 8, minHeight: 40, justifyContent: 'center' },
});
