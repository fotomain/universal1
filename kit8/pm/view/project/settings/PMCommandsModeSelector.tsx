// PMCommandsModeSelector: selects the context commands presentation mode for tree rows or Gantt bars
// ('onHoverPanelMode' = hover panel, 'onRightClickMenuMode' = right-click / long-press menu).
// Used in Project Settings (TabUXUI) and Gantt UX/UI Settings (TabTree, TabGantt).

import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { PMIconButton } from '../../../inner/buttons';
import { PMContextCommandsMode, PM_CONTEXT_COMMANDS_MODES } from '../../../model/types';

export const COMMANDS_MODE_UI: Record<PMContextCommandsMode, { icon: string; label: string; title: string }> = {
  onHoverPanelMode: { icon: 'more_horiz', label: 'Hover panel', title: 'Buttons on the hovered (web) / selected (touch) row' },
  onRightClickMenuMode: { icon: 'menu_open', label: 'Right-click menu', title: 'Menu on right-click (web) / long-press and release (touch)' },
};

export interface PMCommandsModeSelectorProps {
  label: string;
  testID: string;
  value: PMContextCommandsMode;
  onChange: (v: PMContextCommandsMode) => void;
  colors: { text: string; primary: string };
  style?: StyleProp<ViewStyle>;
}

export function PMCommandsModeSelector({
  label,
  testID,
  value,
  onChange,
  colors,
  style,
}: PMCommandsModeSelectorProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.segment} testID={testID}>
        {PM_CONTEXT_COMMANDS_MODES.map((m) => (
          <PMIconButton
            key={m}
            testID={`${testID}-${m}`}
            icon={COMMANDS_MODE_UI[m].icon}
            label={COMMANDS_MODE_UI[m].label}
            title={COMMANDS_MODE_UI[m].title}
            active={value === m}
            activeColor={colors.primary}
            color={colors.text}
            onPress={() => onChange(m)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12 },
  label: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  segment: { flexDirection: 'row', alignItems: 'center' },
});

export default PMCommandsModeSelector;
