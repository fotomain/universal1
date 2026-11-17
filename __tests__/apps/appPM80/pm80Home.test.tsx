/** @jest-environment jsdom */
import React, { act } from 'react';
import fs from 'fs';
import path from 'path';
import { cleanupUI, press, q, renderUI, textOf, typeInto, pressKey, inputValue, expectInOrder } from '../../pm/ui/pmUiTestKit';
import { saveBusinessOrderLocal, resetBusinessOrderLocal } from '../../../apps/appPM80/home/businessOrder/businessOrderLocal';
import { BUSINESS_ORDER_ROUTE, defaultBusinessOrder, setBusinessOrderVisible, reorderBusinessOrder } from '../../../apps/appPM80/home/businessOrder/businessOrderModel';
import { ROI_INFO, ROI_INFO_COMMON, roiInfoNumbers } from '../../../apps/appPM80/home/roiInfo/roiInfoModel';
import { KPI_INFO, KPI_IDS, kpiBandsText, kpiInfoContent, kpiInfoNumbers } from '../../../apps/appPM80/home/kpiInfo/kpiInfoModel';
import { KPI_BANDS, statusLowerBetter, statusHigherBetter } from '../../../apps/appPM80/home/pm80HomeModel';
import { createDoubleTouch } from '../../../apps/appPM80/home/roiInfo/pm80DoubleTouch';
import { computePM80Layout } from '../../../apps/appPM80/home/pm80Layout';
import { flowScrollY, flowSpacerHeight, flowCanReach, flowTargetOffset, FLOW_TOP_GAP } from '../../../apps/appPM80/home/pm80FlowScroll';
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
  PM80_YEAR_MIN,
  PM80_YEAR_MAX,
  parseYearInput,
  sanitizeYearText,
  pm80YearList,
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
const { pm80LogoWithBackground, PM80_LOGO_DARK_BACKGROUND } = require('../../../apps/appPM80/home/PM80BrandLogo');

beforeEach(() => {
  // jsdom has no window.open: a blocked pop-up = the link is pushed in the app
  jest.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  resetBusinessOrderLocal();
  cleanupUI();
  jest.clearAllMocks();
});

/** one tap on the year: the list opens after the double tap window */
function tapOnce(testID: string) {
  press(testID);
  act(() => {
    jest.advanceTimersByTime(500);
  });
}

