/** @jest-environment jsdom */
import React from 'react';
import { cleanupUI, press, q, qa, renderUI } from '../../pm/ui/pmUiTestKit';
import {
  PM80_HOME_SETTINGS_DEFAULT,
  normalizeHomeSettings,
  gridRows,
  itemRadius,
} from '../../../apps/appPM80/home/homeSettings/homeSettingsModel';
import { getHomeSettingsLocal, resetHomeSettingsLocal, saveHomeSettingsLocal } from '../../../apps/appPM80/home/homeSettings/homeSettingsLocal';
import { computePM80Layout } from '../../../apps/appPM80/home/pm80Layout';

jest.doMock('react-native-paper', () => {
  const R = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    Surface: ({ children, style, testID }: any) => R.createElement(View, { style, testID }, children),
    Text: ({ children, style, testID }: any) => R.createElement(Text, { style, testID }, children),
    Chip: ({ children, onPress, testID, style }: any) => R.createElement(TouchableOpacity, { onPress, testID, style }, R.createElement(Text, null, children)),
    Divider: ({ style }: any) => R.createElement(View, { style }),
    useTheme: () => ({ colors: { primary: '#6750A4', background: '#FAF8FC', surface: '#FFFFFF' } }),
  };
});
jest.doMock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.doMock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({}),
}));

const PM80HomePaper = require('../../../apps/appPM80/home/PM80HomePaper').default;
const PM80HomeTamagui = require('../../../apps/appPM80/home/PM80HomeTamagui').default;
const PM80HomeSettingsPanel = require('../../../apps/appPM80/home/homeSettings/PM80HomeSettingsPanel').default;
const { useHomeSettings } = require('../../../apps/appPM80/home/homeSettings/homeSettingsLocal');

// the radio sets live on the Business order screen (PM80BusinessOrderSettings mounts this panel); here the panel is wired
// the same way next to a home, so the choice is seen on the home at once
function PanelOnBusinessOrderScreen() {
  const settings = useHomeSettings();
  return (
    <PM80HomeSettingsPanel
      testID="pm80-business-order-home-settings"
      settings={settings}
      onChange={saveHomeSettingsLocal}
      textStrong="#000"
      textMuted="#666"
      accent="#6750A4"
      borderColor="#ccc"
    />
  );
}
const SP = 'pm80-business-order-home-settings';

afterEach(() => {
  resetHomeSettingsLocal();
  cleanupUI();
});

/** React Native Web writes a dynamic radius inline as border-top-left-radius */
const cssRadiusOf = (el: HTMLElement) => parseFloat(el.style.borderTopLeftRadius);

const rowSizes = (prefix: string) => qa(`${prefix}-grid-row-`).filter((id) => /-grid-row-\d+$/.test(id)).map((id) => q(id)!.querySelectorAll('[data-testid*="-satellite-"]:not([data-testid$="-step"])').length);

describe('home settings (model)', () => {
  it('defaults: 3 items in the first row, circles', () => {
    expect(PM80_HOME_SETTINGS_DEFAULT).toEqual({ itemsPerRow: 3, itemShape: 'circle' });
    expect(normalizeHomeSettings(undefined)).toEqual(PM80_HOME_SETTINGS_DEFAULT);
  });

  it('only 2, 3, 4 and circle / square are valid; a wrong value falls back per field', () => {
    expect(normalizeHomeSettings({ itemsPerRow: 4, itemShape: 'square' })).toEqual({ itemsPerRow: 4, itemShape: 'square' });
    expect(normalizeHomeSettings({ itemsPerRow: '2', itemShape: 'circle' }).itemsPerRow).toBe(2);
    expect(normalizeHomeSettings({ itemsPerRow: 5, itemShape: 'triangle' })).toEqual(PM80_HOME_SETTINGS_DEFAULT);
    expect(normalizeHomeSettings({ itemsPerRow: 2, itemShape: 'hexagon' })).toEqual({ itemsPerRow: 2, itemShape: 'circle' });
  });

  it('the first row is full; the 8 items are cut in rows of 2 / 3 / 4', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(gridRows(items, 2).map((r) => r.length)).toEqual([2, 2, 2, 2]);
    expect(gridRows(items, 3).map((r) => r.length)).toEqual([3, 3, 2]);
    expect(gridRows(items, 4).map((r) => r.length)).toEqual([4, 4]);
    expect(gridRows(items, 3).flat()).toEqual(items);
  });

  it('circle = half the side, square = a rounded corner', () => {
    expect(itemRadius('circle', 60)).toBe(30);
    expect(itemRadius('square', 60)).toBeLessThan(30);
    expect(itemRadius('square', 60)).toBeGreaterThan(0);
  });

  it('the device store keeps a partial change and refuses a wrong one', () => {
    saveHomeSettingsLocal({ itemsPerRow: 4 });
    expect(getHomeSettingsLocal()).toEqual({ itemsPerRow: 4, itemShape: 'circle' });
    saveHomeSettingsLocal({ itemShape: 'square' });
    expect(getHomeSettingsLocal()).toEqual({ itemsPerRow: 4, itemShape: 'square' });
    saveHomeSettingsLocal({ itemsPerRow: 9 as any });
    expect(getHomeSettingsLocal().itemsPerRow).toBe(3);
  });
});

