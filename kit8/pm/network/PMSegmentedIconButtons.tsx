// A small group of mutually exclusive icon buttons (same look as the Gantt bar's
// "Dependency arrows" selector). Used by GanttToNetworkViewToggleButtons and the
// variant toggles of PMNetworkDiagram / PMNetworkSchedule.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PMIconButton } from '../inner/buttons/PMIconButton';

export interface PMSegmentOption<T extends string> {
  value: T;
  icon: string;
  /** optional visible text next to the icon */
  label?: string;
  /** tip */
  title: string;
}

export default function PMSegmentedIconButtons<T extends string>({
  options,
  value,
  onChange,
  color,
  activeColor,
  border,
  testID,
}: {
  options: PMSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  color: string;
  activeColor: string;
  border: string;
  testID: string;
}) {
  return (
    <View style={[styles.group, { borderColor: border }]} testID={testID} accessibilityRole="radiogroup">
      {options.map((o) => (
        <PMIconButton
          key={o.value}
          testID={`${testID}-${o.value}`}
          icon={o.icon}
          label={o.label}
          title={o.title}
          active={value === o.value}
          activeColor={activeColor}
          color={color}
          onPress={() => value !== o.value && onChange(o.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    paddingLeft: 2,
    marginHorizontal: 2,
  },
});
