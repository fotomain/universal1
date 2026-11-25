// ReusableTable - "Filter & sort" popup of one column (opened by the ▾ button of its header).
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import TextInputApp from '../../common/TextInputApp';
import { autoFormatCompactDate } from '../../common/date_input/dateInputFormat';
import type { VisualColumn } from './reusableTableTypes';
import { ColumnFilter, ColumnFilterOp, ColumnSort, defaultFilterOpOf, filterKindOf, filterNeedsSecondValue, filterNeedsValue, filterOpLabel, filterOpsOf, parseDayOperand, parseNumberOperand, splitFilterList } from './tableFilter';
import { pmT } from '../../../../pm/i18n/pmT';

export interface ReusableTableColumnMenuProps {
  col: VisualColumn;
  x: number;
  y: number;
  sort: ColumnSort | null;
  filter?: ColumnFilter;
  onSort: (sort: ColumnSort | null) => void;
  onFilter: (filter: ColumnFilter | null) => void;
  onClose: () => void;
  testID: string;
}

const W_TEXT = 240;
const W_WIDE = 270; // the labels of the number / date operators are longer

export default function ReusableTableColumnMenu({ col, x, y, sort, filter, onSort, onFilter, onClose, testID }: ReusableTableColumnMenuProps) {
  const { themeColors: c } = useDesignSystem();
  const win = useWindowDimensions();
  const ops = filterOpsOf(col);
  const kind = filterKindOf(col);
  const numeric = kind === 'number';
  const W = kind === 'text' ? W_TEXT : W_WIDE;
  const [op, setOp] = useState<ColumnFilterOp>(filter?.op && ops.includes(filter.op) ? filter.op : defaultFilterOpOf(col));
  // the operator is picked from a select list: a text column (equal / not equal / contains / ...), a number or date column (is exactly / is not / is greater than / ... / is one of)
  const [listOpen, setListOpen] = useState(false);
  const [value, setValue] = useState(filter?.value ?? '');
  const [value2, setValue2] = useState(filter?.value2 ?? '');
  const [invalid, setInvalid] = useState(false);
  const mySort = sort?.key === col.key ? sort.direction : null;
  const left = Math.max(8, Math.min(x, win.width - W - 8));
  const top = Math.max(8, Math.min(y, win.height - 430));
  const id = (s: string) => `${testID}-column-menu-${s}`;
  const setOperator = (o: ColumnFilterOp) => { setOp(o); setInvalid(false); };
  // what Apply stores: numbers and days are checked and written the one way ('2026-01-05' for 05.01.2026 or 20260105); a value that is no number / date keeps the popup open
  const normalize = (text: string): string | null => {
    const t = text.trim();
    if (kind === 'text') return t;
    const one = (x: string) => (kind === 'number' ? (parseNumberOperand(x) === null ? null : String(parseNumberOperand(x))) : parseDayOperand(x));
    if (op === 'oneOf') {
      const items = splitFilterList(t).map(one);
      return items.length === 0 || items.some((x) => x === null) ? null : items.join(', ');
    }
    return one(t);
  };
  const apply = () => {
    if (!filterNeedsValue(op)) { onFilter({ op }); onClose(); return; }
    if (kind === 'text') { onFilter({ op, value: value.trim() }); onClose(); return; }
    const a = value.trim() === '' ? '' : normalize(value);
    const b = filterNeedsSecondValue(op) ? (value2.trim() === '' ? '' : normalize(value2)) : undefined;
    if (a === null || b === null) { setInvalid(true); return; }
    onFilter({ op, value: a, ...(b !== undefined ? { value2: b } : {}) });
    onClose();
  };
  const hint = kind === 'date' ? 'YYYY-MM-DD' : kind === 'number' ? pmT('Number…') : pmT('Text…');
  // one input of the filter value: TextInputApp for every kind (a day is typed in any form of DateInputApp and written as YYYY-MM-DD by Apply); the cursor goes into the first one (web)
  const valueInput = (which: 1 | 2) => {
    // a day typed as eight digits (20261130, 30112026) turns into 2026-11-30 at once (not in a list)
    const set = (t: string) => { (which === 1 ? setValue : setValue2)(kind === 'date' && op !== 'oneOf' ? autoFormatCompactDate(t) : t); setInvalid(false); };
    const placeholder = op === 'oneOf' ? (kind === 'date' ? '2026-01-05, 2026-02-01' : '1, 5, 10') : hint;
    return (
      <View key={which} style={styles.field}>
        <TextInputApp testID={id(which === 1 ? 'value' : 'value2')} value={which === 1 ? value : value2} onChangeText={set} placeholder={placeholder} onSubmitEditing={apply}
          autoFocus={which === 1 && Platform.OS === 'web'} keyboardType={kind === 'number' && op !== 'oneOf' ? 'numeric' : 'default'} error={invalid} iconsNotTabbable style={{ marginBottom: 0 }} />
      </View>
    );
  };

  const sortItem = (direction: 'asc' | 'desc', label: string) => (
    <Pressable testID={id(`sort-${direction}`)} onPress={() => { onSort(mySort === direction ? null : { key: col.key, direction }); onClose(); }}
      style={({ hovered }: any) => [styles.item, { backgroundColor: mySort === direction ? c.primary + '22' : hovered ? c.primary + '12' : 'transparent' }]}>
      <Text style={{ color: mySort === direction ? c.primary : c.text, fontWeight: '600' }}>{direction === 'asc' ? '▲' : '▼'}  {label}</Text>
      {mySort === direction && <Text style={{ color: c.primary, marginLeft: 'auto' }}>✓</Text>}
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable testID={id('backdrop')} style={StyleSheet.absoluteFill} onPress={onClose} />
      <View testID={id('card')} style={[styles.card, { width: W, left, top, backgroundColor: c.surface, borderColor: c.border }]}>
        <Text numberOfLines={1} style={[styles.caption, { color: c.text }]}>{pmT(col.title)}</Text>
        {sortItem('asc', numeric ? 'Sort 0 → 9' : 'Sort A → Z')}
        {sortItem('desc', numeric ? 'Sort 9 → 0' : 'Sort Z → A')}
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text style={[styles.caption, { color: c.text }]}>{pmT('Filter')}</Text>
        <View style={styles.selectWrap}>
          <Pressable testID={id('op-select')} onPress={() => setListOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: listOpen }}
            style={[styles.select, { borderColor: listOpen ? c.primary : c.border, backgroundColor: c.background }]}>
            <Text testID={id('op-selected')} numberOfLines={1} style={{ color: c.text, fontSize: 14, flex: 1 }}>{pmT(filterOpLabel(kind, op))}</Text>
            <Text style={{ color: c.text, fontSize: 11, opacity: 0.7 }}>{listOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {listOpen && (
            <View testID={id('op-list')} style={[styles.list, { borderColor: c.border, backgroundColor: c.surface }]}>
              {ops.map((o) => (
                <Pressable key={o} testID={id(`op-${o}`)} onPress={() => { setOperator(o); setListOpen(false); }} accessibilityRole="menuitem" accessibilityState={{ selected: op === o }}
                  style={({ hovered }: any) => [styles.listItem, { backgroundColor: op === o ? c.primary : hovered ? c.primary + '22' : 'transparent' }]}>
                  <Text numberOfLines={1} style={{ color: op === o ? '#fff' : c.text, fontSize: 13 }}>{pmT(filterOpLabel(kind, o))}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        {filterNeedsValue(op) && valueInput(1)}
        {filterNeedsSecondValue(op) && <Text style={[styles.and, { color: c.text }]}>{pmT('and')}</Text>}
        {filterNeedsSecondValue(op) && valueInput(2)}
        {invalid && <Text testID={id('invalid')} style={[styles.caption, { color: c.error, opacity: 1 }]}>{pmT(kind === 'date' ? 'Not a valid date' : 'Not a valid number')}</Text>}
        <View style={styles.buttons}>
          <Pressable testID={id('clear')} onPress={() => { onFilter(null); onClose(); }} style={[styles.btn, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '600' }}>{pmT('Clear')}</Text>
          </Pressable>
          <Pressable testID={id('apply')} onPress={apply} style={[styles.btn, { borderColor: c.primary, backgroundColor: c.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{pmT('Apply')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  caption: { fontSize: 11, opacity: 0.6, paddingHorizontal: 8, paddingVertical: 4 },
  item: { height: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderRadius: 6 },
  line: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  field: { marginHorizontal: 6, marginBottom: 6 },
  and: { fontSize: 12, opacity: 0.6, marginHorizontal: 8, marginBottom: 4 },
  selectWrap: { marginHorizontal: 6, marginBottom: 6, zIndex: 20 },
  select: { borderWidth: 1, borderRadius: 8, height: 34, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { position: 'absolute', top: 36, left: 0, right: 0, borderWidth: 1, borderRadius: 6, paddingVertical: 2, zIndex: 30, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  listItem: { height: 28, justifyContent: 'center', paddingHorizontal: 8 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 6, paddingTop: 8 },
  btn: { borderWidth: 1, borderRadius: 8, height: 32, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
});
