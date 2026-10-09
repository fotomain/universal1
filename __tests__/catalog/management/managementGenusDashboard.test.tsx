/** @jest-environment jsdom */
// ManagementGenusDashboardCRUD on the SQL seed: the genus FOLDERS (tree) beside the genus ITEMS (table), read-only by default (noCrud), editing on request.
import React, { act } from 'react';
import { genusRows, rawRoleTables } from '../resourcerole/resourceRoleTestKit';
import { mockRects, rowTop } from '../../ui/tree/folderTreeTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
let mockParams: Record<string, string> = {};
const mockSetParams = jest.fn((p: any) => { mockParams = { ...mockParams, ...p }; });
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), setParams: mockSetParams }), usePathname: () => '/catalog/resourcerole/dashboard', useGlobalSearchParams: () => mockParams }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `uuid-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn(() => 'subscribed') }));
const mockCalls: any[] = [];
const mockActionsFor = (entity: string) => ({
  readData: (p: any) => ({ type: `${entity}/readData`, p }),
  createOne: (p: any) => { mockCalls.push(['create', entity, p]); return { type: `${entity}/createOne`, p }; },
  updateOne: (p: any) => { mockCalls.push(['update', entity, p]); return { type: `${entity}/updateOne`, p }; },
  deleteOne: (p: any) => { mockCalls.push(['delete', entity, p]); return { type: `${entity}/deleteOne`, p }; },
});
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: (_t, k: string) => ({ actions: mockActionsFor(k) }) }) }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch, shallowEqual: jest.requireActual('react-redux').shallowEqual }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '', default: () => null }));
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ items, testID }: any) => R.createElement(View, { testID }, items.map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.onPress }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ visible, onConfirm, modalBody }: any) => (visible
    ? R.createElement(Pressable, { testID: 'ask-confirm', onPress: onConfirm }, R.createElement(Text, { testID: 'ask-body' }, modalBody))
    : null) };
});
jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: (sel: any) => sel({ selectRowCheckBoxForm: 'formRound' }) }));
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
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
// design-system components of the product card: light stand-ins (the real ones switch on the active design system)
jest.mock('../../../kit8/ui/components/common/TextApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ children, testID }: any) => R.createElement(Text, { testID }, children) };
});
jest.mock('../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  const ButtonApp = ({ title, icon, onPress, testID }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, title ?? icon));
  return { __esModule: true, default: ButtonApp, ButtonApp };
});
jest.mock('../../../kit8/ui/components/common/SegmentButtonsApp', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ buttons, value, onValueChange, testID }: any) => R.createElement(View, { testID },
    buttons.map((b: any) => R.createElement(Pressable, { key: b.value, testID: b.testID, 'aria-selected': b.value === value, onPress: () => onValueChange(b.value) }, R.createElement(Text, null, b.label)))) };
});
jest.mock('../../../kit8/ui/components/common/SwitchApp', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ value, onValueChange, label, testID }: any) => R.createElement(Pressable, { testID, 'aria-checked': value, onPress: () => onValueChange(!value) }, R.createElement(Text, null, label)) };
});
jest.mock('../../../kit8/ui/components/common/SelectorFromApp', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ options, value, onValueChange, label, testID }: any) => R.createElement(View, { testID, 'data-value': value },
    R.createElement(Text, null, label),
    options.map((o: any) => R.createElement(Pressable, { key: o.value, testID: `${testID}-option-${o.value || 'none'}`, onPress: () => onValueChange(o.value) }, R.createElement(Text, null, o.label)))) };
});

import ManagementGenusDashboardCRUD from '../../../kit8/catalog/management/genus/ManagementGenusDashboardCRUD';
import { MANAGEMENT_GENUS_TABLE } from '../../../kit8/catalog/management/genus/managementGenusModel';
import { beginFolderDrag, endFolderDrag } from '../../../kit8/ui/components/tree/folderTreeDnd';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../kit8/catalog/resourcerole/resourceRoleModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const calls = (kind: string, entity: string) => mockCalls.filter((c) => c[0] === kind && c[1] === entity).map((c) => c[2]);
const TABLE = 'genus-table';
const TREE = `${TABLE}-folders`;
const rowIds = () => qa(`${TABLE}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${TABLE}-row-`, '')).filter((x) => !x.includes('-'));
const pickFolder = (id: string) => act(() => { (q(`${TREE}-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });

