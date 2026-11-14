// ReusableList - the bar above the items: search, sort + filter, add, the selection strip (count, clear, delete), refresh, ⋮ menu, chips of the active sort / filters.
// A plain component (no list state inside): everything comes in as props, so it re-renders only when the user types or taps, never while the list scrolls.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import TextInputApp from '../../common/TextInputApp';
import { PMIconButton } from '../../../../pm/inner/buttons/PMIconButton';
import ActivityIndicatorCircleApp from '../../activityindicator/ActivityIndicatorCircleApp';
import type { ReusableListDataMode } from './reusableListTypes';

export interface ReusableListBarProps {
  testID: string;
  colors: { text: string; border: string; primary: string; background: string };
  title?: string;
  mode: ReusableListDataMode;
  search: string;
  onSearch: (text: string) => void;
  searchEnabled: boolean;
  /** "Name ▲" of the column sort, '' = none */
  sortLabel: string;
  filterCount: number;
  onSortFilter: () => void;
  onClearQuery: () => void;
  onAdd?: () => void;
  onRefresh: () => void;
  onMore?: () => void;
  refreshing: boolean;
  selectedCount: number;
  onClearSelection: () => void;
  onDeleteSelected?: () => void;
  onSelectAll?: () => void;
  selectionEnabled: boolean;
  toolbarExtra?: React.ReactNode;
}

export default function ReusableListBar(p: ReusableListBarProps) {
  const { colors: c, testID } = p;
  const queryActive = p.search.trim() !== '' || !!p.sortLabel || p.filterCount > 0;
  return (
    <View testID={`${testID}-bar`} style={[styles.bar, { borderBottomColor: c.border, backgroundColor: c.background }]}>
      <View style={styles.row}>
        {p.title ? <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{p.title}</Text> : null}
        {p.searchEnabled ? (
          <View style={styles.search}>
            <TextInputApp testID={`${testID}-search`} value={p.search} onChangeText={p.onSearch} placeholder="Search" compact heightVariant="smallestHeight" leftIcon="search" />
          </View>
        ) : <View style={{ flex: 1 }} />}
        {p.onAdd ? <PMIconButton testID={`${testID}-add`} icon="add" label="Add" onPress={p.onAdd} color={c.text} /> : null}
        <PMIconButton testID={`${testID}-sort-filter`} icon="filter_list" label="Sort and filter" onPress={p.onSortFilter} color={c.text} active={!!p.sortLabel || p.filterCount > 0} activeColor={c.primary} />
        {p.mode === 'serverDataMode' ? <PMIconButton testID={`${testID}-refresh`} icon="refresh" label="Reload from the database" onPress={p.onRefresh} color={c.text} /> : null}
        {p.toolbarExtra}
        {p.onMore ? <PMIconButton testID={`${testID}-more`} icon="more_vert" label="More" onPress={p.onMore} color={c.text} /> : null}
        {p.refreshing ? <ActivityIndicatorCircleApp size="small" /> : null}
      </View>
      {queryActive ? (
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {p.sortLabel ? <Text testID={`${testID}-chip-sort`} style={[styles.chip, { color: c.primary, borderColor: c.primary }]}>Sort: {p.sortLabel}</Text> : null}
          {p.filterCount > 0 ? <Text testID={`${testID}-chip-filters`} style={[styles.chip, { color: c.primary, borderColor: c.primary }]}>Filters: {p.filterCount}</Text> : null}
          <Pressable testID={`${testID}-clear-query`} onPress={p.onClearQuery}><Text style={{ color: c.text, opacity: 0.7, fontSize: 12, textDecorationLine: 'underline' }}>Clear search, sort and filters</Text></Pressable>
        </View>
      ) : null}
      {p.selectionEnabled && p.selectedCount > 0 ? (
        <View testID={`${testID}-selection`} style={[styles.row, { backgroundColor: c.primary + '18', borderRadius: 8, paddingHorizontal: 8 }]}>
          <Text testID={`${testID}-selected-count`} style={{ color: c.text, fontWeight: '600', flex: 1 }}>{p.selectedCount} selected</Text>
          {p.onSelectAll ? <Pressable testID={`${testID}-select-all`} onPress={p.onSelectAll}><Text style={{ color: c.primary, fontWeight: '600' }}>Select all</Text></Pressable> : null}
          <Pressable testID={`${testID}-clear-selection`} onPress={p.onClearSelection}><Text style={{ color: c.text, opacity: 0.8 }}>Clear</Text></Pressable>
          {p.onDeleteSelected ? <PMIconButton testID={`${testID}-delete-selected`} icon="delete" label="Delete selected" onPress={p.onDeleteSelected} color="#d32f2f" /> : null}
        </View>
      ) : p.selectionEnabled && p.onSelectAll ? (
        <View style={styles.row}><Pressable testID={`${testID}-select-all`} onPress={p.onSelectAll}><Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>Select all</Text></Pressable></View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 8, paddingVertical: 6, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34 },
  title: { fontSize: 16, fontWeight: '700', maxWidth: 160 },
  search: { flex: 1, minWidth: 120 },
  chip: { fontSize: 12, fontWeight: '600', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
});
