// One row of a PM menu: icon + label, hover / press highlight, optional danger color,
// optional submenu (chevron ▸, opened by PMContextMenu), icon color (e.g. color swatches)
// and a trailing check mark (current choice).

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { pmT } from '../../i18n/pmT';

export interface PMMenuItemProps {
  testID: string;
  label: string;
  icon: string;
  /** not called for items with a submenu (they open it) */
  onPress: () => void;
  /** red icon + label (sql_for_delete) */
  danger?: boolean;
  disabled?: boolean;
  /** icon color override (e.g. a color swatch) */
  iconColor?: string;
  /** current choice: check mark at the end */
  checked?: boolean;
  /** items of a submenu (PMContextMenu opens it next to this item: press, or hover on web) */
  submenu?: PMMenuItemProps[];
  /** set by PMContextMenu */
  highlighted?: boolean;
  onHoverIn?: () => void;
}

export default function PMMenuItem({ testID, label: labelText, icon, onPress, danger, disabled, iconColor, checked, submenu, highlighted, onHoverIn }: PMMenuItemProps) {
  const { themeColors: c } = useDesignSystem();
  // labels are English texts: shown in the app language (i18n/pmT)
  const label = pmT(labelText);
  const color = danger ? c.error : c.text;
  const tint = danger ? c.error : c.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, checked: !!checked, expanded: submenu ? !!highlighted : undefined }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={onHoverIn}
      style={({ hovered, pressed }: any) => [
        styles.item,
        { opacity: disabled ? 0.4 : 1, backgroundColor: hovered || pressed || highlighted ? `${tint}18` : 'transparent' },
      ]}
    >
      <IconApp testID={`${testID}-icon`} name={icon} size={18} color={iconColor || color} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {checked && <IconApp testID={`${testID}-checked`} name="check" size={16} color={c.primary} />}
      {!!submenu && <IconApp testID={`${testID}-more`} name="chevron_right" size={18} color={color} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  text: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '600' },
});
