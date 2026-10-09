/** @jest-environment jsdom */
// ProductsWithTree (tab "Products & folders" of ProductDashboard) on the SQL seed: the folder tree beside the products
// table - counts, folder filter, folder CRUD saved through redux, products dragged onto a folder, folders dragged in the tree.
import React, { act } from 'react';
import { seedCatalog } from './productTestKit';
import { dragWithMouse, mockRects, rowTop } from '../../ui/tree/folderTreeTestKit';

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

import ProductDashboard from '../../../kit8/catalog/product/dashboard/ProductDashboard';
import { PRODUCT_TABLE_KEYS, PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import type { ProductCatalogData } from '../../../kit8/catalog/product/crud/productCatalogTools';
import { beginFolderDrag, endFolderDrag } from '../../../kit8/ui/components/tree/folderTreeDnd';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let restore: () => void;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const TABLE = 'products-tree-table';
const TREE = `${TABLE}-folders`;
const pickFolder = (id: string) => act(() => { (q(`${TREE}-row-${id}`)!.querySelector('[role="button"]') as HTMLElement).click(); });
const productRows = () => qa(`${TABLE}-row-`).filter((e) => /-row-[^-]+$/.test(String(e.getAttribute('data-testid'))));

function stateOf(data: ProductCatalogData) {
  const s: any = { uxuiState: { askBeforeDeletePost: true } };
  for (const k of PRODUCT_TABLE_KEYS) s[PRODUCT_TABLES[k].entity] = { entityDataFromServer: data[k], readSuccessful: 1 };
  return s;
}
function mount(data = seedCatalog()) {
  mockParams = { tab: 'productsTree' };
  mockState = stateOf(data);
  // fake window: the tree at the left, header 80 px, 2 pinned rows of 32 px, the list below
  restore = mockRects({
    [TREE]: { left: 0, top: 0, width: 270, height: 600 },
    [`${TREE}-pinned`]: { left: 0, top: 80, width: 270, height: 64 },
    [`${TREE}-list`]: { left: 0, top: 144, width: 270, height: 450 },
  });
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ProductDashboard />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; restore?.(); jest.clearAllMocks(); mockCalls.length = 0; });
const calls = (kind: string, entity: string) => mockCalls.filter((c) => c[0] === kind && c[1] === entity).map((c) => c[2]);
const rowY = (id: string, frac = 0.5) => 144 + rowTop(q(`${TREE}-row-${id}`)!) + 32 * frac;

it('the menu has "Products & folders"; the tab shows the tree beside the products table', () => {
  mount();
  expect(q('product-nav-productsTree')!.textContent).toContain('Products & folders');
  expect(q('products-with-tree-title')!.textContent).toBe('Products & folders');
  expect(q(TREE)).not.toBeNull();
  expect(productRows()).toHaveLength(106);
  // counts per folder, with subfolders
  expect(q(`${TREE}-row-fld_elec-count`)!.textContent).toBe('46');
  expect(q(`${TREE}-row-fld_mobile-count`)!.textContent).toBe('24');
  expect(q(`${TREE}-row-fld_food-count`)!.textContent).toBe('32');
  expect(q(`${TREE}-row-__tree_all__-count`)!.textContent).toBe('106');
  expect(q(`${TREE}-row-__tree_none__-count`)!.textContent).toBe('0');
});

it('picking a folder shows its products (with subfolders); "Add" creates the product in it', () => {
  mount();
  pickFolder('fld_mobile');
  expect(productRows()).toHaveLength(24);
  pickFolder('fld_elec');
  expect(productRows()).toHaveLength(46);
  pickFolder('fld_mobile');
  press(`${TABLE}-add`);
  expect(calls('create', 'productReusable')[0]).toEqual(expect.objectContaining({ rowParentGUID: 'fld_mobile' }));
});

