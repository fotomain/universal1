import {SearchTextApp, SearchTextAppProps} from '../components/common/SearchTextApp';

jest.mock('@material-symbols-svg/react-native', () => ({}), { virtual: true });
jest.mock('expo-clipboard', () => ({}), { virtual: true });
jest.mock('expo-symbols', () => ({ SymbolView: () => null }), { virtual: true });
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}), { virtual: true });

jest.mock('../context/DesignSystemContext', () => ({
  useDesignSystem: () => ({
    activeSystem: 'google_md3_web',
    themeColors: { primary: '#6750A4', surface: '#ffffff' },
    isDark: false,
  }),
}));

describe('SearchTextApp component export and prop interface', () => {
  it('exports SearchTextApp as a valid function component', () => {
    expect(typeof SearchTextApp).toBe('function');
  });

  it('accepts SearchTextAppProps correctly', () => {
    const props: SearchTextAppProps = {
      value: 'query',
      onChangeText: jest.fn(),
      placeholder: 'Search items...',
      testID: 'SearchTextApp',
    };

    expect(props.value).toBe('query');
    expect(props.placeholder).toBe('Search items...');
  });
});
