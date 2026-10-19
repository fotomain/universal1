/** @jest-environment jsdom */
// ItemNumber / SearchName of a Product: the Product list columns (CRUD, sort, filter, unique item number), the card, the pick lists, and the product window of a task line
// (Tree / Split / List) that shows the fields the PROJECT makes visible and SEARCHES the ones that are only enabled.
import React, { act } from 'react';
import { seedCatalog } from './productTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: () => null }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) };
});
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: ({ testID }: any) => R.createElement(View, { testID }) };
});
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));

import { buildTaskLineColumns } from '../../../kit8/pm/view/task/finances/taskLineColumns';
import { emptyTaskLineCatalogs } from '../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { taskLineGenusDef } from '../../../kit8/pm/view/task/finances/taskLineModel';
import { PRODUCT_SELECT_COLUMNS, productSelectColumns, productSubtitle } from '../../../kit8/catalog/product/productSelectModel';
import { itemNumberTaken, productDetailParts, productFieldsOfCatalog, productFieldsOfProject, productSearchTexts } from '../../../kit8/catalog/product/productFieldsModel';
import { PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import { buildProductLabels } from '../../../kit8/catalog/product/crud/productLabels';
import { buildDashboardTables } from '../../../kit8/catalog/product/dashboard/productDashboardTables';
import { rowMatches, searchIds, shownColumns } from '../../../kit8/catalog/select/with_folders/withFoldersModel';

const ON = { itemNumberFunctionalityEnabled: true, searchNameFunctionalityEnabled: true };
const ON_VISIBLE = { ...ON, itemNumberFunctionalityVisibleInProjects: true, searchNameFunctionalityVisibleInProjects: true };
const product = (guid: string, title: string, j: Record<string, any> = {}) => ({ rowGUID: guid, rowOwnerGUID: 'type1', rowParentGUID: 'empty', orderInList: 1, rowJSON: { title, ...j } });
const phone = product('p1', 'Phone X', { sku: 'SKU-1', itemNumber: '100-0245', searchName: 'iph nickname', description: 'A smart phone' });
const cable = product('p2', 'USB cable', { sku: 'SKU-2', itemNumber: '200-0001' });

describe('the pure side', () => {
  it('a new product row has the two keys (null)', () => {
    expect(PRODUCT_TABLES.product.emptyRowJSON()).toMatchObject({ itemNumber: null, searchName: null });
  });
  it('itemNumberTaken: another product with the same number (case-insensitive); empty never; the product itself never', () => {
    expect(itemNumberTaken([phone, cable], ' 100-0245 ', 'p2')).toBe(true);
    expect(itemNumberTaken([phone, cable], '100-0245', 'p1')).toBe(false);
    expect(itemNumberTaken([phone, cable], '', 'p2')).toBe(false);
    expect(itemNumberTaken([phone, cable], null, 'p2')).toBe(false);
    expect(itemNumberTaken([product('x', 'A', { itemNumber: 'ab-1' }), cable], 'AB-1', 'p2')).toBe(true);
  });
  it('productSearchTexts: only the fields that are enabled; productDetailParts: the item number only while shown', () => {
    expect(productSearchTexts(phone, productFieldsOfProject({}))).toEqual([]);
    expect(productSearchTexts(phone, productFieldsOfProject({ itemNumberFunctionalityEnabled: true }))).toEqual(['100-0245']);
    expect(productSearchTexts(phone, productFieldsOfProject(ON))).toEqual(['100-0245', 'iph nickname']);
    expect(productDetailParts(phone, productFieldsOfProject(ON))).toEqual(['SKU-1']);
    expect(productDetailParts(phone, productFieldsOfProject(ON_VISIBLE))).toEqual(['SKU-1', '100-0245']);
  });
  it('the pick lists of the catalog get the item number in the details only while it is shown', () => {
    const data = seedCatalog();
    data.product = [phone as any];
    expect(buildProductLabels(data).options.products[0].hint).toBe('SKU-1 · type1');
    expect(buildProductLabels(data, productFieldsOfProject(ON_VISIBLE)).options.products[0].hint).toBe('SKU-1 · 100-0245 · type1');
  });
});

describe('the window columns (productSelectColumns)', () => {
  it('no switch: Description + SKU (as before the fields)', () => {
    expect(PRODUCT_SELECT_COLUMNS.map((c) => c.key)).toEqual(['title', 'sku']);
    expect(productSelectColumns(productFieldsOfProject({})).map((c) => c.key)).toEqual(['title', 'sku']);
  });
  it('Enabled only: the columns exist for the SEARCH but are not shown; Enabled + Visible: shown columns', () => {
    const hidden = productSelectColumns(productFieldsOfProject(ON));
    expect(hidden.map((c) => c.key)).toEqual(['title', 'sku', 'itemNumber', 'searchName']);
    expect(shownColumns(hidden).map((c) => c.key)).toEqual(['title', 'sku']);
    const shown = productSelectColumns(productFieldsOfProject(ON_VISIBLE));
    expect(shownColumns(shown).map((c) => c.title)).toEqual(['Description', 'SKU', 'Item number', 'Search name']);
  });
  it('the search finds by item number and search name only while the field is enabled', () => {
    const off = productSelectColumns(productFieldsOfProject({}));
    const on = productSelectColumns(productFieldsOfProject(ON));
    expect(rowMatches(phone as any, off, '0245')).toBe(false);
    expect(rowMatches(phone as any, on, '0245')).toBe(true);
    expect(rowMatches(phone as any, on, 'NICKNAME')).toBe(true);
    expect(rowMatches(cable as any, on, 'nickname')).toBe(false);
    expect([...searchIds([phone, cable] as any, on, '200-')!]).toEqual(['p2']);
  });
  it('the details line of the List: shown fields, then the description', () => {
    expect(productSubtitle(phone as any, productFieldsOfProject({}))).toBe('A smart phone');
    expect(productSubtitle(phone as any, productFieldsOfProject(ON))).toBe('A smart phone');
    expect(productSubtitle(phone as any, productFieldsOfProject(ON_VISIBLE))).toBe('100-0245 · iph nickname · A smart phone');
    expect(productSubtitle(cable as any, productFieldsOfProject(ON_VISIBLE))).toBe('200-0001');
    expect(productSubtitle(product('p3', 'Bare'), productFieldsOfProject(ON_VISIBLE))).toBeUndefined();
  });
});

describe('the Product list (buildDashboardTables)', () => {
  const build = (fields?: any) => {
    const data = seedCatalog();
    data.product = [phone as any, cable as any];
    const L = buildProductLabels(data);
    return { data, tables: buildDashboardTables(data, L, { openTable: jest.fn(), assignBarcode: jest.fn(), productFields: fields }) };
  };
  const keys = (t: any) => t.product.columns.map((c: any) => c.key);
  it('no switch: no columns for the fields', () => {
    const { tables } = build();
    expect(keys(tables)).not.toContain('itemNumber');
    expect(keys(tables)).not.toContain('searchName');
  });
  it('Enabled AND VisibleInProjects (organization settings): the columns come right before the SKU, Item number first (so the list sorts, filters and searches them)', () => {
    const { tables } = build(productFieldsOfCatalog(ON_VISIBLE));
    const k = keys(tables);
    expect(k.slice(k.indexOf('title'), k.indexOf('sku') + 1)).toEqual(['title', 'itemNumber', 'searchName', 'sku']);
  });
  it('Enabled without VisibleInProjects: no column', () => {
    const { tables } = build(productFieldsOfCatalog(ON));
    expect(keys(tables)).not.toContain('itemNumber');
    expect(keys(tables)).not.toContain('searchName');
  });
  it('only one of them visible: only its column', () => {
    const { tables } = build(productFieldsOfCatalog({ ...ON, searchNameFunctionalityVisibleInProjects: true }));
    const k = keys(tables);
    expect(k).not.toContain('itemNumber');
    expect(k.slice(k.indexOf('title'), k.indexOf('sku') + 1)).toEqual(['title', 'searchName', 'sku']);
  });
  it('the item number must be unique: a number of another product is refused', () => {
    const { tables } = build(productFieldsOfCatalog({ itemNumberFunctionalityEnabled: true, itemNumberFunctionalityVisibleInProjects: true }));
    const col = tables.product.columns.find((c: any) => c.key === 'itemNumber')!;
    expect(col.validate!('100-0245', { rowGUID: 'p2' } as any)).toMatch(/already used/);
    expect(col.validate!('100-0245', { rowGUID: 'p1' } as any)).toBeNull();
    expect(col.validate!('', { rowGUID: 'p2' } as any)).toBeNull();
  });
});

// ---- the product window of a Material line ----
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

function mountPicker(projectSettings: Record<string, any>) {
  const data = { ...emptyTaskLineCatalogs(), productFolder: [], product: [phone, cable] as any };
  const col: any = buildTaskLineColumns({ data, genus: taskLineGenusDef('materialGenus')!, textColor: '#000', errorColor: '#f00', showErrors: false, productFields: productFieldsOfProject(projectSettings) }).find((c) => c.key === 'product');
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<>{col.renderPicker({ testID: 'pr', value: null, onChange: jest.fn(), disabled: false, compact: true, triggerStyle: {}, placeholder: 'Select product…', row: { rowGUID: 'L1', rowJSON: {} } })}</>));
  press('pr-trigger');
}
const text = () => document.body.textContent || '';

