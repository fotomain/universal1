// PMTaskEditOptions - the window of the context menu item "Options" of a task row / bar: title "Edit options", the UX/UI of the task ONLY
// (the bar color, rowJSON.taskColor). The whole task form (name, dates, progress ...) is TabTaskEditMain of the task window (edit/PMTaskEditWindow) and PMTaskEditModal.
// Opened with store.setEditingOptions(guid) (crud.editOptions); Save writes the color, Cancel / X close without saving.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { usePMStore } from '../../store/store_pm';
import { PMCrud } from '../../crud/usePMCrud';
import { taskColorOf } from '../../model/types';
import { PMDialogButton, PMIconButton } from '../../inner/buttons';
import ColorPickerRowApp from '../../../ui/components/common/ColorPickerRowApp';
import { pmT } from '../../i18n/pmT';
import { SWATCHES } from './PMTaskEditModal';

export default function PMTaskEditOptions({ crud }: { crud: PMCrud }) {
  const { themeColors } = useDesignSystem();
  const guid = usePMStore((s) => s.editingOptionsGUID);
  const task = usePMStore((s) => (s.editingOptionsGUID ? s.tasksById[s.editingOptionsGUID] : undefined));
  const [color, setColor] = useState<string | null>(null);
  const close = () => usePMStore.getState().setEditingOptions(null);

  useEffect(() => {
    if (task) setColor(taskColorOf(task.rowJSON));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guid]);

  if (!task) return null;

  const save = () => {
    const { color: _legacyColor, ...json } = task.rowJSON;
    if ((color ?? null) !== (taskColorOf(task.rowJSON) ?? null)) {
      crud.recordEditPlace?.(task.rowGUID, { surface: 'editModal', section: 'TabUXUI' });
      crud.updateTask(task.rowGUID, { rowJSON: { ...json, taskColor: color } as any }, `Options of "${task.rowJSON.taskDescription}"`);
    }
    close();
  };

  const labelStyle = [styles.label, { color: themeColors.text }];
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View testID="pm-task-options" style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <View style={styles.header}>
            <Text testID="pm-task-options-title" style={[styles.title, { color: themeColors.text }]}>{pmT('Edit options')}</Text>
            <PMIconButton testID="pm-task-options-close" icon="close" title={pmT('Cancel (close without saving)')} color={themeColors.text} onPress={close} />
          </View>
          <Text numberOfLines={1} style={[styles.subtitle, { color: themeColors.text }]}>{task.rowJSON.taskDescription}</Text>

          {/* UX/UI -> Colors (the same section as the UX/UI tab of PMTaskEditModal) */}
          <View testID="pm-task-colors-section" style={{ marginTop: 8 }}>
            <Text style={[labelStyle, { fontWeight: '700', fontSize: 13, marginBottom: 8 }]}>{pmT('Colors')}</Text>
            <Text style={labelStyle}>{pmT('Task bar color')}</Text>
            <ColorPickerRowApp
              testID="pm-task-color-picker"
              value={color}
              onChange={setColor}
              showAuto
              swatches={SWATCHES}
              title={pmT('Custom task color')}
              autoLabel={pmT('auto')}
              customLabel={pmT('Custom…')}
              swatchTestID={(c) => `pm-edit-color-${SWATCHES.find((x) => x.toUpperCase() === (c || '').toUpperCase()) ?? c ?? 'auto'}`}
            />
          </View>

          <View style={styles.actions}>
            <PMDialogButton testID="pm-task-options-cancel" kind="secondary" title={pmT('Cancel')} color={themeColors.text} style={{ marginLeft: 0 }} onPress={close} />
            <PMDialogButton testID="pm-task-options-save" kind="primary" title={pmT('Save')} onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 460, maxHeight: '92%', borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  subtitle: { fontSize: 12, opacity: 0.7 },
  label: { fontSize: 12, opacity: 0.7, marginTop: 12, marginBottom: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 18 },
});
