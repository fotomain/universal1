/** @jest-environment jsdom */
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({
    activeSystem: 'native',
    isDark: false,
    themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' },
  }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/x', useGlobalSearchParams: () => ({}) }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: 'rgb(231, 224, 236)' } }) }));
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
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: (fn: any) => fn(mockState),
  useDispatch: () => mockDispatch,
}));

jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '',
    default: ({ testID, value, onChange, entityName }: any) =>
      R.createElement(
        Pressable,
        { testID, onPress: () => onChange(`${entityName}-picked`) },
        R.createElement(Text, null, `${entityName}|${value || '-'}`)
      ),
  };
});

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
jest.mock('../../../kit8/pm/inner/tooltip/PMTooltip', () => ({
  usePMTip: () => ({ ref: { current: null }, onHoverIn: undefined, onHoverOut: undefined, onPressIn: undefined, onLongPress: undefined, delayLongPress: 500, accessibilityHint: undefined }),
}));
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));

import ReusableTable from '../../../kit8/ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import { fireEvent } from '@testing-library/react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 'tbl';

// A catalog column whose catalog depends on the ROW (a Time line: a person OR an equipment): catalogEntityNameOf + catalogEntityNames.
const PERSONS = [{ rowGUID: 'p1', rowOwnerGUID: 'personCatalog', rowParentGUID: 'empty', orderInList: 1, rowJSON: { name: 'Anna Berg' } }];
const MACHINES = [{ rowGUID: 'm1', rowOwnerGUID: 'equipmentCatalog', rowParentGUID: 'empty', orderInList: 1, rowJSON: { name: 'Excavator CAT 320' } }];
const nameOf = (r: any) => r?.rowJSON?.name ?? '';
const rows = [
  { rowGUID: 'r1', rowOwnerGUID: 'o1', rowParentGUID: 'p', orderInList: 1, rowJSON: { kind: 'person', resource: 'p1' } },
  { rowGUID: 'r2', rowOwnerGUID: 'o1', rowParentGUID: 'p', orderInList: 2, rowJSON: { kind: 'equipment', resource: 'm1' } },
  { rowGUID: 'r3', rowOwnerGUID: 'o1', rowParentGUID: 'p', orderInList: 3, rowJSON: { kind: 'equipment', resource: null } },
];
const rowAware: VisualColumn = {
  key: 'resource', title: 'Resource', type: 'catalog', catalogEntityName: 'persons', catalogEntityNames: ['persons', 'machines'],
  catalogEntityNameOf: (row) => (row.rowJSON?.kind === 'equipment' ? 'machines' : 'persons'), titleExtractor: nameOf,
};
const plain: VisualColumn = { key: 'plain', title: 'Plain', type: 'catalog', field: 'resource', catalogEntityName: 'persons', titleExtractor: nameOf };
const columns: VisualColumn[] = [{ key: 'n', title: '#', type: 'rowNumber' }, { key: 'title', title: 'Kind', type: 'text', field: 'kind' }, rowAware];

function mount(cols: VisualColumn[] = columns) {
  mockState = { thing: { entityDataFromServer: rows, readSuccessful: 1 }, persons: { entityDataFromServer: PERSONS }, machines: { entityDataFromServer: MACHINES } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" listOwnerGUID={REUSABLE_TABLE_ALL} listParentGUID={REUSABLE_TABLE_ALL} visualColumns={cols} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

const cell = (row: string, col: string) => q(`${T}-cell-${row}-${col}`);

describe('a catalog column whose catalog follows the row (catalogEntityNameOf)', () => {
  it('each cell reads ITS catalog: a person row the persons, an equipment row the machines', () => {
    mount();
    expect(cell('r1', 'resource')!.textContent).toBe('persons|p1');
    expect(cell('r2', 'resource')!.textContent).toBe('machines|m1');
    expect(cell('r3', 'resource')!.textContent).toBe('machines|-');
  });

  it('picking in a cell stores the GUID of the catalog of THAT row', () => {
    mount();
    press(`${T}-cell-r2-resource`);
    expect(mockActions.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({ rowGUID: 'r2', rowJSON: expect.objectContaining({ resource: 'machines-picked' }) }));
  });

  it('a column without catalogEntityNameOf is exactly as before (the entity of the column)', () => {
    mount([...columns.slice(0, 2), plain]);
    expect(cell('r2', 'plain')!.textContent).toBe('persons|m1');
  });

  it('search finds the title of a stored GUID in ANY of the catalogs of the column', () => {
    mount();
    const search = document.querySelector(`[data-testid="${T}-search"]`) as HTMLInputElement | null;
    expect(search).not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setValue.call(search, 'excavator'); search!.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(q(`${T}-row-r2`)).not.toBeNull();
    expect(q(`${T}-row-r1`)).toBeNull();
    act(() => { setValue.call(search, 'anna'); search!.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(q(`${T}-row-r1`)).not.toBeNull();
    expect(q(`${T}-row-r2`)).toBeNull();
  });

  it('"Fill all lines" picks from catalogEntityName and fills only the rows of that catalog - a person is never written into an equipment row', () => {
    mount();
    act(() => { q(`${T}-header-resource`)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 50 })); });
    press(`${T}-header-menu-fill-all`);
    expect(q(`${T}-fill-catalog-select`)!.textContent).toBe('persons|-');
    press(`${T}-fill-catalog-select`);
    press(`${T}-fill-confirm`);
    const filled = mockActions.updateOne.mock.calls.map((c: any[]) => c[0].rowGUID);
    expect(filled).toEqual(['r1']);
    expect(mockActions.updateOne).toHaveBeenCalledWith(expect.objectContaining({ rowGUID: 'r1', rowJSON: expect.objectContaining({ resource: 'persons-picked' }) }));
  });
});
