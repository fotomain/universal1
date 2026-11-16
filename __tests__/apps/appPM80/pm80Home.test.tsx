/** @jest-environment jsdom */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { cleanupUI, press, q, renderUI, textOf } from '../../pm/ui/pmUiTestKit';
import {
  PM80_MONTH_SNAPSHOTS,
  PM80_QUICK_LINKS,
  PM80_STAGES,
  PM80_TIPS,
  roiKindTip,
  vatBasisTip,
  computePM80Center,
  pm80FlowOf,
} from '../../../apps/appPM80/home/pm80HomeModel';

jest.doMock('react-native-paper', () => {
  const R = require('react');
  const { View, Text, TouchableOpacity } = require('react-native');
  return {
    Surface: ({ children, style, testID }: any) =>
      R.createElement(View, { style, testID }, children),
    Text: ({ children, style, testID }: any) =>
      R.createElement(Text, { style, testID }, children),
    Chip: ({ children, onPress, testID, style }: any) =>
      R.createElement(
        TouchableOpacity,
        { onPress, testID, style },
        R.createElement(Text, null, children)
      ),
    Divider: ({ style }: any) => R.createElement(View, { style }),
    useTheme: () => ({
      colors: {
        primary: '#6750A4',
        background: '#FAF8FC',
        surface: '#FFFFFF',
      },
    }),
  };
});

jest.doMock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ name, testID }: any) => R.createElement(Text, { testID }, name),
  };
});

const mockPush = jest.fn();
jest.doMock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    navigate: jest.fn(),
    back: jest.fn(),
    canGoBack: () => false,
  }),
  useLocalSearchParams: () => ({}),
}));

const HomeAppPM80 = require('../../../apps/appPM80/home/HomeAppPM80').default;
const PM80HomePaper = require('../../../apps/appPM80/home/PM80HomePaper').default;
const PM80HomeTamagui = require('../../../apps/appPM80/home/PM80HomeTamagui').default;
const PM80BrandLogo = require('../../../apps/appPM80/home/PM80BrandLogo').default;
const { pm80LogoWithBackground } = require('../../../apps/appPM80/home/PM80BrandLogo');

beforeEach(() => {
  // jsdom has no window.open: a blocked pop-up = the link is pushed in the app
  jest.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
});

