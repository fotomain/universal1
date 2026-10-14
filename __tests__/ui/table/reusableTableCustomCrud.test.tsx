/** @jest-environment jsdom */
// ReusableTable: onAdd (the add button calls the screen; no add first / duplicate / add above / below), onRowOpen (a click on a cell and the row menu "Open" call the screen; cells read only), openLabel.
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

const mockEnv = { dev: false };
jest.mock('../../../kit8/ui/environment', () => ({ isDevEnvironment: () => mockEnv.dev, DEV_ENVIRONMENT: 'DEV_ENVIRONMENT', environmentName: () => (mockEnv.dev ? 'DEV_ENVIRONMENT' : '') }));
import ReusableTable from '../../../kit8/ui/components/table/reusable/ReusableTable';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 'ft';
const columns: VisualColumn[] = [{ key: 'n', title: '#', type: 'rowNumber' }, { key: 'name', title: 'Name', type: 'text', field: 'name' }];
function mount(props: any = {}) {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: { entityDataFromServer: [{ rowGUID: 'a', rowOwnerGUID: 'task', orderInList: 1, rowJSON: { name: 'x' } }], readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" listOwnerGUID="task" listParentGUID="*" visualColumns={columns} {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockEnv.dev = false; Object.keys(mockMenus).forEach((k) => delete mockMenus[k]); });

describe('onAdd - the rows are made by the screen', () => {
  it('the add button calls onAdd and creates no row; add first and duplicate are gone', () => {
    const onAdd = jest.fn();
    mount({ onAdd });
    press(`${T}-add`);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(mockActions.createOne).not.toHaveBeenCalled();
    expect(q(`${T}-add-first`)).toBeNull();
    expect(q(`${T}-duplicate-selected`)).toBeNull();
    expect(q(`${T}-delete-selected`)).not.toBeNull();                      // delete stays
  });
  it('without onAdd the table adds a row itself (as before)', () => {
    mount();
    press(`${T}-add`);
    expect(mockActions.createOne).toHaveBeenCalledTimes(1);
    expect(q(`${T}-add-first`)).not.toBeNull();
  });
  it('the row menu has no add above / below / duplicate with onAdd, but still Delete', () => {
    mount({ onAdd: jest.fn() });
    press(`${T}-menu-button-a`);
    const ids = mockMenus[`${T}-menu`].map((i) => i.testID);
    expect(ids).not.toContain(`${T}-menu-add-below`);
    expect(ids).not.toContain(`${T}-menu-add-above`);
    expect(ids).not.toContain(`${T}-menu-duplicate`);
    expect(ids).toContain(`${T}-menu-delete`);
  });
});

describe('onRowOpen - the row is shown by the screen', () => {
  it('a click on a cell opens the row (the cells are read only); the row object is handed over', () => {
    const onRowOpen = jest.fn();
    mount({ onRowOpen });
    press(`${T}-open-a-name`);
    expect(onRowOpen).toHaveBeenCalledTimes(1);
    expect(onRowOpen.mock.calls[0][0]).toMatchObject({ rowGUID: 'a', rowJSON: { name: 'x' } });
  });
  it('the row menu: "Edit row" by default, openLabel when given; it calls onRowOpen too', () => {
    const onRowOpen = jest.fn();
    mount({ onRowOpen });
    press(`${T}-menu-button-a`);
    expect(mockMenus[`${T}-menu`].find((i) => i.testID === `${T}-menu-edit`).label).toBe('Edit row');
    act(() => { mockMenus[`${T}-menu`].find((i) => i.testID === `${T}-menu-edit`).onPress(); });
    expect(onRowOpen).toHaveBeenCalledTimes(1);
    act(() => root.unmount()); document.body.innerHTML = '';
    mount({ onRowOpen, openLabel: 'Open document' });
    press(`${T}-menu-button-a`);
    expect(mockMenus[`${T}-menu`].find((i) => i.testID === `${T}-menu-edit`).label).toBe('Open document');
  });
  it('without onRowOpen the cells are edited in place and the menu has no Edit', () => {
    mount();
    expect(q(`${T}-open-a-name`)).toBeNull();
    press(`${T}-menu-button-a`);
    expect(mockMenus[`${T}-menu`].map((i) => i.testID)).not.toContain(`${T}-menu-edit`);
  });
});
