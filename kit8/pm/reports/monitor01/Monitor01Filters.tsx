// Monitor01Filters - the fast filters above the table: startDate · finishDate (DateInputApp: type or pick) · Project · Task · Resource (SelectItemFromListApp, picked from the names that
// are actually in the data - not typed free text: two tasks can share a name, so a name is not a key). Every change is applied after MONITOR01_FILTER_DEBOUNCE_MS; the filters work in memory
// on the loaded rows. An unreadable date is a red field, not a filter. The project mode has no Project field (the project is fixed).
// The items of Task and Resource narrow to the selected Project (monitor01TaskOptions / monitor01ResourceOptions, like the Contract select of the vendor invoice filter narrows with its
// Partner) - computed by the screen (Monitor01Dashboard), which also clears a Task / Resource that no longer belongs to a newly picked project: this bar only reports what was picked.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { pmT } from '../../i18n/pmT';
import { MONITOR01_FILTER_DEBOUNCE_MS } from './monitor01Constants';
import { EMPTY_MONITOR01_FILTERS, Monitor01Filters, Monitor01SelectOption, monitor01DateErrors } from './monitor01Model';
import SelectPeriodButton from './SelectPeriodButton';

export interface Monitor01FiltersProps {
  value: Monitor01Filters;
  onChange: (next: Monitor01Filters) => void;
  /** project mode: no Project field */
  showProject: boolean;
  /** the items of the Project select (standalone mode): every project of the loaded rows */
  projectItems: readonly Monitor01SelectOption[];
  /** the items of the Task select: the tasks of the selected project, or of every row when no project is selected */
  taskItems: readonly Monitor01SelectOption[];
  /** the items of the Resource select: the roles of the selected project, or of every row when no project is selected */
  resourceItems: readonly Monitor01SelectOption[];
  testID?: string;
}

/** wide enough for the whole date (2026-12-31) next to the calendar and clear icons */
const DATE_WIDTH = 200;
const SELECT_WIDTH = 190;
const DATES: { key: 'startDate' | 'finishDate'; label: string }[] = [
  { key: 'startDate', label: 'startDate' },
  { key: 'finishDate', label: 'finishDate' },
];
/** key = the field of Monitor01Filters; suffix = the testID / translation key kept from before (no "GUID" in the UI) */
const SELECTS: { key: 'projectGUID' | 'taskGUID' | 'resourceGUID'; suffix: 'project' | 'task' | 'resource'; label: string }[] = [
  { key: 'projectGUID', suffix: 'project', label: 'Project' },
  { key: 'taskGUID', suffix: 'task', label: 'Task' },
  { key: 'resourceGUID', suffix: 'resource', label: 'Resource' },
];

export default function Monitor01FiltersBar({ value, onChange, showProject, projectItems, taskItems, resourceItems, testID = 'monitor01-filters' }: Monitor01FiltersProps) {
  const { themeColors: c } = useDesignSystem();
  const [draft, setDraft] = useState<Monitor01Filters>(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // a change from outside (reset, or the screen clearing a stale Task / Resource) replaces what is typed
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const change = (patch: Partial<Monitor01Filters>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), MONITOR01_FILTER_DEBOUNCE_MS);
  };
  const itemsOf = { projectGUID: projectItems, taskGUID: taskItems, resourceGUID: resourceItems } as const;
  const errors = monitor01DateErrors(draft);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID} style={{ flexGrow: 0 }} contentContainerStyle={styles.row}>
      {DATES.map((f) => (
        <View key={f.key} style={[styles.cell, { width: DATE_WIDTH }]}>
          <DateInputApp testID={`${testID}-${f.key}`} label={pmT(f.label)} value={draft[f.key]} onChangeText={(t) => change({ [f.key]: t })} compact error={errors[f.key]} style={styles.field} />
        </View>
      ))}
      {/* right after Finish date: pick a whole range of months at once (SelectPeriodModal), instead of typing / picking the two dates one at a time */}
      <View style={styles.cell}>
        <SelectPeriodButton testID={`${testID}-period`} color={c.text} value={{ startDate: draft.startDate, finishDate: draft.finishDate }} onApply={(next) => change(next)} />
      </View>
      {SELECTS.filter((f) => showProject || f.key !== 'projectGUID').map((f) => (
        <View key={f.key} style={[styles.cell, { width: SELECT_WIDTH }]}>
          <SelectItemFromListApp
            testID={`${testID}-${f.suffix}`}
            items={itemsOf[f.key]}
            value={draft[f.key]}
            onSelect={(v: string) => change({ [f.key]: v })}
            placeholder={pmT(f.label)}
            searchPlaceholder={pmT(f.label)}
            clearable
            fieldHeight={42}
            fieldRadius={4}
          />
        </View>
      ))}
    </ScrollView>
  );
}

export { EMPTY_MONITOR01_FILTERS };
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, alignItems: 'center' },
  // every input in the bar: one row height, the visible box bottom-aligned (paper leaves 6 px above its outline for the label), no bottom margin of its own
  cell: { height: 48, justifyContent: 'flex-end' },
  field: { marginBottom: 0 },
});
