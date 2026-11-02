// PMKanbanStagePercentInput - the percent of a Kanban stage (rowJSON.stageProgressPercent), whole number 0..100.
//   1..100 = FIXED: every card of the stage has this percent (and, with Project settings -> Kanban -> autoUpdateTaskProgressPercentFromKanban, the task progress % of a card moved into the stage)
//   0      = MANUAL: the percent is typed on each card of the Kanban dashboard
// Used by the "Kanban Stages" window and by the stage dialog of Project settings -> Kanban. The rules are in kanbanTypes.ts (parseKanbanStagePercent).
import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';
import { parseKanbanStagePercent } from '../../model/kanbanTypes';

export const KANBAN_STAGE_PERCENT_ERROR = 'The percent of a stage is a whole number from 0 to 100 (0 = typed on each card).';

export default function PMKanbanStagePercentInput({
  testID,
  value,
  onCommit,
  onInvalid,
  colors,
  width = 52,
}: {
  testID: string;
  value: number;
  /** a valid percent that differs from `value` */
  onCommit: (n: number) => void;
  onInvalid?: (message: string) => void;
  colors: { text: string; border: string };
  width?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = parseKanbanStagePercent(text);
    if (n === null) {
      onInvalid?.(KANBAN_STAGE_PERCENT_ERROR);
      setText(String(value));
      return;
    }
    setText(String(n));
    if (n !== value) onCommit(n);
  };
  return (
    <TextInput
      testID={testID}
      accessibilityLabel="Stage percent, 0 = typed on each card"
      value={text}
      onChangeText={(t) => setText(t.replace(/[^0-9]/g, '').slice(0, 3))}
      onBlur={commit}
      onSubmitEditing={commit}
      placeholder="%"
      placeholderTextColor={colors.border}
      keyboardType="number-pad"
      selectTextOnFocus
      style={[styles.input, { width, color: colors.text, borderColor: colors.border }]}
    />
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingHorizontal: 8, paddingVertical: Platform.OS === 'web' ? 6 : 4, marginRight: 6, fontSize: 13, textAlign: 'center' },
});
