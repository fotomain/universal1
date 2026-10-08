// Product dashboard - the "Value" cell of a property value row: the input follows the descriptor's value type
// (list value -> picker of the descriptor values, number / text / date -> typed, Yes / No -> check box).
// Stores rowJSON.descriptorValueGUID (list) OR rowJSON.value (scalar) - rule R5 of the sheet.
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { showSnackbar } from '../../../redux/uxuiSlice';
import IconApp from '../../../ui/components/common/IconApp';
import ReusableTableOptionPicker from '../../../ui/components/table/reusable/ReusableTableOptionPicker';
import type { SelectOption } from '../../../ui/components/table/reusable/reusableTableTypes';
import { isValidDay, parseNumberInput } from '../../../ui/components/table/reusable/tableRows';
import type { DescriptorValueType } from '../productModel';

export interface DescriptorValueCellProps {
  /** null = no plan line chosen yet */
  valueType: DescriptorValueType | null;
  unit?: string | null;
  title: string;
  options: SelectOption[];
  descriptorValueGUID?: string | null;
  value?: any;
  editable?: boolean;
  onPatch: (rowJSONPatch: Record<string, any>) => void;
  testID: string;
}

export default function DescriptorValueCell({ valueType, unit, title, options, descriptorValueGUID, value, editable = true, onPatch, testID }: DescriptorValueCellProps) {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const shownScalar = value === null || value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(shownScalar);
  useEffect(() => setDraft(shownScalar), [shownScalar]);

  if (!valueType) return <Text testID={testID} style={[styles.dim, { color: c.text }]}>Choose the property first</Text>;

  if (valueType === 'ref') {
    const found = options.find((o) => o.value === descriptorValueGUID);
    return (
      <>
        <Pressable testID={testID} disabled={!editable} onPress={() => setOpen(true)} style={styles.trigger} accessibilityRole="button" accessibilityLabel={`${title}: ${found?.label ?? 'not set'}`}>
          {found?.color ? <View style={[styles.dot, { backgroundColor: found.color, borderColor: c.border }]} /> : null}
          <Text numberOfLines={1} style={{ flex: 1, color: c.text, opacity: found || descriptorValueGUID ? 1 : 0.45, fontSize: 14 }}>{found?.label ?? descriptorValueGUID ?? 'Select…'}</Text>
          {editable ? <IconApp name="expand_more" size={16} color={c.text} /> : null}
        </Pressable>
        {open && (
          <ReusableTableOptionPicker testID={`${testID}-picker`} title={title} options={options} multi={false} selected={descriptorValueGUID ? [descriptorValueGUID] : []}
            onClose={() => setOpen(false)} onPick={(v) => { setOpen(false); onPatch({ descriptorValueGUID: v[0] ?? null, value: null }); }} />
        )}
      </>
    );
  }

  if (valueType === 'boolean') {
    const on = value === true;
    return (
      <Pressable testID={testID} disabled={!editable} accessibilityRole="checkbox" aria-checked={on} onPress={() => onPatch({ value: !on, descriptorValueGUID: null })} style={styles.trigger}>
        <View style={[styles.box, { borderColor: on ? c.primary : c.text + '80', backgroundColor: on ? c.primary : 'transparent' }]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
        <Text style={{ color: c.text, fontSize: 14 }}>{on ? 'Yes' : 'No'}</Text>
      </Pressable>
    );
  }

  const commit = () => {
    if (draft === shownScalar) return;
    const t = draft.trim();
    if (t === '') { onPatch({ value: null, descriptorValueGUID: null }); return; }
    if (valueType === 'number') {
      const n = parseNumberInput(t);
      if (n === null) { dispatch(showSnackbar({ message: `${title}: type a number` })); setDraft(shownScalar); return; }
      onPatch({ value: n, descriptorValueGUID: null });
      return;
    }
    if (valueType === 'date' && !isValidDay(t)) { dispatch(showSnackbar({ message: `${title}: use the form YYYY-MM-DD` })); setDraft(shownScalar); return; }
    onPatch({ value: t, descriptorValueGUID: null });
  };
  if (!editable) return <Text testID={testID} style={{ color: c.text, fontSize: 14 }}>{shownScalar}{unit && shownScalar ? ` ${unit}` : ''}</Text>;
  return (
    <View style={styles.trigger}>
      <TextInput testID={testID} value={draft} onChangeText={setDraft} onBlur={commit} onSubmitEditing={commit}
        keyboardType={valueType === 'number' ? 'decimal-pad' : 'default'} placeholder={valueType === 'date' ? 'YYYY-MM-DD' : valueType === 'number' ? '0' : 'Text…'}
        placeholderTextColor={c.text + '60'} style={[styles.input, { color: c.text }]} />
      {unit ? <Text style={[styles.dim, { color: c.text }]}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, alignSelf: 'stretch' },
  dim: { opacity: 0.5, fontSize: 13 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  box: { width: 18, height: 18, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  input: { flex: 1, minWidth: 0, height: 30, fontSize: 14, ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }) },
});
