// ReportFilterBar - ONE horizontal scrolling row of filters built from descriptors (reportFilterModel.ts). Every change is applied after REPORT_FILTER_DEBOUNCE_MS; an unreadable date / amount is a red
// field (and stays in the draft) - the caller decides what an invalid value means (the partner balance sends no filter for it). Used by Monitor07; the look is the one of Monitor02Filters.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import { pmT } from '../../i18n/pmT';
import SelectPeriodButton from '../monitor01/SelectPeriodButton';
import { FilterDescriptor, FilterValues, applyFilterChange, reportFilterErrors } from './reportFilterModel';

export const REPORT_FILTER_DEBOUNCE_MS = 150;
const DATE_WIDTH = 190;
const SELECT_WIDTH = 190;
const AMOUNT_WIDTH = 150;

export interface ReportFilterBarProps {
  descriptors: readonly FilterDescriptor[];
  value: FilterValues;
  onChange: (next: FilterValues) => void;
  testID?: string;
}

export default function ReportFilterBar({ descriptors, value, onChange, testID = 'report-filters' }: ReportFilterBarProps) {
  const [draft, setDraft] = useState<FilterValues>(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const push = (next: FilterValues) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), REPORT_FILTER_DEBOUNCE_MS);
  };
  const change = (id: string, v: string) => push(applyFilterChange(descriptors, draft, id, v));
  const errors = reportFilterErrors(descriptors, draft);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID} style={{ flexGrow: 0 }} contentContainerStyle={styles.row}>
      {descriptors.map((d) => {
        if (d.kind === 'date') {
          return (
            <View key={d.id} style={[styles.cell, { width: d.width ?? DATE_WIDTH }]}>
              <DateInputApp testID={`${testID}-${d.id}`} label={pmT(d.label)} value={draft[d.id] ?? ''} onChangeText={(t: string) => change(d.id, t)} compact error={errors[d.id]} style={styles.field} />
            </View>
          );
        }
        if (d.kind === 'period') {
          return (
            <View key={d.id} style={[styles.cell, styles.centered]}>
              <SelectPeriodButton testID={`${testID}-${d.id}`} color="#888" value={{ startDate: draft[d.from] ?? '', finishDate: draft[d.to] ?? '' }}
                onApply={(next: { startDate: string; finishDate: string }) => push({ ...draft, [d.from]: next.startDate, [d.to]: next.finishDate })} />
            </View>
          );
        }
        if (d.kind === 'amount') {
          return (
            <View key={d.id} style={[styles.cell, { width: d.width ?? AMOUNT_WIDTH }]}>
              <TextInputApp testID={`${testID}-${d.id}`} label={pmT(d.label)} value={draft[d.id] ?? ''} onChangeText={(t: string) => change(d.id, t)} compact keyboardType="numeric" error={errors[d.id]} style={styles.field} />
            </View>
          );
        }
        return (
          <View key={d.id} style={[styles.cell, { width: d.width ?? SELECT_WIDTH }]}>
            <SelectItemFromListApp testID={`${testID}-${d.id}`} items={d.items as any} value={draft[d.id] ?? ''} onSelect={(v: string) => change(d.id, v)} placeholder={pmT(d.label)} searchPlaceholder={pmT(d.label)} clearable
              disabled={d.disabled} fieldHeight={42} fieldRadius={4} />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, alignItems: 'center' },
  cell: { height: 48, justifyContent: 'flex-end' },
  field: { marginBottom: 0 },
  centered: { justifyContent: 'center', paddingTop: 6 },
});
