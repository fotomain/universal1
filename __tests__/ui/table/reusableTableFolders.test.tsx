/** @jest-environment jsdom */
// ReusableTable + folders tree (uxuiTable.showFoldersTree + foldersTree): a picked folder filters the rows (with / without
// subfolders), counts, "Add" inside a folder, rows dragged onto a folder / "No folder" save the folder column,
// the hide button, calibration (row height, position, width).
import React, { act } from 'react';
import { mockRects } from '../tree/folderTreeTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
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
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '', default: () => null }));
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: () => null }));
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
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));

import ReusableTable from '../../../kit8/ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableFoldersTree, VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import { beginFolderDrag, endFolderDrag } from '../../../kit8/ui/components/tree/folderTreeDnd';
import { TREE_NONE_ID } from '../../../kit8/ui/components/tree/folderTreeModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let restore: () => void;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 't';
const TREE = `${T}-folders`;
const pickFolder = (id: string) => act(() => { (q(`${TREE}-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });
const tableRows = () => qa(`${T}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${T}-row-`, ''));

const columns: VisualColumn[] = [
  { key: 'n', title: '#', type: 'rowNumber' },
  { key: 'title', title: 'Title', type: 'text' },
];
//  f1 ── f2       f3
const folders: ReusableTableFoldersTree = {
  nodes: [
    { id: 'f1', parentId: null, title: 'Phones', order: 1000 },
    { id: 'f2', parentId: 'f1', title: 'Smart', order: 1000 },
    { id: 'f3', parentId: 'empty', title: 'Food', order: 2000 },
  ],
};
const rows = [
  { rowGUID: 'a', rowOwnerGUID: 'o1', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title: 'Loose' } },
  { rowGUID: 'b', rowOwnerGUID: 'o1', rowParentGUID: 'f1', orderInList: 2, rowJSON: { title: 'Phone' } },
  { rowGUID: 'c', rowOwnerGUID: 'o1', rowParentGUID: 'f2', orderInList: 3, rowJSON: { title: 'Smartphone' } },
  { rowGUID: 'd', rowOwnerGUID: 'o1', rowParentGUID: 'f3', orderInList: 4, rowJSON: { title: 'Soup' } },
  { rowGUID: 'e', rowOwnerGUID: 'o1', rowParentGUID: 'gone', orderInList: 5, rowJSON: { title: 'Orphan' } },
];
function mount(props: any = {}) {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: { entityDataFromServer: rows, readSuccessful: 1 } };
  // the fake window: the tree (260 px) left of the table; header 80, pinned rows 2 x 32, list below
  restore = mockRects({
    [TREE]: { left: 0, top: 0, width: 260, height: 500 },
    [`${TREE}-pinned`]: { left: 0, top: 80, width: 260, height: 64 },
    [`${TREE}-list`]: { left: 0, top: 144, width: 260, height: 350 },
  });
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(
    <ReusableTable testID={T} entityName="thing" listOwnerGUID={REUSABLE_TABLE_ALL} listParentGUID={REUSABLE_TABLE_ALL} visualColumns={columns}
      foldersTree={folders} uxuiTable={{ showFoldersTree: true }} {...props} />,
  ));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; restore?.(); jest.clearAllMocks(); });

it('no tree unless uxuiTable.showFoldersTree (and the foldersTree prop)', () => {
  mount({ uxuiTable: {} });
  expect(q(TREE)).toBeNull();
  expect(tableRows()).toHaveLength(5);
  act(() => root.unmount());
  mount({ foldersTree: undefined });
  expect(q(TREE)).toBeNull();
});

it('the tree shows the folders with counts (subfolders included) and the pinned rows', () => {
  mount();
  expect(q(`${TREE}-row-f1-count`)!.textContent).toBe('2'); // b + c (in the subfolder)
  expect(q(`${TREE}-row-f2-count`)!.textContent).toBe('1');
  expect(q(`${TREE}-row-f3-count`)!.textContent).toBe('1');
  expect(q(`${TREE}-row-__tree_all__-count`)!.textContent).toBe('5');
  expect(q(`${TREE}-row-__tree_none__-count`)!.textContent).toBe('2'); // a + e (its folder is not in the tree)
  expect(q(`${TREE}-row-__tree_all__`)!.textContent).toContain('All rows');
});

it('a picked folder filters the rows, with its subfolders; "No folder" shows the rest; the footer counts', () => {
  mount();
  pickFolder('f1');
  expect(tableRows().sort()).toEqual(['b', 'c']);
  expect(q(`${T}-count`)!.textContent).toBe('2 of 5 rows');
  pickFolder('f2');
  expect(tableRows()).toEqual(['c']);
  pickFolder('f3');
  expect(tableRows()).toEqual(['d']);
  pickFolder(TREE_NONE_ID);
  expect(tableRows().sort()).toEqual(['a', 'e']);
  pickFolder('__tree_all__');
  expect(tableRows()).toHaveLength(5);
});

it('includeSubfolders: false shows the rows of that folder only', () => {
  mount({ foldersTree: { ...folders, includeSubfolders: false } });
  pickFolder('f1');
  expect(tableRows()).toEqual(['b']);
});

it('the picked folder can be controlled and is reported', () => {
  const onSelectedFolderChange = jest.fn();
  mount({ foldersTree: { ...folders, onSelectedFolderChange } });
  pickFolder('f3');
  expect(onSelectedFolderChange).toHaveBeenCalledWith('f3');
});

it('"Add" inside a folder creates the row in it; with no folder picked it does not', () => {
  mount();
  press(`${T}-add`);
  expect(mockActions.createOne).toHaveBeenLastCalledWith(expect.objectContaining({ rowParentGUID: 'empty' }));
  pickFolder('f2');
  press(`${T}-add`);
  expect(mockActions.createOne).toHaveBeenLastCalledWith(expect.objectContaining({ rowParentGUID: 'f2' }));
});

it('reordering by position is off while a folder is picked (the view is a subset)', () => {
  const off = () => q(`${T}-move-down-selected`)!.getAttribute('aria-disabled') === 'true' || q(`${T}-move-down-selected`)!.hasAttribute('disabled');
  mount();
  press(`${T}-select-b`);
  expect(off()).toBe(false); // all rows shown: row b can move down
  pickFolder('f1');
  expect(tableRows().sort()).toEqual(['b', 'c']);
  expect(off()).toBe(true);
  pickFolder('__tree_all__');
  expect(off()).toBe(false);
});

describe('drag rows onto the tree', () => {
  // tree rows are 32 px high (= the table rows); the list starts at y 144, so row i of the tree is at 144 + 32 * i + 16
  const rowY = (id: string) => 144 + parseFloat(q(`${TREE}-row-${id}`)!.style.top) + 16;
  it('rows dropped on a folder save its GUID as their folder (rowParentGUID); rows already there are skipped', () => {
    mount();
    act(() => { beginFolderDrag({ kind: 'items', ids: ['a', 'b'], label: '2 rows', source: T }, 40, rowY('f3')); });
    expect(q(`${TREE}-row-f3-drop-inside`)).not.toBeNull();
    act(() => { endFolderDrag(); });
    expect(mockActions.updateOne).toHaveBeenCalledTimes(2);
    expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'a', rowOwnerGUID: 'o1', columns: { rowParentGUID: 'f3' } });
    expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'b', rowOwnerGUID: 'o1', columns: { rowParentGUID: 'f3' } });
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: '2 rows moved to Food' } });
    mockActions.updateOne.mockClear();
    act(() => { beginFolderDrag({ kind: 'items', ids: ['d'], label: 'Soup', source: T }, 40, rowY('f3')); });
    act(() => { endFolderDrag(); });
    expect(mockActions.updateOne).not.toHaveBeenCalled(); // d is in f3 already
  });
  it('"No folder" saves the empty value', () => {
    mount();
    act(() => { beginFolderDrag({ kind: 'items', ids: ['b'], label: 'Phone', source: T }, 40, 80 + 32 + 16); });
    act(() => { endFolderDrag(); });
    expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'b', rowOwnerGUID: 'o1', columns: { rowParentGUID: 'empty' } });
  });
  it('rows of another source are ignored; onRowsDrop replaces the default save', () => {
    const onRowsDrop = jest.fn();
    mount({ foldersTree: { ...folders, onRowsDrop } });
    act(() => { beginFolderDrag({ kind: 'items', ids: ['a'], label: 'x', source: 'someone-else' }, 40, rowY('f3')); });
    act(() => { endFolderDrag(); });
    expect(onRowsDrop).not.toHaveBeenCalled();
    act(() => { beginFolderDrag({ kind: 'items', ids: ['a', 'b'], label: 'x', source: T }, 40, rowY('f3')); });
    act(() => { endFolderDrag(); });
    expect(onRowsDrop).toHaveBeenCalledWith(['a', 'b'], 'f3');
    expect(mockActions.updateOne).not.toHaveBeenCalled();
  });
  it('the folder can live in rowJSON (folderTarget)', () => {
    mount({ foldersTree: { ...folders, folderTarget: 'rowJSON', folderField: 'folder' } });
    act(() => { beginFolderDrag({ kind: 'items', ids: ['a'], label: 'Loose', source: T }, 40, rowY('f3')); });
    act(() => { endFolderDrag(); });
    expect(mockActions.updateOne).toHaveBeenCalledWith({ rowGUID: 'a', rowOwnerGUID: 'o1', rowJSON: { folder: 'f3' } });
  });
});

describe('calibration (uxuiTable.foldersTree*)', () => {
  it('tree rows are as high as the table rows (alignRows), or 28 px when alignRows is off', () => {
    mount();
    expect(q(`${TREE}-row-f1`)!.style.height).toBe('32px');
    act(() => root.unmount());
    mount({ uxuiTable: { showFoldersTree: true, foldersTreeAlignRows: false } });
    expect(q(`${TREE}-row-f1`)!.style.height).toBe('28px');
    act(() => root.unmount());
    mount({ rowHeight: 40 });
    expect(q(`${TREE}-row-f1`)!.style.height).toBe('40px');
  });
  it('width, position and height', () => {
    mount({ uxuiTable: { showFoldersTree: true, foldersTreeWidth: 300, foldersTreePosition: 'right', foldersTreeHeight: 410 } });
    const panel = q(`${T}-folders-panel`)!;
    expect(panel.style.width).toBe('300px');
    expect(panel.style.height).toBe('410px');
    expect((q(`${T}-with-folders`)!.style as any).flexDirection).toBe('row-reverse');
  });
  it('the splitter and the toggle button can be turned off', () => {
    mount({ uxuiTable: { showFoldersTree: true, foldersTreeResizable: false, foldersTreeCollapsible: false } });
    expect(q(`${T}-folders-splitter`)).toBeNull();
    expect(q(`${T}-folders-toggle`)).toBeNull();
  });
  it('the toggle hides the tree and the folder filter with it', () => {
    mount();
    pickFolder('f3');
    expect(tableRows()).toEqual(['d']);
    press(`${T}-folders-toggle`);
    expect(q(TREE)).toBeNull();
    expect(tableRows()).toHaveLength(5);
    press(`${T}-folders-toggle`);
    expect(q(TREE)).not.toBeNull();
    expect(tableRows()).toEqual(['d']);
  });
  it('foldersTreeCollapsed starts without the tree', () => {
    mount({ uxuiTable: { showFoldersTree: true, foldersTreeCollapsed: true } });
    expect(q(TREE)).toBeNull();
    expect(q(`${T}-folders-toggle`)).not.toBeNull();
  });
});

describe('alwaysFullHeight (foldersTree.uxuiFolders, default true)', () => {
  const { Dimensions } = require('react-native');
  let spy: jest.SpyInstance;
  beforeEach(() => { spy = jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 }); });
  afterEach(() => spy.mockRestore());
  it('tree and table are as high as the screen; the rows scroll inside the table', () => {
    mount();
    expect(q(`${T}-folders-panel`)!.style.height).toBe('784px');
    expect(q(T)!.style.height).toBe('784px');
    expect(q(`${T}-body-scroll`)).not.toBeNull();
    // the header and the footer stay outside the scrolling body
    expect(q(`${T}-body-scroll`)!.contains(q(`${T}-footer`))).toBe(false);
    expect(q(`${T}-body-scroll`)!.contains(q(`${T}-headers`))).toBe(false);
    expect(q(`${T}-body-scroll`)!.querySelectorAll('[data-testid^="t-row-"]').length).toBe(5);
  });
  it('fullHeightBottomOffset / fullHeightMin', () => {
    mount({ foldersTree: { ...folders, uxuiFolders: { fullHeightBottomOffset: 100 } } });
    expect(q(T)!.style.height).toBe('700px');
    act(() => root.unmount());
    spy.mockReturnValue({ width: 1000, height: 200, scale: 1, fontScale: 1 });
    mount({ foldersTree: { ...folders, uxuiFolders: { fullHeightMin: 410 } } });
    expect(q(T)!.style.height).toBe('410px');
  });
  it('alwaysFullHeight: false, or a fixed foldersTreeHeight: the table grows with its rows, no inner scroll', () => {
    mount({ foldersTree: { ...folders, uxuiFolders: { alwaysFullHeight: false } } });
    expect(q(`${T}-body-scroll`)).toBeNull();
    expect(q(T)!.style.height).toBe('');
    act(() => root.unmount());
    mount({ uxuiTable: { showFoldersTree: true, foldersTreeHeight: 400 } });
    expect(q(`${T}-body-scroll`)).toBeNull();
    expect(q(`${T}-folders-panel`)!.style.height).toBe('400px');
  });
  it('doubleClickOnBranch reaches the tree', () => {
    mount({ foldersTree: { ...folders, uxuiFolders: { doubleClickOnBranch: 'openToEdit' }, tree: { onRename: jest.fn() } } });
    act(() => { q(`${TREE}-row-f1`)!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    expect(q(`${TREE}-row-f1-input`)).not.toBeNull();
  });
});
