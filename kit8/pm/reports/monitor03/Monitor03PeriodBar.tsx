// Monitor03PeriodBar - startDate · finishDate (DateInputApp: type or pick) · the period button (a range of months): the period of the chart and the table of Monitor03.
// 'Business month' mode: the months that overlap the period, summed from the first of them; 'As seen on a date': the rows of the log whose day is in the period. An unreadable date is a red field, not a period.
// Every change is applied after MONITOR03_PERIOD_DEBOUNCE_MS (the same bar as Monitor01 / Monitor02: SelectPeriodButton).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { pmT } from '../../i18n/pmT';
import SelectPeriodButton from '../monitor01/SelectPeriodButton';
import { roiDateErrors } from '../monitor02/Monitor02Filters';

export const MONITOR03_PERIOD_DEBOUNCE_MS = 150;
const DATE_WIDTH = 200;

export interface Monitor03Period { startDate: string; finishDate: string }
export const EMPTY_MONITOR03_PERIOD: Monitor03Period = { startDate: '', finishDate: '' };

export default function Monitor03PeriodBar({ value, onChange, testID = 'monitor03-filters' }: { value: Monitor03Period; onChange: (next: Monitor03Period) => void; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const [draft, setDraft] = useState<Monitor03Period>(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (patch: Partial<Monitor03Period>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), MONITOR03_PERIOD_DEBOUNCE_MS);
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
        <SelectPeriodButton testID={`${testID}-period`} color={c.text} value={draft} onApply={(next) => change(next)} />
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
