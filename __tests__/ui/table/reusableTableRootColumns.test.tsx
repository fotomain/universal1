/** @jest-environment jsdom */
// ReusableTable: any root column as a cell target (a number, a date), fromStored, the calendar date cell (picker), addEnabled = false (no new row).
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/x', useGlobalSearchParams: () => ({}) }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: 'rgb(231, 224, 236)' } }), TextInput: () => null, HelperText: () => null }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
const mockActions = {
  readData: jest.fn((p: any) => ({ type: 'read', p })),
  createOne: jest.fn((p: any) => ({ type: 'create', p })),
  updateOne: jest.fn((p: any) => ({ type: 'update', p })),
  deleteOne: jest.fn((p: any) => ({ type: 'delete', p })),
};
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { thing: { get actions() { return mockActions; } } } }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: () => '', default: () => null }));
const mockMenus: Record<string, any[]> = {};
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: (p: any) => { mockMenus[p.testID] = p.items; return null; } }));
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, ...p }: any) => R.createElement(TextInput, p) };
});
// the calendar field: a text input with the commit hooks + a button that "picks" 2026-12-24
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput, Pressable } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, onSelectDate, onSubmitEditing }: any) => R.createElement(R.Fragment, null,
    R.createElement(TextInput, { testID, value, onChangeText, onSubmitEditing }),
    R.createElement(Pressable, { testID: `${testID}-pick`, onPress: () => onSelectDate(new Date(2026, 11, 24)) })) };
});
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));

import ReusableTable from '../../../kit8/ui/components/table/reusable/ReusableTable';
import { cellPatch, cellValue } from '../../../kit8/ui/components/table/reusable/tableRows';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const type = (id: string, text: string) => act(() => {
  const el = q(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const enter = (id: string) => act(() => { q(id)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
const T = 'ft';

// a fact line: real columns rowPeriodDatetime (timestamptz) and qtyForContract next to rowJSON
const columns: VisualColumn[] = [
  { key: 'n', title: '#', type: 'rowNumber' },
  { key: 'day', title: 'Date', type: 'date', picker: true, target: 'rowPeriodDatetime', fromStored: (v) => (v ? String(v).slice(0, 10) : null) },
  { key: 'qty', title: 'Qty', type: 'number', target: 'qtyForContract', stepper: false },
  { key: 'planned', title: 'Planned', type: 'number', target: 'qtyForBudget', editable: false, stepper: false },
  { key: 'price', title: 'Price', type: 'number', field: 'priceTaskLine', stepper: false, total: false },
];
const rows = [
  { rowGUID: 'a', rowOwnerGUID: 'task', orderInList: 1, rowPeriodDatetime: '2026-10-14T00:00:00+00:00', qtyForContract: 6, qtyForBudget: 8, rowJSON: { priceTaskLine: 10 } },
  { rowGUID: 'b', rowOwnerGUID: 'task', orderInList: 2, rowPeriodDatetime: '2026-10-15T00:00:00+00:00', qtyForContract: 2, qtyForBudget: 2, rowJSON: { priceTaskLine: 5 } },
];
function mount(props: any = {}) {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: { entityDataFromServer: rows, readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" listOwnerGUID="task" listParentGUID="*" visualColumns={columns} {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); Object.keys(mockMenus).forEach((k) => delete mockMenus[k]); });

describe('pure: any root column as a target', () => {
  it('cellValue reads the root column and applies fromStored; "empty" is only the marker of owner / parent', () => {
    expect(cellValue(rows[0] as any, columns[1])).toBe('2026-10-14');
    expect(cellValue(rows[0] as any, columns[2])).toBe(6);
    expect(cellValue({ rowGUID: 'x', rowPeriodDatetime: null } as any, columns[1])).toBeNull();
        expect(cellValue({ rowGUID: 'x', rowParentGUID: 'empty' } as any, { key: 'p', title: 'p', type: 'text', target: 'rowParentGUID' })).toBeNull();
  });
  it('cellPatch: a number / date goes to columns as given, nothing = null (not "empty")', () => {
    expect(cellPatch(columns, 'qty', 7)).toEqual({ rowJSON: {}, columns: { qtyForContract: 7 } });
    expect(cellPatch(columns, 'qty', null)).toEqual({ rowJSON: {}, columns: { qtyForContract: null } });
    expect(cellPatch(columns, 'day', '2026-12-24')).toEqual({ rowJSON: {}, columns: { rowPeriodDatetime: '2026-12-24' } });
    expect(cellPatch(columns, 'price', 12)).toEqual({ rowJSON: { priceTaskLine: 12 }, columns: {} });
    // the usual two keep their marker
    const withOwner: VisualColumn[] = [{ key: 'o', title: 'o', type: 'text', target: 'rowOwnerGUID' }];
    expect(cellPatch(withOwner, 'o', null)).toEqual({ rowJSON: {}, columns: { rowOwnerGUID: 'empty' } });
  });
});

describe('the table', () => {
  it('shows the root columns: the day (fromStored) and the numbers; the footer adds the numbers', () => {
    mount();
    expect((q(`${T}-cell-a-day`) as HTMLInputElement).value).toBe('2026-10-14');
    expect((q(`${T}-cell-a-qty`) as HTMLInputElement).value).toBe('6');
    expect(q(`${T}-cell-a-planned`)!.textContent).toBe('8');
    expect(q(`${T}-total-qty`)!.textContent).toBe('8');
  });
  it('a number root column is saved with updateOne({ columns: { qtyForContract } })', () => {
    mount();
    type(`${T}-cell-a-qty`, '7.5');
    act(() => { const el = q(`${T}-cell-a-qty`) as HTMLInputElement; el.focus(); el.blur(); });
    expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'a', rowOwnerGUID: 'task', columns: { qtyForContract: 7.5 } });
  });
  it('a rowJSON column next to it is a rowJSON patch', () => {
    mount();
    type(`${T}-cell-a-price`, '12');
    act(() => { const el = q(`${T}-cell-a-price`) as HTMLInputElement; el.focus(); el.blur(); });
    expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'a', rowOwnerGUID: 'task', rowJSON: { priceTaskLine: 12 } });
  });
  it('the calendar date cell: picked in the calendar → the root column rowPeriodDatetime', () => {
    mount();
    press(`${T}-cell-a-day-pick`);
    expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'a', rowOwnerGUID: 'task', columns: { rowPeriodDatetime: '2026-12-24' } });
  });
  it('the calendar date cell: typed in another form and confirmed with Enter → written as YYYY-MM-DD', () => {
    mount();
    type(`${T}-cell-b-day`, '20.11.2026');
    enter(`${T}-cell-b-day`);
    expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'b', rowOwnerGUID: 'task', columns: { rowPeriodDatetime: '2026-11-20' } });
  });
  it('a date that is not a day is refused with the message of the table and saves nothing', () => {
    mount();
    type(`${T}-cell-b-day`, '2026-02-31');
    enter(`${T}-cell-b-day`);
    expect(mockActions.updateOne).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'snackbar' }));
  });
  it('a read-only root column (editable: false) is text, not an input', () => {
    mount();
    expect(q(`${T}-cell-a-planned`)!.tagName).not.toBe('INPUT');
  });
});

