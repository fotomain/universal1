/** @jest-environment jsdom */
// ResourceRoleDashboardCRUD on the SQL seeds (products + roles, the shared tables hold both): overview + checks, tables with filters,
// the role folder tree beside the roles table, the role card (Main, Cost, Variants, Properties), generate variants - and the
// ProductDashboardCRUD next to role rows in the shared tables.
import React, { act } from 'react';
import { rawProductTables, rawRoleTables, seedRoleCatalog } from './resourceRoleTestKit';
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

import ResourceRoleDashboardCRUD from '../../../kit8/catalog/resourcerole/dashboard/ResourceRoleDashboardCRUD';
import ProductDashboardCRUD from '../../../kit8/catalog/product/dashboard/ProductDashboardCRUD';
import { PRODUCT_TABLE_KEYS, PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import { RESOURCE_ROLE_TABLE_KEYS, RESOURCE_ROLE_TABLES } from '../../../kit8/catalog/resourcerole/resourceRoleModel';
import type { ResourceRoleCatalogData } from '../../../kit8/catalog/resourcerole/crud/resourceRoleCatalogTools';
import { MANAGEMENT_GENUS_TABLE } from '../../../kit8/catalog/management/genus/managementGenusModel';
import { buildResourceRoleLabels } from '../../../kit8/catalog/resourcerole/crud/resourceRoleLabels';
import { buildResourceRoleTables, ROLE_DASHBOARD_TABLE_ORDER } from '../../../kit8/catalog/resourcerole/dashboard/resourceRoleDashboardTables';
import { beginFolderDrag, endFolderDrag } from '../../../kit8/ui/components/tree/folderTreeDnd';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let restore: () => void;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const calls = (kind: string, entity: string) => mockCalls.filter((c) => c[0] === kind && c[1] === entity).map((c) => c[2]);
/** the rows of a table: ids right after `<table>-row-` */
const rowIds = (table: string) => qa(`${table}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${table}-row-`, '')).filter((x) => !x.includes('-'));

/** redux as the database: the shared tables hold the rows of both sides */
function stateOf(raw: ResourceRoleCatalogData = rawRoleTables()) {
  const s: any = { uxuiState: { askBeforeDeletePost: true } };
  const product = rawProductTables();
  for (const k of PRODUCT_TABLE_KEYS) s[PRODUCT_TABLES[k].entity] = { entityDataFromServer: product[k], readSuccessful: 1 };
  for (const k of RESOURCE_ROLE_TABLE_KEYS) s[RESOURCE_ROLE_TABLES[k].entity] = { entityDataFromServer: raw[k], readSuccessful: 1 };
  s[MANAGEMENT_GENUS_TABLE.entity] = { entityDataFromServer: raw.managementGenus, readSuccessful: 1 };
  return s;
}
function mountRoles(params: Record<string, string> = {}, raw?: ResourceRoleCatalogData) {
  mockParams = params;
  mockState = stateOf(raw);
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ResourceRoleDashboardCRUD />));
}
const rerender = () => act(() => root.render(<ResourceRoleDashboardCRUD />));
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; restore?.(); jest.clearAllMocks(); mockCalls.length = 0; });

