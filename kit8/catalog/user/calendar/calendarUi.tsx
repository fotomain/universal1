// Small building blocks of the user calendar windows (chips, icon rows, inputs, the window frame).

import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, useWindowDimensions, View, ViewStyle, StyleProp } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import IconApp from '../../../ui/components/common/IconApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';

export type CalendarColors = ReturnType<typeof useDesignSystem>['themeColors'];

/** Phones: the window fills the screen; wider screens: a centered card. */
export const useIsWide = () => useWindowDimensions().width >= 720;

export function CalChip({ label, selected, onPress, color, disabled, testID, dot }: { label: string; selected?: boolean; onPress?: () => void; color: CalendarColors; disabled?: boolean; testID?: string; dot?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? color.primary : color.border, backgroundColor: selected ? `${color.primary}22` : 'transparent', opacity: disabled ? 0.45 : 1 }]}
    >
      {!!dot && <View style={[styles.dot, { backgroundColor: dot, opacity: selected ? 1 : 0.35 }]} />}
      <Text style={{ color: selected ? color.primary : color.text, fontSize: 13, fontWeight: selected ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

/** A form line: icon on the left, content on the right. */
export function CalRow({ icon, children, color, style }: { icon?: string; children: React.ReactNode; color: CalendarColors; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.rowIcon}>{!!icon && <IconApp name={icon} size={20} color={color.text} />}</View>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

export const CalDivider = ({ color }: { color: CalendarColors }) => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: color.border, marginVertical: 6 }} />;

export function CalInput({ color, style, ...props }: TextInputProps & { color: CalendarColors }) {
  return (
    <TextInput
      placeholderTextColor={`${color.text}77`}
      {...props}
      style={[styles.input, { color: color.text, borderColor: color.border, backgroundColor: color.background }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null, style]}
    />
  );
}

/** A value that opens something when pressed (date, repeat, unit ...). */
export function CalValueButton({ label, onPress, color, testID, disabled, icon, width }: { label: string; onPress: () => void; color: CalendarColors; testID?: string; disabled?: boolean; icon?: string; width?: number }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.valueBtn, { borderColor: color.border, backgroundColor: color.background, opacity: disabled ? 0.5 : 1 }, width ? { width } : null]}>
      <Text numberOfLines={1} style={{ color: color.text, fontSize: 14, flexShrink: 1 }}>{label}</Text>
      <IconApp name={icon || 'arrow_drop_down'} size={18} color={color.text} />
    </Pressable>
  );
}

export function CalIconButton({ icon, onPress, color, label, testID, tint, disabled }: { icon: string; onPress: () => void; color: CalendarColors; label: string; testID?: string; tint?: string; disabled?: boolean }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}
      {...({ title: label } as any)}
    >
      <IconApp name={icon} size={22} color={tint || color.text} />
    </Pressable>
  );
}

export function CalButton({ label, onPress, color, primary, testID, disabled, danger }: { label: string; onPress: () => void; color: CalendarColors; primary?: boolean; testID?: string; disabled?: boolean; danger?: boolean }) {
  const tint = danger ? color.error : color.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, primary ? { backgroundColor: tint } : { borderWidth: 1, borderColor: color.border }, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}
    >
      <Text style={{ color: primary ? '#fff' : tint, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Window frame: full screen on phones, a centered card on wide screens.
 * `header` stays on top, the children scroll.
 */
export function CalWindow({ visible, onClose, header, children, color, maxWidth = 640, testID, footer }: { visible: boolean; onClose: () => void; header: React.ReactNode; children: React.ReactNode; color: CalendarColors; maxWidth?: number; testID?: string; footer?: React.ReactNode }) {
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.overlay, wide ? { padding: 24, alignItems: 'center', justifyContent: 'center' } : null]}>
        {wide && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />}
        <View
          testID={testID}
          style={[
            { backgroundColor: color.surface },
            wide
              ? { width: '100%', maxWidth, maxHeight: '92%', borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: color.border }
              : { flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
          ]}
        >
          <View style={[styles.windowHeader, { borderColor: color.border }]}>{header}</View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, paddingBottom: 28 }} style={wide ? { flexGrow: 0 } : { flex: 1 }}>
            {children}
          </ScrollView>
          {!!footer && <View style={[styles.windowFooter, { borderColor: color.border }]}>{footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 32, borderRadius: 8, borderWidth: 1, marginRight: 8, marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  rowIcon: { width: 36, paddingTop: 7, alignItems: 'flex-start' },
  rowBody: { flex: 1, minWidth: 0 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, minHeight: 36, fontSize: 14, paddingVertical: 6 },
  valueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 4, height: 36, marginRight: 8, marginBottom: 6, maxWidth: '100%' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  button: { height: 38, paddingHorizontal: 18, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  windowHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth },
  windowFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
