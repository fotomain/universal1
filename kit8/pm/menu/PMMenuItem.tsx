// One row of a PM menu: icon + label, hover / press highlight, optional danger color.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';

export interface PMMenuItemProps {
  testID: string;
  label: string;
  icon: string;
  onPress: () => void;
  /** red icon + label (delete) */
  danger?: boolean;
  disabled?: boolean;
}

export default function PMMenuItem({ testID, label, icon, onPress, danger, disabled }: PMMenuItemProps) {
  const { themeColors: c } = useDesignSystem();
  const color = danger ? c.error : c.text;
  const tint = danger ? c.error : c.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="menuitem"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }: any) => [
        styles.item,
        { opacity: disabled ? 0.4 : 1, backgroundColor: hovered || pressed ? `${tint}18` : 'transparent' },
      ]}
    >
      <IconApp testID={`${testID}-icon`} name={icon} size={18} color={color} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  text: { marginLeft: 10, fontSize: 14, fontWeight: '600' },
});
