/** @jest-environment jsdom */
// TREE.PLUGIN - FolderTreeReusable: windowed rows (200k), select / expand / search, CRUD callbacks, keyboard,
// pointer-driven drag & drop (folder before / after / inside, rows onto a folder, "No folder", into itself).
import React, { act } from 'react';
import { dragWithMouse, mockRects, pointer, releaseResponder, rowTop } from './folderTreeTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ items, testID }: any) => R.createElement(View, { testID }, items.map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.onPress }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ visible, onConfirm, onCancel, modalBody }: any) => (visible
    ? R.createElement(R.Fragment, null,
      R.createElement(Text, { testID: 'ask-body' }, modalBody),
      R.createElement(Pressable, { testID: 'ask-confirm', onPress: onConfirm }, R.createElement(Text, null, 'yes')),
      R.createElement(Pressable, { testID: 'ask-cancel', onPress: onCancel }, R.createElement(Text, null, 'no')))
    : null) };
});

import FolderTreeReusable from '../../../kit8/ui/components/tree/FolderTreeReusable';
import { FABProvider, useFABCurrentContextActions } from '../../../kit8/providers/FABProvider';
import { beginFolderDrag, endFolderDrag } from '../../../kit8/ui/components/tree/folderTreeDnd';
import { generateFolderNodes } from '../../../kit8/ui/components/tree/folderTreeDemoData';
import { FolderTreeNode, TREE_ALL_ID, TREE_NONE_ID } from '../../../kit8/ui/components/tree/folderTreeModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let restore: () => void;
const T = 'tree';
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`)).filter((e) => /-row-[^-]+$/.test(String(e.getAttribute('data-testid'))));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const row = (id: string) => q(`${T}-row-${id}`) as HTMLElement;
const allIds = () => qa(`${T}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${T}-row-`, ''));
/** the folder rows (without the pinned "All items" / "No folder") */
const ids = () => allIds().filter((x) => x !== TREE_ALL_ID && x !== TREE_NONE_ID);
/** click the row itself (the press handler is on the button inside the row view) */
const pressRow = (id: string) => act(() => { (row(id).querySelector('[role="button"]') as HTMLElement).click(); });

const n = (id: string, parentId: string | null, title = id, order?: number): FolderTreeNode => ({ id, parentId, title, order });
const sample = [n('A', null, 'Alpha', 1000), n('A1', 'A', 'Alpha one', 1000), n('A1a', 'A1', 'Deep', 1000), n('A2', 'A', 'Alpha two', 2000), n('B', null, 'Beta', 2000), n('B1', 'B', 'Beta one', 1000)];

const RH = 28;
// layout of the fake window: tree at (0,0) 300x500, header 80 px, pinned rows (All items + No folder) 56 px, list below
const LIST_TOP = 80 + 2 * RH;
function mount(props: any = {}) {
  restore = mockRects({
    [T]: { left: 0, top: 0, width: 300, height: 500 },
    [`${T}-pinned`]: { left: 0, top: 80, width: 300, height: 2 * RH },
    [`${T}-list`]: { left: 0, top: LIST_TOP, width: 300, height: 400 },
  });
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  const render = (p: any) => act(() => root.render(<FolderTreeReusable testID={T} nodes={sample} rowHeight={RH} showAllNode showNoneNode {...p} />));
  render(props);
  return render;
}
const yOfRow = (id: string, frac = 0.5) => LIST_TOP + rowTop(row(id)) + RH * frac;
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; restore?.(); jest.clearAllMocks(); });

describe('rows', () => {
  it('shows the top level folders open one level (initialExpandDepth 1) and toggles', () => {
    mount();
    expect(ids()).toEqual(['A', 'A1', 'A2', 'B', 'B1']);
    press(`${T}-row-A1-toggle`);
    expect(ids()).toContain('A1a');
    press(`${T}-row-A-toggle`);
    expect(ids()).not.toContain('A1');
  });
  it('selecting reports the id; All items / No folder are pinned', () => {
    const onSelect = jest.fn();
    mount({ onSelect });
    pressRow('A2');
    expect(onSelect).toHaveBeenLastCalledWith('A2', expect.objectContaining({ title: 'Alpha two' }));
    pressRow(TREE_NONE_ID);
    expect(onSelect).toHaveBeenLastCalledWith(TREE_NONE_ID, undefined);
  });
  it('counts: with subfolders; the pinned rows show the totals', () => {
    mount({ itemCounts: new Map([['A1a', 2], ['A2', 1], ['B', 4]]), totalCount: 9, noneCount: 2 });
    expect(q(`${T}-row-A-count`)!.textContent).toBe('3');
    expect(q(`${T}-row-B-count`)!.textContent).toBe('4');
    expect(q(`${T}-row-${TREE_ALL_ID}-count`)!.textContent).toBe('9');
    expect(q(`${T}-row-${TREE_NONE_ID}-count`)!.textContent).toBe('2');
  });
  it('search shows matches with their ancestors, opened', async () => {
    mount();
    const input = q(`${T}-search`) as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'deep');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 250));
    });
    expect(ids()).toEqual(['A', 'A1', 'A1a']);
    expect(q(`${T}-matches`)!.textContent).toBe('1');
  });
  it('200 000 folders: only a window of rows is mounted', () => {
    const t0 = Date.now();
    mount({ nodes: generateFolderNodes(200_000) });
    expect(ids().length).toBeLessThan(60);
    expect(ids().length).toBeGreaterThan(10);
    expect(q(`${T}-total`)!.textContent).toBe('200,000');
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe('CRUD callbacks (a missing callback hides its command)', () => {
  it('read only: no CRUD buttons', () => {
    mount();
    expect(q(`${T}-new-root`)).toBeNull();
    expect(q(`${T}-delete`)).toBeNull();
  });
  it('new top level folder / new subfolder of the selected one', () => {
    const onCreate = jest.fn();
    mount({ onCreate, onRename: jest.fn(), newId: () => 'new-1' });
    press(`${T}-new-root`);
    expect(onCreate).toHaveBeenLastCalledWith({ id: 'new-1', parentId: null, title: 'New folder', order: 3000 });
    pressRow('A2');
    press(`${T}-new-sub`);
    expect(onCreate).toHaveBeenLastCalledWith({ id: 'new-1', parentId: 'A2', title: 'New folder', order: 1000 });
  });
  it('rename: the inline input saves on Enter, ignores an unchanged / empty name', () => {
    const onRename = jest.fn();
    mount({ onRename });
    pressRow('A2');
    press(`${T}-rename`);
    const input = q(`${T}-row-A2-input`) as HTMLInputElement;
    expect(input.value).toBe('Alpha two');
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(input, 'Renamed');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); input.blur(); });
    expect(onRename).toHaveBeenCalledWith('A2', 'Renamed', 'Alpha two');
    expect(q(`${T}-row-A2-input`)).toBeNull();
  });
  it('sql_for_delete asks first and reports the folder + all its subfolders', () => {
    const onDelete = jest.fn();
    mount({ onDelete });
    pressRow('A');
    press(`${T}-delete`);
    expect(q('ask-body')!.textContent).toContain('3 subfolders');
    press('ask-cancel');
    expect(onDelete).not.toHaveBeenCalled();
    press(`${T}-delete`);
    press('ask-confirm');
    expect(onDelete).toHaveBeenCalledWith(expect.arrayContaining(['A', 'A1', 'A1a', 'A2']), 'A');
    expect(onDelete.mock.calls[0][0]).toHaveLength(4);
  });
  it('confirmDelete={false} deletes at once', () => {
    const onDelete = jest.fn();
    mount({ onDelete, confirmDelete: false });
    pressRow('B');
    press(`${T}-delete`);
    expect(onDelete).toHaveBeenCalledWith(['B', 'B1'], 'B');
  });
});

describe('keyboard (web)', () => {
  const key = (k: string, extra: any = {}) => act(() => { q(T)!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra })); });
  it('arrows move the selection, → opens, ← closes / goes to the parent, F2 renames, Delete deletes', () => {
    const onSelect = jest.fn();
    const onRename = jest.fn();
    const onDelete = jest.fn();
    mount({ onSelect, onRename, onDelete, confirmDelete: false, defaultSelectedId: 'A' });
    key('ArrowDown');
    expect(onSelect).toHaveBeenLastCalledWith('A1', expect.anything());
    key('ArrowRight'); // A1 is closed: opens
    expect(ids()).toContain('A1a');
    key('ArrowRight'); // open: first child
    expect(onSelect).toHaveBeenLastCalledWith('A1a', expect.anything());
    key('ArrowLeft'); // a leaf: its parent
    expect(onSelect).toHaveBeenLastCalledWith('A1', expect.anything());
    key('ArrowLeft'); // open: closes
    expect(ids()).not.toContain('A1a');
    key('End');
    expect(onSelect).toHaveBeenLastCalledWith('B1', expect.anything());
    key('Home');
    expect(onSelect).toHaveBeenLastCalledWith('A', expect.anything());
    key('ArrowDown');
    key('F2');
    expect(q(`${T}-row-A1-input`)).not.toBeNull();
    act(() => { (q(`${T}-row-A1-input`) as HTMLInputElement).blur(); });
    expect(onRename).not.toHaveBeenCalled(); // unchanged name
    key('Delete');
    expect(onDelete).toHaveBeenCalledWith(['A1', 'A1a'], 'A1');
  });
});

describe('drag & drop (pointer events)', () => {
  const grab = (id: string) => row(id);
  it('a folder dropped INSIDE another folder', () => {
    const onMove = jest.fn();
    mount({ onMove, initialExpandDepth: 0 });
    // rows: A, B (collapsed). Drag B onto the middle of A
    dragWithMouse(grab('B'), [[40, yOfRow('B')], [40, yOfRow('B') - 6], [40, yOfRow('A')]]);
    expect(onMove).toHaveBeenCalledWith({ id: 'B', parentId: 'A', order: 3000 });
  });
  it('before / after: the top / bottom quarter of a row', () => {
    const onMove = jest.fn();
    mount({ onMove, initialExpandDepth: 0 });
    dragWithMouse(grab('B'), [[40, yOfRow('B')], [40, yOfRow('B') - 8], [40, yOfRow('A', 0.05)]]);
    expect(onMove).toHaveBeenLastCalledWith({ id: 'B', parentId: null, order: 0 });
    dragWithMouse(grab('A'), [[40, yOfRow('A')], [40, yOfRow('A') + 8], [40, yOfRow('B', 0.95)]]);
    expect(onMove).toHaveBeenLastCalledWith({ id: 'A', parentId: null, order: 3000 });
  });
  it('never into itself or its own subfolder (a message says so)', () => {
    const onMove = jest.fn();
    const onMessage = jest.fn();
    mount({ onMove, onMessage, defaultExpandedIds: ['A', 'A1'] });
    dragWithMouse(grab('A'), [[40, yOfRow('A')], [40, yOfRow('A') + 8], [40, yOfRow('A1a')]]);
    expect(onMove).not.toHaveBeenCalled();
    expect(onMessage).toHaveBeenCalledWith('A folder cannot be moved into itself.');
  });
  it('a folder dropped on "All items" goes to the top level, last', () => {
    const onMove = jest.fn();
    mount({ onMove, defaultExpandedIds: ['A'] });
    dragWithMouse(grab('A2'), [[40, yOfRow('A2')], [40, yOfRow('A2') - 8], [40, 80 + RH * 0.5]]);
    expect(onMove).toHaveBeenCalledWith({ id: 'A2', parentId: null, order: 3000 });
  });
  it('rows dropped on a folder, on "No folder"; "All items" does not take rows', () => {
    const onDropItems = jest.fn();
    mount({ onDropItems, defaultExpandedIds: ['A'] });
    const payload = { kind: 'items', ids: ['p1', 'p2'], label: '2 rows', source: 'x' } as const;
    act(() => { beginFolderDrag({ ...payload }, 40, yOfRow('A2')); });
    expect(q(`${T}-row-A2-drop-inside`)).not.toBeNull();
    act(() => { endFolderDrag(); });
    expect(onDropItems).toHaveBeenLastCalledWith('A2', expect.objectContaining({ ids: ['p1', 'p2'] }));
    act(() => { beginFolderDrag({ ...payload }, 40, 80 + RH + RH * 0.5); });
    act(() => { endFolderDrag(); });
    expect(onDropItems).toHaveBeenLastCalledWith(null, expect.anything());
    onDropItems.mockClear();
    act(() => { beginFolderDrag({ ...payload }, 40, 80 + RH * 0.5); });
    act(() => { endFolderDrag(); });
    expect(onDropItems).not.toHaveBeenCalled();
  });
  it('without onDropItems rows are not accepted; without onMove folders cannot be dragged', () => {
    mount();
    act(() => { beginFolderDrag({ kind: 'items', ids: ['p1'], label: 'x', source: 'x' }, 40, yOfRow('A')); });
    expect(q(`${T}-row-A-drop-inside`)).toBeNull();
    expect(endFolderDrag()).toBe(false);
    // a folder drag never starts (no onMove): the pointer moves over a folder, nothing is marked
    act(() => { grab('B').dispatchEvent(pointer('pointerdown', 40, yOfRow('B'))); });
    act(() => { window.dispatchEvent(pointer('pointermove', 40, yOfRow('B') - 12)); });
    act(() => { window.dispatchEvent(pointer('pointermove', 40, yOfRow('A'))); });
    expect(document.querySelector('[data-testid*="-drop-"]')).toBeNull();
    act(() => { window.dispatchEvent(pointer('pointerup', 40, yOfRow('A'))); });
    releaseResponder();
  });
});

describe('uxuiFolders', () => {
  const dbl = (id: string) => act(() => { row(id).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  it('double click on a branch opens / closes it (default toggleOpenClose); a folder without subfolders does nothing', () => {
    mount({ onRename: jest.fn() });
    expect(ids()).not.toContain('A1a');
    dbl('A1');
    expect(ids()).toContain('A1a');
    dbl('A1');
    expect(ids()).not.toContain('A1a');
    dbl('A2');
    expect(q(`${T}-row-A2-input`)).toBeNull();
  });
  it("doubleClickOnBranch: 'openToEdit' renames in place instead", () => {
    mount({ onRename: jest.fn(), uxuiFolders: { doubleClickOnBranch: 'openToEdit' } });
    dbl('A1');
    expect(q(`${T}-row-A1-input`)).not.toBeNull();
    expect(ids()).not.toContain('A1a');
  });
  it('alwaysFullHeight (default): as high as the screen below the tree\'s top edge; an explicit height wins; false = the parent decides', () => {
    const style = () => q(T)!.style.height;
    // jsdom has no window size here: give the app one
    const { Dimensions } = require('react-native');
    const spy = jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
    const win = 800;
    mount();
    expect(style()).toBe(`${win - 16}px`);
    act(() => root.unmount()); restore();
    mount({ height: 300 });
    expect(style()).toBe('300px');
    act(() => root.unmount()); restore();
    mount({ uxuiFolders: { alwaysFullHeight: false } });
    expect(style()).toBe('100%');
    act(() => root.unmount()); restore();
    mount({ uxuiFolders: { fullHeightBottomOffset: 100 } });
    expect(style()).toBe(`${win - 100}px`);
    spy.mockRestore();
  });
});

describe('context menu', () => {
  const menuOn = (id: string) => act(() => { row(id).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })); });
  it('Rename runs AFTER the menu has closed (a closing modal gives the focus back to the page and would end the rename)', async () => {
    const onRename = jest.fn();
    mount({ onRename });
    menuOn('A2');
    expect(q(`${T}-context-menu`)).not.toBeNull();
    press(`${T}-menu-rename`);
    expect(q(`${T}-context-menu`)).toBeNull();
    expect(q(`${T}-row-A2-input`)).toBeNull(); // not yet
    await act(async () => { await new Promise((r) => setTimeout(r, 320)); });
    expect(q(`${T}-row-A2-input`)).not.toBeNull();
  });
  it('a blur after the input had the focus saves the rename', () => {
    {
      const onRename = jest.fn();
      mount({ onRename });
      pressRow('A2');
      press(`${T}-rename`);
      const input = q(`${T}-row-A2-input`) as HTMLInputElement;
      act(() => { input.focus(); });
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Two');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      act(() => { input.blur(); });
      expect(onRename).toHaveBeenCalledWith('A2', 'Two', 'Alpha two');
    }
  });
});

describe('main FAB (FABProvider.useFABContextActions)', () => {
  function Probe() {
    const a = useFABCurrentContextActions();
    return <>{(a || []).map((x, i) => <button key={i} data-testid={`fab-${i}`} onClick={x.onPress}>{x.label}</button>)}</>;
  }
  function mountFab(props: any = {}) {
    restore = mockRects({ [T]: { left: 0, top: 0, width: 300, height: 500 } });
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => root.render(<FABProvider><FolderTreeReusable testID={T} nodes={sample} rowHeight={RH} {...props} /><Probe /></FABProvider>));
  }
  const labels = () => Array.from(document.querySelectorAll('[data-testid^="fab-"]')).map((e) => e.textContent);
  const fab = (label: string) => act(() => { (Array.from(document.querySelectorAll('[data-testid^="fab-"]')).find((e) => e.textContent === label) as HTMLElement).click(); });
  it('with a folder selected: the commands of its context menu, named after it', () => {
    const onCreate = jest.fn(); const onDelete = jest.fn(); const onMove = jest.fn();
    mountFab({ onCreate, onDelete, onMove, onRename: jest.fn(), confirmDelete: false, newId: () => 'n1', defaultSelectedId: 'A2' });
    expect(labels()).toEqual(expect.arrayContaining(['New top level folder', 'New subfolder in "Alpha two"', 'New folder below', 'Rename "Alpha two"', 'Duplicate', 'Move up', 'Delete "Alpha two"', 'Expand all folders', 'Collapse all folders']));
    expect(labels()).not.toContain('Move down'); // the last child
    fab('New subfolder in "Alpha two"');
    expect(onCreate).toHaveBeenLastCalledWith({ id: 'n1', parentId: 'A2', title: 'New folder', order: 1000 });
    fab('Delete "Alpha two"');
    expect(onDelete).toHaveBeenCalledWith(['A2'], 'A2');
    fab('Move up');
    expect(onMove).toHaveBeenCalledWith({ id: 'A2', parentId: 'A', order: 0 });
  });
  it('follows the selection; nothing is selected: only the tree wide commands', () => {
    mountFab({ onCreate: jest.fn() });
    expect(labels()).toEqual(['New top level folder', 'Expand all folders', 'Collapse all folders']);
    pressRow('B');
    expect(labels()).toContain('New subfolder in "Beta"');
  });
  it('a command that is not available is not offered (read only)', () => {
    mountFab({ defaultSelectedId: 'A' });
    expect(labels()).toEqual(['Expand all below', 'Collapse all below', 'Expand all folders', 'Collapse all folders']);
  });
  it('commandsInMainFab: false publishes nothing; the commands leave with the tree', () => {
    mountFab({ onCreate: jest.fn(), uxuiFolders: { commandsInMainFab: false } });
    expect(labels()).toEqual([]);
    act(() => root.unmount());
    mountFab({ onCreate: jest.fn() });
    expect(labels().length).toBeGreaterThan(0);
    act(() => root.render(<FABProvider><Probe /></FABProvider>));
    expect(labels()).toEqual([]);
  });
});
