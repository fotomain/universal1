import React from 'react';

jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-clipboard', () => ({}), { virtual: true });
jest.mock('expo-symbols', () => ({ SymbolView: () => null }), { virtual: true });

jest.mock('../context/DesignSystemContext', () => ({
  useDesignSystem: () => ({
    themeColors: { primary: '#6750A4', onPrimary: '#ffffff' },
  }),
}));

import { OnOffButtonApp, OnOffButtonAppProps } from '../components/common/OnOffButtonApp';

describe('OnOffButtonApp component', () => {
  it('exports OnOffButtonApp as a valid React component', () => {
    expect(typeof OnOffButtonApp).toBe('function');
  });

  it('accepts isOn, onIcon, offIcon, and onOffCallback props', () => {
    const callback = jest.fn();
    const props: OnOffButtonAppProps = {
      isOn: false,
      onIcon: <span data-testid="on-icon" />,
      offIcon: <span data-testid="off-icon" />,
      onOffCallback: callback,
      testID: 'onOffSelectionButton',
    };

    expect(props.isOn).toBe(false);
    expect(props.testID).toBe('onOffSelectionButton');
    expect(props.onOffCallback).toBe(callback);
  });
});
