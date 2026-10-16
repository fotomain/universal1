// TaskScopeChip - the line above a document list that says "this list is for one task / task line" and clears it (the x). Rendered only while the scope is active.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { pmT } from '../../pm/i18n/pmT';
import { TaskScope, taskScopeActive, taskScopeLabel } from './taskScopeModel';

export interface TaskScopeChipProps {
  scope: TaskScope;
  taskName: string;
  onClear: () => void;
  testID?: string;
}

export default function TaskScopeChip({ scope, taskName, onClear, testID = 'task-scope' }: TaskScopeChipProps) {
  const { themeColors: c } = useDesignSystem();
  if (!taskScopeActive(scope)) return null;
  return (
    <View testID={testID} style={styles.row}>
      <View style={[styles.chip, { borderColor: c.primary, backgroundColor: `${c.primary}18` }]}>
        <IconApp name="filter_alt" size={16} color={c.primary} />
        <Text testID={`${testID}-label`} numberOfLines={1} style={{ color: c.text, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>{taskScopeLabel(scope, taskName, pmT)}</Text>
        <Pressable testID={`${testID}-clear`} accessibilityRole="button" accessibilityLabel={pmT('Show all')} onPress={onClear} hitSlop={8} style={styles.x}>
          <IconApp name="close" size={16} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 4, paddingVertical: 4, borderWidth: 1, borderRadius: 16, maxWidth: '100%' },
  x: { padding: 2 },
});
