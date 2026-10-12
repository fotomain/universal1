/** @jest-environment jsdom */
// SelectCatalogItemWithFolders: a catalog of FOLDERS and ITEMS (the budget items: Costs > Time, Material, Expense ...). The window has a RadioSetApp Tree | List at its
// right corner; the Tree has 2 variants (a tree-table; the folders + a table); the List opens by itself on a small width; one search box; only an item can be chosen.
import React, { act } from 'react';
import { budgetSeedRows } from '../../budget/budgetItemTestKit';

jest.mock('../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: ({ testID }: any) => R.createElement(View, { testID }) };
});
jest.mock('../../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));

import SelectCatalogItemWithFolders from '../../../../kit8/catalog/select/with_folders/SelectCatalogItemWithFolders';
import { folderPathText, itemsInFolder, visibleRows, defaultIsFolder, searchIds, DEFAULT_WITH_FOLDERS_COLUMNS } from '../../../../kit8/catalog/select/with_folders/withFoldersModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const type = async (id: string, text: string) => act(async () => {
  const input = q(id) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const T = 'sel';
// the width of the window that useWindowDimensions reads (react-native-web: the clientWidth of <html>, read again on a resize event)
const setWidth = (width: number) => {
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => width });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => 800 });
  act(() => { window.dispatchEvent(new Event('resize')); });
};
beforeEach(() => setWidth(1024));
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

const rows = budgetSeedRows();
const folderGUIDs = rows.filter((r) => r.rowParentGUID === 'empty').map((r) => r.rowGUID);
function mount(props: Record<string, any> = {}) {
  const onChange = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<SelectCatalogItemWithFolders testID={T} rows={rows} value={null} onChange={onChange} label="Budget item" {...props} />));
  return onChange;
}

describe('the pure side', () => {
  const isFolder = defaultIsFolder(rows);
  it('folders = the top level (and rows with sub-rows); items are the rest; only the folders that hold a fitting item stay', () => {
    expect(rows.filter(isFolder).map((r) => r.rowGUID)).toEqual(expect.arrayContaining(folderGUIDs));
    const onlyTime = visibleRows(rows, isFolder, (r) => r.rowJSON?.managementGenusItem === 'timeGenus');
    expect(onlyTime.map((r) => r.rowGUID).sort()).toEqual(['costsBudgetFolder', 'timeBudgetItem']);
  });
  it('the items of a folder, the path of an item, the search keeps the ancestors', () => {
    expect(itemsInFolder(rows, isFolder, 'costsBudgetFolder').map((r) => r.rowGUID).sort()).toEqual(['expenseBudgetItem', 'materialBudgetItem', 'timeBudgetItem']);
    expect(itemsInFolder(rows, isFolder, null).length).toBe(rows.filter((r) => !isFolder(r)).length);
    expect(folderPathText(rows, 'timeBudgetItem')).toBe('Costs › Time');
    const ids = searchIds(rows, DEFAULT_WITH_FOLDERS_COLUMNS, 'timeBudget')!; // the code column
    expect([...ids].sort()).toEqual(['costsBudgetFolder', 'timeBudgetItem']);
    expect(searchIds(rows, DEFAULT_WITH_FOLDERS_COLUMNS, '  ')).toBeNull();
  });
});

describe('the field', () => {
  it('shows the title of the value, the placeholder when empty; clear', () => {
    const onChange = mount({ value: 'timeBudgetItem' });
    expect(q(T)!.textContent).toContain('Time');
    press(`${T}-clear`);
    expect(onChange).toHaveBeenCalledWith(null, null);
    act(() => root.unmount());
    mount({ placeholder: 'Select budget item…' });
    expect(q(T)!.textContent).toContain('Select budget item…');
  });
});

