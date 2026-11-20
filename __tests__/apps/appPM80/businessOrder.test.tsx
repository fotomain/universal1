/** @jest-environment jsdom */
// Business order setup of the PM80 home: the pure rules (businessOrderModel) and the settings screen (ReusableTable in local rows
// mode, no add / delete, names read only, Defaults, Save to the right places).
import React from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../../pm/ui/pmUiTestKit';
import {
  PM80_MONTH_SNAPSHOTS,
  PM80_PROJECTS,
  pm80ProjectsFromRows,
} from '../../../apps/appPM80/home/pm80HomeModel';
import {
  BUSINESS_ORDER_KEY,
  applyBusinessOrder,
  businessOrderEquals,
  businessOrderRouteParams,
  businessOrderScopeText,
  businessOrderTargets,
  defaultBusinessOrder,
  isDefaultBusinessOrder,
  normalizeBusinessOrder,
  parseSelectionParam,
  reorderBusinessOrder,
  resolveBusinessOrder,
  selectionParam,
  setBusinessOrderVisible,
  storedBusinessOrder,
} from '../../../apps/appPM80/home/businessOrder/businessOrderModel';

const ids = (s: { items: Array<{ id: string }> }) => s.items.map((i) => i.id);

describe('businessOrderModel', () => {
  it('the default is all 8 steps, in the business order of the app, all shown', () => {
    const d = defaultBusinessOrder();
    expect(ids(d)).toEqual(['plan', 'orders', 'receipts', 'timesheets', 'fact', 'vendorInvoices', 'customerInvoices', 'payments']);
    expect(d.items.every((i) => i.visible)).toBe(true);
    expect(isDefaultBusinessOrder(d)).toBe(true);
  });

  it('normalize: unknown steps dropped, doubles once, missing steps appended shown, garbage = defaults', () => {
    expect(normalizeBusinessOrder(null)).toEqual(defaultBusinessOrder());
    expect(normalizeBusinessOrder({ items: 'x' })).toEqual(defaultBusinessOrder());
    const n = normalizeBusinessOrder({ items: [{ id: 'payments', visible: false }, { id: 'nope' }, { id: 'payments' }, { id: 'plan' }] });
    expect(ids(n).slice(0, 2)).toEqual(['payments', 'plan']);
    expect(n.items).toHaveLength(8);
    expect(n.items[0].visible).toBe(false); // the first of a double counts
    expect(n.items.slice(2).every((i) => i.visible)).toBe(true); // the missing ones come back shown
    expect(storedBusinessOrder({ [BUSINESS_ORDER_KEY]: { items: [] } })).not.toBeNull();
    expect(storedBusinessOrder({})).toBeNull();
    expect(storedBusinessOrder(null)).toBeNull();
  });

  it('hiding keeps the step in the user order; moving keeps the check boxes', () => {
    let s = setBusinessOrderVisible(defaultBusinessOrder(), 'orders', false);
    expect(ids(s)).toEqual(ids(defaultBusinessOrder())); // still there, same place
    s = reorderBusinessOrder(s, ['payments', 'plan', 'orders', 'receipts', 'timesheets', 'fact', 'vendorInvoices', 'customerInvoices']);
    expect(ids(s)[0]).toBe('payments');
    expect(s.items.find((i) => i.id === 'orders')!.visible).toBe(false);
    expect(businessOrderEquals(s, defaultBusinessOrder())).toBe(false);
    expect(isDefaultBusinessOrder(s)).toBe(false);
  });

  it('applyBusinessOrder: shown steps in the user order, numbered 1..n, on the places in reading order', () => {
    let s = setBusinessOrderVisible(defaultBusinessOrder(), 'receipts', false);
    s = reorderBusinessOrder(s, ['payments', ...ids(s).filter((x) => x !== 'payments')]);
    const snap = applyBusinessOrder(PM80_MONTH_SNAPSHOTS[0], s);
    expect(snap.satellites.map((n) => n.id)).toEqual(['payments', 'plan', 'orders', 'timesheets', 'fact', 'vendorInvoices', 'customerInvoices']);
    expect(snap.satellites.map((n) => n.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(snap.satellites.map((n) => n.position)).toEqual(['top-left', 'top-right', 'mid-left', 'mid-right', 'lower-left', 'lower-right', 'bottom-left']);
    // the money of a step did not change
    expect(snap.satellites[0].factAmount).toBe(PM80_MONTH_SNAPSHOTS[0].satellites.find((n) => n.id === 'payments')!.factAmount);
    // the KPI rings and the center are untouched
    expect(snap.advancedMetrics).toBe(PM80_MONTH_SNAPSHOTS[0].advancedMetrics);
  });

  it('what the home shows: ONE project = its own, else the organization, else the defaults; SOME / ALL = the organization', () => {
    const org = setBusinessOrderVisible(defaultBusinessOrder(), 'plan', false);
    const proj = setBusinessOrderVisible(defaultBusinessOrder(), 'fact', false);
    const stored = { organization: org, projects: { a: proj } };
    expect(resolveBusinessOrder(['a'], stored)).toBe(proj);
    expect(resolveBusinessOrder(['b'], stored)).toBe(org); // b has none: the organization's
    expect(resolveBusinessOrder(['a', 'b'], stored)).toBe(org);
    expect(resolveBusinessOrder(null, stored)).toBe(org);
    expect(isDefaultBusinessOrder(resolveBusinessOrder(['b'], { organization: null, projects: {} }))).toBe(true);
  });

  it('where a save goes: ONE project -> it, SOME -> each, ALL -> the organization and each project', () => {
    const all = ['a', 'b', 'c'];
    expect(businessOrderTargets(['b'], all)).toEqual({ organization: false, projectIds: ['b'] });
    expect(businessOrderTargets(['a', 'c'], all)).toEqual({ organization: false, projectIds: ['a', 'c'] });
    expect(businessOrderTargets(null, all)).toEqual({ organization: true, projectIds: ['a', 'b', 'c'] });
    expect(businessOrderScopeText(null, 12)).toContain('organization and in each project');
    expect(businessOrderScopeText(['a'], 12, 'Solar')).toContain('One project (Solar)');
    expect(businessOrderScopeText(['a', 'b'], 12)).toBe('2 of 12 projects: saved in each of them');
  });

  it('the selection travels as one route parameter', () => {
    expect(selectionParam(null)).toBe('all');
    expect(selectionParam(['a', 'b'])).toBe('a,b');
    expect(parseSelectionParam('all')).toBeNull();
    expect(parseSelectionParam('')).toBeNull();
    expect(parseSelectionParam(undefined)).toBeNull();
    expect(parseSelectionParam('a, b')).toEqual(['a', 'b']);
    expect(parseSelectionParam(['x,y'])).toEqual(['x', 'y']);
    expect(businessOrderRouteParams(['a'])).toEqual({ projects: 'a', returnTo: '/home' });
  });

  it('real projects: the shares add up to exactly 1000 permille for any number of projects', () => {
    [1, 2, 3, 7, 12, 40].forEach((n) => {
      const rows = Array.from({ length: n }, (_, i) => ({ rowGUID: `guid-${i}-${n}`, rowJSON: { name: `P${i}` } }));
      const list = pm80ProjectsFromRows(rows);
      expect(list.reduce((a, p) => a + p.costPermille, 0)).toBe(1000);
      expect(list.reduce((a, p) => a + p.revPermille, 0)).toBe(1000);
      expect(list.every((p) => p.costPermille >= 0 && p.revPermille >= 0)).toBe(true);
    });
    expect(pm80ProjectsFromRows([])).toEqual([]);
    expect(PM80_PROJECTS).toHaveLength(12); // the demo list is untouched
    // stable: the same ids give the same shares
    const a = pm80ProjectsFromRows([{ rowGUID: 'x' }, { rowGUID: 'y' }]);
    const b = pm80ProjectsFromRows([{ rowGUID: 'x' }, { rowGUID: 'y' }]);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------------------------------------------- the screen
const mockTable: { props: any } = { props: null };
const mockSave = jest.fn();
let mockStored = defaultBusinessOrder();

jest.doMock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ themeColors: { text: '#000', primary: '#63f', error: '#d00', background: '#fff', surface: '#fff', border: '#ccc' } }),
}));
jest.doMock('../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ testID, title, onPress, disabled }: any) =>
      R.createElement(Pressable, { testID, onPress: disabled ? undefined : onPress }, R.createElement(Text, null, `${title}${disabled ? ' (off)' : ''}`)),
  };
});
jest.doMock('../../../kit8/ui/components/table/reusable/ReusableTable', () => {
  const R = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => {
      mockTable.props = props;
      return R.createElement(View, { testID: props.testID }, props.localRows.map((r: any) => R.createElement(Text, { key: r.rowGUID, testID: `row-${r.rowGUID}` }, `${r.orderInList}.${r.rowJSON.checked ? 'x' : '-'}.${r.rowJSON.title}`)));
    },
  };
});
jest.doMock('../../../kit8/pm/i18n/pmT', () => ({
  pmT: (t: string, v?: Record<string, string | number>) => (v ? t.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (v[k] !== undefined ? String(v[k]) : m)) : t),
}));
jest.doMock('../../../apps/appPM80/home/businessOrder/useBusinessOrder', () => ({
  usePM80Projects: () => ({ projects: require('../../../apps/appPM80/home/pm80HomeModel').PM80_PROJECTS, real: false, rows: [], ownerGUID: '' }),
  useBusinessOrderFor: () => mockStored,
  useSaveBusinessOrder: () => mockSave,
}));