it('products dragged onto a folder get its GUID (rowParentGUID); onto "No folder" they get none', () => {
  mount();
  act(() => { beginFolderDrag({ kind: 'items', ids: ['prod1', 'prod2'], label: '2 products', source: TABLE }, 40, rowY('fld_books')); });
  act(() => { endFolderDrag(); });
  const updates = calls('update', 'productReusable');
  expect(updates).toEqual([
    { rowGUID: 'prod1', rowOwnerGUID: expect.any(String), columns: { rowParentGUID: 'fld_books' } },
    { rowGUID: 'prod2', rowOwnerGUID: expect.any(String), columns: { rowParentGUID: 'fld_books' } },
  ]);
  mockCalls.length = 0;
  act(() => { beginFolderDrag({ kind: 'items', ids: ['prod1'], label: 'x', source: TABLE }, 40, 80 + 32 + 16); });
  act(() => { endFolderDrag(); });
  expect(calls('update', 'productReusable')).toEqual([{ rowGUID: 'prod1', rowOwnerGUID: expect.any(String), columns: { rowParentGUID: 'empty' } }]);
});

describe('folders: CRUD is saved to productFolderTable', () => {
  it('new top level folder', () => {
    mount();
    press(`${TREE}-new-root`);
    expect(calls('create', 'productFolderReusable')).toEqual([{
      rowGUID: expect.any(String), rowOwnerGUID: 'productFolderCatalog', rowParentGUID: 'empty', orderInList: 14000, rowJSON: { title: 'New folder' },
    }]);
  });
  it('new subfolder of the picked folder: last child', () => {
    mount();
    pickFolder('fld_audio');
    press(`${TREE}-new-sub`);
    expect(calls('create', 'productFolderReusable')[0]).toEqual(expect.objectContaining({ rowParentGUID: 'fld_audio', orderInList: 1000, rowJSON: { title: 'New folder' } }));
  });
  it('rename', () => {
    mount();
    pickFolder('fld_audio');
    press(`${TREE}-rename`);
    const input = q(`${TREE}-row-fld_audio-input`) as HTMLInputElement;
    act(() => { input.focus(); });
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Sound');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { input.blur(); });
    expect(calls('update', 'productFolderReusable')).toEqual([{ rowGUID: 'fld_audio', rowOwnerGUID: 'productFolderCatalog', rowJSON: { title: 'Sound' } }]);
  });
  it('delete: the folder and its subfolders go, their products get no folder (and are kept)', () => {
    mount();
    pickFolder('fld_food');
    press(`${TREE}-delete`);
    expect(q('ask-body')!.textContent).toContain('3 subfolders');
    press('ask-confirm');
    const deleted = calls('delete', 'productFolderReusable').map((c) => c.rowGUID).sort();
    expect(deleted).toEqual(['fld_coffee', 'fld_drinks', 'fld_food', 'fld_meals']);
    expect(calls('delete', 'productReusable')).toHaveLength(0);
    const freed = calls('update', 'productReusable');
    expect(freed).toHaveLength(32);
    expect(freed.every((u) => u.columns.rowParentGUID === 'empty')).toBe(true);
    expect(mockDispatch).toHaveBeenCalledWith({ type: 'snackbar', p: { message: '32 products moved to "No folder"' } });
  });
  it('a folder dragged inside another folder: one update with the new parent and order', () => {
    mount();
    // Books (top level) onto the middle of Food
    dragWithMouse(q(`${TREE}-row-fld_books`)!, [[40, rowY('fld_books')], [40, rowY('fld_books') - 9], [40, rowY('fld_food')]]);
    expect(calls('update', 'productFolderReusable')).toEqual([{
      rowGUID: 'fld_books', rowOwnerGUID: 'productFolderCatalog', columns: { rowParentGUID: 'fld_food', orderInList: 13000 },
    }]);
  });
  it('a folder dragged into its own subfolder: nothing is saved', () => {
    mount();
    dragWithMouse(q(`${TREE}-row-fld_elec`)!, [[40, rowY('fld_elec')], [40, rowY('fld_elec') + 9], [40, rowY('fld_audio')]]);
    expect(calls('update', 'productFolderReusable')).toHaveLength(0);
  });
});