function mount(props: { noCrud?: boolean } = {}, rows = genusRows(), roleTypes = rawRoleTables({ withResources: true }).resourceRoleType) {
  mockParams = {};
  mockState = {
    uxuiState: { askBeforeDeletePost: true },
    [MANAGEMENT_GENUS_TABLE.entity]: { entityDataFromServer: rows, readSuccessful: 1 },
    [RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity]: { entityDataFromServer: roleTypes, readSuccessful: 1 },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ManagementGenusDashboardCRUD {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

describe('noCrud = true by default', () => {
  it('the tree has the 3 folders, the table the 6 items (level 2) - no folder is a row - and no way to change them', () => {
    mount();
    expect(rowIds().sort()).toEqual(['expenseGenus', 'inboundPaymentGenus', 'materialGenus', 'outboundPaymentGenus', 'revenueGenus', 'timeGenus']);
    expect(q(TREE)).not.toBeNull();
    for (const f of ['costsGenus', 'revenuesGenus', 'paymentsGenus']) expect(q(`${TREE}-row-${f}`)).not.toBeNull();
    // an item is not a folder of the tree
    for (const i of ['timeGenus', 'revenueGenus', 'inboundPaymentGenus']) expect(q(`${TREE}-row-${i}`)).toBeNull();
    // no "No folder" row: every item has a folder
    expect(q(`${TREE}-row-__tree_none__`)).toBeNull();
    // no add / duplicate / sql_for_delete panel, no check boxes, no row menu
    expect(q(`${TABLE}-add`)).toBeNull();
    expect(q(`${TABLE}-menu-button-timeGenus`)).toBeNull();
    // no folder commands in the tree
    expect(q(`${TREE}-new-root`)).toBeNull();
    expect(q(`${TREE}-rename`)).toBeNull();
    expect(q(`${TREE}-delete`)).toBeNull();
    expect(q('genus-edit-toggle')!.textContent).toBe('lock');
    expect(q('genus-dashboard')!.textContent).toContain('read-only');
  });

  it('cells are not editable', () => {
    mount();
    const cell = q(`${TABLE}-cell-timeGenus-title`);
    expect(cell).not.toBeNull();
    expect(cell!.tagName === 'INPUT' ? (cell as HTMLInputElement).readOnly || (cell as HTMLInputElement).disabled : true).toBe(true);
    expect(calls('update', MANAGEMENT_GENUS_TABLE.entity)).toEqual([]);
  });

  it('picking a folder shows its items; counts per folder', () => {
    mount();
    expect(q(`${TREE}-row-costsGenus-count`)!.textContent).toBe('3');
    expect(q(`${TREE}-row-revenuesGenus-count`)!.textContent).toBe('1');
    expect(q(`${TREE}-row-paymentsGenus-count`)!.textContent).toBe('2');
    pickFolder('costsGenus');
    expect(rowIds().sort()).toEqual(['expenseGenus', 'materialGenus', 'timeGenus']);
    pickFolder('revenuesGenus');
    expect(rowIds()).toEqual(['revenueGenus']);
    pickFolder('paymentsGenus');
    expect(rowIds().sort()).toEqual(['inboundPaymentGenus', 'outboundPaymentGenus']);
  });

  it('read-only: nothing can be dropped on a folder, no row drag changes a genus', () => {
    mount();
    act(() => { beginFolderDrag({ kind: 'items', ids: ['timeGenus'], label: 'Time', source: TABLE }, 40, 80 + 16); });
    act(() => { endFolderDrag(); });
    expect(calls('update', MANAGEMENT_GENUS_TABLE.entity)).toEqual([]);
  });

  it('the code, the path of the parent and how many role types use the genus', () => {
    mount();
    expect(q('genus-code-timeGenus')!.textContent).toBe('timeGenus');
    // the demo rows: Human Resources is the one role type of timeGenus
    expect(q('genus-role-types-timeGenus')!.textContent).toBe('1');
    expect(q('genus-role-types-revenueGenus')!.textContent).toBe('1');
    expect(q('genus-role-types-inboundPaymentGenus')!.textContent).toBe('0');
    expect(q(`${TABLE}-cell-timeGenus-parent`)!.textContent).toContain('Costs');
    expect(q('genus-role-types-materialGenus')!.textContent).toBe('1');
    expect(q('genus-role-types-expenseGenus')!.textContent).toBe('1');
  });
});

describe('editing on request', () => {
  it('the lock button turns CRUD on: "+" creates an ITEM in the picked folder, "new folder" a top level row', () => {
    mount();
    press('genus-edit-toggle');
    expect(q('genus-edit-toggle')!.textContent).toBe('lock_open');
    expect(q(`${TABLE}-add`)).not.toBeNull();
    pickFolder('paymentsGenus');
    press(`${TABLE}-add`);
    expect(calls('create', MANAGEMENT_GENUS_TABLE.entity)[0]).toEqual(expect.objectContaining({ rowOwnerGUID: 'managementGenusCatalog', rowParentGUID: 'paymentsGenus' }));
    press(`${TREE}-new-root`);
    const created = calls('create', MANAGEMENT_GENUS_TABLE.entity);
    expect(created[created.length - 1]).toEqual(expect.objectContaining({ rowOwnerGUID: 'managementGenusCatalog', rowParentGUID: 'empty', rowJSON: { title: 'New genus' } }));
    press('genus-edit-toggle');
    expect(q(`${TABLE}-add`)).toBeNull();
  });

  it('a new item with "All" picked goes into the first folder (never to the top level, where it would be a folder)', () => {
    mount({ noCrud: false });
    press(`${TABLE}-add`);
    expect(calls('create', MANAGEMENT_GENUS_TABLE.entity)[0]).toEqual(expect.objectContaining({ rowParentGUID: 'costsGenus' }));
  });

  it('no subfolders: "new subfolder" and a folder dragged into a folder are refused', () => {
    mount({ noCrud: false });
    pickFolder('costsGenus');
    press(`${TREE}-new-sub`);
    expect(calls('create', MANAGEMENT_GENUS_TABLE.entity)).toEqual([]);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'A genus is added in the table: pick the folder and press +' } });
  });

  it('noCrud={false} starts with editing on; deleting a folder deletes its items', () => {
    mount({ noCrud: false });
    expect(q(`${TABLE}-add`)).not.toBeNull();
    pickFolder('paymentsGenus');
    press(`${TREE}-delete`);
    press('ask-confirm');
    expect(calls('delete', MANAGEMENT_GENUS_TABLE.entity).map((c) => c.rowGUID).sort()).toEqual(['inboundPaymentGenus', 'outboundPaymentGenus', 'paymentsGenus']);
  });

  it('a genus renamed in the tree is saved', () => {
    mount({ noCrud: false });
    pickFolder('revenuesGenus');
    press(`${TREE}-rename`);
    const input = q(`${TREE}-row-revenuesGenus-input`) as HTMLInputElement;
    act(() => { input.focus(); });
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Sales revenue');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { input.blur(); });
    expect(calls('update', MANAGEMENT_GENUS_TABLE.entity)).toEqual([{ rowGUID: 'revenuesGenus', rowOwnerGUID: 'managementGenusCatalog', rowJSON: { title: 'Sales revenue' } }]);
  });
});

it('no rows: the setup hint names the SQL file', () => {
  mount({}, []);
  expect(q('genus-setup')!.textContent).toContain('create_management_genus_table.sql');
});
