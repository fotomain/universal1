import React from 'react';
import { View, Text } from 'react-native';
import { Switch as PaperSwitch } from 'react-native-paper';
import { SwitchAppProps } from '../../SwitchApp';

let useDesignSystem: any;
try {
  useDesignSystem = require('../../../../context/DesignSystemContext').useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ themeColors: { primary: '#6750A4', text: '#212121' } });
}

export const PaperSwitchSub: React.FC<SwitchAppProps> = ({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  testID = 'paperSwitch',
}) => {
  let themeColors: any = { primary: '#6750A4', text: '#212121' };
  try {
    themeColors = useDesignSystem()?.themeColors || themeColors;
  } catch (e) {}

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }, style]}>
      {label && <Text style={{ fontSize: 16, color: themeColors.text }}>{label}</Text>}
      <PaperSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        color={themeColors.primary}
      />
    </View>
  );
};

export default PaperSwitchSub;
