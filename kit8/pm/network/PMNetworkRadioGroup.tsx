// Radio buttons of PMNetworkView: "Network diagram" / "Network schedule".

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import IconApp from '../../components/common/IconApp';
import { PMTipPressable } from '../buttons/PMTipPressables';

export interface PMRadioOption<T extends string> {
  value: T;
  label: string;
  tip: string;
}

export default function PMNetworkRadioGroup<T extends string>({
  options,
  value,
  onChange,
  color,
  activeColor,
  testID,
}: {
  options: PMRadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  color: string;
  activeColor: string;
  testID: string;
}) {
  return (
    <View style={styles.group} testID={testID} accessibilityRole="radiogroup">
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <PMTipPressable
            key={o.value}
            tip={o.tip}
            testID={`${testID}-${o.value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            onPress={() => !checked && onChange(o.value)}
            style={[styles.item, Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null]}
          >
            <IconApp name={checked ? 'radio_button_checked' : 'radio_button_unchecked'} size={18} color={checked ? activeColor : color} />
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                {
                  color: checked ? activeColor : color,
                  fontWeight: checked ? '700' : '500',
                },
              ]}
            >
              {o.label}
            </Text>
          </PMTipPressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  label: { fontSize: 13, marginLeft: 4 },
});
