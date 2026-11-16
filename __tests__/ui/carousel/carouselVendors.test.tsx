/** @jest-environment jsdom */
import React, { act } from 'react';

let mockActiveSystem = 'paper';

jest.mock('react-native-reanimated', () => ({
  useSharedValue: (init: any) => ({ value: init }),
}));

jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => 'span');

jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  const IconApp = ({ testID, name }: any) => R.createElement(Text, { testID }, String(name || ''));
  return { __esModule: true, default: IconApp, IconApp };
});

jest.mock('../../../kit8/ui/components/common/googlemd3web/GoogleMD3WebButton', () => {
  const R = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, onPress, children }: any) =>
      R.createElement(
        TouchableOpacity,
        { onPress, accessibilityRole: 'button' },
        R.createElement(Text, null, title || children)
      ),
  };
});

jest.mock('../../../kit8/ui/applemacui/components/AppleButton', () => {
  const R = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    __esModule: true,
    AppleButton: ({ title, onPress, children }: any) =>
      R.createElement(
        TouchableOpacity,
        { onPress, accessibilityRole: 'button' },
        R.createElement(Text, null, title || children)
      ),
  };
});

jest.mock('react-native-paper', () => {
  const R = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');

  const Card: any = ({ children, style, testID, onPress }: any) =>
    R.createElement(
      TouchableOpacity,
      { style, testID, onPress, accessibilityRole: 'link' },
      children
    );
  Card.Content = ({ children, style }: any) => R.createElement(View, { style }, children);

  const Chip = ({ children, onPress, accessibilityRole, accessibilityState, style }: any) =>
    R.createElement(
      TouchableOpacity,
      { onPress, accessibilityRole, accessibilityState, style },
      R.createElement(Text, null, children)
    );

  const Button = ({ children, onPress, style }: any) =>
    R.createElement(
      TouchableOpacity,
      { onPress, accessibilityRole: 'button', style },
      R.createElement(Text, null, children)
    );

  const IconButton = ({ onPress, accessibilityLabel, style }: any) =>
    R.createElement(TouchableOpacity, {
      onPress,
      accessibilityRole: 'button',
      accessibilityLabel,
      style,
    });

  const Surface = ({ children, style }: any) => R.createElement(View, { style }, children);
  const Badge = ({ children, style }: any) => R.createElement(Text, { style }, children);
  const Divider = ({ style }: any) => R.createElement(View, { style });
  const PaperText = ({ children, style }: any) => R.createElement(Text, { style }, children);

  return {
    Card,
    Chip,
    Button,
    IconButton,
    Surface,
    Badge,
    Divider,
    Text: PaperText,
    useTheme: () => ({
      colors: {
        primary: '#2563eb',
        onPrimary: '#ffffff',
        primaryContainer: '#dbeafe',
        background: '#f8fafc',
        onBackground: '#0f172a',
        surface: '#ffffff',
        onSurface: '#0f172a',
        surfaceVariant: '#f1f5f9',
        onSurfaceVariant: '#64748b',
        outline: '#94a3b8',
        outlineVariant: '#e2e8f0',
        elevation: { level1: '#ffffff', level2: '#f8fafc' },
      },
    }),
  };
});

jest.mock('react-native-svg', () => {
  const R = require('react');
  return {
    __esModule: true,
    SvgXml: ({ xml, testID, ...props }: any) =>
      R.createElement('div', { 'data-testid': testID || 'svg-brand-logo', ...props }),
    Svg: 'svg',
    Path: 'path',
  };
});

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({
    activeSystem: mockActiveSystem,
    isDark: false,
    themeColors: {
      primary: '#2563eb',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#0f172a',
      border: '#e2e8f0',
      error: '#ef4444',
      card: '#ffffff',
    },
  }),
}));

