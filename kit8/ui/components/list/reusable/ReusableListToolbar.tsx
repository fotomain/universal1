// ReusableList - the TOOLBAR above the items: search, Add (+), card size, Sort and Filter, refresh, the extra buttons of the host, the ⋮ More menu, chips of the active sort / filters,
// the selection strip (count, clear, delete). Icons only (the name of an icon is its tip, never text next to it); an icon the list does not need is not drawn.
// A plain component (no list state inside): everything comes in as props, so it re-renders only when the user types or taps, never while the list scrolls.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MenuAnchorPoint, useMenuAnchor } from './useMenuAnchor';
import TextInputApp from '../../common/TextInputApp';
import { PMIconButton } from '../../../../pm/inner/buttons/PMIconButton';
import ActivityIndicatorCircleApp from '../../activityindicator/ActivityIndicatorCircleApp';
import ScrollTopButton from './ScrollTopButton';
import ScrollBottomButton from './ScrollBottomButton';
import ScrollToLastUsedCardButton from './ScrollToLastUsedCardButton';
import { SELECT_COLUMN_WIDTH, SelectCircle } from './RowSelectColumn';
import SelectCardSizeIconButton from '../cards/SelectCardSizeIconButton';
import type { CardSize } from '../cards/cardSize';
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
  /** `at` = the right edge + bottom of the button: the menu opens there */
  onSortFilter: (at: MenuAnchorPoint) => void;
  onClearQuery: () => void;
  onAdd?: () => void;
  onRefresh: () => void;
  onMore?: (at: MenuAnchorPoint) => void;
  refreshing: boolean;
  selectedCount: number;
  onClearSelection: () => void;
  onDeleteSelected?: () => void;
  onSelectAll?: () => void;
  selectionEnabled: boolean;
  /** the ring button: the check boxes (select rows) are shown / hidden */
  selectionVisible: boolean;
  /** every row of the shown list is selected (the select-all circle is full) */
  allSelected: boolean;
  onSelectionVisibleChange: (on: boolean) => void;
  toolbarExtra?: React.ReactNode;
  onScrollTop: () => void;
  onScrollBottom: () => void;
  onScrollToLastUsed: () => void;
  /** a card was used and is in the shown list */
  lastUsedEnabled: boolean;
  lastUsedTitle?: string;
  /** the list shows cards: the icon button that picks cardSmall / cardMedium / cardBig */
  cardSize?: CardSize;
  cardSizes?: readonly CardSize[];
  onCardSizeChange?: (size: CardSize) => void;
}

