import React from 'react';
import { View, Text, Switch as RNSwitch } from 'react-native';
import { SwitchAppProps } from '../../SwitchApp';
import { ExpoUISwitch } from '../../../../expoui/ExpoUI';
import { useThemeFont } from '../../../../fonts/useThemeFont';

let useDesignSystem: any;
try {
  useDesignSystem = require('../../../../../providers/WithDesignSystem').useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ themeColors: { primary: '#4630Eb', text: '#000000' }, isDark: false });
}

export const ExpoSwitchSub: React.FC<SwitchAppProps> = ({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  testID = 'expoSwitch',
}) => {
  let designSystem: any = { themeColors: { primary: '#4630Eb', text: '#000000' }, isDark: false };
  try {
    designSystem = useDesignSystem() || designSystem;
  } catch (e) {}

  const { themeColors, isDark } = designSystem;

  const labelFont = useThemeFont('label');
  const legacy = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          paddingHorizontal: 16,
          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
          borderRadius: 20,
        },
        style,
      ]}
    >
      {label && <Text style={{ fontFamily: labelFont.fontFamily, fontSize: 15, fontWeight: '700', color: themeColors.text }}>{label}</Text>}
      <RNSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#cbd5e1', true: themeColors.primary || '#4630Eb' }}
        thumbColor="#ffffff"
      />
    </View>
  );
  // the native Switch of @expo/ui (SwiftUI / Compose); the hand-made one above is the fallback
  return <ExpoUISwitch testID={testID} value={value} onValueChange={onValueChange} label={label} disabled={disabled} fallback={legacy} />;
};

export default ExpoSwitchSub;
