// EditTaskNameFast - the name of a task as a text that can be typed over at once (the title of the Finances view, the title of a task page):
// TextInputApp in FLAT mode = no background, no border, no underline; the label and the placeholder work as in any TextInputApp.
//   * Enter or leaving the field saves the name (crud.updateTask, one undo step "Rename task"); Escape (web) puts the old name back
//   * the text is selected when the field is focused (a click then typing replaces it)
//   * an EMPTY name is never saved: the old name comes back when the field is left (a task always has a name)
//   * the name of the task changed elsewhere (realtime, the tree) shows here at once - unless the user is typing in the field now
//   * only the name is written: the rest of the task rowJSON is kept as it is
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import { usePMStore } from '../../store/store_pm';
import { pmT } from '../../i18n/pmT';
import type { PMCrud } from '../../crud/usePMCrud';

export const TASK_NAME_MAX = 200;

/** the name to save, or null when nothing should be saved (empty, or the same as now) */
export function nameToSave(draft: string, current: string): string | null {
  const next = draft.trim().slice(0, TASK_NAME_MAX);
  if (!next || next === current) return null;
  return next;
}

export default function EditTaskNameFast({ guid, crud, label, testID, textStyle }: {
  guid: string;
  crud: Pick<PMCrud, 'updateTask'>;
  /** the label of the field (floats above the text in the design systems that have one); none = the placeholder only */
  label?: string;
  testID?: string;
  textStyle?: any;
}) {
  const task = usePMStore((s) => s.tasksById[guid]);
  const current: string = task?.rowJSON?.name ?? '';
  const [draft, setDraft] = useState(current);
  const focused = useRef(false);
  /** the name this field saved last and the store has not shown yet: Enter and then leaving the field must not save it twice */
  const saved = useRef<string | null>(null);

  // a name changed elsewhere (realtime, another view) follows - not while the user is typing here
  useEffect(() => {
    saved.current = null;
    if (!focused.current) setDraft(current);
  }, [current]);

  const commit = () => {
    const next = nameToSave(draft, saved.current ?? current);
    if (next && task) {
      saved.current = next;
      crud.updateTask(guid, { rowJSON: { ...task.rowJSON, name: next } }, 'Rename task');
      setDraft(next);
    } else {
      setDraft(saved.current ?? current);        // empty or unchanged: show the saved name (trimmed) again
    }
  };

  if (!task) return null;
  return (
    <View style={styles.box} testID={testID ?? `pm-task-name-${guid}`}>
      <TextInputApp
        mode="flat"
        testID={`${testID ?? `pm-task-name-${guid}`}-input`}
        label={label}
        placeholder={pmT('Task name')}
        value={draft}
        onChangeText={(t) => setDraft(t.slice(0, TASK_NAME_MAX))}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commit(); }}
        onSubmitEditing={commit}
        onKeyPress={(e: any) => { if (e?.nativeEvent?.key === 'Escape') setDraft(saved.current ?? current); }}
        selectTextOnFocus
        hideClearIcon
        autoCapitalize="sentences"
        heightVariant="smallestHeight"
        returnKeyType="done"
        style={textStyle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, minWidth: 0, justifyContent: 'center' },
});
