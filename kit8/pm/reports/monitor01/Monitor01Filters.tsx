// Monitor01Filters - the fast filters above the table: startDate · finishDate (DateInputApp: type or pick) · Project · Task · Resource (TextInputApp, each with the clear icon INSIDE the field).
// Typing is applied after MONITOR01_FILTER_DEBOUNCE_MS; the filters work in memory on the loaded rows. An unreadable date is a red field, not a filter.
// The project mode has no Project field (the project is fixed).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import TextInputApp from '../../../ui/components/common/TextInputApp';
import DateInputApp from '../../../ui/components/common/date_input/DateInputApp';
import { pmT } from '../../i18n/pmT';
import { MONITOR01_FILTER_DEBOUNCE_MS } from './monitor01Constants';
import { EMPTY_MONITOR01_FILTERS, Monitor01Filters, monitor01DateErrors } from './monitor01Model';

export interface Monitor01FiltersProps {
  value: Monitor01Filters;
  onChange: (next: Monitor01Filters) => void;
  /** project mode: no Project field */
  showProject: boolean;
  testID?: string;
}

const DATES: { key: 'startDate' | 'finishDate'; label: string }[] = [
  { key: 'startDate', label: 'startDate' },
  { key: 'finishDate', label: 'finishDate' },
];
const TEXTS: { key: 'project' | 'task' | 'resource'; label: string }[] = [
  { key: 'project', label: 'Project' },
  { key: 'task', label: 'Task' },
  { key: 'resource', label: 'Resource' },
];

export default function Monitor01FiltersBar({ value, onChange, showProject, testID = 'monitor01-filters' }: Monitor01FiltersProps) {
  const [draft, setDraft] = useState<Monitor01Filters>(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // a change from outside (reset) replaces what is typed
  useEffect(() => setDraft(value), [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const set = (key: keyof Monitor01Filters, text: string) => {
    const next = { ...draft, [key]: text };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(next), MONITOR01_FILTER_DEBOUNCE_MS);
  };
  const errors = monitor01DateErrors(draft);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID} style={{ flexGrow: 0 }} contentContainerStyle={styles.row}>
      {DATES.map((f) => (
        <View key={f.key} style={{ width: 150 }}>
          <DateInputApp testID={`${testID}-${f.key}`} label={pmT(f.label)} value={draft[f.key]} onChangeText={(t) => set(f.key, t)} compact error={errors[f.key]} />
        </View>
      ))}
      {TEXTS.filter((f) => showProject || f.key !== 'project').map((f) => (
        <View key={f.key} style={{ width: 170 }}>
          <TextInputApp testID={`${testID}-${f.key}`} label={pmT(f.label)} value={draft[f.key]} onChangeText={(t) => set(f.key, t)} compact leftIcon="search" />
        </View>
      ))}
    </ScrollView>
  );
}

export { EMPTY_MONITOR01_FILTERS };
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, alignItems: 'center' },
});
