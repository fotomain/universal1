import React from 'react';
import PaperSwitchSub from './switch/subcomponents/PaperSwitchSub';
import TamaguiSwitchSub from './switch/subcomponents/TamaguiSwitchSub';
import GoogleMD3WebSwitchSub from './switch/subcomponents/GoogleMD3WebSwitchSub';
import AntSwitchSub from './switch/subcomponents/AntSwitchSub';
import ExpoSwitchSub from './switch/subcomponents/ExpoSwitchSub';
import NativeSwitchSub from './switch/subcomponents/NativeSwitchSub';

let useDesignSystem: any;
try {
  useDesignSystem = require('../../context/DesignSystemContext').useDesignSystem;
} catch (e) {
  useDesignSystem = () => ({ activeSystem: 'native' });
}

export interface SwitchAppProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: any;
  testID?: string;
}

export const SwitchApp: React.FC<SwitchAppProps> = (props) => {
  let activeSystem = 'native';
  try {
    if (useDesignSystem) {
      activeSystem = useDesignSystem()?.activeSystem || 'native';
    }
  } catch (e) {}

  switch (activeSystem) {
    case 'paper':
      return <PaperSwitchSub {...props} />;
    case 'tamagui':
      return <TamaguiSwitchSub {...props} />;
    case 'ant':
      return <AntSwitchSub {...props} />;
    case 'expo':
      return <ExpoSwitchSub {...props} />;
    case 'googlemd3web':
      return <GoogleMD3WebSwitchSub {...props} />;
    case 'native':
    default:
      return <NativeSwitchSub {...props} />;
  }
};

export default SwitchApp;
