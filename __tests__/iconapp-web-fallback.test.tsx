import React from 'react';

let getWebFallbackGlyph: (name: string) => string;
let getPlatformSymbolName: (name: string) => string;

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'MaterialCommunityIcons');
jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('expo-symbols', () => ({
  SymbolView: ({ name, fallback }: { name: string; fallback?: React.ReactNode }) =>
    require('react').createElement('Text', null, fallback || name),
}));

jest.mock('react-native-paper', () => ({
  Icon: ({ source }: { source?: string }) => require('react').createElement('Text', null, source || 'icon'),
}));

const mockDesignSystem = {
  activeSystem: 'paper',
  setActiveSystem: jest.fn(),
  iconsVariant: 'platformOrientedIcons',
  setIconsVariant: jest.fn(),
  isDark: false,
  toggleTheme: jest.fn(),
  tamaguiConfig: {},
  themeColors: {
    primary: '#000',
    background: '#fff',
    surface: '#fff',
    text: '#000',
    border: '#ddd',
    error: '#f00',
    card: '#fff',
  },
};

jest.mock('../kit8/providers/WithDesignSystem', () => ({
  __esModule: true,
  default: require('react').createContext(mockDesignSystem),
  useDesignSystem: () => mockDesignSystem,
}));

describe('IconApp web fallback', () => {
  beforeAll(() => {
    ({ getWebFallbackGlyph, getPlatformSymbolName } = require('../kit8/components/common/IconApp'));
  });

  it('uses a text glyph instead of loading vector icon fonts on web', () => {
    expect(getWebFallbackGlyph('menu')).toBe('☰');
    expect(getWebFallbackGlyph('close')).toBe('✕');
    expect(getWebFallbackGlyph('settings')).toBe('⚙');
  });

  it('maps generic names to the platform-oriented symbol names when selected', () => {
    expect(getPlatformSymbolName('home')).toBe('house');
    expect(getPlatformSymbolName('settings')).toBe('settings');
    expect(getPlatformSymbolName('more_vert')).toBe('more_vert');
  });

  it('uses the groups alias for user collections in the left menu', () => {
    expect(getWebFallbackGlyph('groups')).toBe('👥');
    expect(getPlatformSymbolName('groups')).toBe('person_2');
    expect(getPlatformSymbolName('account-group')).toBe('person_2');
  });
});
