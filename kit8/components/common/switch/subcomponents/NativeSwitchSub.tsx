import React from 'react';
import { View, Text, Switch as RNSwitch } from 'react-native';
import { SwitchAppProps } from '../../SwitchApp';

let useDesignSystem: any;
try {
  useDesignSystem = require('../../../../providers/WithDesignSystem').useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ themeColors: { primary: '#007aff', text: '#000000' } });
}

export const NativeSwitchSub: React.FC<SwitchAppProps> = ({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  testID = 'nativeSwitch',
}) => {
  let designSystem: any = { themeColors: { primary: '#007aff', text: '#000000' } };
  try {
    designSystem = useDesignSystem() || designSystem;
  } catch (e) {}

  const { themeColors } = designSystem;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }, style]}>
      {label && <Text style={{ fontSize: 15, color: themeColors.text }}>{label}</Text>}
      <RNSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: '#767577', true: themeColors.primary || '#007aff' }}
        thumbColor={value ? '#ffffff' : '#f4f3f4'}
      />
    </View>
  );
};

export default NativeSwitchSub;
