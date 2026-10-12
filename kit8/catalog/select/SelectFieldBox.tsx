// SelectFieldBox - the FIELD of the catalog selectors that open a window (from_tree/SelectCatalogItemFromTreeReusable, with_folders/SelectCatalogItemWithFolders):
// an optional label, a box with the icon + the chosen text (or the placeholder), a clear button and the ▾; `compact` = a table cell. `children` = the window (rendered under the box).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';

export interface SelectFieldBoxProps {
  /** the chosen text ('' = nothing chosen: the placeholder shows) */
  text: string;
  placeholder?: string;
  /** label above the field (not in a table cell: the column header is enough) */
  label?: string;
  accessibilityLabel?: string;
  icon?: string;
  allowClear?: boolean;
  disabled?: boolean;
  /** something is wrong: the box turns red and says what */
  error?: string;
  /** low box (about 30 px) for dense places such as table rows */
  compact?: boolean;
  /** extra style of the box (e.g. { borderRadius: 0, backgroundColor: 'transparent' } inside a table cell) */
  triggerStyle?: any;
  onOpen: () => void;
  onClear: () => void;
  testID: string;
  children?: React.ReactNode;
}

export default function SelectFieldBox({ text, placeholder = 'Select…', label, accessibilityLabel, icon = 'account_tree', allowClear = true, disabled = false, error, compact = false, triggerStyle, onOpen, onClear, testID, children }: SelectFieldBoxProps) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View style={compact ? undefined : styles.wrap}>
      {!!label && <Text style={[styles.label, { color: c.text }]}>{label}</Text>}
      <View
        testID={testID}
        style={[styles.box, { borderColor: error ? c.error : c.border, backgroundColor: disabled ? `${c.border}20` : c.surface, opacity: disabled ? 0.6 : 1 }, compact && { minHeight: 30 }, triggerStyle]}
      >
        <Pressable testID={`${testID}-trigger`} disabled={disabled} onPress={onOpen} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label || 'Select item'} style={[styles.field, compact && { paddingVertical: 4 }]}>
          <IconApp name={icon} size={16} color={c.primary} />
          <Text numberOfLines={1} style={{ flex: 1, color: text ? c.text : `${c.text}88`, fontWeight: text ? '600' : '400', fontSize: compact ? 13 : 14 }}>{text || placeholder}</Text>
        </Pressable>
        {allowClear && !!text && !disabled && (
          <Pressable testID={`${testID}-clear`} onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear selection" style={[styles.iconButton, compact && { padding: 3 }]}>
            <IconApp name="close" size={16} color={c.text} />
          </Pressable>
        )}
        <Pressable disabled={disabled} onPress={onOpen} style={[styles.iconButton, compact && { padding: 3 }]}>
          <IconApp name="expand_more" size={18} color={disabled ? `${c.text}44` : c.text} />
        </Pressable>
      </View>
      {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, fontSize: 11, marginTop: 2 }}>{error}</Text>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 6 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, minHeight: 40, paddingHorizontal: 10 },
  field: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  iconButton: { padding: 6 },
});
