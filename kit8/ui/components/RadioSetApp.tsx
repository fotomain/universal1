// RadioSetApp - a set of radio buttons: one of several options (label, optional description + icon).
// Used by the share intent window to ask WHAT TO ADD (kit8/ui/components/intent/IntentAddModalWindow.tsx:
// project task / project stage · calendar task · media post) and by the new task screen.

import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import IconApp from './common/IconApp';
import { useDesignSystem } from '../../providers/WithDesignSystem';

export interface RadioSetOption<T extends string = string> {
  id: T;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

export interface RadioSetAppProps<T extends string = string> {
  /** caption above the set, e.g. "What to add?" */
  title?: string;
  options: RadioSetOption<T>[];
  value: T | null | undefined;
  onChange: (id: T) => void;
  /** options side by side (short labels) instead of one under another */
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export default function RadioSetApp<T extends string = string>({ title, options, value, onChange, horizontal = false, style, testID = 'radio-set-app' }: RadioSetAppProps<T>) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View style={style} testID={testID} accessibilityRole="radiogroup" accessibilityLabel={title}>
      {!!title && <Text style={[styles.title, { color: c.text }]}>{title}</Text>}
      <View style={horizontal ? styles.horizontal : undefined}>
        {options.map((o) => {
          const selected = o.id === value;
          return (
            <Pressable
              key={o.id}
              testID={`${testID}-${o.id}`}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !!o.disabled }}
              accessibilityLabel={o.label}
              disabled={o.disabled}
              onPress={() => onChange(o.id)}
              style={({ pressed }) => [
                styles.option,
                horizontal ? styles.optionHorizontal : null,
                { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? `${c.primary}14` : 'transparent', opacity: o.disabled ? 0.45 : pressed ? 0.7 : 1 },
              ]}
            >
              <IconApp name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} color={selected ? c.primary : c.text} />
              {!!o.icon && <IconApp name={o.icon} size={20} color={selected ? c.primary : c.text} style={{ marginLeft: 10 }} />}
              <View style={styles.texts}>
                <Text style={{ color: c.text, fontSize: 15, fontWeight: selected ? '700' : '500' }}>{o.label}</Text>
                {!!o.description && <Text style={{ color: c.text, opacity: 0.65, fontSize: 12.5, marginTop: 1 }}>{o.description}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 13, fontWeight: '700', opacity: 0.75, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  horizontal: { flexDirection: 'row', flexWrap: 'wrap' },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  optionHorizontal: { marginRight: 8 },
  texts: { flexShrink: 1, marginLeft: 10 },
});
