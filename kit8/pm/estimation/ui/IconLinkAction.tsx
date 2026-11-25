// IconLinkAction - an action that looks like a HYPERLINK, not a button: an optional icon + an underlined text in the colour of links, centred in its cell, no box. Used where a table cell
// holds one action (the Select link of the norm window, the "Select norm" link of a position).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';

/** the size of the link text (px); a column that must be as wide as its word measures the text with it */
export const LINK_FONT_SIZE = 12;

export interface IconLinkActionProps {
  title: string;
  onPress: () => void;
  testID?: string;
  /** a Material symbol drawn before the text */
  icon?: string;
  /** what a screen reader says when it is longer than the text */
  label?: string;
  disabled?: boolean;
}

export default function IconLinkAction({ title, onPress, testID, icon, label, disabled = false }: IconLinkActionProps) {
  const { themeColors: c } = useDesignSystem();
  return (
    <Pressable testID={testID} accessibilityRole="link" accessibilityLabel={label ?? title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={6}
      style={{ alignSelf: 'center', opacity: disabled ? 0.45 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        {!!icon && <IconApp name={icon} size={14} color={c.primary} />}
        <Text numberOfLines={1} style={{ color: c.primary, fontSize: LINK_FONT_SIZE, fontWeight: '400', textAlign: 'center', textDecorationLine: 'underline' }}>{title}</Text>
      </View>
    </Pressable>
  );
}