describe('the window - Tree (a tree-table, the default on a wide screen)', () => {
  it('RadioSetApp Tree | List at the top; the folders open, the items are leaf rows with the code; an item can be chosen, a folder only opens / closes', () => {
    const onChange = mount();
    press(`${T}-trigger`);
    expect(q(`${T}-view`)).not.toBeNull();
    expect(q(`${T}-view-tree`)).not.toBeNull();
    expect(q(`${T}-view-list`)).not.toBeNull();
    expect(q(`${T}-tree`)).not.toBeNull();
    expect(q(`${T}-tree-row-costsBudgetFolder`)).not.toBeNull();
    expect(q(`${T}-tree-row-timeBudgetItem`)!.textContent).toContain('timeBudgetItem'); // the Code column
    press(`${T}-tree-row-costsBudgetFolder`); // a folder closes
    expect(q(`${T}-tree-row-timeBudgetItem`)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    press(`${T}-tree-row-costsBudgetFolder`); // ... and opens
    press(`${T}-tree-row-timeBudgetItem`);
    expect(onChange).toHaveBeenCalledWith('timeBudgetItem', expect.objectContaining({ rowGUID: 'timeBudgetItem' }));
    expect(q(`${T}-window`)).toBeNull(); // the window closed
  });

  it('the search shows the matches with their folders', async () => {
    mount();
    press(`${T}-trigger`);
    await type(`${T}-search`, 'expense');
    expect(q(`${T}-tree-row-expenseBudgetItem`)).not.toBeNull();
    expect(q(`${T}-tree-row-costsBudgetFolder`)).not.toBeNull();
    expect(q(`${T}-tree-row-timeBudgetItem`)).toBeNull();
    expect(q(`${T}-tree-row-revenueBudgetItem`)).toBeNull();
  });

  it('filterItem: only the fitting items and their folders are offered', () => {
    mount({ filterItem: (r: any) => r.rowJSON?.managementGenusItem === 'revenueGenus' });
    press(`${T}-trigger`);
    expect(q(`${T}-tree-row-revenueBudgetItem`)).not.toBeNull();
    expect(q(`${T}-tree-row-timeBudgetItem`)).toBeNull();
    expect(q(`${T}-tree-row-costsBudgetFolder`)).toBeNull();
  });
});

describe('the window - "Tree + items" (the folders on the full left side, the items of the branch on the right)', () => {
  it('the radio offers the views asked for, in this order: Tree | List by default, + "Tree + items" when views says so', () => {
    mount();
    press(`${T}-trigger`);
    expect(q(`${T}-view-tree`)).not.toBeNull();
    expect(q(`${T}-view-split`)).toBeNull();
    expect(q(`${T}-view-list`)).not.toBeNull();
    act(() => root.unmount());
    document.body.innerHTML = '';
    mount({ views: ['tree', 'split', 'list'] });
    press(`${T}-trigger`);
    expect(Array.from(document.querySelectorAll(`[data-testid^="${T}-view-"]`)).map((e) => e.getAttribute('data-testid'))).toEqual([`${T}-view-tree`, `${T}-view-split`, `${T}-view-list`]);
    expect(q(`${T}-view`)!.textContent).toContain('Tree + items');
  });

  it('"No folder" lists the items at the top level (only while there are some)', () => {
    const loose = { rowGUID: 'looseItem', rowOwnerGUID: 'x', rowParentGUID: 'empty', orderInList: 99, rowJSON: { title: 'Loose item' } };
    mount({ views: ['split'], rows: [...rows, loose], isFolder: (r: any) => r.rowGUID.endsWith('BudgetFolder') });
    press(`${T}-trigger`);
    act(() => { (q(`${T}-split-folders-row-__tree_none__`)!.querySelector('[role="button"]') as HTMLElement).click(); });
    expect(q(`${T}-split-item-looseItem`)).not.toBeNull();
    expect(q(`${T}-split-item-timeBudgetItem`)).toBeNull();
  });

  it('"All" lists every item; a folder narrows the table to its items; an item is chosen', () => {
    const onChange = mount({ views: ['tree', 'split', 'list'] });
    press(`${T}-trigger`);
    press(`${T}-view-split`);
    expect(q(`${T}-split`)).not.toBeNull();
    expect(q(`${T}-split-item-timeBudgetItem`)).not.toBeNull();
    expect(q(`${T}-split-item-revenueBudgetItem`)).not.toBeNull();
    act(() => { (q(`${T}-split-folders-row-revenuesBudgetFolder`)!.querySelector('[role="button"]') as HTMLElement).click(); });
    expect(q(`${T}-split-item-revenueBudgetItem`)).not.toBeNull();
    expect(q(`${T}-split-item-timeBudgetItem`)).toBeNull();
    press(`${T}-split-item-revenueBudgetItem`);
    expect(onChange).toHaveBeenCalledWith('revenueBudgetItem', expect.anything());
  });
});

describe('the window - List', () => {
  it('the radio switches to the List: cards with the folder path, the chosen one is ACTIVE; the same search', async () => {
    const onChange = mount({ value: 'timeBudgetItem' });
    press(`${T}-trigger`);
    expect(q(`${T}-tree`)).not.toBeNull();
    press(`${T}-view-list`);
    expect(q(`${T}-tree`)).toBeNull();
    expect(q(`${T}-list-item-timeBudgetItem`)!.textContent).toContain('ACTIVE');
    expect(q(`${T}-list-item-timeBudgetItem`)!.textContent).toContain('Costs');
    expect(q(`${T}-list-item-costsBudgetFolder`)).toBeNull(); // a folder is not a choice
    await type(`${T}-search`, 'revenue');
    expect(q(`${T}-list-item-revenueBudgetItem`)).not.toBeNull();
    expect(q(`${T}-list-item-timeBudgetItem`)).toBeNull();
    press(`${T}-list-item-revenueBudgetItem`);
    expect(onChange).toHaveBeenCalledWith('revenueBudgetItem', expect.anything());
  });

  it('opens as the List by itself on a small width, as the Tree on a wide one; defaultView forces one', () => {
    setWidth(400);
    mount();
    press(`${T}-trigger`);
    expect(q(`${T}-list`)).not.toBeNull();
    expect(q(`${T}-tree`)).toBeNull();
    press(`${T}-view-tree`); // the Tree is still there on a phone
    expect(q(`${T}-tree`)).not.toBeNull();
    act(() => root.unmount());
    document.body.innerHTML = '';
    mount({ defaultView: 'tree' });
    press(`${T}-trigger`);
    expect(q(`${T}-tree`)).not.toBeNull();
  });
});

it('disabled: no window', () => {
  mount({ disabled: true });
  press(`${T}-trigger`);
  expect(q(`${T}-window`)).toBeNull();
});