describe('PM80 Analogic ROI Dashboard (Paper & Tamagui)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

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
    routes.add(BUSINESS_ORDER_ROUTE);
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
    press('pm80-home-paper-chip-vat');
    expect(textOf('pm80-home-paper-chip-vat')).toContain('Gross');
    press('pm80-home-paper-month-pill');
    expect(q('pm80-home-paper-month-modal')).not.toBeNull();
    press('pm80-home-paper-month-item-3');
    expect(textOf('pm80-home-paper-month-pill')).toContain('MARCH');
    expect(q('pm80-home-paper-month-modal')).toBeNull();
  });

  it('the logo: a light theme = transparent background, the dark theme = a BLACK background, on every platform', () => {
    expect(pm80LogoWithBackground(false)).toBe(false); // transparent
    expect(pm80LogoWithBackground(true)).toBe(true); // a square ...
    expect(PM80_LOGO_DARK_BACKGROUND).toBe('#000000'); // ... black
    // the drawing: no square at all in the light theme; a square filled with black in the dark theme
    const { pm80LogoBackgroundFill } = require('../../../apps/appPM80/home/PM80BrandLogo');
    expect(pm80LogoBackgroundFill(PM80_LOGO_DARK_BACKGROUND)).toBe('#000000');
    expect(pm80LogoBackgroundFill()).toBe('url(#pm80BgGrad)'); // the app icon keeps its gradient
    const squares = (html: string) => (html.match(/<rnsvgrect[^>]*width="1024"/gi) || []).length;
    renderUI(<PM80BrandLogo size={36} withBackground={false} testID="pm80-logo-light" />);
    expect(squares(q('pm80-logo-light')!.innerHTML)).toBe(0);
    cleanupUI();
    renderUI(<PM80BrandLogo size={36} withBackground backgroundColor={PM80_LOGO_DARK_BACKGROUND} testID="pm80-logo-dark" />);
    expect(squares(q('pm80-logo-dark')!.innerHTML)).toBe(1);
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
    expect(shiftPeriod({ year: PM80_YEAR_MIN, month: 1 }, -1)).toBeNull();
    expect(shiftPeriod({ year: PM80_YEAR_MAX, month: 12 }, 1)).toBeNull();
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
    tapOnce('pm80-home-paper-year-pill');
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
    tapOnce('pm80-home-tamagui-year-pill');
    press('pm80-home-tamagui-year-item-2025');
    press('pm80-home-tamagui-month-pill');
    press('pm80-home-tamagui-month-item-6');
    expect(textOf('pm80-home-tamagui-month-pill')).toContain('JUNE');
    expect(textOf('pm80-home-tamagui-year-pill')).toContain('2025');
  });

  it('the typed year: exactly 4 digits from 2000 to 2099', () => {
    expect(sanitizeYearText('20a2-6x9')).toBe('2026');
    expect(sanitizeYearText('')).toBe('');
    expect(parseYearInput('2026')).toEqual({ ok: true, year: 2026 });
    expect(parseYearInput(' 2031 ')).toEqual({ ok: true, year: 2031 });
    ['', '26', '202', '20266', 'abcd', '1999', '2100', '0000'].forEach((t) => {
      expect(parseYearInput(t).ok).toBe(false);
    });
    const bad = parseYearInput('1999');
    expect(!bad.ok && bad.message).toContain('2000');
    expect(pm80YearList(2026)).toEqual(PM80_YEARS);
    expect(pm80YearList(2041)).toEqual([...PM80_YEARS, 2041]);
    expect(pm80YearList(2010)[0]).toBe(2010);
  });

  it('double tap on the year opens an inline number input; Enter applies a valid year', () => {
    renderUI(<PM80HomePaper />);
    press('pm80-home-paper-year-pill');
    press('pm80-home-paper-year-pill'); // the second tap inside the window
    expect(q('pm80-home-paper-year-modal')).toBeNull(); // no list
    expect(q('pm80-home-paper-year-input')).not.toBeNull();
    expect(inputValue('pm80-home-paper-year-input')).toBe('2026');

    // only digits, at most 4
    typeInto('pm80-home-paper-year-input', '20x3y45');
    expect(inputValue('pm80-home-paper-year-input')).toBe('2034');
    pressKey('pm80-home-paper-year-input', 'Enter');
    expect(q('pm80-home-paper-year-input')).toBeNull();
    expect(textOf('pm80-home-paper-year-pill')).toContain('2034');
    expect(textOf('pm80-home-paper-month-pill')).toContain('NOVEMBER'); // the month did not change
    // the list now shows the typed year
    tapOnce('pm80-home-paper-year-pill');
    expect(q('pm80-home-paper-year-item-2034')).not.toBeNull();
  });

  it('an unrealistic year is refused with a message and the old year stays', () => {
    renderUI(<PM80HomePaper />);
    press('pm80-home-paper-year-pill');
    press('pm80-home-paper-year-pill');
    typeInto('pm80-home-paper-year-input', '1850');
    // said at once, at the 4th digit
    expect(textOf('pm80-home-paper-year-error')).toContain('2000');
    pressKey('pm80-home-paper-year-input', 'Enter');
    expect(q('pm80-home-paper-year-input')).not.toBeNull(); // still editing

    // too short: Enter says how many digits
    typeInto('pm80-home-paper-year-input', '20');
    pressKey('pm80-home-paper-year-input', 'Enter');
    expect(textOf('pm80-home-paper-year-error')).toContain('4 digits');

    // Escape drops the typing
    pressKey('pm80-home-paper-year-input', 'Escape');
    expect(q('pm80-home-paper-year-input')).toBeNull();
    expect(textOf('pm80-home-paper-year-pill')).toContain('2026');
  });

  it('the Tamagui home has the same inline year input', () => {
    renderUI(<PM80HomeTamagui />);
    press('pm80-home-tamagui-year-pill');
    press('pm80-home-tamagui-year-pill');
    typeInto('pm80-home-tamagui-year-input', '2029');
    pressKey('pm80-home-tamagui-year-input', 'Enter');
    expect(textOf('pm80-home-tamagui-year-pill')).toContain('2029');
  });

  it('layout: portrait fits phones from 320 px, landscape puts the circles in 4 columns', () => {
    [320, 349, 375, 390, 430].forEach((w) => {
      const l = computePM80Layout(w, 800, 28);
      expect(l.isLandscape).toBe(false);
      // [circle][hub][circle] must fit in the content width
      expect(2 * l.sat + l.hub).toBeLessThanOrEqual(l.inner);
      expect(4 * l.kpi).toBeLessThanOrEqual(l.inner);
      expect(l.hub).toBeLessThanOrEqual(194);
    });
    // Tamagui has a card around the content (50 px)
    const t = computePM80Layout(349, 700, 50);
    expect(2 * t.sat + t.hub).toBeLessThanOrEqual(t.inner);
    // the design size on a wide portrait window
    const wide = computePM80Layout(480, 900, 28);
    expect(wide.hub).toBe(194);
    expect(wide.sat).toBe(86);
    // landscape phones and tablets
    [[568, 320], [667, 375], [844, 390], [1024, 768]].forEach(([w, h]) => {
      const l = computePM80Layout(w, h, 28);
      expect(l.isLandscape).toBe(true);
      const rightW = l.inner - l.leftW - 16;
      expect(4 * l.sat).toBeLessThanOrEqual(rightW + 4);
      expect(l.leftW).toBeGreaterThanOrEqual(200);
      expect(l.bodyMax).toBe(960);
    });
    // a short wide window is landscape, a tall narrow one is not
    expect(computePM80Layout(500, 300).isLandscape).toBe(false); // narrower than 560
    expect(computePM80Layout(900, 1200).isLandscape).toBe(false);
  });

  it('phone scroll: the Business order panel goes to the top; the spacer makes it reachable', () => {
    // the panel at y = 900 goes to the top with a small gap, never above the page
    expect(flowScrollY(900)).toBe(900 - FLOW_TOP_GAP);
    expect(flowScrollY(3)).toBe(0);
    // screen 700 high, 400 px of page below the panel (to the end of its block): a spacer of 300 - gap
    const spacer = flowSpacerHeight(700, 400);
    expect(spacer).toBe(700 - 400 - FLOW_TOP_GAP);
    // the page is 1300 long with the panel at 900: without the spacer it cannot reach the top, with it it can
    expect(flowCanReach(700, 1300, 900)).toBe(false);
    expect(flowCanReach(700, 1300 + spacer, 900)).toBe(true);
    // the number does not depend on the spacer in force: asking again gives the same height (no growing loop)
    expect(flowSpacerHeight(700, 400)).toBe(spacer);
    // a long page below the panel needs none
    expect(flowSpacerHeight(700, 2500)).toBe(0);
    // not measured yet
    expect(flowSpacerHeight(0, 400)).toBe(0);
    expect(flowSpacerHeight(700, 0)).toBe(0);
    expect(flowCanReach(0, 0, 900)).toBe(false);
    // from window coordinates: the panel is 520 px below the top of the visible page, the page is scrolled by 300
    expect(flowTargetOffset(620, 100, 300)).toBe(300 + 520 - FLOW_TOP_GAP);
    // a panel already above the top of the page never gives a negative offset
    expect(flowTargetOffset(50, 100, 0)).toBe(0);
  });

  it('a phone is a native app or a window narrower than 768 px', () => {
    expect(computePM80Layout(349, 700, 28, 349, 'web').isMobile).toBe(true);
    expect(computePM80Layout(1024, 768, 28, 1024, 'web').isMobile).toBe(false);
    expect(computePM80Layout(1024, 768, 28, 1024, 'ios').isMobile).toBe(true);
    expect(computePM80Layout(700, 360, 28, 700, 'web').isMobile).toBe(true); // a landscape phone
  });

  it('a tap on a circle marks that step in the Business order panel (Paper and Tamagui)', () => {
    renderUI(<PM80HomePaper />);
    expect(q('pm80-home-paper-flow-step-4-active')).toBeNull();
    press('pm80-home-paper-satellite-timesheets');
    expect(q('pm80-home-paper-flow-step-4-active')).not.toBeNull();
    expect(q('pm80-home-paper-flow-step-5-active')).toBeNull();
    press('pm80-home-paper-satellite-vendorInvoices');
    expect(q('pm80-home-paper-flow-step-4-active')).toBeNull();
    expect(q('pm80-home-paper-flow-step-6-active')).not.toBeNull();
    cleanupUI();

    renderUI(<PM80HomeTamagui />);
    press('pm80-home-tamagui-satellite-payments');
    expect(q('pm80-home-tamagui-flow-step-8-active')).not.toBeNull();
  });

  it('the layers button opens the Business order settings route; Back goes Home (returnTo)', () => {
    renderUI(<PM80HomePaper />);
    press('pm80-home-paper-layers-btn');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: BUSINESS_ORDER_ROUTE,
      params: { projects: 'all', returnTo: '/home' },
    });
    // with a project filter the selection travels with it
    mockPush.mockClear();
    press('pm80-home-paper-project-filter');
    press('pm80-home-paper-project-filter-all');
    press('pm80-home-paper-project-filter-item-solar');
    press('pm80-home-paper-project-filter-apply');
    press('pm80-home-paper-layers-btn');
    expect(mockPush).toHaveBeenCalledWith({
      pathname: BUSINESS_ORDER_ROUTE,
      params: { projects: 'solar', returnTo: '/home' },
    });
    cleanupUI();
    renderUI(<PM80HomeTamagui />);
    mockPush.mockClear();
    press('pm80-home-tamagui-layers-btn');
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ pathname: BUSINESS_ORDER_ROUTE }));
  });

  it('the home follows the Business order setup: hidden steps are gone, the order is the user\'s, numbers are 1..n', () => {
    // hide Product receipts, move Customer invoices to the front
    let setup = setBusinessOrderVisible(defaultBusinessOrder(), 'receipts', false);
    setup = reorderBusinessOrder(setup, ['customerInvoices', ...setup.items.map((i) => i.id).filter((id) => id !== 'customerInvoices')]);
    saveBusinessOrderLocal({ organization: true, projectIds: [] }, setup);
    renderUI(<PM80HomePaper />);
    expect(q('pm80-home-paper-satellite-receipts')).toBeNull();
    expect(q('pm80-home-paper-flow-step-7')).not.toBeNull();
    expect(q('pm80-home-paper-flow-step-8')).toBeNull(); // 7 steps are shown
    expect(textOf('pm80-home-paper-satellite-customerInvoices-step')).toBe('1');
    expect(textOf('pm80-home-paper-satellite-plan-step')).toBe('2');
    // a tap on step 1 of the strip opens its real screen (Customer invoices)
    press('pm80-home-paper-flow-step-1');
    expect(mockPush).toHaveBeenCalledWith('/pm/customer-invoice/list');
  });

  it('the VAT basis button (IFRS Cost) stands UNDER the Net ROI ring; the ROI chips stay above it', () => {
    renderUI(<PM80HomePaper />);
    expectInOrder(['pm80-home-paper-chip-roi4', 'pm80-home-paper-center-hub', 'pm80-home-paper-chip-vat']);
    expect(textOf('pm80-home-paper-chip-vat')).toContain('IFRS Cost');
    press('pm80-home-paper-chip-vat');
    expect(textOf('pm80-home-paper-chip-vat')).toContain('Gross');
    cleanupUI();
    renderUI(<PM80HomeTamagui />);
    expectInOrder(['pm80-home-tamagui-chip-roi4', 'pm80-home-tamagui-center-hub', 'pm80-home-tamagui-chip-vat']);
  });

  it('the selected ROI button has a check mark inside, at its left; every name is centered', () => {
    renderUI(<PM80HomePaper />);
    expect(q('pm80-home-paper-chip-roi4-check')).not.toBeNull(); // ROI4 is selected at the start
    expect(q('pm80-home-paper-chip-roi1-check')).toBeNull();
    press('pm80-home-paper-chip-roi2');
    expect(q('pm80-home-paper-chip-roi2-check')).not.toBeNull();
    expect(q('pm80-home-paper-chip-roi4-check')).toBeNull();
    expect(textOf('pm80-home-paper-center-hub')).toContain('Delivered ROI');
    cleanupUI();
    renderUI(<PM80HomeTamagui />);
    expect(q('pm80-home-tamagui-chip-roi4-check')).not.toBeNull();
    press('pm80-home-tamagui-chip-roi3');
    expect(q('pm80-home-tamagui-chip-roi3-check')).not.toBeNull();
    expect(q('pm80-home-tamagui-chip-roi4-check')).toBeNull();
  });

  it('every ROI has a full CFO description: question, formula, sources, how to read, what misleads', () => {
    (['roi1', 'roi2', 'roi3', 'roi4'] as const).forEach((k) => {
      const i = ROI_INFO[k];
      expect(i.heading.startsWith(k.toUpperCase())).toBe(true);
      [i.question, i.inOneSentence, i.formula, i.revenue, i.cost].forEach((t) => expect(t.length).toBeGreaterThan(20));
      expect(i.howToRead.length).toBeGreaterThanOrEqual(2);
      expect(i.watchOut.length).toBeGreaterThanOrEqual(2);
    });
    expect(ROI_INFO.roi4.cost).toContain('vendor invoices');
    expect(ROI_INFO.roi2.revenue).toContain('Fact input');
    expect(ROI_INFO_COMMON.rules.join(' ')).toContain('Recoverable VAT is not a cost');
    // the worked example is the same number as the ring
    const nov = PM80_MONTH_SNAPSHOTS[0];
    const tax = { includeSaleVat: false, includePurchaseVat: false };
    (['roi1', 'roi2', 'roi3', 'roi4'] as const).forEach((k) => {
      const n = roiInfoNumbers(nov, k, tax);
      const c = computePM80Center(nov, k, tax);
      expect(n.roi).toBe(c.formattedRoiPct);
      expect(n.profit).toBe(c.formattedProfit);
      expect(n.basisLabel).toBe('IFRS Cost');
    });
    expect(roiInfoNumbers(nov, 'roi4', { includeSaleVat: true, includePurchaseVat: true }).basisLabel).toBe('Gross (+VAT)');
  });

  it('a double touch is a second touch on the same thing inside the window', () => {
    let t = 1000;
    const d = createDoubleTouch(380, () => t);
    expect(d.touch('a')).toBe(false);
    t += 200;
    expect(d.touch('a')).toBe(true);
    t += 100;
    expect(d.touch('a')).toBe(false); // a third touch starts again
    t += 100;
    expect(d.touch('b')).toBe(false); // another thing
    t += 100;
    expect(d.touch('a')).toBe(false);
    t += 400;
    expect(d.touch('a')).toBe(false); // too slow
  });

  it('a double touch on a ROI button opens its description; one touch only selects it', () => {
    renderUI(<PM80HomePaper />);
    press('pm80-home-paper-chip-roi3');
    expect(q('pm80-home-paper-roi-info')).toBeNull();
    expect(textOf('pm80-home-paper-center-hub')).toContain('Billed ROI');
    press('pm80-home-paper-chip-roi3'); // the second touch
    expect(q('pm80-home-paper-roi-info')).not.toBeNull();
    expect(textOf('pm80-home-paper-roi-info-heading')).toBe('ROI3 - Billed ROI');
    expect(textOf('pm80-home-paper-roi-info-formula')).toContain('Customer invoiced - Planned cost');
    const shown = textOf('pm80-home-paper-roi-info-result');
    expect(shown).toBe(textOf('pm80-home-paper-center-hub').match(/ROI3: [-\d.]+ %/)![0].replace('ROI3: ', ''));
    press('pm80-home-paper-roi-info-close');
    expect(q('pm80-home-paper-roi-info')).toBeNull();
    // the VAT basis of the screen is the basis of the example
    press('pm80-home-paper-chip-vat');
    press('pm80-home-paper-chip-roi4');
    press('pm80-home-paper-chip-roi4');
    expect(textOf('pm80-home-paper-roi-info-numbers')).toContain('Gross (+VAT)');
    cleanupUI();
    renderUI(<PM80HomeTamagui />);
    press('pm80-home-tamagui-chip-roi2');
    press('pm80-home-tamagui-chip-roi2');
    expect(textOf('pm80-home-tamagui-roi-info-heading')).toBe('ROI2 - Delivered ROI');
  });

  it('every KPI ring has a CFO description: question, formula, numerator, denominator, how to read, what misleads', () => {
    expect(KPI_IDS).toEqual(['budget', 'capacity', 'delivered', 'collected']);
    KPI_IDS.forEach((id) => {
      const i = KPI_INFO[id];
      [i.question, i.inOneSentence, i.formula, i.numerator, i.denominator].forEach((t) => expect(t.length).toBeGreaterThan(20));
      expect(i.howToRead.length).toBeGreaterThanOrEqual(2);
      expect(i.watchOut.length).toBeGreaterThanOrEqual(2);
    });
    expect(KPI_INFO.budget.direction).toBe('lower');
    expect(KPI_INFO.budget.numerator).toContain('vendor invoices');
    expect(KPI_INFO.delivered.numerator).toContain('Fact input');
    expect(KPI_INFO.collected.denominator).toContain('customer invoices');
  });

  it('the ring colors in the description are the bands the ring really uses', () => {
    expect(kpiBandsText('lower')).toBe('up to 90% optimal · up to 100% good · up to 110% warning · above 110% critical');
    expect(kpiBandsText('higher')).toBe('90% and more optimal · from 75% good · from 50% warning · below 50% critical');
    expect(KPI_BANDS.lowerBetter).toEqual({ optimal: 90, good: 100, warning: 110 });
    expect(statusLowerBetter(90)).toBe('optimal');
    expect(statusLowerBetter(91)).toBe('good');
    expect(statusLowerBetter(111)).toBe('critical');
    expect(statusHigherBetter(90)).toBe('optimal');
    expect(statusHigherBetter(89)).toBe('good');
    expect(statusHigherBetter(49)).toBe('critical');
  });

  it('the worked example of a KPI is the percent of the ring and the money behind it', () => {
    PM80_MONTH_SNAPSHOTS.forEach((snap) => {
      KPI_IDS.forEach((id) => {
        const n = kpiInfoNumbers(snap, id);
        const metric = snap.advancedMetrics.find((m) => m.id === id)!;
        expect(n.rows[n.rows.length - 1][1]).toContain(metric.valueText); // the last row IS the ring
        expect(n.caption).toContain(snap.monthLabel);
      });
    });
    const nov = PM80_MONTH_SNAPSHOTS[0];
    expect(kpiInfoNumbers(nov, 'budget').rows.map((r) => r[0])).toEqual(['Planned cost', 'Fact cost', 'Budget left', 'Budget used']);
    expect(kpiInfoNumbers(nov, 'delivered').rows[2][1]).toBe('€180,000'); // 690K planned - 510K delivered
    expect(kpiInfoNumbers(nov, 'collected').rows[0][1]).toBe('€707,000');
    expect(kpiInfoNumbers(nov, 'collected').rows[2][1]).toBe('€209,000'); // 707K - 498K
    expect(kpiInfoContent('budget', nov).sections.map((s) => s.title)).toContain('Watch out');
  });

  it('a double touch on the NAME of a KPI ring opens its description; one touch only shows the short card', () => {
    renderUI(<PM80HomePaper />);
    press('pm80-home-paper-metric-delivered');
    expect(q('pm80-home-paper-kpi-info')).toBeNull();
    expect(q('pm80-home-paper-inspector-card')).not.toBeNull(); // the short card of one touch stays
    press('pm80-home-paper-metric-delivered'); // the second touch
    expect(q('pm80-home-paper-kpi-info')).not.toBeNull();
    expect(textOf('pm80-home-paper-kpi-info-heading')).toBe('Delivered');
    expect(textOf('pm80-home-paper-kpi-info-formula')).toBe('Revenue fact input / Planned revenue');
    expect(textOf('pm80-home-paper-kpi-info-result')).toContain('74%');
    press('pm80-home-paper-kpi-info-close');
    expect(q('pm80-home-paper-kpi-info')).toBeNull();
    // another ring: a touch on delivered then on budget is not a double touch
    press('pm80-home-paper-metric-delivered');
    press('pm80-home-paper-metric-budget');
    expect(q('pm80-home-paper-kpi-info')).toBeNull();
    cleanupUI();
    renderUI(<PM80HomeTamagui />);
    press('pm80-home-tamagui-metric-collected');
    press('pm80-home-tamagui-metric-collected');
    expect(textOf('pm80-home-tamagui-kpi-info-heading')).toBe('Collected');
    expect(textOf('pm80-home-tamagui-kpi-info-numbers')).toContain('Still to collect');
  });
});
