import React from 'react';

jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-clipboard', () => ({}), { virtual: true });
jest.mock('expo-symbols', () => ({ SymbolView: () => null }), { virtual: true });

jest.mock('../context/DesignSystemContext', () => ({
  useDesignSystem: () => ({
    themeColors: { primary: '#6750A4', surface: '#ffffff' },
  }),
}));

import { SearchInputApp, SearchInputAppProps } from '../components/common/SearchInputApp';

describe('SearchInputApp component export and prop interface', () => {
  it('exports SearchInputApp as a valid function component', () => {
    expect(typeof SearchInputApp).toBe('function');
  });

  it('accepts SearchInputAppProps correctly', () => {
    const props: SearchInputAppProps = {
      value: 'query',
      onChangeText: jest.fn(),
      placeholder: 'Search items...',
      testID: 'searchInputApp',
    };

    expect(props.value).toBe('query');
    expect(props.placeholder).toBe('Search items...');
  });
});