const PM80BusinessOrderSettings = require('../../../apps/appPM80/home/businessOrder/PM80BusinessOrderSettings').default;
const { businessOrderRows, businessOrderFromRows, reportText } = require('../../../apps/appPM80/home/businessOrder/PM80BusinessOrderSettings');
const act = require('react').act as (cb: () => void) => void;

describe('PM80BusinessOrderSettings screen', () => {
  let widthSpy: jest.SpyInstance;
  const setWidth = (w: number) => widthSpy.mockReturnValue({ width: w, height: 800, scale: 2, fontScale: 1 });
  beforeEach(() => {
    widthSpy = jest.spyOn(require('react-native'), 'useWindowDimensions');
    setWidth(900); // a wide window unless a test says otherwise
    mockStored = defaultBusinessOrder();
    mockSave.mockReset();
    mockSave.mockResolvedValue({ ok: true, savedOrganization: true, savedProjects: ['a'], localOnly: [], failures: [] });
  });
  afterEach(() => {
    widthSpy.mockRestore();
    cleanupUI();
  });

  it('is a ReusableTable on local rows: no add, no delete, reorder on, the names are read only', () => {
    renderUI(<PM80BusinessOrderSettings selection={null} />);
    const p = mockTable.props;
    expect(p.addEnabled).toBe(false);
    expect(p.deleteEnabled).toBe(false);
    expect(p.reorderEnabled).toBe(true);
    expect(p.localRows).toHaveLength(8);
    const byKey = Object.fromEntries(p.visualColumns.map((c: any) => [c.key, c]));
    expect(byKey.checked.type).toBe('boolean');
    expect(byKey.title.editable).toBe(false);
    expect(byKey.stage.editable).toBe(false);
    expect(textOf('row-plan')).toBe('1.x.Project plan');
    expect(textOf('pm80-business-order-scope')).toContain('All projects (12)');
    // a sorted / searched list would hide the user's order: no search, no sort
    expect(p.searchEnabled).toBe(false);
    expect(p.columnSortAndFilter).toBe(false);
  });

  it('the Home settings radio sets (items in the first row, items form) are at the top of the screen', () => {
    renderUI(<PM80BusinessOrderSettings selection={null} />);
    const { getHomeSettingsLocal, resetHomeSettingsLocal } = require('../../../apps/appPM80/home/homeSettings/homeSettingsLocal');
    resetHomeSettingsLocal();
    expect(q('pm80-business-order-home-settings')).not.toBeNull();
    press('pm80-business-order-home-settings-perRow-4');
    expect(getHomeSettingsLocal().itemsPerRow).toBe(4);
    press('pm80-business-order-home-settings-shape-square');
    expect(getHomeSettingsLocal().itemShape).toBe('square');
    resetHomeSettingsLocal();
  });

  it('a phone: two columns that fit the width (Show, Step)', () => {
    setWidth(369);
    renderUI(<PM80BusinessOrderSettings selection={null} />);
    const cols = mockTable.props.visualColumns;
    expect(cols.map((c: any) => c.key)).toEqual(['checked', 'title']);
    expect(cols.reduce((a: number, c: any) => a + c.width, 0) + 160).toBeLessThanOrEqual(369);
    expect(textOf('row-orders')).toBe('2.x.Purchase orders');
  });

  it('a check box and a move make the draft; Save is for a change; Defaults brings the default setup back', async () => {
    renderUI(<PM80BusinessOrderSettings selection={null} />);
    expect(q('pm80-business-order-unsaved')).toBeNull();
    expect(textOf('pm80-business-order-save')).toContain('(off)'); // nothing changed
    expect(textOf('pm80-business-order-defaults')).toContain('(off)'); // already the default

    // untick Product receipts, move Payments to the top
    const rows = businessOrderRows(defaultBusinessOrder()).map((r: any) => ({ ...r }));
    rows.find((r: any) => r.rowGUID === 'receipts').rowJSON = { ...rows.find((r: any) => r.rowGUID === 'receipts').rowJSON, checked: false };
    rows.find((r: any) => r.rowGUID === 'payments').orderInList = 0;
    act(() => mockTable.props.onLocalRowsChange(rows));
    expect(textOf('row-payments')).toBe('1.x.Cash payments');
    expect(textOf('row-receipts')).toContain('-'); // not shown, but still in its place of the order
    expect(q('pm80-business-order-unsaved')).not.toBeNull();
    expect(textOf('pm80-business-order-count')).toBe('7 of 8 steps are shown');
    expect(textOf('pm80-business-order-save')).not.toContain('(off)');

    press('pm80-business-order-defaults');
    expect(textOf('row-plan')).toBe('1.x.Project plan');
    expect(textOf('pm80-business-order-count')).toBe('8 of 8 steps are shown');
    expect(q('pm80-business-order-unsaved')).toBeNull();
  });

  it('Save sends the draft and the selection; the message tells where it went', async () => {
    renderUI(<PM80BusinessOrderSettings selection={['solar']} />);
    expect(textOf('pm80-business-order-scope')).toContain('One project (Solar Roof Pilot)');
    const rows = businessOrderRows(defaultBusinessOrder()).map((r: any) => ({ ...r }));
    rows[0].rowJSON = { ...rows[0].rowJSON, checked: false };
    act(() => mockTable.props.onLocalRowsChange(rows));
    await act(async () => {
      press('pm80-business-order-save');
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const [settings, selection] = mockSave.mock.calls[0];
    expect(selection).toEqual(['solar']);
    expect(settings.items.find((i: any) => i.id === 'plan').visible).toBe(false);
    expect(textOf('pm80-business-order-message')).toContain('saved in the organization');
  });

  it('with no step shown Save is off and the screen says why', () => {
    renderUI(<PM80BusinessOrderSettings selection={null} />);
    const rows = businessOrderRows(defaultBusinessOrder()).map((r: any) => ({ ...r, rowJSON: { ...r.rowJSON, checked: false } }));
    act(() => mockTable.props.onLocalRowsChange(rows));
    expect(q('pm80-business-order-none')).not.toBeNull();
    expect(textOf('pm80-business-order-save')).toContain('(off)');
  });

  it('rows <-> settings: the order is orderInList, the check box is rowJSON.checked', () => {
    const rows = businessOrderRows(defaultBusinessOrder());
    expect(rows.map((r: any) => r.orderInList)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const swapped = rows.map((r: any) => (r.rowGUID === 'plan' ? { ...r, orderInList: 99 } : r));
    expect(ids(businessOrderFromRows(swapped, defaultBusinessOrder())).pop()).toBe('plan');
  });

  it('the save report in words', () => {
    expect(reportText({ ok: true, savedOrganization: true, savedProjects: ['a', 'b'], localOnly: [], failures: [] })).toContain('saved in the organization; saved in 2 project(s)');
    const r = reportText({ ok: false, savedOrganization: false, savedProjects: [], localOnly: ['organization'], failures: [{ target: 'organization', error: 'No organization: sign in first.' }] });
    expect(r).toContain('kept on this device');
    expect(r).toContain('sign in first');
  });
});