jest.mock('react-native-reanimated-carousel', () => {
  const R = require('react');
  const { View, Text } = require('react-native');
  return {
    Carousel: R.forwardRef(({ data, renderItem }: any, ref: any) => {
      R.useImperativeHandle(ref, () => ({
        prev: jest.fn(),
        next: jest.fn(),
        getCurrentIndex: () => 0,
        scrollTo: jest.fn(),
      }));
      return R.createElement(
        View,
        { testID: 'mock-reanimated-carousel' },
        data.map((item: any, index: number) =>
          R.createElement(
            View,
            { key: item.id || index, testID: `carousel-slide-${item.id || index}` },
            renderItem({ item, index })
          )
        )
      );
    }),
    Pagination: ({ count }: any) =>
      R.createElement(
        View,
        { testID: 'mock-pagination' },
        R.createElement(Text, null, `Dots: ${count}`)
      ),
  };
});

// Top-level auto-detecting components
import CarouselVendors, { VENDOR_SLIDES } from '../../../kit8/ui/components/carousel/CarouselVendors';
import CarouselApp from '../../../kit8/ui/components/carousel/CarouselApp';

// Common exports
import { VENDOR_ITEMS, CATEGORIES } from '../../../kit8/ui/components/carousel/common';

// Tamagui flavor
import TamaguiCarouselVendors from '../../../kit8/ui/components/carousel/tamagui/CarouselVendors';
import {
  GoogleVendorCard as TamaguiGoogleCard,
  MicrosoftVendorCard as TamaguiMicrosoftCard,
  PostgreSqlVendorCard as TamaguiPostgresCard,
  ClaudeVendorCard as TamaguiClaudeCard,
  ReactNativeExpoVendorCard as TamaguiRnExpoCard,
  AppleVendorCard as TamaguiAppleCard,
  SwiftVendorCard as TamaguiSwiftCard,
  MaterialYouVendorCard as TamaguiMaterialYouCard,
  AndroidVendorCard as TamaguiAndroidCard,
  GoogleAntigravityVendorCard as TamaguiAntigravityCard,
} from '../../../kit8/ui/components/carousel/tamagui/items';

// Paper flavor
import PaperCarouselVendors from '../../../kit8/ui/components/carousel/paper/CarouselVendors';
import {
  GoogleVendorCard as PaperGoogleCard,
  MicrosoftVendorCard as PaperMicrosoftCard,
  PostgreSqlVendorCard as PaperPostgresCard,
  ClaudeVendorCard as PaperClaudeCard,
  ReactNativeExpoVendorCard as PaperRnExpoCard,
  AppleVendorCard as PaperAppleCard,
  SwiftVendorCard as PaperSwiftCard,
  MaterialYouVendorCard as PaperMaterialYouCard,
  AndroidVendorCard as PaperAndroidCard,
  GoogleAntigravityVendorCard as PaperAntigravityCard,
} from '../../../kit8/ui/components/carousel/paper/items';

// Additional theme flavors
import AppleMacUICarouselVendors from '../../../kit8/ui/components/carousel/applemacui/CarouselVendors';
import AntCarouselVendors from '../../../kit8/ui/components/carousel/ant/CarouselVendors';
import ExpoCarouselVendors from '../../../kit8/ui/components/carousel/expo/CarouselVendors';
import GoogleMD3WebCarouselVendors from '../../../kit8/ui/components/carousel/googlemd3web/CarouselVendors';
import NativeCarouselVendors from '../../../kit8/ui/components/carousel/native/CarouselVendors';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let container: HTMLDivElement;

function mount(ui: React.ReactElement) {
  act(() => {
    root.render(ui);
  });
}