describe('addEnabled = false: the lines come from elsewhere, nothing new can be made', () => {
  it('default: the add buttons are there', () => {
    mount();
    expect(q(`${T}-add`)).not.toBeNull();
    expect(q(`${T}-add-first`)).not.toBeNull();
    expect(q(`${T}-duplicate-selected`)).not.toBeNull();
  });
  it('false: no add, no add first, no duplicate; delete stays', () => {
    mount({ addEnabled: false });
    expect(q(`${T}-add`)).toBeNull();
    expect(q(`${T}-add-first`)).toBeNull();
    expect(q(`${T}-duplicate-selected`)).toBeNull();
    expect(q(`${T}-delete-selected`)).not.toBeNull();
  });
  it('the row menu: no add above / below / duplicate - the others are there', () => {
    mount({ addEnabled: false });
    press(`${T}-menu-button-a`);
    const labels = (mockMenus[`${T}-menu`] || []).map((i: any) => i.label);
    expect(labels.some((l: string) => /^Add /.test(l) || l === 'Duplicate')).toBe(false);
    expect(labels).toContain('Delete');
    expect(labels).toContain('Copy GUID');
  });
  it('true: the row menu has them', () => {
    mount();
    press(`${T}-menu-button-a`);
    const labels = (mockMenus[`${T}-menu`] || []).map((i: any) => i.label);
    expect(labels).toContain('Duplicate');
    expect(labels.some((l: string) => /^Add /.test(l))).toBe(true);
  });
});
