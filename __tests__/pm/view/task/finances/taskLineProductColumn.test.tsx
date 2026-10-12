/** @jest-environment jsdom */
// The Product column of a Material / Expense / Revenue line: still a catalog column of the products, its input is SelectCatalogItemWithFolders: a window with a
// RadioSetApp Tree | List; the Tree = the product folders (productFolderTable) with the products in them (a product without a folder shows at the top level); the search
// also finds by SKU; the List shows title + description as the plain list did.
import React, { act } from 'react';

jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../../../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: () => null }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('../../../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: ({ testID }: any) => R.createElement(View, { testID }) };
});
jest.mock('../../../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));

import { buildTaskLineColumns } from '../../../../../kit8/pm/view/task/finances/taskLineColumns';
import { emptyTaskLineCatalogs } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { taskLineGenusDef } from '../../../../../kit8/pm/view/task/finances/taskLineModel';
import { isProductFolder, productRowsWithFolders } from '../../../../../kit8/catalog/product/productSelectModel';

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
Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => 1024 });
Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => 800 });
beforeAll(() => { act(() => { window.dispatchEvent(new Event('resize')); }); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

const folder = (guid: string, parent: string, title: string, order = 0) => ({ rowGUID: guid, rowOwnerGUID: 'productFolderCatalog', rowParentGUID: parent, orderInList: order, rowJSON: { title } });
const product = (guid: string, parent: string, title: string, sku: string, description: string, order = 0) => ({ rowGUID: guid, rowOwnerGUID: 'type1', rowParentGUID: parent, orderInList: order, rowJSON: { title, sku, description } });
const folders = [folder('f_el', 'empty', 'Electronics', 1), folder('f_mob', 'f_el', 'Mobile devices', 2)];
const products = [product('p_phone', 'f_mob', 'Phone X', 'SKU-100', 'A smart phone', 3), product('p_cable', 'f_el', 'USB cable', 'SKU-200', 'A cable', 4), product('p_loose', 'empty', 'Loose screws', 'SKU-300', 'No folder', 5)];

function mount(value: string | null) {
  const data = { ...emptyTaskLineCatalogs(), productFolder: folders, product: products };
  const col: any = buildTaskLineColumns({ data, genus: taskLineGenusDef('materialGenus')!, textColor: '#000', errorColor: '#f00', showErrors: false }).find((c) => c.key === 'product');
  const onChange = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<>{col.renderPicker({ testID: 'pr', value, onChange, disabled: false, compact: true, triggerStyle: {}, placeholder: 'Select product…', row: { rowGUID: 'L1', rowJSON: {} } })}</>));
  return { col, onChange };
}

it('the folders and the products are one list of rows; a folder is a row of the folder catalog', () => {
  const rows = productRowsWithFolders(folders, products);
  expect(rows.filter(isProductFolder).map((r) => r.rowGUID)).toEqual(['f_el', 'f_mob']);
  expect(rows).toHaveLength(5);
});

it('stays a catalog column of the products (title, search, fill column) with an own picker', () => {
  const { col } = mount(null);
  expect(col).toMatchObject({ type: 'catalog', field: 'taskResourceItem', catalogEntityName: 'productReusable' });
  expect(typeof col.renderPicker).toBe('function');
});

it('Tree: the folders with the products in them, a product without a folder at the top level; a product is chosen, a folder only opens / closes', () => {
  const { onChange } = mount(null);
  expect(q('pr')!.textContent).toContain('Select product…');
  press('pr-trigger');
  expect(q('pr-view-tree')).not.toBeNull();
  expect(q('pr-view-list')).not.toBeNull();
  expect(q('pr-tree-row-f_mob')).not.toBeNull();
  expect(q('pr-tree-row-p_phone')!.textContent).toContain('SKU-100');
  expect(q('pr-tree-row-p_loose')).not.toBeNull();
  press('pr-tree-row-f_el'); // closes Electronics: the cable and the Mobile devices folder go
  expect(q('pr-tree-row-p_cable')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  press('pr-tree-row-p_loose');
  expect(onChange).toHaveBeenCalledWith('p_loose');
});

it('the search finds by title and by SKU (with the folders of the match)', async () => {
  mount(null);
  press('pr-trigger');
  await type('pr-search', 'sku-100');
  expect(q('pr-tree-row-p_phone')).not.toBeNull();
  expect(q('pr-tree-row-f_mob')).not.toBeNull();
  expect(q('pr-tree-row-f_el')).not.toBeNull();
  expect(q('pr-tree-row-p_cable')).toBeNull();
});

it('List: the products with title + description, the chosen one is ACTIVE; the value shows its title in the cell', () => {
  mount('p_cable');
  expect(q('pr')!.textContent).toContain('USB cable');
  press('pr-trigger');
  press('pr-view-list');
  expect(q('pr-list-item-p_cable')!.textContent).toContain('A cable');
  expect(q('pr-list-item-p_cable')!.textContent).toContain('ACTIVE');
  expect(q('pr-list-item-f_el')).toBeNull(); // a folder is no choice
  expect(q('pr-list-item-p_loose')).not.toBeNull();
});

it('"Tree + items": the product folders on the left, the products of the picked branch (sub-folders included) on the right; "No folder" holds the loose product', () => {
  const { onChange } = mount(null);
  press('pr-trigger');
  expect(q('pr-view-split')).not.toBeNull(); // Tree | Tree + items | List
  press('pr-view-split');
  expect(q('pr-split-item-p_phone')).not.toBeNull(); // All
  act(() => { (q('pr-split-folders-row-f_el')!.querySelector('[role="button"]') as HTMLElement).click(); });
  expect(q('pr-split-item-p_phone')).not.toBeNull(); // Electronics holds Mobile devices
  expect(q('pr-split-item-p_cable')).not.toBeNull();
  expect(q('pr-split-item-p_loose')).toBeNull();
  act(() => { (q('pr-split-folders-row-f_mob')!.querySelector('[role="button"]') as HTMLElement).click(); });
  expect(q('pr-split-item-p_cable')).toBeNull();
  act(() => { (q('pr-split-folders-row-__tree_none__')!.querySelector('[role="button"]') as HTMLElement).click(); });
  expect(q('pr-split-item-p_loose')).not.toBeNull();
  press('pr-split-item-p_loose');
  expect(onChange).toHaveBeenCalledWith('p_loose');
});
