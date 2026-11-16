/** @jest-environment jsdom */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { cleanupUI, press, q, renderUI, textOf } from '../../pm/ui/pmUiTestKit';
import {
  PM80_MONTH_SNAPSHOTS,
  PM80_QUICK_LINKS,
  PM80_STAGES,
  PM80_PROJECTS,
  normalizeProjectSelection,
  projectFilterLabel,
  pm80SnapshotFor,
  PM80_DEFAULT_PERIOD,
  PM80_MONTH_NAMES,
  PM80_YEARS,
  shiftPeriod,
  periodLabel,
  pm80InputFor,
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
    expect(textOf('pm80-home-paper-month-pill')).toContain('NOVEMBER');
    expect(textOf('pm80-home-paper-year-pill')).toContain('2026');

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
    expect(textOf('pm80-home-tamagui-month-pill')).toContain('NOVEMBER');
    expect(textOf('pm80-home-tamagui-year-pill')).toContain('2026');

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
    expect(q('pm80-home-paper-month-modal')).not.toBeNull();
    press('pm80-home-paper-month-item-3');
    expect(textOf('pm80-home-paper-month-pill')).toContain('MARCH');
    expect(q('pm80-home-paper-month-modal')).toBeNull();
  });

  it('the header logo has no dark square on web with a light theme', () => {
    expect(pm80LogoWithBackground(false, 'web')).toBe(false); // light web: transparent
    expect(pm80LogoWithBackground(true, 'web')).toBe(true); // dark web: the square
    expect(pm80LogoWithBackground(false, 'ios')).toBe(true); // phones keep the square
    expect(pm80LogoWithBackground(false, 'android')).toBe(true);
  });

  it('the 12 demo projects hold exactly 100% of the cost and of the revenue', () => {
    expect(PM80_PROJECTS).toHaveLength(12);
    expect(PM80_PROJECTS.reduce((a, p) => a + p.costPermille, 0)).toBe(1000);
    expect(PM80_PROJECTS.reduce((a, p) => a + p.revPermille, 0)).toBe(1000);
  });

  it('a selection is normalized: all / empty / unknown = ALL projects (null)', () => {
    const ids = PM80_PROJECTS.map((p) => p.id);
    expect(normalizeProjectSelection(null)).toBeNull();
    expect(normalizeProjectSelection([])).toBeNull();
    expect(normalizeProjectSelection(['nope'])).toBeNull();
    expect(normalizeProjectSelection(ids)).toBeNull();
    expect(normalizeProjectSelection(['audit', 'nope', 'solar'])).toEqual(['solar', 'audit']);
    expect(projectFilterLabel(null)).toBe('All projects (12)');
    expect(projectFilterLabel(['solar'])).toBe('Solar Roof Pilot');
    expect(projectFilterLabel(['solar', 'audit', 'brand'])).toBe('3 of 12 projects');
  });

  it('a subset shows the sums of its projects; ALL gives the original numbers', () => {
    const all = pm80SnapshotFor(PM80_DEFAULT_PERIOD, null);
    expect(all).toBe(PM80_MONTH_SNAPSHOTS[0]);
    const a = pm80SnapshotFor(PM80_DEFAULT_PERIOD, ['railway1', 'officeMove']);
    const b = pm80SnapshotFor(PM80_DEFAULT_PERIOD, ['budget1', 'erpUpgrade', 'mobileApp', 'warehouse', 'brand', 'dataCenter', 'portal', 'solar', 'training', 'audit']);
    // the two complementary subsets add up to ALL (rounding of whole euros: +-2)
    expect(Math.abs(a.money.costPlanNet + b.money.costPlanNet - all.money.costPlanNet)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.money.revenueInvoicedNet + b.money.revenueInvoicedNet - all.money.revenueInvoicedNet)).toBeLessThanOrEqual(2);
    expect(a.projectCount).toBe(2);
    expect(a.projectTitle).toBe('2 of 12 projects');
    // cost share 170 + 80 = 25%, revenue share 150 + 20 = 17%
    expect(a.money.costPlanNet).toBe(72500);
    expect(a.money.revenueInvoicedNet).toBe(Math.round(707000 * 0.17));
    // the circles follow: plan cost, customer invoiced, goal
    expect(a.satellites.find((n) => n.id === 'plan')!.planAmount).toBe(72500);
    expect(a.satellites.find((n) => n.id === 'customerInvoices')!.factAmount).toBe(Math.round(707000 * 0.17));
    expect(a.goalNetProfit).toBe(Math.round(580000 * 0.17));
    // every project has a ROI of its own (Office Move: cost 8% of the book, revenue 2%)
    const office = computePM80Center(pm80SnapshotFor(PM80_DEFAULT_PERIOD, ['officeMove']), 'roi4');
    const railway = computePM80Center(pm80SnapshotFor(PM80_DEFAULT_PERIOD, ['railway1']), 'roi4');
    expect(office.netProfit).toBeLessThan(0);
    expect(railway.netProfit).toBeGreaterThan(0);
  });

  it('the Paper home: open the list, check a subset, Apply; then show all again', () => {
    renderUI(<PM80HomePaper />);
    expect(textOf('pm80-home-paper-project-filter-label')).toBe('All projects (12)');
    const profitAll = textOf('pm80-home-paper-center-profit');

    press('pm80-home-paper-project-filter');
    expect(q('pm80-home-paper-project-filter-modal')).not.toBeNull();
    // uncheck everything, check two projects
    press('pm80-home-paper-project-filter-all');
    press('pm80-home-paper-project-filter-item-railway1');
    press('pm80-home-paper-project-filter-item-erpUpgrade');
    expect(textOf('pm80-home-paper-project-filter-apply')).toContain('Apply (2)');
    press('pm80-home-paper-project-filter-apply');

    expect(textOf('pm80-home-paper-project-filter-label')).toBe('2 of 12 projects');
    expect(textOf('pm80-home-paper-center-profit')).not.toBe(profitAll);

    // back to ALL: check all, the button says so
    press('pm80-home-paper-project-filter');
    press('pm80-home-paper-project-filter-all');
    expect(textOf('pm80-home-paper-project-filter-apply')).toContain('Show all projects');
    press('pm80-home-paper-project-filter-apply');
    expect(textOf('pm80-home-paper-project-filter-label')).toBe('All projects (12)');
    expect(textOf('pm80-home-paper-center-profit')).toBe(profitAll);
  });

  it('Apply is disabled while no project is checked', () => {
    renderUI(<PM80HomeTamagui />);
    press('pm80-home-tamagui-project-filter');
    press('pm80-home-tamagui-project-filter-all'); // all -> none
    press('pm80-home-tamagui-project-filter-apply');
    // the list stays open and the filter is unchanged
    expect(q('pm80-home-tamagui-project-filter-modal')).not.toBeNull();
    expect(textOf('pm80-home-tamagui-project-filter-label')).toBe('All projects (12)');
    press('pm80-home-tamagui-project-filter-cancel');
  });

  it('shiftPeriod moves by one month and changes the year at January / December', () => {
    expect(shiftPeriod({ year: 2026, month: 11 }, 1)).toEqual({ year: 2026, month: 12 });
    expect(shiftPeriod({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftPeriod({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftPeriod({ year: PM80_YEARS[0], month: 1 }, -1)).toBeNull();
    expect(shiftPeriod({ year: PM80_YEARS[PM80_YEARS.length - 1], month: 12 }, 1)).toBeNull();
    expect(periodLabel({ year: 2027, month: 3 })).toBe('MARCH 2027');
    expect(PM80_MONTH_NAMES).toHaveLength(12);
  });

  it('every month of every listed year has numbers; the hand made months stay as they were', () => {
    PM80_YEARS.forEach((year) => {
      for (let month = 1; month <= 12; month += 1) {
        const snap = pm80SnapshotFor({ year, month }, null);
        expect(snap.monthLabel).toBe(periodLabel({ year, month }));
        expect(snap.money.costPlanNet).toBeGreaterThan(0);
        expect(snap.satellites).toHaveLength(8);
        expect(snap.advancedMetrics).toHaveLength(4);
      }
    });
    expect(pm80SnapshotFor({ year: 2026, month: 11 }, null)).toBe(PM80_MONTH_SNAPSHOTS[0]);
    expect(pm80SnapshotFor({ year: 2026, month: 10 }, null)).toBe(PM80_MONTH_SNAPSHOTS[1]);
    expect(pm80SnapshotFor({ year: 2026, month: 12 }, null)).toBe(PM80_MONTH_SNAPSHOTS[2]);
    // a derived month differs from November (season + growth) and its circles agree with its money
    const mar27 = pm80SnapshotFor({ year: 2027, month: 3 }, null);
    expect(mar27.money.costPlanNet).not.toBe(PM80_MONTH_SNAPSHOTS[0].money.costPlanNet);
    expect(mar27.satellites.find((n) => n.id === 'plan')!.planAmount).toBe(mar27.money.costPlanNet);
    expect(pm80InputFor({ year: 2027, month: 3 }).monthKey).toBe('2027-03');
    // the project filter works on a derived month too
    expect(pm80SnapshotFor({ year: 2027, month: 3 }, ['solar']).money.costPlanNet).toBeLessThan(mar27.money.costPlanNet);
  });

  it('month and year are two inputs: each opens its own list', () => {
    renderUI(<PM80HomePaper />);
    press('pm80-home-paper-year-pill');
    expect(q('pm80-home-paper-year-modal')).not.toBeNull();
    PM80_YEARS.forEach((y) => expect(q(`pm80-home-paper-year-item-${y}`)).not.toBeNull());
    press('pm80-home-paper-year-item-2028');
    expect(textOf('pm80-home-paper-year-pill')).toContain('2028');
    expect(textOf('pm80-home-paper-month-pill')).toContain('NOVEMBER'); // the month did not change
    expect(q('pm80-home-paper-year-modal')).toBeNull();

    press('pm80-home-paper-month-pill');
    PM80_MONTH_NAMES.forEach((_, i) => expect(q(`pm80-home-paper-month-item-${i + 1}`)).not.toBeNull());
    press('pm80-home-paper-month-item-1');
    expect(textOf('pm80-home-paper-month-pill')).toContain('JANUARY');
    expect(textOf('pm80-home-paper-year-pill')).toContain('2028');

    // the arrows walk over the year border
    press('pm80-home-paper-prev-month');
    expect(textOf('pm80-home-paper-month-pill')).toContain('DECEMBER');
    expect(textOf('pm80-home-paper-year-pill')).toContain('2027');
    press('pm80-home-paper-next-month');
    expect(textOf('pm80-home-paper-month-pill')).toContain('JANUARY');
    expect(textOf('pm80-home-paper-year-pill')).toContain('2028');
  });

  it('the Tamagui home has the same two lists', () => {
    renderUI(<PM80HomeTamagui />);
    press('pm80-home-tamagui-year-pill');
    press('pm80-home-tamagui-year-item-2025');
    press('pm80-home-tamagui-month-pill');
    press('pm80-home-tamagui-month-item-6');
    expect(textOf('pm80-home-tamagui-month-pill')).toContain('JUNE');
    expect(textOf('pm80-home-tamagui-year-pill')).toContain('2025');
  });
});
