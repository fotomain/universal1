import React from 'react';
import { View, Text } from 'react-native';
import { Switch as PaperSwitch } from 'react-native-paper';
import { SwitchAppProps } from '../../SwitchApp';

let AntSwitchComp: any = null;
try {
  AntSwitchComp = require('@ant-design/react-native').Switch;
} catch (e) {
  AntSwitchComp = null;
}

let useDesignSystem: any;
try {
  useDesignSystem = require('../../../../providers/WithDesignSystem').useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ themeColors: { primary: '#1677ff', text: '#000000d9', border: '#f0f0f0' } });
}

export const AntSwitchSub: React.FC<SwitchAppProps> = ({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
  testID = 'antSwitch',
}) => {
  let designSystem: any = { themeColors: { primary: '#1677ff', text: '#000000d9', border: '#f0f0f0' } };
  try {
    designSystem = useDesignSystem() || designSystem;
  } catch (e) {}

  const { themeColors } = designSystem;

  const renderAntSwitch = () => {
    if (AntSwitchComp) {
      try {
        return (
          <AntSwitchComp
            testID={testID}
            checked={Boolean(value)}
            onChange={(checked: boolean) => onValueChange && onValueChange(checked)}
            disabled={disabled}
            color={themeColors.primary || '#1677ff'}
          />
        );
      } catch (err) {
        // fallback to react-native-paper
      }
    }

    return (
      <PaperSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        color={themeColors.primary || '#1677ff'}
      />
    );
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.border || '#f0f0f0',
        },
        style,
      ]}
    >
      {label && <Text style={{ fontSize: 15, color: themeColors.text }}>{label}</Text>}
      {renderAntSwitch()}
    </View>
  );
};

export default AntSwitchSub;
