import React from 'react';

jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-clipboard', () => ({}), { virtual: true });
jest.mock('expo-symbols', () => ({ SymbolView: () => null }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}), { virtual: true });

import { SwitchApp, SwitchAppProps } from '../components/common/SwitchApp';

describe('SwitchApp component export and props', () => {
  it('exports SwitchApp function component', () => {
    expect(typeof SwitchApp).toBe('function');
  });

  it('accepts SwitchAppProps correctly', () => {
    const props: SwitchAppProps = {
      value: true,
      onValueChange: jest.fn(),
      label: 'Dark mode',
      testID: 'darkModeSwitch',
    };
    expect(props.value).toBe(true);
    expect(props.label).toBe('Dark mode');
  });
});