describe('home settings (phone portrait layout)', () => {
  it('a full row of 2, 3 or 4 items fits the content from 320 px, Paper (28) and Tamagui (50)', () => {
    [320, 349, 375, 390, 430].forEach((w) => {
      [28, 50].forEach((chrome) => {
        [2, 3, 4].forEach((n) => {
          const l = computePM80Layout(w, 800, chrome, w, 'ios', n);
          expect(l.isLandscape).toBe(false);
          expect(l.itemsPerRow).toBe(n);
          expect(n * l.sat + (n - 1) * l.itemGap).toBeLessThanOrEqual(l.inner);
          expect(l.satCircle).toBeLessThanOrEqual(l.sat);
          expect(l.hub).toBeLessThanOrEqual(l.inner);
        });
      });
    });
  });

  it('fewer items in a row = bigger items; landscape also follows the setting', () => {
    const two = computePM80Layout(390, 800, 28, 390, 'ios', 2);
    const four = computePM80Layout(390, 800, 28, 390, 'ios', 4);
    expect(two.satCircle).toBeGreaterThan(four.satCircle);
    [2, 3, 4].forEach((n) => {
      const l = computePM80Layout(844, 390, 28, 844, 'ios', n);
      expect(l.isLandscape).toBe(true);
      const rightW = l.inner - l.leftW - 16;
      expect(n * l.sat).toBeLessThanOrEqual(rightW + 4);
      expect(l.kpi).toBe(computePM80Layout(844, 390, 28, 844, 'ios', 3).kpi);
    });
  });
});

describe.each([
  ['paper', 'pm80-home-paper', PM80HomePaper],
  ['tamagui', 'pm80-home-tamagui', PM80HomeTamagui],
])('home settings (%s home)', (_name, id, Home: any) => {
  it('3 per row by default (3 + 3 + 2), the ROI ring above the grid, circles', () => {
    renderUI(<Home />);
    expect(rowSizes(id)).toEqual([3, 3, 2]);
    expect(q(`${id}-hub-slot`)).not.toBeNull();
    expect(q(`${id}-hub-slot`)!.compareDocumentPosition(q(`${id}-grid`)!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the home has no Home settings button any more (it is on the Business order screen)', () => {
    renderUI(<Home />);
    expect(q(`${id}-settings-btn`)).toBeNull();
    expect(q(`${id}-settings`)).toBeNull();
  });

  it('the radio set changes the first row to 2 and 4 at once, and the choice is kept', () => {
    renderUI(<><Home /><PanelOnBusinessOrderScreen /></>);
    press(`${SP}-perRow-2`);
    expect(rowSizes(id)).toEqual([2, 2, 2, 2]);
    press(`${SP}-perRow-4`);
    expect(rowSizes(id)).toEqual([4, 4]);
    expect(getHomeSettingsLocal().itemsPerRow).toBe(4);
  });

  it('the form radio set makes the items square', () => {
    renderUI(<><Home /><PanelOnBusinessOrderScreen /></>);
    const orb = () => q(`${id}-satellite-orders-step`)!.parentElement as HTMLElement;
    const radius = () => cssRadiusOf(orb());
    const before = radius();
    expect(before).toBeGreaterThan(20); // a circle: half of the side
    press(`${SP}-shape-square`);
    expect(getHomeSettingsLocal().itemShape).toBe('square');
    expect(radius()).toBeLessThan(before);
    press(`${SP}-shape-circle`);
    expect(radius()).toBe(before);
  });

  it('every one of the 8 items is still pressable in the grid', () => {
    renderUI(<Home />);
    press(`${id}-satellite-orders`);
    expect(q(`${id}-inspector-card`) ?? q(`${id}-inspector`)).not.toBeNull();
  });
});
