// ReusableTable - one generic table for web + iOS + Android, driven by a column config.
// Features: sort by column, search, pagination, row selection, custom cells, design-system colors.
// Usage: <ReusableTable data={rows} columns={columns} keyExtractor={(r) => r.rowGUID} />
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../common/IconApp';
import type { ReusableTableColumn, ReusableTableProps, SortDirection } from './reusableTableTypes';

const DEFAULT_COLUMN_WIDTH = 140;
const CHECK_COLUMN_WIDTH = 44;

const valueOf = <T,>(col: ReusableTableColumn<T>, row: T): unknown => (col.getValue ? col.getValue(row) : (row as any)?.[col.key]);

/** numbers by value, dates by time, everything else as case-insensitive text; empty values last */
export function compareValues(a: unknown, b: unknown): number {
  const emptyA = a === null || a === undefined || a === '';
  const emptyB = b === null || b === undefined || b === '';
  if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export default function ReusableTable<T>({
  data,
  columns,
  keyExtractor,
  title,
  searchable = true,
  searchPlaceholder = 'Search...',
  pageSize = 10,
  initialSort,
  selectable = false,
  onSelectionChange,
  onRowPress,
  emptyText = 'No data',
  loading = false,
  striped = true,
  testID = 'reusable-table',
}: ReusableTableProps<T>) {
  const { themeColors: c } = useDesignSystem();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(initialSort ?? null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // ---- search ----
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    const cols = columns.filter((col) => col.searchable !== false);
    return data.filter((row) =>
      cols.some((col) => {
        const v = valueOf(col, row);
        return (typeof v === 'string' || typeof v === 'number') && String(v).toLowerCase().includes(q);
      }),
    );
  }, [data, columns, query]);

  // ---- sort ----
  const sorted = useMemo(() => {
    const col = sort && columns.find((x) => x.key === sort.key);
    if (!sort || !col) return filtered;
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => dir * compareValues(valueOf(col, a), valueOf(col, b)));
  }, [filtered, columns, sort]);

  // ---- pagination ----
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  useEffect(() => { if (page !== safePage) setPage(safePage); }, [page, safePage]);
  const visible = pageSize > 0 ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

  /** header press: asc -> desc -> not sorted */
  const toggleSort = (key: string) => {
    setSort((s) => (s?.key !== key ? { key, direction: 'asc' } : s.direction === 'asc' ? { key, direction: 'desc' } : null));
    setPage(0);
  };

  // ---- selection ----
  const applySelection = (next: Record<string, boolean>) => {
    setSelected(next);
    onSelectionChange?.(Object.keys(next).filter((k) => next[k]));
  };
  const toggleRow = (key: string) => applySelection({ ...selected, [key]: !selected[key] });
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected[keyExtractor(r)]);
  const toggleAllVisible = () => {
    const next = { ...selected };
    visible.forEach((r) => { next[keyExtractor(r)] = !allVisibleSelected; });
    applySelection(next);
  };
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const totalWidth = columns.reduce((w, col) => w + (col.width ?? DEFAULT_COLUMN_WIDTH), selectable ? CHECK_COLUMN_WIDTH : 0);
  const justify = (col: ReusableTableColumn<T>) => (col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start');

  const checkbox = (checked: boolean, onPress: () => void, id: string) => (
    <Pressable testID={id} onPress={onPress} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked }} style={[styles.cell, { width: CHECK_COLUMN_WIDTH, justifyContent: 'center' }]}>
      {/* text glyphs: render the same on web / iOS / Android, no icon-font dependency */}
      <View style={[styles.box, { borderColor: checked ? c.primary : c.text + '80', backgroundColor: checked ? c.primary : 'transparent' }]}>
        {checked && <Text style={styles.boxTick}>✓</Text>}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.surface, borderColor: c.border }]} testID={testID}>
      {(title || searchable) && (
        <View style={[styles.toolbar, { borderBottomColor: c.border }]}>
          {!!title && <Text style={[styles.title, { color: c.text }]}>{title}</Text>}
          {selectable && selectedCount > 0 && <Text testID={`${testID}-selected-count`} style={{ color: c.primary, fontWeight: '600' }}>{selectedCount} selected</Text>}
          {searchable && (
            <TextInput
              testID={`${testID}-search`}
              value={query}
              onChangeText={(v) => { setQuery(v); setPage(0); }}
              placeholder={searchPlaceholder}
              placeholderTextColor={c.text + '80'}
              style={[styles.search, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
            />
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }}>
        <View style={{ minWidth: totalWidth, flex: 1 }}>
          {/* header */}
          <View style={[styles.row, { backgroundColor: c.background, borderBottomColor: c.border }]}>
            {selectable && checkbox(allVisibleSelected, toggleAllVisible, `${testID}-select-all`)}
            {columns.map((col) => {
              const active = sort?.key === col.key;
              return (
                <Pressable
                  key={col.key}
                  testID={`${testID}-header-${col.key}`}
                  disabled={!col.sortable}
                  onPress={() => toggleSort(col.key)}
                  style={[styles.cell, { width: col.width ?? DEFAULT_COLUMN_WIDTH, justifyContent: justify(col) }]}
                >
                  <Text numberOfLines={1} style={[styles.headerText, { color: active ? c.primary : c.text }]}>{col.title}</Text>
                  {col.sortable && (
                    <Text testID={`${testID}-sort-${col.key}`} style={{ marginLeft: 4, fontSize: 11, color: active ? c.primary : c.text + '60' }}>{active ? (sort!.direction === 'asc' ? '▲' : '▼') : '↕'}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* body */}
          {loading ? (
            <View style={styles.state}><ActivityIndicator color={c.primary} /></View>
          ) : visible.length === 0 ? (
            <View style={styles.state}><Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6 }}>{emptyText}</Text></View>
          ) : (
            visible.map((row, i) => {
              const key = keyExtractor(row);
              const isSelected = !!selected[key];
              const bg = isSelected ? c.primary + '18' : striped && i % 2 === 1 ? c.background : 'transparent';
              return (
                <Pressable key={key} testID={`${testID}-row-${key}`} disabled={!onRowPress} onPress={() => onRowPress?.(row)} style={[styles.row, { backgroundColor: bg, borderBottomColor: c.border }]}>
                  {selectable && checkbox(isSelected, () => toggleRow(key), `${testID}-select-${key}`)}
                  {columns.map((col) => {
                    const v = valueOf(col, row);
                    return (
                      <View key={col.key} style={[styles.cell, { width: col.width ?? DEFAULT_COLUMN_WIDTH, justifyContent: justify(col) }]}>
                        {col.renderCell ? col.renderCell(row, safePage * Math.max(pageSize, 0) + i) : (
                          <Text numberOfLines={1} style={{ color: c.text, fontSize: 14 }}>{v === null || v === undefined ? '' : String(v)}</Text>
                        )}
                      </View>
                    );
                  })}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* footer */}
      <View style={[styles.footer, { borderTopColor: c.border }]}>
        <Text testID={`${testID}-count`} style={{ color: c.text, opacity: 0.7, fontSize: 13 }}>
          {sorted.length === data.length ? `${data.length} rows` : `${sorted.length} of ${data.length} rows`}
        </Text>
        {pageSize > 0 && pageCount > 1 && (
          <View style={styles.pager}>
            <Pressable testID={`${testID}-prev`} disabled={safePage === 0} onPress={() => setPage(safePage - 1)} hitSlop={8} style={{ opacity: safePage === 0 ? 0.3 : 1 }}>
              <IconApp name="chevron_left" size={22} color={c.text} />
            </Pressable>
            <Text testID={`${testID}-page`} style={{ color: c.text, fontSize: 13, marginHorizontal: 8 }}>{safePage + 1} / {pageCount}</Text>
            <Pressable testID={`${testID}-next`} disabled={safePage >= pageCount - 1} onPress={() => setPage(safePage + 1)} hitSlop={8} style={{ opacity: safePage >= pageCount - 1 ? 0.3 : 1 }}>
              <IconApp name="chevron_right" size={22} color={c.text} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '700', flexGrow: 1 },
  search: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 180, fontSize: 14 },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 42 },
  cell: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  box: { width: 18, height: 18, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  boxTick: { color: '#fff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  headerText: { fontSize: 13, fontWeight: '700' },
  state: { padding: 28, alignItems: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1 },
  pager: { flexDirection: 'row', alignItems: 'center' },
});
