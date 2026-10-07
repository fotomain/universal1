// ReusableTable - "Filter & sort" popup of one column (opened by the ▾ button of its header).
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import type { VisualColumn } from './reusableTableTypes';
import { ColumnFilter, ColumnFilterOp, ColumnSort, FILTER_OP_LABEL, filterNeedsValue, filterOpsOf } from './tableFilter';

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

const W = 240;

export default function ReusableTableColumnMenu({ col, x, y, sort, filter, onSort, onFilter, onClose, testID }: ReusableTableColumnMenuProps) {
  const { themeColors: c } = useDesignSystem();
  const win = useWindowDimensions();
  const ops = filterOpsOf(col);
  const [op, setOp] = useState<ColumnFilterOp>(filter?.op ?? ops[0]);
  const [value, setValue] = useState(filter?.value ?? '');
  const numeric = col.type === 'integer' || col.type === 'number';
  const mySort = sort?.key === col.key ? sort.direction : null;
  const left = Math.max(8, Math.min(x, win.width - W - 8));
  const top = Math.max(8, Math.min(y, win.height - 300));
  const id = (s: string) => `${testID}-column-menu-${s}`;
  const apply = () => { onFilter({ op, value: filterNeedsValue(op) ? value.trim() : undefined }); onClose(); };

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
      <View testID={id('card')} style={[styles.card, { left, top, backgroundColor: c.surface, borderColor: c.border }]}>
        <Text numberOfLines={1} style={[styles.caption, { color: c.text }]}>{col.title}</Text>
        {sortItem('asc', numeric ? 'Sort 0 → 9' : 'Sort A → Z')}
        {sortItem('desc', numeric ? 'Sort 9 → 0' : 'Sort Z → A')}
        <View style={[styles.line, { backgroundColor: c.border }]} />
        <Text style={[styles.caption, { color: c.text }]}>Filter</Text>
        <View style={styles.ops}>
          {ops.map((o) => (
            <Pressable key={o} testID={id(`op-${o}`)} onPress={() => setOp(o)} style={[styles.op, { borderColor: op === o ? c.primary : c.border, backgroundColor: op === o ? c.primary + '22' : 'transparent' }]}>
              <Text style={{ color: op === o ? c.primary : c.text, fontSize: 12, fontWeight: '600' }}>{FILTER_OP_LABEL[o]}</Text>
            </Pressable>
          ))}
        </View>
        {filterNeedsValue(op) && (
          <TextInput testID={id('value')} value={value} onChangeText={setValue} onSubmitEditing={apply} autoFocus placeholder={numeric ? 'Number…' : 'Text…'}
            placeholderTextColor={c.text + '70'} keyboardType={numeric ? 'decimal-pad' : 'default'}
            style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]} />
        )}
        <View style={styles.buttons}>
          <Pressable testID={id('clear')} onPress={() => { onFilter(null); onClose(); }} style={[styles.btn, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '600' }}>Clear</Text>
          </Pressable>
          <Pressable testID={id('apply')} onPress={apply} style={[styles.btn, { borderColor: c.primary, backgroundColor: c.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', width: W, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  caption: { fontSize: 11, opacity: 0.6, paddingHorizontal: 8, paddingVertical: 4 },
  item: { height: 36, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderRadius: 6 },
  line: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  ops: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 6, paddingBottom: 6 },
  op: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  input: { borderWidth: 1, borderRadius: 8, height: 36, paddingHorizontal: 10, marginHorizontal: 6, fontSize: 14, ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }) },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, padding: 6, paddingTop: 8 },
  btn: { borderWidth: 1, borderRadius: 8, height: 32, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
});
