import React from 'react';
import { View, Text } from 'react-native';
import { Switch as MaterialSwitch } from 'react-native-paper';
import { SwitchAppProps } from '../../SwitchApp';

let useDesignSystem: any;
try {
  useDesignSystem = require('../../../../kit8/providers/DesignSystemContext').useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ themeColors: { primary: '#6366f1', text: '#111827', border: '#e5e7eb' }, isDark: false });
}

export const TamaguiSwitchSub: React.FC<SwitchAppProps> = ({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  testID = 'tamaguiSwitch',
}) => {
  let designSystem: any = { themeColors: { primary: '#6366f1', text: '#111827', border: '#e5e7eb' }, isDark: false };
  try {
    designSystem = useDesignSystem() || designSystem;
  } catch (e) {}

  const { themeColors, isDark } = designSystem;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          paddingHorizontal: 12,
          backgroundColor: isDark ? '#1f2937' : '#f8fafc',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: themeColors.border || '#e5e7eb',
        },
        style,
      ]}
    >
      {label && <Text style={{ fontSize: 15, fontWeight: '600', color: themeColors.text }}>{label}</Text>}
      <MaterialSwitch
        testID={testID}
        value={Boolean(value)}
        onValueChange={onValueChange}
        disabled={disabled}
        color={themeColors.primary || '#6366f1'}
      />
    </View>
  );
};

export default TamaguiSwitchSub;
