// BusinessUnitPickerField - a field that shows the business unit chosen (its path) and opens CatalogTreePicker to choose another: the tree of the units,
// any level when the entity has `selectFromTree` (the business unit does). Used where a form (not a table column) needs a unit, e.g. the four centers
// of a project. `isSelectable` / `reasonWhy` restrict the choice (a Cost center field offers units that take costs).
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import CatalogTreePicker from '../../ui/components/tree/CatalogTreePicker';
import type { DefRow } from '../product/productModel';
import { BUSINESS_UNIT_SELECT_FROM_TREE, businessUnitLeaves, businessUnitNodes, businessUnitPath, isBusinessUnitActive } from './businessUnitModel';

export interface BusinessUnitPickerFieldProps {
  rows: DefRow<any>[];
  value: string | null | undefined;
  onChange: (guid: string | null) => void;
  label?: string;
  placeholder?: string;
  /** may the field be empty? (default true) */
  allowClear?: boolean;
  /** which units can be chosen (default: the active ones; leaves only when `selectFromTree` is false) */
  isSelectable?: (guid: string) => boolean;
  reasonWhy?: (guid: string) => string;
  disabled?: boolean;
  /** something is wrong (e.g. obligatory and empty): the field turns red */
  error?: string;
  selectFromTree?: boolean;
  testID?: string;
}

export default function BusinessUnitPickerField({ rows, value, onChange, label, placeholder = 'Choose a business unit…', allowClear = true, isSelectable, reasonWhy, disabled, error, selectFromTree = BUSINESS_UNIT_SELECT_FROM_TREE, testID = 'business-unit-field' }: BusinessUnitPickerFieldProps) {
  const { themeColors: c } = useDesignSystem();
  const [open, setOpen] = useState(false);
  const nodes = useMemo(() => businessUnitNodes(rows), [rows]);
  const leaves = useMemo(() => new Set(businessUnitLeaves(rows).map((r) => r.rowGUID)), [rows]);
  const active = useMemo(() => new Map(rows.map((r) => [r.rowGUID, isBusinessUnitActive(r)])), [rows]);
  const selectable = (id: string) => (selectFromTree || leaves.has(id)) && active.get(id) !== false && (!isSelectable || isSelectable(id));
  const why = (id: string) => (active.get(id) === false ? 'This unit is not active' : !selectFromTree && !leaves.has(id) ? 'Choose a unit without sub-units' : reasonWhy?.(id) || 'This unit cannot be chosen here');
  const text = value ? businessUnitPath(rows, value) : '';
  return (
    <View style={styles.wrap}>
      {!!label && <Text style={[styles.label, { color: c.text }]}>{label}</Text>}
      <View style={[styles.box, { borderColor: error ? c.error : c.border, backgroundColor: c.surface, opacity: disabled ? 0.6 : 1 }]}>
        <Pressable testID={testID} disabled={disabled} onPress={() => setOpen(true)} style={styles.field}>
          <IconApp name="account_tree" size={16} color={c.primary} />
          <Text numberOfLines={1} style={{ flex: 1, color: text ? c.text : c.text + '88', fontSize: 13 }}>{text || placeholder}</Text>
          <IconApp name="arrow_drop_down" size={18} color={c.text} />
        </Pressable>
        {allowClear && !!value && !disabled && (
          <Pressable testID={`${testID}-clear`} onPress={() => onChange(null)} style={styles.clear}>
            <IconApp name="close" size={16} color={c.text} />
          </Pressable>
        )}
      </View>
      {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, fontSize: 11, marginTop: 2 }}>{error}</Text>}
      <CatalogTreePicker
        visible={open}
        nodes={nodes}
        value={value}
        title={label ?? 'Business unit'}
        isSelectable={selectable}
        reasonWhy={why}
        onPick={(id) => { setOpen(false); onChange(id); }}
        onClose={() => setOpen(false)}
        testID={`${testID}-picker`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  clear: { paddingHorizontal: 8, paddingVertical: 8 },
});