describe('the product window of a task line', () => {
  it('no switch: item number and search name are neither shown nor searched', async () => {
    mountPicker({});
    expect(text()).not.toContain('100-0245');
    await type('pr-search', '0245');
    expect(q('pr-tree-row-p1')).toBeNull();
  });
  it('Enabled, not Visible: not shown, but the search finds the product by item number and by search name', async () => {
    mountPicker(ON);
    expect(text()).not.toContain('100-0245');
    await type('pr-search', '0245');
    expect(q('pr-tree-row-p1')).not.toBeNull();
    expect(q('pr-tree-row-p2')).toBeNull();
    expect(text()).not.toContain('100-0245');
    await type('pr-search', 'nickname');
    expect(q('pr-tree-row-p1')).not.toBeNull();
  });
  it('Enabled + Visible: the Item number and Search name columns are shown', () => {
    mountPicker(ON_VISIBLE);
    expect(text()).toContain('Item number');
    expect(text()).toContain('100-0245');
    expect(text()).toContain('iph nickname');
  });
  it('List view: the shown fields are in the details line of the product', () => {
    mountPicker(ON_VISIBLE);
    press('pr-view-list');
    expect(q('pr-list-item-p1')!.textContent).toContain('100-0245 · iph nickname · A smart phone');
  });
});
