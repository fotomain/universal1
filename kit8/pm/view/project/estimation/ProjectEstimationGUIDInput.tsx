// ProjectEstimationGUIDInput - the "Estimation project" field of Project settings -> Estimation: a project picked from a list (searched by name as you type, like the project field of the
// project bar). The value is project_table.rowJSON.projectEstimationGUID of the project being edited. It is ALWAYS enabled (no switch behind it); only a read-only project locks it (`locked`).
//   x clears the link, the arrow opens the estimation project in a window of its own, the list never offers the project itself.
// The list is shown IN the flow under the field (not a floating layer): the settings window scrolls, a layer would be cut by it.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import ActivityIndicatorCircleApp from '../../../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import { useProjectSearchQuery } from '../../../crud/queries';
import { useReadProjectQuery } from '../../../crud/project/projectQueries';
import { pmT } from '../../../i18n/pmT';
import type { PMProjectRow } from '../../../model/types';
import { openProjectBoard } from '../dashboardDeepLink';
import { canBeEstimationOf } from './estimationModel';

const DEBOUNCE_MS = 220;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export interface ProjectEstimationGUIDInputProps {
  /** the project being edited (null = not saved yet: any project may be picked) */
  projectGUID: string | null;
  /** the owner whose projects are listed (the list of the project bar) */
  ownerGUID: string;
  /** projectEstimationGUID now */
  value: string | null;
  onChange: (guid: string | null) => void;
  /** read-only project: shown, not changed */
  locked?: boolean;
  testID?: string;
}

export default function ProjectEstimationGUIDInput({ projectGUID, ownerGUID, value, onChange, locked = false, testID = 'pm-project-estimation-input' }: ProjectEstimationGUIDInputProps) {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const selected = useReadProjectQuery(value);
  const selectedRow: PMProjectRow | null | undefined = selected.data;
  const selectedName = selectedRow?.rowJSON?.name ?? '';
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const debounced = useDebounced(filter, DEBOUNCE_MS);
  const search = useProjectSearchQuery(ownerGUID, debounced, open && !locked);
  const results = useMemo(() => (search.data ?? []).filter((p) => canBeEstimationOf(projectGUID, p.rowGUID)), [search.data, projectGUID]);
  const notFound = !!value && !selected.isLoading && !selectedRow;

  // when not typing, the field shows the picked project
  useEffect(() => {
    if (!focused) setText(selectedName);
  }, [selectedName, focused]);

  const pick = (p: PMProjectRow) => {
    onChange(p.rowGUID);
    setText(p.rowJSON?.name || '');
    setFilter('');
    setOpen(false);
    setFocused(false);
    inputRef.current?.blur();
  };
  const clear = () => {
    onChange(null);
    setText('');
    setFilter('');
    setOpen(false);
  };

  return (
    <View testID={testID} style={styles.root}>
      <Text style={[styles.label, { color: c.text }]}>{pmT('Estimation project')}</Text>
      <View style={[styles.field, { borderColor: focused ? c.primary : c.border, backgroundColor: c.background, opacity: locked ? 0.6 : 1 }]}>
        <IconApp testID={`${testID}-icon`} name="calculate" size={16} color={c.text} />
        <TextInput
          ref={inputRef}
          testID={`${testID}-text`}
          value={text}
          editable={!locked}
          onChangeText={(t) => { setText(t); setFilter(t); setOpen(true); }}
          onFocus={() => { setFocused(true); setFilter(''); setOpen(true); }}
          onBlur={() => { setFocused(false); setText(selectedName); }}
          onSubmitEditing={() => results[0] && pick(results[0])}
          placeholder={pmT('Find the estimation project…')}
          placeholderTextColor={`${c.text}88`}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.input, { color: c.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
        />
        {!!value && !locked && <IconApp testID={`${testID}-clear`} name="close" size={16} color={c.text} onPress={clear} />}
        {!!value && !!selectedRow && <IconApp testID={`${testID}-open`} name="open_in_new" size={16} color={c.text} onPress={() => openProjectBoard(selectedRow.rowGUID, router)} />}
        {!locked && <IconApp testID={`${testID}-toggle`} name={open ? 'expand_less' : 'expand_more'} size={18} color={c.text} onPress={() => { setFilter(''); setOpen((v) => !v); }} />}
      </View>
      {locked && <Text testID={`${testID}-locked`} style={[styles.hint, { color: c.text }]}>{pmT('Read-only project: the estimation project cannot be changed.')}</Text>}
      {notFound && <Text testID={`${testID}-notfound`} style={[styles.hint, { color: c.error }]}>{pmT('The estimation project is not found or you cannot read it.')}</Text>}
      {!value && !open && <Text testID={`${testID}-empty`} style={[styles.hint, { color: c.text }]}>{pmT('No estimation project. Make the estimation as a separate project, then pick it here.')}</Text>}
      {!!selectedRow && !open && (
        <Text testID={`${testID}-info`} style={[styles.hint, { color: c.text }]}>
          {[selectedRow.rowJSON?.currencyForBudget, selectedRow.rowJSON?.projectStartDate, selectedRow.rowJSON?.projectFinishDate].filter(Boolean).join(' · ')}
        </Text>
      )}
      {open && !locked && (
        <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]} testID={`${testID}-list`}>
          {search.isFetching && !results.length ? (
            <View style={styles.listEmpty}><ActivityIndicatorCircleApp size="small" color={c.primary} /></View>
          ) : !results.length ? (
            <Text style={[styles.listEmptyText, { color: c.text }]} testID={`${testID}-list-empty`}>{pmT('No project found')}</Text>
          ) : (
            <ScrollView style={styles.listScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {results.map((p) => (
                <Pressable key={p.rowGUID} testID={`${testID}-item-${p.rowGUID}`} onPress={() => pick(p)} style={[styles.item, p.rowGUID === value && { backgroundColor: `${c.primary}22` }]}>
                  <Text style={{ color: c.text, fontSize: 13, fontWeight: p.rowGUID === value ? '700' : '500' }} numberOfLines={1}>{p.rowJSON?.name || p.rowGUID}</Text>
                  <Text style={{ color: c.text, fontSize: 11, opacity: 0.6 }} numberOfLines={1}>{[p.rowJSON?.currencyForBudget, p.rowJSON?.projectStartDate].filter(Boolean).join(' · ')}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, minHeight: 40 },
  input: { flex: 1, fontSize: 14, paddingVertical: 6 },
  hint: { fontSize: 12, opacity: 0.7, marginTop: 4 },
  list: { borderWidth: 1, borderRadius: 8, marginTop: 4, maxHeight: 240, overflow: 'hidden' },
  listScroll: { maxHeight: 240 },
  listEmpty: { padding: 12, alignItems: 'center' },
  listEmptyText: { padding: 12, fontSize: 13, opacity: 0.7 },
  item: { paddingHorizontal: 12, paddingVertical: 8 },
});