describe('Carousel Vendors — Multi-Theme Auto-Detection, 8 Vendors & Slide Links', () => {
  beforeEach(() => {
    mockActiveSystem = 'paper';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  describe('1. Common Shared Data & 10 Vendors', () => {
    it('exports all 10 VENDOR_ITEMS (including Apple, Swift Language, Google Material You, Android, Google Antigravity) and CATEGORIES', () => {
      expect(Object.keys(VENDOR_ITEMS)).toEqual([
        'google',
        'microsoft',
        'postgresql',
        'claude',
        'reactNativeExpo',
        'apple',
        'swift',
        'materialYou',
        'android',
        'googleAntigravity',
      ]);
      expect(CATEGORIES).toEqual([
        'All',
        'Cloud',
        'Database',
        'AI',
        'Framework',
        'Platform',
        'Language',
        'Design',
      ]);
      expect(VENDOR_SLIDES).toHaveLength(10);
    });

    it('includes valid websiteUrl for every vendor', () => {
      expect(VENDOR_ITEMS.google.websiteUrl).toBe('https://cloud.google.com');
      expect(VENDOR_ITEMS.microsoft.websiteUrl).toBe('https://azure.microsoft.com');
      expect(VENDOR_ITEMS.postgresql.websiteUrl).toBe('https://www.postgresql.org');
      expect(VENDOR_ITEMS.claude.websiteUrl).toBe('https://www.anthropic.com/claude');
      expect(VENDOR_ITEMS.reactNativeExpo.websiteUrl).toBe('https://expo.dev');
      expect(VENDOR_ITEMS.apple.websiteUrl).toBe('https://www.apple.com');
      expect(VENDOR_ITEMS.swift.websiteUrl).toBe('https://www.swift.org');
      expect(VENDOR_ITEMS.materialYou.websiteUrl).toBe('https://m3.material.io');
      expect(VENDOR_ITEMS.android.websiteUrl).toBe('https://www.android.com');
      expect(VENDOR_ITEMS.googleAntigravity.websiteUrl).toBe('https://antigravity.google');
    });
  });

  describe('2. Auto-Detection of Theme Variant from Settings', () => {
    it('auto-detects Paper variant when Settings activeSystem is "paper"', () => {
      mockActiveSystem = 'paper';
      mount(<CarouselVendors />);
      expect(container.textContent).toContain('ENTERPRISE STACK & ECOSYSTEM (PAPER)');
    });

    it('auto-detects Tamagui variant when Settings activeSystem is "tamagui"', () => {
      mockActiveSystem = 'tamagui';
      mount(<CarouselVendors />);
      expect(container.textContent).toContain('ENTERPRISE STACK & ECOSYSTEM (TAMAGUI)');
    });

    it('auto-detects AppleMacUI, Ant, Expo, GoogleMD3Web, and Native variants from Settings', () => {
      const mapping: Array<[string, string]> = [
        ['applemacui', 'ENTERPRISE STACK & ECOSYSTEM (APPLE MAC UI)'],
        ['ant', 'ENTERPRISE STACK & ECOSYSTEM (ANT DESIGN)'],
        ['expo', 'ENTERPRISE STACK & ECOSYSTEM (EXPO UI)'],
        ['googlemd3web', 'ENTERPRISE STACK & ECOSYSTEM (GOOGLE MD3 WEB)'],
        ['native', 'ENTERPRISE STACK & ECOSYSTEM (REACT NATIVE CORE)'],
      ];

      for (const [sys, expectedHeader] of mapping) {
        mockActiveSystem = sys;
        mount(<CarouselVendors />);
        expect(container.textContent).toContain(expectedHeader);
      }
    });

    it('auto-detects variant in top-level CarouselApp', () => {
      const items = [{ id: '1', title: 'Slide 1' }, { id: '2', title: 'Slide 2' }];
      mockActiveSystem = 'tamagui';
      mount(
        <CarouselApp
          data={items}
          renderItem={(item) => <div>{item.title}</div>}
        />
      );
      expect(container.textContent).toContain('Slide 1');
      expect(container.textContent).toContain('1 / 2');
    });
  });

  describe('3. All 10 Vendor Cards across Tamagui, Paper & Theme Variants', () => {
    it('renders all 10 Tamagui vendor subcomponents', () => {
      mount(
        <div>
          <TamaguiGoogleCard />
          <TamaguiMicrosoftCard />
          <TamaguiPostgresCard />
          <TamaguiClaudeCard />
          <TamaguiRnExpoCard />
          <TamaguiAppleCard />
          <TamaguiSwiftCard />
          <TamaguiMaterialYouCard />
          <TamaguiAndroidCard />
          <TamaguiAntigravityCard />
        </div>
      );
      expect(container.textContent).toContain('Google Cloud');
      expect(container.textContent).toContain('Microsoft Azure');
      expect(container.textContent).toContain('PostgreSQL');
      expect(container.textContent).toContain('Claude (Anthropic)');
      expect(container.textContent).toContain('React Native & Expo');
      expect(container.textContent).toContain('Apple');
      expect(container.textContent).toContain('Swift Language');
      expect(container.textContent).toContain('Google Material You');
      expect(container.textContent).toContain('Android');
      expect(container.textContent).toContain('Google Antigravity');
    });

    it('renders all 10 Paper vendor subcomponents', () => {
      mount(
        <div>
          <PaperGoogleCard />
          <PaperMicrosoftCard />
          <PaperPostgresCard />
          <PaperClaudeCard />
          <PaperRnExpoCard />
          <PaperAppleCard />
          <PaperSwiftCard />
          <PaperMaterialYouCard />
          <PaperAndroidCard />
          <PaperAntigravityCard />
        </div>
      );
      expect(container.textContent).toContain('Google Cloud');
      expect(container.textContent).toContain('Microsoft Azure');
      expect(container.textContent).toContain('PostgreSQL');
      expect(container.textContent).toContain('Claude (Anthropic)');
      expect(container.textContent).toContain('React Native & Expo');
      expect(container.textContent).toContain('Apple');
      expect(container.textContent).toContain('Swift Language');
      expect(container.textContent).toContain('Google Material You');
      expect(container.textContent).toContain('Android');
      expect(container.textContent).toContain('Google Antigravity');
    });

    it('renders AppleMacUI, Ant, Expo, GoogleMD3Web, and Native CarouselVendors with all 10 slides', () => {
      for (const Comp of [
        AppleMacUICarouselVendors,
        AntCarouselVendors,
        ExpoCarouselVendors,
        GoogleMD3WebCarouselVendors,
        NativeCarouselVendors,
      ]) {
        mount(<Comp />);
        expect(container.textContent).toContain('Apple');
        expect(container.textContent).toContain('Swift Language');
        expect(container.textContent).toContain('Google Material You');
        expect(container.textContent).toContain('Android');
        expect(container.textContent).toContain('Google Antigravity');
      }
    });
  });

  describe('4. Clicking a Carousel Slide Opens New Browser to Vendor Home Page', () => {
    it('opens new browser tab to vendor websiteUrl when clicking a slide', () => {
      const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

      mount(<TamaguiAppleCard />);
      const linkEl = container.querySelector('[role="link"]') as HTMLElement;
      expect(linkEl).toBeTruthy();

      act(() => {
        linkEl.click();
      });

      expect(openSpy).toHaveBeenCalledWith(
        'https://www.apple.com',
        '_blank',
        'noopener,noreferrer'
      );

      mount(<TamaguiSwiftCard />);
      const swiftLink = container.querySelector('[role="link"]') as HTMLElement;
      act(() => {
        swiftLink.click();
      });

      expect(openSpy).toHaveBeenCalledWith(
        'https://www.swift.org',
        '_blank',
        'noopener,noreferrer'
      );

      mount(<TamaguiMaterialYouCard />);
      const materialLink = container.querySelector('[role="link"]') as HTMLElement;
      act(() => {
        materialLink.click();
      });

      expect(openSpy).toHaveBeenCalledWith(
        'https://m3.material.io',
        '_blank',
        'noopener,noreferrer'
      );

      mount(<TamaguiAndroidCard />);
      const androidLink = container.querySelector('[role="link"]') as HTMLElement;
      act(() => {
        androidLink.click();
      });

      expect(openSpy).toHaveBeenCalledWith(
        'https://www.android.com',
        '_blank',
        'noopener,noreferrer'
      );

      mount(<TamaguiAntigravityCard />);
      const agyLink = container.querySelector('[role="link"]') as HTMLElement;
      act(() => {
        agyLink.click();
      });

      expect(openSpy).toHaveBeenCalledWith(
        'https://antigravity.google',
        '_blank',
        'noopener,noreferrer'
      );

      openSpy.mockRestore();
    });
  });
});
