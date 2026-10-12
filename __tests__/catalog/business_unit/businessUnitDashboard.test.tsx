/** @jest-environment jsdom */
// BusinessUnitCRUD (CatalogTreeReusableCRUD) on the 29 units of the seed: the tree of ALL units beside the table of the picked unit's sub-units, a CFR column that
// is a select of the enumeration, new rows under the picked unit, a unit with sub-units is not deleted, editing on by default.
import React, { act } from 'react';
import { cfrRows, unitRows } from './businessUnitTestKit';
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

import BusinessUnitCRUD from '../../../kit8/catalog/business_unit/BusinessUnitCRUD';
import { BUSINESS_UNIT_TABLE } from '../../../kit8/catalog/business_unit/businessUnitModel';
import { CFR_TYPE_TABLE } from '../../../kit8/catalog/business_unit/cfrTypeModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const calls = (kind: string, entity: string) => mockCalls.filter((c) => c[0] === kind && c[1] === entity).map((c) => c[2]);
const TABLE = 'business-unit-table';
const TREE = `${TABLE}-folders`;
const rowIds = () => qa(`${TABLE}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${TABLE}-row-`, '')).filter((x) => !x.includes('-'));
const pickNode = (id: string) => act(() => { (q(`${TREE}-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });

function mount(props: { noCrud?: boolean } = {}, rows: any[] = unitRows()) {
  mockParams = {};
  mockState = {
    uxuiState: { askBeforeDeletePost: true },
    [BUSINESS_UNIT_TABLE.entity]: { entityDataFromServer: rows, readSuccessful: 1 },
    [CFR_TYPE_TABLE.entity]: { entityDataFromServer: cfrRows(), readSuccessful: 1 },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<BusinessUnitCRUD {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

describe('the tree and the table', () => {
  it('every unit is a node of the tree (the first levels open) and a row of the table when "All" is picked', () => {
    mount();
    expect(rowIds()).toHaveLength(29);
    for (const u of ['bu_enterprise1', 'bu_sales', 'bu_pm', 'bu_pmteam1', 'bu_board']) expect(q(`${TREE}-row-${u}`)).not.toBeNull();
    expect(q('business-unit-dashboard')!.textContent).toContain('29 rows');
  });

  it('picking a unit shows its sub-units and theirs (not itself)', () => {
    mount();
    pickNode('bu_sales');
    expect(rowIds().sort()).toEqual(['bu_internetsales', 'bu_keyaccounts']);
    pickNode('bu_pm');
    expect(rowIds().sort()).toEqual(['bu_pmteam1', 'bu_pmteam2', 'bu_team1', 'bu_team1costs', 'bu_team2', 'bu_team2costs']);
    pickNode('bu_enterprise1');
    expect(rowIds()).toHaveLength(28);
  });

  it('the CFR column is a select of the enumeration; the effective CFR says "(inherited)" for a unit without one', () => {
    mount();
    expect(q(`${TABLE}-cell-bu_team1-cfrAssigned`)!.textContent).toContain('Revenue center');
    expect(q(`${TABLE}-cell-bu_team1costs-cfrAssigned`)!.textContent).toContain('Cost center');
    expect(q('business-unit-effective-bu_team1')!.textContent).toBe('Revenue center');
    expect(q('business-unit-effective-bu_ceo')!.textContent).toBe('Investment center (inherited)');
  });
});

describe('editing is on by default; the lock makes it read-only', () => {
  it('"+" creates a unit UNDER the picked unit; with "All" picked a root; "new root" in the tree a root', () => {
    mount();
    expect(q('business-unit-edit-toggle')!.textContent).toBe('lock_open');
    pickNode('bu_sales');
    press(`${TABLE}-add`);
    expect(calls('create', BUSINESS_UNIT_TABLE.entity)[0]).toEqual(expect.objectContaining({ rowOwnerGUID: 'businessUnitCatalog', rowParentGUID: 'bu_sales' }));
    press(`${TREE}-new-root`);
    const created = calls('create', BUSINESS_UNIT_TABLE.entity);
    expect(created[created.length - 1]).toEqual(expect.objectContaining({ rowOwnerGUID: 'businessUnitCatalog', rowParentGUID: 'empty', rowJSON: expect.objectContaining({ title: 'New business unit', isActive: true }) }));
  });

  it('"new sub-unit" in the tree creates a unit under the chosen one (any depth)', () => {
    mount();
    pickNode('bu_pmteam1'); // a unit of the 3rd level
    press(`${TREE}-new-sub`);
    expect(calls('create', BUSINESS_UNIT_TABLE.entity)[0]).toEqual(expect.objectContaining({ rowParentGUID: 'bu_pmteam1' }));
  });

  it('a unit WITH sub-units is not deleted (SQL refuses a used one as well); a leaf is', () => {
    mount();
    pickNode('bu_sales');
    press(`${TREE}-delete`);
    press('ask-confirm');
    expect(calls('delete', BUSINESS_UNIT_TABLE.entity)).toEqual([]);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'Not deleted: it has sub-business units. Move or delete them first.' } });
    pickNode('bu_keyaccounts');
    press(`${TREE}-delete`);
    press('ask-confirm');
    expect(calls('delete', BUSINESS_UNIT_TABLE.entity).map((c) => c.rowGUID)).toEqual(['bu_keyaccounts']);
  });

  it('noCrud: no add, no tree commands, cells not editable', () => {
    mount({ noCrud: true });
    expect(q('business-unit-edit-toggle')!.textContent).toBe('lock');
    expect(q(`${TABLE}-add`)).toBeNull();
    expect(q(`${TREE}-new-root`)).toBeNull();
    expect(q(`${TREE}-delete`)).toBeNull();
    expect(q('business-unit-dashboard')!.textContent).toContain('read-only');
    press('business-unit-edit-toggle');
    expect(q(`${TABLE}-add`)).not.toBeNull();
  });
});

it('no rows: the setup hint names PART 18 of the SQL file', () => {
  mount({}, []);
  expect(q('business-unit-setup')!.textContent).toContain('PART 18');
});
