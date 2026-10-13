// Monitor01Filters - the fast filters above the table (TextInputApp): startDate · finishDate · Project · Task · Resource.
// Typing is applied after MONITOR01_FILTER_DEBOUNCE_MS; the filters work in memory on the loaded rows. An unreadable date is a red field, not a filter.
// The project mode has no Project field (the project is fixed).
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import TextInputApp from '../../../ui/components/common/TextInputApp';
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

const FIELDS: { key: keyof Monitor01Filters; label: string; placeholder?: string; width: number; icon?: string }[] = [
  { key: 'startDate', label: 'startDate', placeholder: 'YYYY-MM-DD', width: 130 },
  { key: 'finishDate', label: 'finishDate', placeholder: 'YYYY-MM-DD', width: 130 },
  { key: 'project', label: 'Project', width: 170, icon: 'search' },
  { key: 'task', label: 'Task', width: 170, icon: 'search' },
  { key: 'resource', label: 'Resource', width: 170, icon: 'search' },
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
    <View testID={testID} style={styles.row}>
      {FIELDS.filter((f) => showProject || f.key !== 'project').map((f) => (
        <View key={f.key} style={{ width: f.width }}>
          <TextInputApp
            testID={`${testID}-${f.key}`}
            label={pmT(f.label)}
            placeholder={f.placeholder}
            value={draft[f.key]}
            onChangeText={(t) => set(f.key, t)}
            compact
            leftIcon={f.icon}
            error={f.key === 'startDate' ? errors.startDate : f.key === 'finishDate' ? errors.finishDate : false}
          />
        </View>
      ))}
    </View>
  );
}

export { EMPTY_MONITOR01_FILTERS };
const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' } });
