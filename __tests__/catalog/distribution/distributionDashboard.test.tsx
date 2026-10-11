/** @jest-environment jsdom */
// ManagementGenusDashboardCRUD on the SQL seed: the genus FOLDERS (tree) beside the genus ITEMS (table), read-only by default (noCrud), editing on request.
import React, { act } from 'react';
import seed from './distributionSeed.json';
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

import DistributionTypeCRUD from '../../../kit8/catalog/distribution/DistributionTypeCRUD';
import { DISTRIBUTION_TABLE } from '../../../kit8/catalog/distribution/distributionModel';
import { beginFolderDrag, endFolderDrag } from '../../../kit8/ui/components/tree/folderTreeDnd';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const calls = (kind: string, entity: string) => mockCalls.filter((c) => c[0] === kind && c[1] === entity).map((c) => c[2]);
const TABLE = 'distribution-table';
const TREE = `${TABLE}-folders`;
const rowIds = () => qa(`${TABLE}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${TABLE}-row-`, '')).filter((x) => !x.includes('-'));
const pickFolder = (id: string) => act(() => { (q(`${TREE}-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });
const seedRows = () => (seed as any).distributionGenericTable as any[];

function mount(props: { noCrud?: boolean } = {}, rows = seedRows()) {
  mockParams = {};
  mockState = {
    uxuiState: { askBeforeDeletePost: true },
    [DISTRIBUTION_TABLE.entity]: { entityDataFromServer: rows, readSuccessful: 1 },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<DistributionTypeCRUD {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

const SIMPLE = ['backLoadedDistribution', 'frontLoadedDistribution', 'uniformDistribution'];
const CURVES = ['epidemicDistribution', 'logarithmicBackDistribution', 'logarithmicFrontDistribution', 'normalDistribution'];

describe('noCrud = true by default (like the management genus)', () => {
  it('the tree has the 3 groups, the table the 8 distributions - and no way to change them', () => {
    mount();
    expect(rowIds().sort()).toEqual([...SIMPLE, ...CURVES, 'manualDistribution'].sort());
    for (const g of ['simpleDistributionGroup', 'curvesDistributionGroup', 'customDistributionGroup']) expect(q(`${TREE}-row-${g}`)).not.toBeNull();
    for (const i of ['normalDistribution', 'manualDistribution']) expect(q(`${TREE}-row-${i}`)).toBeNull();
    expect(q(`${TREE}-row-__tree_none__`)).toBeNull();
    expect(q(`${TABLE}-add`)).toBeNull();
    expect(q(`${TABLE}-menu-button-normalDistribution`)).toBeNull();
    expect(q(`${TREE}-new-root`)).toBeNull();
    expect(q(`${TREE}-rename`)).toBeNull();
    expect(q(`${TREE}-delete`)).toBeNull();
    expect(q('distribution-edit-toggle')!.textContent).toBe('lock');
    expect(q('distribution-dashboard')!.textContent).toContain('read-only');
  });

  it('cells are not editable', () => {
    mount();
    const cell = q(`${TABLE}-cell-manualDistribution-title`);
    expect(cell).not.toBeNull();
    expect(cell!.tagName === 'INPUT' ? (cell as HTMLInputElement).readOnly || (cell as HTMLInputElement).disabled : true).toBe(true);
    expect(calls('update', DISTRIBUTION_TABLE.entity)).toEqual([]);
  });

  it('picking a group shows its distributions; counts per group', () => {
    mount();
    expect(q(`${TREE}-row-simpleDistributionGroup-count`)!.textContent).toBe('3');
    expect(q(`${TREE}-row-curvesDistributionGroup-count`)!.textContent).toBe('4');
    expect(q(`${TREE}-row-customDistributionGroup-count`)!.textContent).toBe('1');
    pickFolder('simpleDistributionGroup');
    expect(rowIds().sort()).toEqual(SIMPLE);
    pickFolder('curvesDistributionGroup');
    expect(rowIds().sort()).toEqual(CURVES);
    pickFolder('customDistributionGroup');
    expect(rowIds()).toEqual(['manualDistribution']);
  });

  it('read-only: no row drag changes a distribution', () => {
    mount();
    act(() => { beginFolderDrag({ kind: 'items', ids: ['normalDistribution'], label: 'Normal', source: TABLE }, 40, 80 + 16); });
    act(() => { endFolderDrag(); });
    expect(calls('update', DISTRIBUTION_TABLE.entity)).toEqual([]);
  });

  it('the code, the parameters and which one is editable', () => {
    mount();
    expect(q('distribution-code-normalDistribution')!.textContent).toBe('normalDistribution');
    expect(q('distribution-params-normalDistribution')!.textContent).toBe('Peak position 0.5, Spread 0.2');
    expect(q('distribution-params-logarithmicFrontDistribution')!.textContent).toBe('Steepness 9');
    expect(q('distribution-params-uniformDistribution')!.textContent).toBe('None');
    expect(q('distribution-params-manualDistribution')!.textContent).toBe('Per-period values');
    for (const c of [...SIMPLE, ...CURVES]) expect(q(`distribution-editable-${c}`)!.textContent).toBe('No');
    expect(q('distribution-editable-manualDistribution')!.textContent).toBe('Yes');
    expect(q(`${TABLE}-cell-normalDistribution-parent`)!.textContent).toContain('Curves');
  });
});

describe('editing on request', () => {
  it('the lock button turns CRUD on: "+" creates a distribution in the picked group, "new folder" a group', () => {
    mount();
    press('distribution-edit-toggle');
    expect(q('distribution-edit-toggle')!.textContent).toBe('lock_open');
    expect(q(`${TABLE}-add`)).not.toBeNull();
    pickFolder('customDistributionGroup');
    press(`${TABLE}-add`);
    expect(calls('create', DISTRIBUTION_TABLE.entity)[0]).toEqual(expect.objectContaining({ rowOwnerGUID: 'distributionGenericCatalog', rowParentGUID: 'customDistributionGroup' }));
    press(`${TREE}-new-root`);
    const created = calls('create', DISTRIBUTION_TABLE.entity);
    expect(created[created.length - 1]).toEqual(expect.objectContaining({ rowOwnerGUID: 'distributionGenericCatalog', rowParentGUID: 'empty', rowJSON: { title: 'New group' } }));
    press('distribution-edit-toggle');
    expect(q(`${TABLE}-add`)).toBeNull();
  });

  it('a new distribution with "All" picked goes into the first group', () => {
    mount({ noCrud: false });
    press(`${TABLE}-add`);
    expect(calls('create', DISTRIBUTION_TABLE.entity)[0]).toEqual(expect.objectContaining({ rowParentGUID: 'simpleDistributionGroup' }));
  });

  it('no subgroups: "new subfolder" is refused', () => {
    mount({ noCrud: false });
    pickFolder('simpleDistributionGroup');
    press(`${TREE}-new-sub`);
    expect(calls('create', DISTRIBUTION_TABLE.entity)).toEqual([]);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: 'A distribution is added in the table: pick the group and press +' } });
  });

  it('deleting a group deletes its distributions', () => {
    mount({ noCrud: false });
    pickFolder('customDistributionGroup');
    press(`${TREE}-delete`);
    press('ask-confirm');
    expect(calls('delete', DISTRIBUTION_TABLE.entity).map((c) => c.rowGUID).sort()).toEqual(['customDistributionGroup', 'manualDistribution']);
  });
});

it('no rows: the setup hint names the SQL file', () => {
  mount({}, []);
  expect(q('distribution-setup')!.textContent).toContain('create_distribution_generic_table.sql');
});