describe('a table opened from a row menu has a back arrow to the row it came from', () => {
  const rerender = () => act(() => root.render(<ProductDashboard />));
  it('Products & folders -> Prices -> back: the same tab, the product row focused', () => {
    mount();
    press(`${TABLE}-menu-button-prod1`);
    press('product-open-prices-prod1');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'productPrice' }));
    rerender();
    expect(q('product-table-title')!.textContent).toBe('Prices');
    expect(q('product-table-back')).not.toBeNull();
    mockSetParams.mockClear();
    press('product-table-back');
    expect(mockSetParams).toHaveBeenCalledWith({ tab: 'productsTree', focusRowGUID: 'prod1' });
    rerender();
    expect(q('product-table-back')).toBeNull();
    expect(q('products-with-tree')).not.toBeNull();
  });
  it('the picked folder is still picked after coming back', () => {
    mount();
    pickFolder('fld_mobile');
    expect(productRows()).toHaveLength(24);
    press(`${TABLE}-menu-button-prod1`);
    press('product-open-barcodes-prod1');
    rerender();
    press('product-table-back');
    rerender();
    expect(productRows()).toHaveLength(24);
  });
  it('a menu item of the menu (not the back arrow) clears it', () => {
    mount();
    press(`${TABLE}-menu-button-prod1`);
    press('product-open-prices-prod1');
    rerender();
    press('product-nav-productBarcode');
    rerender();
    expect(q('product-table-back')).toBeNull();
  });
  it('from the Products table too (the plain tab)', () => {
    mockParams = { tab: 'product' };
    mount();
    mockParams = { tab: 'product' };
    rerender();
    press('product-table-product-menu-button-prod1');
    press('product-open-prices-prod1');
    rerender();
    mockSetParams.mockClear();
    press('product-table-back');
    expect(mockSetParams).toHaveBeenCalledWith({ tab: 'product', focusRowGUID: 'prod1' });
  });
});