describe('overview', () => {
  it('numbers of the seed, no check errors, every table in the menu', () => {
    mountRoles();
    expect(q('role-tile-roles-value')!.textContent).toBe('8');
    expect(q('role-tile-types-value')!.textContent).toBe('5');
    expect(q('role-tile-variants-value')!.textContent).toBe('9');
    expect(q('role-tile-rates-value')!.textContent).toBe('32');
    expect(q('role-tile-descriptors-value')!.textContent).toBe('4');
    // role x variant: 2 + 1 + 2 + 2 + 2 + 2 + 2 + 2
    expect(q('role-tile-bookable-value')!.textContent).toBe('15');
    expect(q('role-tile-checks-value')!.textContent).toBe('OK');
    expect(q('role-checks')!.textContent).not.toMatch(/Errors [1-9]/);
    // Overview + Roles & folders + 15 tables
    expect(qa('role-nav-').filter((e) => !String(e.getAttribute('data-testid')).endsWith('-issues'))).toHaveLength(17);
    expect(q('role-setup')).toBeNull();
    expect(q('role-per-type-dataAnalyst')!.textContent).toContain('2');
  });

  it('the product rows in the shared tables are not counted as role data', () => {
    mountRoles();
    // 185 product variants are in the same table: only the 9 role variants count
    expect(q('role-tile-variants-value')!.textContent).toBe('9');
    expect(q('role-tile-properties-value')!.textContent).toBe('11');
  });

  it('no tables yet: the setup hint names both SQL files', () => {
    const empty = {} as ResourceRoleCatalogData;
    for (const k of RESOURCE_ROLE_TABLE_KEYS) empty[k] = [];
    mountRoles({}, empty);
    expect(q('role-setup')!.textContent).toContain('create_resource_role_tables.sql');
    expect(q('role-setup')!.textContent).toContain('create_product_tables.sql');
  });
});

describe('tables', () => {
  it('a menu item opens the table (route parameter tab); the type filter shows only that type; a new role gets the type', () => {
    mountRoles();
    press('role-nav-resourceRole');
    expect(mockSetParams).toHaveBeenCalledWith(expect.objectContaining({ tab: 'resourceRole' }));
    rerender();
    expect(q('role-table-title')!.textContent).toBe('Roles');
    expect(rowIds('role-table-resourceRole')).toHaveLength(8);
    press('role-filter-type');
    press('role-filter-picker-option-dataAnalyst');
    expect(rowIds('role-table-resourceRole').sort()).toEqual(['role3', 'role4']);
    press('role-table-resourceRole-add');
    expect(mockCalls.find((c) => c[0] === 'create')).toEqual(['create', 'resourceRoleReusable', expect.objectContaining({ rowOwnerGUID: 'dataAnalyst', rowParentGUID: 'empty' })]);
  });

  it('VAT now: the own rate, else the type default, else 0 %', () => {
    const raw = rawRoleTables({ withResources: true });
    raw.resourceRoleType.find((t) => t.rowGUID === 'expenseResources')!.rowJSON.roleVATDefaultRate = null;
    mountRoles({ tab: 'resourceRole' }, raw);
    expect(q('count-vatNow-mat_epoxy')!.textContent).toBe('21 %');   // its own
    expect(q('count-vatNow-hr_pm')!.textContent).toBe('21 %');       // the type default
    expect(q('count-vatNow-exp_van')!.textContent).toBe('0 %');      // empty -> 0 %
    expect(q('count-vatNow-role3')!.textContent).toBe('21 %');
  });

  it('role type column and VAT: the type default is the placeholder', () => {
    mountRoles({ tab: 'resourceRole' });
    expect(q('role-table-resourceRole-cell-role3-type')!.textContent).toContain('Data analyst');
    expect(q('count-variants-role3')!.textContent).toBe('2');
    expect(q('count-rate-role3')!.textContent).toBe('45.00 EUR / hour');
  });

  it('Role types: the management genus column shows the path of the genus; a new type has none yet', () => {
    mountRoles({ tab: 'resourceRoleType' }, rawRoleTables({ withResources: true }));
    expect(rowIds('role-table-resourceRoleType')).toHaveLength(9);
    expect(q('role-table-resourceRoleType-cell-revenueResources-managementGenus')!.textContent).toContain('Revenues › Revenue');
    expect(q('role-table-resourceRoleType-cell-humanResources-managementGenus')!.textContent).toContain('Costs › Time');
    expect(q('role-table-resourceRoleType-cell-materialResources-managementGenus')!.textContent).toContain('Costs › Material');
    expect(q('role-table-resourceRoleType-cell-expenseResources-managementGenus')!.textContent).toContain('Costs › Expense');
    expect(q('count-roles-humanResources')!.textContent).toBe('5');
  });

  it('with the demo resources: 35 roles, 89 cost rows, no check errors, the folder tree has the expense domains', () => {
    mountRoles({}, rawRoleTables({ withResources: true }));
    expect(q('role-tile-roles-value')!.textContent).toBe('35');
    expect(q('role-tile-rates-value')!.textContent).toBe('89');
    expect(q('role-tile-checks-value')!.textContent).toBe('OK');
  });

  it('Cost: same columns as the product prices; filter by role; the unit defaults to hour', () => {
    mountRoles({ tab: 'rolePrice' });
    expect(rowIds('role-table-rolePrice')).toHaveLength(32);
    press('role-filter-role');
    press('role-filter-picker-option-role3');
    expect(rowIds('role-table-rolePrice').sort()).toEqual(['rp10', 'rp11', 'rp32', 'rp8', 'rp9']);
    expect(q('role-table-rolePrice-cell-rp11-measureUnit')!.textContent).toContain('hour');
    expect(q('count-now-rp11')!.textContent).toBe('✓ now');
    press('role-table-rolePrice-add');
    expect(mockCalls.find((c) => c[0] === 'create')).toEqual(['create', 'rolePriceReusable', expect.objectContaining({ rowOwnerGUID: 'role3', rowJSON: expect.objectContaining({ measureUnit: 'unit_hour' }) })]);
  });

  it.each([['variant', 9], ['propertyValue', 11], ['descriptorDestination', 10], ['descriptorPlan', 18], ['variantValue', 18]])('the shared table %s lists only the %i role rows (the product rows are in the same entity)', (tab, n) => {
    mountRoles({ tab });
    expect(rowIds(`role-table-${tab}`)).toHaveLength(n);
  });

  it('a row menu opens another table filtered by the row, with a back arrow to it', () => {
    mountRoles({ tab: 'resourceRole' });
    press('role-table-resourceRole-menu-button-role3');
    press('role-open-rates-role3');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'rolePrice' }));
    rerender();
    expect(rowIds('role-table-rolePrice')).toHaveLength(5);
    expect(q('role-filter-role')!.textContent).toContain('BI data analyst');
    press('role-table-back');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'resourceRole', focusRowGUID: 'role3' }));
  });

  it('plan lines: a role set offers role descriptors only', () => {
    mountRoles({ tab: 'descriptorPlan' });
    expect(rowIds('role-table-descriptorPlan')).toHaveLength(18);
  });

  it('price types: shared; the Used for column shows where a list is used', () => {
    mountRoles({ tab: 'priceType' });
    expect(rowIds('role-table-priceType')).toHaveLength(6);
    const billRates = seedRoleCatalog().rolePrice.filter((p) => p.rowJSON.priceTypeGUID === 'pt_bill').length;
    expect(billRates).toBeGreaterThan(0);
    expect(q('count-rates-pt_bill')!.textContent).toBe(String(billRates));
  });
});

