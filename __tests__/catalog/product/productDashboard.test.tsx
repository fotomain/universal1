/** @jest-environment jsdom */
// ProductDashboard with the SQL seed in redux: overview numbers + checks, tables with filters, product card,
// generate variants, rebuild variant titles.
import React, { act } from 'react';
import { seedCatalog } from './productTestKit';

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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), setParams: mockSetParams }), usePathname: () => '/catalog/product/dashboard', useGlobalSearchParams: () => mockParams }));
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
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));
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

import ProductDashboard from '../../../kit8/catalog/product/dashboard/ProductDashboard';
import { PRODUCT_TABLE_KEYS, PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import type { ProductCatalogData } from '../../../kit8/catalog/product/crud/productCatalogTools';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });

function stateOf(data: ProductCatalogData) {
  const s: any = { uxuiState: {} };
  for (const k of PRODUCT_TABLE_KEYS) s[PRODUCT_TABLES[k].entity] = { entityDataFromServer: data[k], readSuccessful: 1 };
  return s;
}
function mount(params: Record<string, string> = {}, data = seedCatalog()) {
  mockParams = params;
  mockState = stateOf(data);
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ProductDashboard />));
}
const rerender = () => act(() => root.render(<ProductDashboard />));
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

it('overview: numbers of the seed, no check errors, every table in the menu', () => {
  mount();
  expect(q('product-tile-products-value')!.textContent).toBe('106');
  expect(q('product-tile-types-value')!.textContent).toBe('11');
  expect(q('product-checks')!.textContent).not.toMatch(/Errors [1-9]/);
  expect(qa('product-nav-').filter((e) => !String(e.getAttribute('data-testid')).endsWith('-issues'))).toHaveLength(21);
  expect(q('product-setup')).toBeNull();
});

it('a menu item opens the table (route parameter tab); the type filter shows only that type', () => {
  mount();
  press('product-nav-product');
  expect(mockSetParams).toHaveBeenCalledWith(expect.objectContaining({ tab: 'product' }));
  rerender();
  expect(q('product-table-title')!.textContent).toBe('Products');
  expect(qa('product-table-product-row-')).toHaveLength(106);
  press('product-filter-type');
  press('product-filter-picker-option-laptop1');
  expect(qa('product-table-product-row-')).toHaveLength(10);
  expect(q('product-filter-type')!.textContent).toContain('Laptop');
  // a new product gets the filter's type
  press('product-table-product-add');
  expect(mockCalls.find((c) => c[0] === 'create')).toEqual(['create', 'productReusable', expect.objectContaining({ rowOwnerGUID: 'laptop1', rowParentGUID: 'empty' })]);
});

it('a catalog table without owner column: new rows get the catalog owner', () => {
  mount({ tab: 'measureUnit' });
  press('product-table-measureUnit-add');
  expect(mockCalls[0]).toEqual(['create', 'measureUnitReusable', expect.objectContaining({ rowOwnerGUID: 'measureUnitCatalog' })]);
});

it('product card: properties, variants with today prices', () => {
  mount({ tab: 'card', product: 'prod2' });
  expect(q('product-card-title')!.textContent).toBe('iPhone 11');
  expect(q('product-card-properties')!.textContent).toContain('Apple');
  expect(q('product-card-variant-pv1')!.textContent).toContain('Red / 256 GB');
});

it('generate variants for a type: creates the variants and their values', () => {
  mount();
  press('product-generate-variants-header');
  press('generate-variants-owner');
  press('generate-variants-owner-picker-option-headphones1');
  // headphones: one descriptor (color); 4 colors exist -> the other colors are planned
  const n = Number(q('generate-variants-count')!.textContent!.split(' ')[0]);
  expect(n).toBeGreaterThan(0);
  press('generate-variants-create');
  const created = mockCalls.filter((c) => c[0] === 'create');
  expect(created.filter((c) => c[1] === 'variantReusable')).toHaveLength(n);
  expect(created.filter((c) => c[1] === 'variantValueReusable')).toHaveLength(n);
  expect(created[0][2]).toMatchObject({ rowOwnerGUID: 'headphones1', rowJSON: expect.objectContaining({ isActive: true }) });
});

it('checks: a stale variant title can be rebuilt from the overview', () => {
  const data = seedCatalog();
  data.variant.find((v) => v.rowGUID === 'pv2')!.rowJSON.title = 'Wrong';
  mount({}, data);
  expect(q('product-issue-R10-pv2')).not.toBeNull();
  press('product-checks-rebuild-all');
  expect(mockCalls).toEqual([['update', 'variantReusable', { rowGUID: 'pv2', rowOwnerGUID: 'smartphone1', rowJSON: { title: 'Midnight black / 256 GB', descriptorKey: 'dp1=dv2|dp2=dv3' } }]]);
});

it('no tables yet: the setup hint names the SQL file', () => {
  const empty = {} as ProductCatalogData;
  for (const k of PRODUCT_TABLE_KEYS) empty[k] = [];
  mount({}, empty);
  expect(q('product-setup')!.textContent).toContain('create_product_tables.sql');
});
