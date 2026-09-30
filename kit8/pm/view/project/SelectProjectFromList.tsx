// SelectProjectFromList: searchable project picker placed BEFORE the project ribbon.
// Works like the language selector of the hamburger menu: type a substring -> the
// matching projects are read from the database (Supabase ILIKE on the name) and shown
// in a dropdown; Enter picks the first match; ▾ shows all; ✕ clears. Picking a project
// selects it and adds it to the ribbon of recently selected projects.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import ActivityIndicatorCircleApp from '../../../components/activityindicator/ActivityIndicatorCircleApp';
import IconApp from '../../../components/common/IconApp';
import { usePMStore } from '../../store/store_pm';
import { useProjectSearchQuery } from '../../crud/queries';
import { formatDateShort } from './scheduling';
import { PMProjectRow } from '../../model/types';

const DEBOUNCE_MS = 220;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SelectProjectFromList({ ownerGUID, width = 220 }: { ownerGUID: string; width?: number }) {
  const { themeColors: c } = useDesignSystem();
  const selectedName = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON.name ?? '' : ''));
  const [text, setText] = useState('');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useDebounced(filter, DEBOUNCE_MS);
  const search = useProjectSearchQuery(ownerGUID, debounced, open);
  const results = useMemo(() => search.data ?? [], [search.data]);

  // when not editing, the field shows the selected project (like "EN - English")
  useEffect(() => {
    if (!focused) setText(selectedName);
  }, [selectedName, focused]);
  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  const pick = (p: PMProjectRow) => {
    const s = usePMStore.getState();
    s.addRecentProject(p.rowGUID);
    s.selectProject(p.rowGUID);
    setText(p.rowJSON.name || '');
    setFilter('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const onChange = (t: string) => {
    setText(t);
    setFilter(t);
    setOpen(true);
  };
  const onFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setFocused(true);
    setFilter(''); // focusing shows all projects first
    setOpen(true);
  };
  const onBlur = () => {
    // let a tap on a dropdown row land before closing
    blurTimer.current = setTimeout(() => {
      setFocused(false);
      setOpen(false);
      setFilter('');
    }, 200);
  };
  const clear = () => {
    setText('');
    setFilter('');
    setOpen(true);
    inputRef.current?.focus();
  };
  const toggle = () => {
    setFilter('');
    setOpen((v) => !v);
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.root, { width }]}>
      <View style={[styles.field, { borderColor: focused ? c.primary : c.border, backgroundColor: c.background }]}>
        <IconApp testID="pm-project-search-icon" name="search" size={16} color={c.text} />
        <TextInput
          ref={inputRef}
          testID="pm-project-search"
          value={text}
          onChangeText={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onSubmitEditing={() => results[0] && pick(results[0])}
          placeholder="Find project…"
          placeholderTextColor={`${c.text}88`}
          selectTextOnFocus
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.input, { color: c.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
        />
        {!!text && <IconApp testID="pm-project-search-clear" name="close" size={16} color={c.text} onPress={clear} />}
        <IconApp testID="pm-project-search-toggle" name={open ? 'expand_less' : 'expand_more'} size={18} color={c.text} onPress={toggle} />
      </View>

      {open && (
        <View style={[styles.dropdown, { backgroundColor: c.surface, borderColor: c.border }]} testID="pm-project-search-list">
          {search.isFetching && !results.length ? (
            <ActivityIndicatorCircleApp style={{ padding: 12 }} size="small" color={c.primary} />
          ) : (
            <FlatList
              data={results}
              keyExtractor={(p) => p.rowGUID}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 280 }}
              renderItem={({ item, index }) => (
                <Pressable
                  testID={`pm-project-search-item-${item.rowGUID}`}
                  onPress={() => pick(item)}
                  style={({ hovered, pressed }: any) => [
                    styles.item,
                    { backgroundColor: hovered || pressed ? `${c.primary}14` : index === 0 && !!filter ? `${c.primary}0a` : 'transparent' },
                  ]}
                >
                  <Text numberOfLines={1} style={{ color: c.text, fontWeight: '600', flex: 1 }}>
                    {item.rowJSON.name || 'Project'}
                  </Text>
                  <Text style={{ color: c.text, opacity: 0.55, fontSize: 11, marginLeft: 8 }}>
                    {Math.round(item.rowProgress || 0)}%{item.rowDuration ? ` · ${formatDateShort(Date.parse(item.rowDuration) - 1)}` : ''}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={[styles.empty, { color: c.text }]}>{filter ? 'No matching project' : 'No projects yet'}</Text>}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'relative', zIndex: 50, marginRight: 6 },
  field: { flexDirection: 'row', alignItems: 'center', height: 34, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8 },
  input: { flex: 1, marginHorizontal: 6, paddingVertical: 0, fontSize: 13, minWidth: 40 },
  dropdown: {
    position: 'absolute',
    top: 38,
    left: 0,
    right: 0,
    minWidth: 240,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 4,
    zIndex: 60,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9 },
  empty: { padding: 12, opacity: 0.6, textAlign: 'center' },
});