describe('table configurations', () => {
  const d = seedRoleCatalog();
  const L = buildResourceRoleLabels(d);
  const opened: any[] = [];
  const T = buildResourceRoleTables(d, L, { today: '2026-10-09', openTable: (...a) => opened.push(a) });

  it('one configuration per table, in the menu order', () => {
    expect(Object.keys(T).sort()).toEqual([...RESOURCE_ROLE_TABLE_KEYS].sort());
    expect([...ROLE_DASHBOARD_TABLE_ORDER].sort()).toEqual([...RESOURCE_ROLE_TABLE_KEYS].sort());
    for (const k of RESOURCE_ROLE_TABLE_KEYS) expect(T[k].key).toBe(k);
  });

  it('the Cost table has the columns of the product Prices table (per 1 unit, valid from)', () => {
    expect(T.rolePrice.columns.map((c) => c.key)).toEqual(['n', 'role', 'variant', 'priceType', 'price', 'measureUnit', 'currency', 'validFrom', 'now']);
  });

  it('the plan line descriptor list offers role descriptors of the set mode only', () => {
    const col = T.descriptorPlan.columns.find((c) => c.key === 'genus') as any;
    expect(col.options({ rowOwnerGUID: 'ds_pm_var' }).map((o: any) => o.value).sort()).toEqual(['seniority', 'workLanguage']);
    expect(col.options({ rowOwnerGUID: 'ds_pm_prop' }).map((o: any) => o.value).sort()).toEqual(['certification', 'minExperienceYears', 'workLanguage']);
  });

  it('row menu of a role: property values, cost, variants of its type', () => {
    const items = T.resourceRole.extraMenuItems!({ rowGUID: 'role3' } as any, () => {});
    expect(items.map((i) => i.label)).toEqual(['Property values', 'Cost', 'Variants']);
    items[1].onPress!();
    expect(opened.pop()).toEqual(['rolePrice', { role: 'role3' }, 'role3']);
    items[2].onPress!();
    expect(opened.pop()).toEqual(['variant', { owner: 'dataAnalyst' }, 'role3']);
  });
});

