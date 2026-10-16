// PMProjectPickerModal - the project DASHBOARD (recent projects, the task tree, the Finances view of the selected task: full data, like "Edit") in a full screen window that RETURNS what the user
// pressed: a task (button "Select this task" of the Finances toolbar) or a task line (row menu "Select this line" / a click on a read only cell of the line).
// Used by the lines of a multi project vendor invoice / purchase order (kit8/documents/vendor/lineplace). The dashboard itself is PMProjectDashboard with its `picker` prop.
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import { pmT } from '../../../i18n/pmT';
import PMProjectDashboard from '../PMProjectDashboard';
import type { PMPickedPlace, PMPickerMode } from './pmPickerContext';

export interface PMProjectPickerModalProps {
  visible: boolean;
  /** 'task': the answer is a task · 'line': a task line (the task can be picked too) */
  mode: PMPickerMode;
  onPick: (place: PMPickedPlace) => void;
  onClose: () => void;
  testID?: string;
}

export const pickerHint = (mode: PMPickerMode): string => (mode === 'line'
  ? 'Click a task in the tree, then choose its line: row menu "Select this line" (or a click on a read only cell). "Select this task" takes the task without a line.'
  : 'Click a task in the tree, then press "Select this task".');

export default function PMProjectPickerModal({ visible, mode, onPick, onClose, testID = 'pm-picker' }: PMProjectPickerModalProps) {
  const { themeColors: c } = useDesignSystem();
  const picker = React.useMemo(() => ({ mode, onPick }), [mode, onPick]);
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} testID={testID}>
      <View style={[styles.root, { backgroundColor: c.background }]}>
        <View style={[styles.bar, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
          <IconApp name="account_tree" size={20} color={c.primary} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text testID={`${testID}-title`} numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT(mode === 'line' ? 'Select a task line' : 'Select a task')}</Text>
            <Text testID={`${testID}-hint`} numberOfLines={2} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT(pickerHint(mode))}</Text>
          </View>
          <Pressable testID={`${testID}-close`} accessibilityRole="button" accessibilityLabel={pmT('Close')} onPress={onClose} hitSlop={8} style={styles.close}>
            <IconApp name="close" size={22} color={c.text} />
          </Pressable>
        </View>
        {visible ? <View style={{ flex: 1 }}><PMProjectDashboard picker={picker} /></View> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  close: { padding: 6 },
});