describe('ProductItemEditModalCard (right-click a product -> Edit)', () => {
  const CARD = `${TABLE}-edit`;
  const openCard = (guid: string) => { press(`${TABLE}-menu-button-${guid}`); press(`${TABLE}-menu-edit`); };
  const data = seedCatalog();
  const pricesOf = (g: string) => data.productPrice.filter((p) => p.rowOwnerGUID === g).map((p) => p.rowGUID);

  it('the row menu has Edit; the card opens on Main with the product fields', () => {
    mount();
    expect(q(CARD)).toBeNull();
    openCard('prod2');
    expect(q(CARD)).not.toBeNull();
    expect(q(`${CARD}-title`)!.textContent).toBe('iPhone 11');
    for (const t of ['main', 'prices', 'variants', 'properties']) expect(q(`${CARD}-tab-${t}`)).not.toBeNull();
    expect((q(`${CARD}-main-cell-prod2-title`) as HTMLInputElement).value).toBe('iPhone 11');
    expect(q(`${CARD}-main-cell-prod2-productVATRate`)).not.toBeNull();
    expect(q(`${CARD}-tab-prices`)!.textContent).toBe(`Prices (${pricesOf('prod2').length})`);
  });

  it('Main: a changed text field is saved like an in-place edit when the card closes (and not once per key)', () => {
    mount();
    openCard('prod2');
    const input = q(`${CARD}-main-cell-prod2-title`) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => { setter.call(input, 'iPhone 11 Pro'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    expect(calls('update', PRODUCT_TABLES.product.entity).filter((p) => p.rowGUID === 'prod2')).toHaveLength(0);
    press(`${CARD}-done`);
    expect(calls('update', PRODUCT_TABLES.product.entity).some((p) => p.rowGUID === 'prod2' && p.rowJSON?.title === 'iPhone 11 Pro')).toBe(true);
  });

  it('Prices / Properties: the rows of THIS product only, without the product column', () => {
    mount();
    openCard('prod2');
    press(`${CARD}-tab-prices`);
    const T = `${CARD}-prices`;
    const shown = qa(`${T}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${T}-row-`, '')).filter((g) => !g.includes('-'));
    expect(shown.sort()).toEqual(pricesOf('prod2').sort());
    expect(q(`${T}-cell-${pricesOf('prod2')[0]}-product`)).toBeNull();
    press(`${CARD}-tab-properties`);
    const P = `${CARD}-properties`;
    const props = data.propertyValue.filter((p) => p.rowOwnerGUID === 'prod2').map((p) => p.rowGUID);
    expect(props.length).toBeGreaterThan(0);
    expect(props.every((g) => q(`${P}-row-${g}`))).toBe(true);
  });

  it('Variants: the variants of the owner (the type for perType) with a note, without the owner column', () => {
    mount();
    openCard('prod2');
    press(`${CARD}-tab-variants`);
    const V = `${CARD}-variants`;
    const own = data.variant.filter((v) => v.rowOwnerGUID === 'smartphone1').map((v) => v.rowGUID);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((g) => q(`${V}-row-${g}`))).toBe(true);
    expect(q(`${CARD}-variants-owner`)!.textContent).toContain('Smartphone');
    expect(q(`${V}-cell-${own[0]}-owner`)).toBeNull();
  });

  it('Done closes the card', () => {
    mount();
    openCard('prod2');
    press(`${CARD}-done`);
    expect(q(CARD)).toBeNull();
  });

  it('Main: lists are SelectorFromApp, yes / no is SwitchApp; both save through setCell (VAT rate, Active)', () => {
    mount();
    openCard('prod2');
    press(`${CARD}-main-cell-prod2-productVATRate-option-vat_12`);
    expect(calls('update', PRODUCT_TABLES.product.entity).some((p) => p.rowGUID === 'prod2' && p.rowJSON?.productVATRate === 'vat_12')).toBe(true);
    press(`${CARD}-main-cell-prod2-productVATRate-option-none`);
    expect(calls('update', PRODUCT_TABLES.product.entity).some((p) => p.rowGUID === 'prod2' && p.rowJSON?.productVATRate === null)).toBe(true);
    // prod2 has no isActive in the seed: off, exactly like the boolean cell of the table
    expect(q(`${CARD}-main-cell-prod2-isActive`)!.getAttribute('aria-checked')).toBe('false');
    press(`${CARD}-main-cell-prod2-isActive`);
    expect(calls('update', PRODUCT_TABLES.product.entity).some((p) => p.rowGUID === 'prod2' && p.rowJSON?.isActive === true)).toBe(true);
  });
});

describe('productModalLook (window per design system)', () => {
  const { productModalLook } = require('../../../kit8/catalog/product/card/ProductItemEditModalCard');
  it('every design system has its own corners; Material = 28, Ant gets a header band, Apple uses its backdrop', () => {
    const systems = ['tamagui', 'paper', 'ant', 'native', 'expo', 'googlemd3web', 'applemacui'] as const;
    const looks = Object.fromEntries(systems.map((s) => [s, productModalLook(s, false)]));
    expect(looks.paper.radius).toBe(28);
    expect(looks.googlemd3web.radius).toBe(28);
    expect(looks.native.radius).toBeLessThan(looks.tamagui.radius);
    expect(looks.ant.headerBand).toBe('#fafafa');
    expect(productModalLook('ant', true).headerBand).toBe('#1a2234');
    expect(looks.applemacui.borderWidth).toBe(0);
    expect(productModalLook('applemacui', false, 'rgba(1,2,3,0.4)').backdrop).toBe('rgba(1,2,3,0.4)');
    expect(productModalLook('native', true).backdrop).not.toBe(productModalLook('native', false).backdrop);
  });
});
