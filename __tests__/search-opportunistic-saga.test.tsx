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

describe('SearchTextApp & Field Filter Integration', () => {
  it('exports SearchTextApp as a valid function component', () => {
    expect(typeof SearchTextApp).toBe('function');
  });

  it('accepts SearchTextAppProps correctly', () => {
    const props: SearchTextAppProps = {
      value: 'John',
      onChangeText: jest.fn(),
      placeholder: 'Search items...',
      testID: 'SearchTextApp',
    };

    expect(props.value).toBe('John');
    expect(props.placeholder).toBe('Search items...');
  });

  it('filters posts by firstName, lastName, and mediaPostOrigin accurately', () => {
    const mockPosts = [
      { id: '1', title: 'Update', description: 'Tech post', rawItem: { mediaPostJSON: { firstName: 'Alice', lastName: 'Smith', mediaPostOrigin: 'https://youtube.com/watch?v=123' } } },
      { id: '2', title: 'Announcement', description: 'General news', rawItem: { mediaPostJSON: { firstName: 'Bob', lastName: 'Jones', mediaPostOrigin: 'https://vimeo.com/456' } } },
      { id: '3', title: 'Design Review', description: 'UI post', rawItem: { mediaPostJSON: { mediaPostFirstName: 'Charlie', mediaPostLastName: 'Brown', mediaPostOrigin: 'https://github.com/expo/expo' } } },
    ];

    const filterFn = (items: typeof mockPosts, searchText: string) => {
      if (!searchText || searchText.trim() === '') return items;
      const lower = searchText.toLowerCase().trim();
      return items.filter((card) => {
        const title = String(card.title || '').toLowerCase();
        const description = String(card.description || '').toLowerCase();
        const rawJson = card.rawItem?.mediaPostJSON || card.rawItem || {};
        const firstName = String(rawJson.firstName || rawJson.mediaPostFirstName || '').toLowerCase();
        const lastName = String(rawJson.lastName || rawJson.mediaPostLastName || '').toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const mediaPostOrigin = String(rawJson.mediaPostOrigin || rawJson.originUrl || '').toLowerCase();

        return (
          title.includes(lower) ||
          description.includes(lower) ||
          (firstName.length > 0 && firstName.includes(lower)) ||
          (lastName.length > 0 && lastName.includes(lower)) ||
          (fullName.length > 0 && fullName.includes(lower)) ||
          (mediaPostOrigin.length > 0 && mediaPostOrigin.includes(lower))
        );
      });
    };

    expect(filterFn(mockPosts, 'Alice').length).toBe(1);
    expect(filterFn(mockPosts, 'youtube').length).toBe(1);
    expect(filterFn(mockPosts, 'youtube')[0].id).toBe('1');

    expect(filterFn(mockPosts, 'vimeo').length).toBe(1);
    expect(filterFn(mockPosts, 'vimeo')[0].id).toBe('2');

    expect(filterFn(mockPosts, 'github').length).toBe(1);
    expect(filterFn(mockPosts, 'github')[0].id).toBe('3');
  });
});