export default function ReusableListToolbar(p: ReusableListBarProps) {
  const { colors: c, testID } = p;
  const sortAnchor = useMenuAnchor(p.onSortFilter);
  const moreAnchor = useMenuAnchor((at) => p.onMore?.(at));
  const queryActive = p.search.trim() !== '' || !!p.sortLabel || p.filterCount > 0;
  return (
    <View testID={`${testID}-bar`} style={[styles.bar, { backgroundColor: c.background }]}>
      <View style={styles.row}>
        {p.title ? <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{p.title}</Text> : null}
        {p.searchEnabled ? (
          <View style={styles.search}>
            <TextInputApp testID={`${testID}-search`} value={p.search} onChangeText={p.onSearch} placeholder="Search" compact heightVariant="smallestHeight" leftIcon="search" style={styles.searchInput} />
          </View>
        ) : <View style={{ flex: 1 }} />}
        {p.onAdd ? <PMIconButton testID={`${testID}-add`} icon="add" title="Add" onPress={p.onAdd} color={c.text} /> : null}
        {p.selectionEnabled ? (
          <PMIconButton testID={`${testID}-selection-toggle`} icon={p.selectionVisible ? 'check_circle' : 'radio_button_unchecked'} title={p.selectionVisible ? 'Hide row selection' : 'Select rows'}
            onPress={() => p.onSelectionVisibleChange(!p.selectionVisible)} color={c.text} active={p.selectionVisible} activeColor={c.primary} />
        ) : null}
        {p.selectionEnabled && p.selectionVisible && p.selectedCount > 0 && p.onDeleteSelected ? (
          <PMIconButton testID={`${testID}-delete-selected`} icon="delete" title="Delete selected" onPress={p.onDeleteSelected} color="#d32f2f" badge={p.selectedCount} />
        ) : null}
        {p.cardSize && p.onCardSizeChange ? <SelectCardSizeIconButton testID={`${testID}-card-size`} value={p.cardSize} sizes={p.cardSizes} onChange={p.onCardSizeChange} color={c.text} activeColor={c.primary} /> : null}
        <View {...sortAnchor.anchorProps}>
          <PMIconButton testID={`${testID}-sort-filter`} icon="filter_list" title="Sort and filter" onPress={sortAnchor.open} color={c.text} active={!!p.sortLabel || p.filterCount > 0} activeColor={c.primary} />
        </View>
        {p.mode === 'serverDataMode' ? <PMIconButton testID={`${testID}-refresh`} icon="refresh" title="Reload from the database" onPress={p.onRefresh} color={c.text} /> : null}
        {p.toolbarExtra}
        <ScrollToLastUsedCardButton testID={`${testID}-scroll-last-used`} onPress={p.onScrollToLastUsed} enabled={p.lastUsedEnabled} title={p.lastUsedTitle} color={c.text} activeColor={c.primary} />
        <ScrollTopButton testID={`${testID}-scroll-top`} onPress={p.onScrollTop} color={c.text} />
        <ScrollBottomButton testID={`${testID}-scroll-bottom`} onPress={p.onScrollBottom} color={c.text} />
        {p.onMore ? <View {...moreAnchor.anchorProps}><PMIconButton testID={`${testID}-more`} icon="more_vert" title="More" onPress={moreAnchor.open} color={c.text} /></View> : null}
        {p.refreshing ? <ActivityIndicatorCircleApp size="small" /> : null}
      </View>
      {queryActive ? (
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          {p.sortLabel ? <Text testID={`${testID}-chip-sort`} style={[styles.chip, { color: c.primary, borderColor: c.primary }]}>Sort: {p.sortLabel}</Text> : null}
          {p.filterCount > 0 ? <Text testID={`${testID}-chip-filters`} style={[styles.chip, { color: c.primary, borderColor: c.primary }]}>Filters: {p.filterCount}</Text> : null}
          <Pressable testID={`${testID}-clear-query`} onPress={p.onClearQuery}><Text style={{ color: c.text, opacity: 0.7, fontSize: 12, textDecorationLine: 'underline' }}>Clear search, sort and filters</Text></Pressable>
        </View>
      ) : null}
      {p.selectionEnabled && p.selectionVisible ? (
        // the select-all circle stands in a column as wide as the select column of the rows and at the same left edge: ONE vertical line of circles
        <View testID={`${testID}-selection`} style={[styles.row, styles.selectionStrip, { backgroundColor: p.selectedCount > 0 ? c.primary + '18' : 'transparent' }]}>
          <View style={styles.selectAllColumn}>
            <SelectCircle testID={`${testID}-select-all`} checked={p.allSelected} partial={p.selectedCount > 0 && !p.allSelected} borderColor={c.text + '66'} primary={c.primary}
              onPress={() => (p.allSelected ? p.onClearSelection() : p.onSelectAll?.())} />
          </View>
          {p.selectedCount > 0 ? <Text testID={`${testID}-selected-count`} style={{ color: c.text, fontWeight: '600', flex: 1 }}>{p.selectedCount} selected</Text> : <Text style={{ color: c.text, opacity: 0.6, fontSize: 13, flex: 1 }}>Select all</Text>}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 8, paddingVertical: 6, gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, minHeight: 34 },
  // the bar has 8 px padding at the sides: the strip goes back to the list's left edge so its circle is on the line of the row circles
  selectionStrip: { marginHorizontal: -8, paddingRight: 8, flexWrap: 'nowrap' },
  selectAllColumn: { width: SELECT_COLUMN_WIDTH, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '700', maxWidth: 160 },
  search: { flex: 1, minWidth: 120, justifyContent: 'center' },
  // TextInputApp keeps a 12 - 14 px margin under the field (room for an error text): without this the field sits above the centre line of the icons
  searchInput: { marginBottom: 0 },
  chip: { fontSize: 12, fontWeight: '600', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
});