describe('PM80 Analogic ROI Dashboard (Paper & Tamagui)', () => {
  it('renders PM80BrandLogo with and without wordmark', () => {
    renderUI(<PM80BrandLogo size={64} showWordmark={true} testID="pm80-logo-test" />);
    expect(q('pm80-logo-test')).not.toBeNull();
    expect(textOf('pm80-logo-test')).toContain('Project Budget Management');
  });
  it('computes +€420,000 Net Profit for November 2026 under ROI4 (Fact - Fact)', () => {
    const nov = PM80_MONTH_SNAPSHOTS[0];
    const center = computePM80Center(nov, 'roi4', {
      includeSaleVat: false,
      includePurchaseVat: false,
    });
    expect(center.netProfit).toBe(420000);
    expect(center.formattedProfit).toBe('+€420,000');
    expect(center.formattedGoal).toBe('Goal €580K');
    expect(nov.advancedMetrics).toHaveLength(4);
    expect(nov.satellites).toHaveLength(8);
  });

  it('renders PM80HomePaper and allows switching months, ROI kinds, and inspecting satellites', () => {
    renderUI(<PM80HomePaper />);
    expect(textOf('pm80-home-paper-center-profit')).toBe('+€420,000');
    expect(textOf('pm80-home-paper-month-pill')).toContain('NOVEMBER 2026');

    // Tap satellite node to open inspector card
    press('pm80-home-paper-satellite-orders');
    expect(q('pm80-home-paper-inspector-card')).not.toBeNull();

    // Switch ROI kind to ROI1
    press('pm80-home-paper-chip-roi1');
    expect(textOf('pm80-home-paper-center-hub')).toContain('Plan ROI');
  });

  it('renders PM80HomeTamagui and allows switching months and inspecting advanced KPI metrics', () => {
    renderUI(<PM80HomeTamagui />);
    expect(textOf('pm80-home-tamagui-center-profit')).toBe('+€420,000');
    expect(textOf('pm80-home-tamagui-month-pill')).toContain('NOVEMBER 2026');

    // Tap advanced metric ring to open inspector
    press('pm80-home-tamagui-metric-budget');
    expect(q('pm80-home-tamagui-inspector-card')).not.toBeNull();
  });

  it('toggles between Paper and Tamagui in HomeAppPM80', () => {
    // hidden by default
    renderUI(<HomeAppPM80 />);
    expect(q('pm80-home-paper')).not.toBeNull();
    expect(q('pm80-home-tab-tamagui')).toBeNull();
    cleanupUI();

    renderUI(<HomeAppPM80 showVariantSwitcher />);
    expect(q('pm80-home-paper')).not.toBeNull();

    press('pm80-home-tab-tamagui');
    expect(q('pm80-home-tamagui')).not.toBeNull();
  });

  it('has the 8 circles in the business order 1..8 with the real Drawer names', () => {
    const flow = pm80FlowOf(PM80_MONTH_SNAPSHOTS[0]);
    expect(flow.map((n) => n.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(flow.map((n) => n.label.replace('\n', ' '))).toEqual([
      'Project plan',
      'Purchase orders',
      'Product receipts',
      'Time sheets',
      'Fact input',
      'Vendor invoices',
      'Customer invoices',
      'Cash payments',
    ]);
    // the grid reads left to right, top to bottom = the business order
    expect(flow.map((n) => n.position)).toEqual([
      'top-left', 'top-right', 'mid-left', 'mid-right',
      'lower-left', 'lower-right', 'bottom-left', 'bottom-right',
    ]);
  });

  it('every link of the home is a REAL route of app/ (circles, KPI rings, quick links)', () => {
    const routes = new Set<string>();
    PM80_STAGES.forEach((s) => routes.add(s.route));
    PM80_QUICK_LINKS.forEach((l) => routes.add(l.route));
    PM80_MONTH_SNAPSHOTS.forEach((m) => m.advancedMetrics.forEach((k) => routes.add(k.route)));
    const appDir = path.resolve(__dirname, '../../../app');
    routes.forEach((r) => {
      const asIndex = path.join(appDir, r, 'index.tsx');
      const asFile = path.join(appDir, `${r}.tsx`);
      expect(fs.existsSync(asIndex) || fs.existsSync(asFile)).toBe(true);
    });
  });

  it('the circles agree with the ROI money of the month (plan, fact input, invoiced)', () => {
    PM80_MONTH_SNAPSHOTS.forEach((m) => {
      const by = (id: string) => m.satellites.find((s) => s.id === id)!;
      expect(by('plan').planAmount).toBe(m.money.costPlanNet);
      expect(by('plan').factAmount).toBe(m.money.revenuePlanNet - m.money.costPlanNet);
      expect(by('fact').planAmount).toBe(m.money.revenuePlanNet);
      expect(by('fact').factAmount).toBe(m.money.revenueUsedNet);
      expect(by('vendorInvoices').factAmount).toBe(m.money.costInvoicedNet);
      expect(by('customerInvoices').factAmount).toBe(m.money.revenueInvoicedNet);
      expect(by('payments').planAmount).toBe(m.money.revenueInvoicedNet);
    });
    expect(PM80_MONTH_SNAPSHOTS[0].advancedMetrics.map((k) => k.id)).toEqual([
      'budget', 'capacity', 'delivered', 'collected',
    ]);
  });

  it('opens the real screen from a circle, from the flow strip and from a quick link', () => {
    renderUI(<PM80HomePaper />);
    press('pm80-home-paper-satellite-timesheets');
    expect(textOf('pm80-home-paper-inspector-card')).toContain('Hours posted');
    press('pm80-home-paper-flow-step-6');
    expect(mockPush).toHaveBeenCalledWith('/pm/vendor-invoice/list');
    press('pm80-home-paper-nav-chat');
    expect(mockPush).toHaveBeenCalledWith('/chat');
    press('pm80-home-paper-metric-collected');
    expect(q('pm80-home-paper-inspector-card')).not.toBeNull();
  });

  it('opens the real screen from the Tamagui flow strip and dock', () => {
    renderUI(<PM80HomeTamagui />);
    press('pm80-home-tamagui-flow-step-8');
    expect(mockPush).toHaveBeenCalledWith('/pm/payment-fact/list');
    press('pm80-home-tamagui-nav-balances');
    expect(mockPush).toHaveBeenCalledWith('/pm/reports/monitor07/customer');
  });

  it('opens a link in a NEW browser window on web, and in this app when the pop-up is blocked', () => {
    const { openPM80Route } = require('../../../apps/appPM80/home/pm80OpenRoute');
    const router = { push: jest.fn() };
    const open = window.open as jest.Mock;
    open.mockReturnValue({} as any);
    openPM80Route('/pm/customer-invoice/list', router);
    expect(open).toHaveBeenCalledWith('/pm/customer-invoice/list', '_blank');
    expect(router.push).not.toHaveBeenCalled();

    open.mockReturnValue(null);
    openPM80Route('/pm/customer-invoice/list', router);
    expect(router.push).toHaveBeenCalledWith('/pm/customer-invoice/list');
  });

  it('every image / circle / ring / button has a short hover tip', () => {
    const tips: string[] = [
      ...Object.values(PM80_TIPS),
      ...PM80_QUICK_LINKS.map((l) => l.tip),
      ...PM80_STAGES.map((st) => st.tip),
      ...PM80_MONTH_SNAPSHOTS.flatMap((m) => m.advancedMetrics.map((k) => `${k.label}: ${k.formulaTip}`)),
      ...(['roi1', 'roi2', 'roi3', 'roi4'] as const).map(roiKindTip),
      vatBasisTip(true),
      vatBasisTip(false),
    ];
    tips.forEach((t) => {
      expect(t.trim().length).toBeGreaterThan(10);
      expect(t.length).toBeLessThanOrEqual(260); // the bubble is 260 px wide: 3-4 lines at most
    });
    expect(roiKindTip('roi4')).toContain('Customer Invoiced');
    expect(vatBasisTip(false)).toContain('IFRS');
  });

  it('the tipped controls still react to a press (the tip wrapper does not swallow it)', () => {
    renderUI(<PM80HomePaper />);
    press('pm80-home-paper-chip-roi2');
    expect(textOf('pm80-home-paper-center-hub')).toContain('Delivered ROI');
    press('pm80-home-paper-layers-btn');
    expect(textOf('pm80-home-paper-chip-vat')).toContain('Gross');
    press('pm80-home-paper-month-pill');
    expect(textOf('pm80-home-paper-month-pill')).not.toContain('NOVEMBER');
  });

  it('the header logo has no dark square on web with a light theme', () => {
    expect(pm80LogoWithBackground(false, 'web')).toBe(false); // light web: transparent
    expect(pm80LogoWithBackground(true, 'web')).toBe(true); // dark web: the square
    expect(pm80LogoWithBackground(false, 'ios')).toBe(true); // phones keep the square
    expect(pm80LogoWithBackground(false, 'android')).toBe(true);
  });
});
