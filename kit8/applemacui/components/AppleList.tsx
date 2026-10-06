// AppleGroupedList + AppleListRow - iOS inset grouped list (HIG: Lists and tables): rounded card on the grouped
// background, hairline separators inset to the text, optional header / footer, rows of 44 pt.
import React, { Children, memo, useMemo } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import IconApp from '../../components/common/IconApp';
import { useAppleMacUI } from '../WithAppleMacUI';

export interface AppleGroupedListProps {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  /** false = plain card without the outer side margins */
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const AppleGroupedList = memo(function AppleGroupedList({ header, footer, children, inset = true, style, testID }: AppleGroupedListProps) {
  const { theme, text } = useAppleMacUI();
  const s = useMemo(() => {
    const c = theme.colors;
    return StyleSheet.create({
      root: { marginHorizontal: inset ? theme.space[4] : 0, marginBottom: theme.space[5] },
      header: { ...text('footnote'), color: c.secondaryLabel, textTransform: 'uppercase', marginBottom: theme.space[2] - 2, marginLeft: theme.space[4] },
      footer: { ...text('footnote'), color: c.secondaryLabel, marginTop: theme.space[2] - 2, marginHorizontal: theme.space[4] },
      card: { borderRadius: theme.radii.card, backgroundColor: c.secondarySystemGroupedBackground, overflow: 'hidden' },
      separator: { height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: theme.space[4] },
    });
  }, [theme, text, inset]);
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View style={[s.root, style]} testID={testID}>
      {!!header && (
        <Text style={s.header} accessibilityRole="header" allowFontScaling>
          {header}
        </Text>
      )}
      <View style={s.card}>
        {rows.map((row, i) => (
          <React.Fragment key={(row as any)?.key ?? i}>
            {i > 0 && <View style={s.separator} />}
            {row}
          </React.Fragment>
        ))}
      </View>
      {!!footer && (
        <Text style={s.footer} allowFontScaling>
          {footer}
        </Text>
      )}
    </View>
  );
});

export interface AppleListRowProps {
  title: string;
  subtitle?: string;
  /** secondary text at the right (the row's value) */
  value?: string;
  /** IconApp name at the left */
  icon?: string;
  iconColor?: string;
  /** chevron = opens something · check = selected · none (default: chevron when onPress is set) */
  accessory?: 'chevron' | 'check' | 'none';
  /** custom control at the right (AppleSwitch …) */
  right?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}

export const AppleListRow = memo(function AppleListRow({ title, subtitle, value, icon, iconColor, accessory, right, destructive, disabled, onPress, testID }: AppleListRowProps) {
  const { theme, text } = useAppleMacUI();
  const s = useMemo(() => {
    const c = theme.colors;
    return StyleSheet.create({
      row: { minHeight: theme.size.listRow, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.space[4], paddingVertical: theme.space[2] - 2, opacity: disabled ? 0.4 : 1 },
      pressed: { backgroundColor: c.systemGray4 },
      icon: { marginRight: theme.space[3] },
      texts: { flex: 1, minWidth: 0 },
      title: { ...text('body'), color: destructive ? c.systemRed : c.label },
      subtitle: { ...text('footnote'), color: c.secondaryLabel, marginTop: 1 },
      value: { ...text('body'), color: c.secondaryLabel, marginLeft: theme.space[3], flexShrink: 1 },
      accessory: { marginLeft: theme.space[2] },
    });
  }, [theme, text, destructive, disabled]);
  const c = theme.colors;
  const acc = accessory ?? (onPress && right === undefined ? 'chevron' : 'none');
  const body = (
    <>
      {!!icon && <IconApp name={icon} size={22} color={iconColor || theme.tint} style={s.icon} />}
      <View style={s.texts}>
        <Text style={s.title} numberOfLines={1} allowFontScaling>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={s.subtitle} numberOfLines={2} allowFontScaling>
            {subtitle}
          </Text>
        )}
      </View>
      {!!value && (
        <Text style={s.value} numberOfLines={1} allowFontScaling>
          {value}
        </Text>
      )}
      {right}
      {acc === 'chevron' && <IconApp name="chevron_right" size={20} color={c.tertiaryLabel} style={s.accessory} />}
      {acc === 'check' && <IconApp name="check" size={20} color={theme.tint} style={s.accessory} />}
    </>
  );
  if (!onPress) {
    return (
      <View style={s.row} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
      accessibilityState={{ disabled: !!disabled, selected: acc === 'check' }}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
    >
      {body}
    </Pressable>
  );
});