describe('Roles & folders: FolderTreeReusable + the roles table', () => {
  const TABLE = 'roles-tree-table';
  const TREE = `${TABLE}-folders`;
  const pickFolder = (id: string) => act(() => { (q(`${TREE}-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });
  const mountTree = () => {
    restore = mockRects({
      [TREE]: { left: 0, top: 0, width: 270, height: 600 },
      [`${TREE}-pinned`]: { left: 0, top: 80, width: 270, height: 64 },
      [`${TREE}-list`]: { left: 0, top: 144, width: 270, height: 450 },
    });
    mountRoles({ tab: 'rolesTree' });
  };
  const rowY = (id: string, frac = 0.5) => 144 + rowTop(q(`${TREE}-row-${id}`)!) + 32 * frac;

  it('the menu has "Roles & folders"; the tab shows the tree beside the roles table with counts per folder', () => {
    mountTree();
    expect(q('role-nav-rolesTree')!.textContent).toContain('Roles & folders');
    expect(q('roles-with-tree-title')!.textContent).toBe('Roles & folders');
    expect(q(TREE)).not.toBeNull();
    expect(rowIds(TABLE)).toHaveLength(8);
    expect(q(`${TREE}-row-fld_role_eng-count`)!.textContent).toBe('4');
    expect(q(`${TREE}-row-fld_role_fe-count`)!.textContent).toBe('2');
    expect(q(`${TREE}-row-fld_role_mgmt-count`)!.textContent).toBe('2');
    expect(q(`${TREE}-row-__tree_all__-count`)!.textContent).toBe('8');
  });

  it('picking a folder shows its roles (with subfolders); "Add" creates the role in it', () => {
    mountTree();
    pickFolder('fld_role_fe');
    expect(rowIds(TABLE).sort()).toEqual(['role5', 'role6']);
    pickFolder('fld_role_eng');
    expect(rowIds(TABLE)).toHaveLength(4);
    pickFolder('fld_role_data');
    press(`${TABLE}-add`);
    expect(calls('create', 'resourceRoleReusable')[0]).toEqual(expect.objectContaining({ rowParentGUID: 'fld_role_data' }));
  });

  it('roles dragged onto a folder get its GUID (rowParentGUID); onto "No folder" they get none', () => {
    mountTree();
    act(() => { beginFolderDrag({ kind: 'items', ids: ['role1', 'role2'], label: '2 roles', source: TABLE }, 40, rowY('fld_role_data')); });
    act(() => { endFolderDrag(); });
    expect(calls('update', 'resourceRoleReusable')).toEqual([
      { rowGUID: 'role1', rowOwnerGUID: 'projectManager', columns: { rowParentGUID: 'fld_role_data' } },
      { rowGUID: 'role2', rowOwnerGUID: 'businessAnalyst', columns: { rowParentGUID: 'fld_role_data' } },
    ]);
    mockCalls.length = 0;
    act(() => { beginFolderDrag({ kind: 'items', ids: ['role3'], label: 'x', source: TABLE }, 40, 80 + 32 + 16); });
    act(() => { endFolderDrag(); });
    expect(calls('update', 'resourceRoleReusable')).toEqual([{ rowGUID: 'role3', rowOwnerGUID: 'dataAnalyst', columns: { rowParentGUID: 'empty' } }]);
  });

  it('new folder: a top level one and a subfolder of the picked one, saved to resourceRoleFolderTable', () => {
    mountTree();
    press(`${TREE}-new-root`);
    expect(calls('create', 'resourceRoleFolderReusable')).toEqual([{
      rowGUID: expect.any(String), rowOwnerGUID: 'resourceRoleFolderCatalog', rowParentGUID: 'empty', orderInList: 4000, rowJSON: { title: 'New folder' },
    }]);
    mockCalls.length = 0;
    pickFolder('fld_role_fe');
    press(`${TREE}-new-sub`);
    expect(calls('create', 'resourceRoleFolderReusable')[0]).toEqual(expect.objectContaining({ rowParentGUID: 'fld_role_fe', orderInList: 1000, rowJSON: { title: 'New folder' } }));
  });

  it('deleting a folder with subfolders: they go, the roles are kept and get no folder', () => {
    mountTree();
    pickFolder('fld_role_eng');
    press(`${TREE}-delete`);
    expect(q('ask-body')!.textContent).toContain('2 subfolders');
    press('ask-confirm');
    expect(calls('delete', 'resourceRoleFolderReusable').map((c) => c.rowGUID).sort()).toEqual(['fld_role_be', 'fld_role_eng', 'fld_role_fe']);
    expect(calls('delete', 'resourceRoleReusable')).toEqual([]);
    expect(calls('update', 'resourceRoleReusable').map((u) => [u.rowGUID, u.columns.rowParentGUID]).sort()).toEqual([
      ['role5', 'empty'], ['role6', 'empty'], ['role7', 'empty'], ['role8', 'empty'],
    ]);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: '4 roles moved to "No folder"' } });
  });
});

describe('the role card (right-click a role -> Edit)', () => {
  const TABLE = 'roles-tree-table';
  const CARD = `${TABLE}-edit`;
  const openCard = (guid: string) => { press(`${TABLE}-menu-button-${guid}`); press(`${TABLE}-menu-edit`); };
  const mountTree = () => mountRoles({ tab: 'rolesTree' });

  it('the row menu has Edit; the card opens on Main with the role fields and counts on the tabs', () => {
    mountTree();
    expect(q(CARD)).toBeNull();
    openCard('role3');
    expect(q(CARD)).not.toBeNull();
    expect(q(`${CARD}-title`)!.textContent).toBe('BI data analyst (Power BI)');
    for (const t of ['main', 'rates', 'variants', 'properties']) expect(q(`${CARD}-tab-${t}`)).not.toBeNull();
    expect((q(`${CARD}-main-cell-role3-title`) as HTMLInputElement).value).toBe('BI data analyst (Power BI)');
    expect(q(`${CARD}-main-cell-role3-roleVATRate`)).not.toBeNull();
    expect(q(`${CARD}-tab-rates`)!.textContent).toBe('Cost (5)');
    expect(q(`${CARD}-tab-variants`)!.textContent).toBe('Variants (2)');
    expect(q(`${CARD}-tab-properties`)!.textContent).toBe('Properties (2)');
  });

  it('Cost / Properties: the rows of THIS role only, without the role column', () => {
    mountTree();
    openCard('role3');
    press(`${CARD}-tab-rates`);
    const R = `${CARD}-rates`;
    expect(rowIds(R).sort()).toEqual(['rp10', 'rp11', 'rp32', 'rp8', 'rp9']);
    expect(q(`${R}-cell-rp8-role`)).toBeNull();
    expect(q(`${R}-cell-rp8-measureUnit`)!.textContent).toContain('hour');
    press(`${CARD}-tab-properties`);
    expect(rowIds(`${CARD}-properties`).sort()).toEqual(['pp11', 'pp12']);
  });

  it('Variants: the variants of the role type (perType) with a note, without the owner column', () => {
    mountTree();
    openCard('role3');
    press(`${CARD}-tab-variants`);
    const V = `${CARD}-variants`;
    expect(rowIds(V).sort()).toEqual(['pv10', 'pv11']);
    expect(q(`${CARD}-variants-owner`)!.textContent).toContain('Data analyst');
    expect(q(`${V}-cell-pv10-owner`)).toBeNull();
  });

  it('Main: a list saves through setCell (VAT rate); Done closes the card', () => {
    mountTree();
    openCard('role3');
    press(`${CARD}-main-cell-role3-roleVATRate-option-vat_12`);
    expect(calls('update', 'resourceRoleReusable').some((p) => p.rowGUID === 'role3' && p.rowJSON?.roleVATRate === 'vat_12')).toBe(true);
    press(`${CARD}-done`);
    expect(q(CARD)).toBeNull();
  });
});

describe('commands', () => {
  it('generate variants for a role type: creates the variants and their values for the missing combinations', () => {
    mountRoles();
    press('role-generate-variants-header');
    press('generate-variants-owner');
    press('generate-variants-owner-picker-option-projectManager');
    expect(q('generate-variants-count')!.textContent).toBe('10 new variants');
    press('generate-variants-create');
    const created = mockCalls.filter((c) => c[0] === 'create');
    expect(created.filter((c) => c[1] === 'variantReusable')).toHaveLength(10);
    expect(created.filter((c) => c[1] === 'variantValueReusable')).toHaveLength(20);
    expect(created[0][2]).toMatchObject({ rowOwnerGUID: 'projectManager', rowJSON: expect.objectContaining({ title: 'Junior, English', isActive: true }) });
  });

  it('checks: a stale variant title can be rebuilt from the overview', () => {
    const raw = rawRoleTables();
    raw.variant.find((v) => v.rowGUID === 'pv7')!.rowJSON.title = 'Wrong';
    mountRoles({}, raw);
    expect(q('role-issue-R10-pv7')).not.toBeNull();
    press('role-checks-rebuild-all');
    expect(mockCalls).toEqual([['update', 'variantReusable', { rowGUID: 'pv7', rowOwnerGUID: 'projectManager', rowJSON: { title: 'Senior, English', descriptorKey: 'dp10=dv13|dp11=dv15' } }]]);
  });

  it('checks: a rate in a product-only price list shows up, the table has a hint, "Open" goes to the row', () => {
    const raw = rawRoleTables();
    raw.rolePrice.find((p) => p.rowGUID === 'rp1')!.rowJSON.priceTypeGUID = 'pt_retail';
    mountRoles({}, raw);
    expect(q('role-issue-R13-rp1')!.textContent).toContain('is not a role price list');
    expect(q('role-nav-rolePrice-issues')!.textContent).toBe('1');
    press('role-issue-open-rp1');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'rolePrice', focusRowGUID: 'rp1' }));
  });

  it('checks: orphan rows are deleted in one click', () => {
    const raw = rawRoleTables();
    raw.resourceRole = raw.resourceRole.filter((r) => r.rowGUID !== 'role8');
    mountRoles({}, raw);
    press('role-checks-sql_for_delete-orphans');
    expect(calls('delete', 'rolePriceReusable').map((p) => p.rowGUID).sort()).toEqual(['rp28', 'rp29', 'rp30', 'rp31']);
    expect(calls('delete', 'propertyValueReusable').map((p) => p.rowGUID)).toEqual(['pp17']);
  });
});

describe('ProductDashboardCRUD next to role rows in the shared tables', () => {
  function mountProducts(params: Record<string, string> = {}) {
    mockParams = params;
    mockState = stateOf();
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => root.render(<ProductDashboardCRUD />));
  }

  it('the numbers and the checks are those of the products alone', () => {
    mountProducts();
    expect(q('product-tile-products-value')!.textContent).toBe('106');
    expect(q('product-tile-variants-value')!.textContent).toBe('185');
    expect(q('product-checks')!.textContent).not.toMatch(/Errors [1-9]/);
  });

  it('the shared tables list the product rows only', () => {
    mountProducts({ tab: 'variant' });
    expect(rowIds('product-table-variant')).toHaveLength(185);
    expect(q('product-table-variant-row-pv7')).toBeNull();
  });
});
