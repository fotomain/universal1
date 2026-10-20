// Monitor02Filters - the bar above the table of Monitor02_ROINow: startDate · finishDate (DateInputApp: type or pick) · the period button (a range of months) · Project · Task.
// The period is by MONTH (the ROI numbers are monthly): any day of a month counts for the whole month. Every change is applied after MONITOR02_FILTER_DEBOUNCE_MS; an unreadable date is a red field, not a filter.
// The Task select lists the tasks that have a line (a project with ROI for tasks ON); picking one shows only that task's line (the project line stays: it is the total).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { pmT } from '../../i18n/pmT';
import { parseDayInput } from '../../../documents/fact/input/factInputModel';
import SelectPeriodButton from '../monitor01/SelectPeriodButton';
import type { RoiReportFilters, RoiSelectOption } from '../roi/roiReportModel';

export const MONITOR02_FILTER_DEBOUNCE_MS = 150;
const DATE_WIDTH = 200;
const SELECT_WIDTH = 190;

export const roiDateErrors = (f: Pick<RoiReportFilters, 'startDate' | 'finishDate'>): { startDate: boolean; finishDate: boolean } => ({
  startDate: !!f.startDate.trim() && parseDayInput(f.startDate) === null,
  finishDate: !!f.finishDate.trim() && parseDayInput(f.finishDate) === null,
});

export interface Monitor02FiltersProps {
  value: RoiReportFilters;
  onChange: (next: RoiReportFilters) => void;
  projectItems: readonly RoiSelectOption[];
  taskItems: readonly RoiSelectOption[];
  testID?: string;
}

export default function Monitor02FiltersBar({ value, onChange, projectItems, taskItems, testID = 'monitor02-filters' }: Monitor02FiltersProps) {
  const { themeColors: c } = useDesignSystem();
  const [draft, setDraft] = useState<RoiReportFilters>(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (patch: Partial<RoiReportFilters>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), MONITOR02_FILTER_DEBOUNCE_MS);
  };
  const errors = roiDateErrors(draft);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID} style={{ flexGrow: 0 }} contentContainerStyle={styles.row}>
      {(['startDate', 'finishDate'] as const).map((k) => (
        <View key={k} style={[styles.cell, { width: DATE_WIDTH }]}>
          <DateInputApp testID={`${testID}-${k}`} label={pmT(k)} value={draft[k]} onChangeText={(t) => change({ [k]: t })} compact error={errors[k]} style={styles.field} />
        </View>
      ))}
      <View style={[styles.cell, styles.centered]}>
        <SelectPeriodButton testID={`${testID}-period`} color={c.text} value={{ startDate: draft.startDate, finishDate: draft.finishDate }} onApply={(next) => change(next)} />
      </View>
      <View style={[styles.cell, { width: SELECT_WIDTH }]}>
        <SelectItemFromListApp testID={`${testID}-project`} items={projectItems} value={draft.projectGUID} onSelect={(v: string) => change({ projectGUID: v, taskGUID: '' })} placeholder={pmT('Project')} searchPlaceholder={pmT('Project')} clearable fieldHeight={42} fieldRadius={4} />
      </View>
      <View style={[styles.cell, { width: SELECT_WIDTH }]}>
        <SelectItemFromListApp testID={`${testID}-task`} items={taskItems} value={draft.taskGUID} onSelect={(v: string) => change({ taskGUID: v })} placeholder={pmT('Task')} searchPlaceholder={pmT('Task')} clearable fieldHeight={42} fieldRadius={4} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, alignItems: 'center' },
  cell: { height: 48, justifyContent: 'flex-end' },
  field: { marginBottom: 0 },
  // the period button is centred on the BOX of the date fields (the label takes the top 6 px of the 48 px cell), not on the cell
  centered: { justifyContent: 'center', paddingTop: 6 },
});
