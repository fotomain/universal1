/** @jest-environment jsdom */
// Hamburger menu: "Catalogs" accordion group with compact sub-rows (Currencies).
import React, { act } from 'react';

const mockNavigate = jest.fn();
let mockPath = '/home';
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate, replace: jest.fn() }), usePathname: () => mockPath }));
jest.mock('expo-router/drawer', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { DrawerContentScrollView: ({ children }: any) => R.createElement(View, null, children) };
});
jest.mock('react-native-paper', () => ({ Drawer: { Item: () => null } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('react-redux', () => ({ useSelector: (sel: any) => sel({ activeUserState: { activeUserEmail: 'a@b.com' } }) }));
jest.mock('../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../kit8/ui/components/LanguageSelectorComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('../kit8/ui/components/DarkThemeSwitchComponent', () => ({ __esModule: true, default: () => null }));

import CustomDrawerContent, { DRAWER_SUBITEM_HEIGHT } from '../kit8/ui/components/CustomDrawerContent';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });
function mount(path: string) {
  mockPath = path;
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<CustomDrawerContent {...({ navigation: { closeDrawer: jest.fn() } } as any)} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); });

it('Catalogs is a closed accordion; press opens it; Currencies, Persons, Partners, Countries, Business units navigate', () => {
  mount('/home');
  expect(q('drawer-item-catalogs')).not.toBeNull();
  expect(q('drawer-item-currencies')).toBeNull(); // not a top-level row any more
  expect(q('drawer-subitem-currencies')).toBeNull(); // closed
  expect(q('drawer-subitem-persons')).toBeNull();
  expect(q('drawer-subitem-partners')).toBeNull();
  expect(q('drawer-subitem-countries')).toBeNull();
  expect(q('drawer-subitem-businessunits')).toBeNull();
  press('drawer-item-catalogs');
  expect(mockNavigate).not.toHaveBeenCalled(); // a group only toggles

  // Currencies
  const subCurr = q('drawer-subitem-currencies')!;
  expect(subCurr.textContent).toContain('Currencies');
  expect(getComputedStyle(subCurr).height).toBe(`${DRAWER_SUBITEM_HEIGHT}px`);
  press('drawer-subitem-currencies');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/currency/list');

  // Persons
  const subPerson = q('drawer-subitem-persons')!;
  expect(subPerson.textContent).toContain('Persons');
  press('drawer-subitem-persons');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/person/list');

  // Partners
  const subPartner = q('drawer-subitem-partners')!;
  expect(subPartner.textContent).toContain('Partners');
  press('drawer-subitem-partners');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/partner/list');

  // Countries
  const subCountry = q('drawer-subitem-countries')!;
  expect(subCountry.textContent).toContain('Countries');
  press('drawer-subitem-countries');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/country');

  // Business units (replace the removed Departments)
  expect(q('drawer-subitem-departaments')).toBeNull();
  const subUnit = q('drawer-subitem-businessunits')!;
  expect(subUnit.textContent).toContain('Business units');
  press('drawer-subitem-businessunits');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/business/unit');

  press('drawer-item-catalogs');
  expect(q('drawer-subitem-currencies')).toBeNull(); // closed again
});

it('the order of the menu: Catalogs, Documents, Project Dashboard, Reports, Budgets (after Home, Developer 1, Media Posts, Record, Play)', () => {
  mount('/home');
  const ids = Array.from(document.querySelectorAll('[data-testid^="drawer-item-"]')).map((e) => e.getAttribute('data-testid'));
  const order = ['drawer-item-catalogs', 'drawer-item-documents', 'drawer-item-pm-projects', 'drawer-item-reports', 'drawer-item-budgets'];
  const at = order.map((id) => ids.indexOf(id));
  expect(at.every((i) => i >= 0)).toBe(true);
  expect(at).toEqual([at[0], at[0] + 1, at[0] + 2, at[0] + 3, at[0] + 4]);
  expect(ids.indexOf('drawer-item-play')).toBeLessThan(at[0]);
  // Products and Users (RACI) are not top-level rows any more: they are in Catalogs
  expect(ids).not.toContain('drawer-item-products');
  expect(ids).not.toContain('drawer-item-raci');
});

it('Documents (right after Catalogs) is a closed accordion: Fact input, Product receipts, Purchase orders and Vendor invoices (by name)', () => {
  mount('/home');
  const ids = Array.from(document.querySelectorAll('[data-testid^="drawer-item-"]')).map((e) => e.getAttribute('data-testid'));
  expect(ids.indexOf('drawer-item-documents')).toBe(ids.indexOf('drawer-item-catalogs') + 1);
  expect(q('drawer-subitem-documents-factinput')).toBeNull(); // closed
  press('drawer-item-documents');
  const subs = Array.from(document.querySelectorAll('[data-testid^="drawer-subitem-"]')).map((e) => e.textContent);
  expect(subs).toHaveLength(4);
  expect(subs[0]).toContain('Fact input');
  expect(subs[1]).toContain('Product receipts');
  expect(subs[2]).toContain('Purchase orders');
  expect(subs[3]).toContain('Vendor invoices');
  press('drawer-subitem-documents-factinput');
  expect(mockNavigate).toHaveBeenCalledWith('/pm/fact/list');
  press('drawer-subitem-documents-productreceipts');
  expect(mockNavigate).toHaveBeenCalledWith('/pm/product-receipt/list');
  press('drawer-subitem-documents-purchaseorders');
  expect(mockNavigate).toHaveBeenCalledWith('/pm/purchase-order/list');
  press('drawer-subitem-documents-vendorinvoices');
  expect(mockNavigate).toHaveBeenCalledWith('/pm/vendor-invoice/list');
});

it('Documents opens by itself on the fact input list and on the vendor invoice list', () => {
  mount('/pm/fact/list');
  expect(q('drawer-subitem-documents-factinput')).not.toBeNull();
  act(() => root?.unmount()); document.body.innerHTML = '';
  mount('/pm/vendor-invoice/list');
  expect(q('drawer-subitem-documents-vendorinvoices')).not.toBeNull();
});

it('Reports (after Project Dashboard) is a closed accordion with Monitor01, which opens the separate screen', () => {
  mount('/home');
  expect(q('drawer-subitem-reports-monitor01')).toBeNull(); // closed
  press('drawer-item-reports');
  expect(q('drawer-subitem-reports-monitor01')!.textContent).toContain('Monitor01');
  press('drawer-subitem-reports-monitor01');
  expect(mockNavigate).toHaveBeenCalledWith('/pm/reports/monitor01');
});

it('Budgets is a closed accordion with the catalogs a budget is built from (also kept in Catalogs); Actuals and Vendor invoices moved to Documents', () => {
  mount('/home');
  expect(q('drawer-subitem-budgets-budgetitems')).toBeNull(); // closed
  press('drawer-item-budgets');
  const subs = Array.from(document.querySelectorAll('[data-testid^="drawer-subitem-"]')).map((e) => e.textContent);
  const labels = ['Budget Items', 'Budget scenarios', 'Business units', 'Resource contract templates', 'Resource roles'];
  expect(subs).toHaveLength(labels.length);
  labels.forEach((label, i) => expect(subs[i]).toContain(label)); // in this order (the mocked icon adds its name to the text)
  expect(q('drawer-subitem-budgets-actuals')).toBeNull();
  expect(q('drawer-subitem-budgets-vendorinvoices')).toBeNull();
  press('drawer-subitem-budgets-budgetscenarios');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/budget/scenario/list');
  press('drawer-subitem-budgets-businessunits');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/business/unit');
  press('drawer-item-catalogs');
  for (const id of ['budgetitems', 'budgetscenarios', 'businessunits', 'templateresourcecontracts', 'resourceroles']) expect(q(`drawer-subitem-${id}`)).not.toBeNull();
  expect(q('drawer-subitem-actuals')).toBeNull(); // Actuals is not a catalog
  expect(q('drawer-subitem-legalentities')).not.toBeNull(); // the legal entities are a catalog (Catalogs > Legal entities)
});

it('Products (product catalog dashboard) and Users (RACI) are in Catalogs (sorted by name) and open their pages', () => {
  mount('/home');
  expect(q('drawer-subitem-products')).toBeNull(); // closed
  press('drawer-item-catalogs');
  const subs = Array.from(document.querySelectorAll('[data-testid^="drawer-subitem-"]')).map((e) => e.getAttribute('data-testid'));
  expect(subs.indexOf('drawer-subitem-products')).toBe(subs.indexOf('drawer-subitem-catalog-projects') - 1);   // Products right before Projects
  expect(subs[subs.length - 1]).toBe('drawer-subitem-raci');                                                   // Users (RACI) after User roles, last
  expect(subs.indexOf('drawer-subitem-raci')).toBe(subs.indexOf('drawer-subitem-user-roles') + 1);
  press('drawer-subitem-products');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/product/dashboard');
  press('drawer-subitem-raci');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/raci/racimember');
});

it('Catalogs opens by itself on the product dashboard and on the RACI page', () => {
  mount('/catalog/product/dashboard');
  expect(q('drawer-subitem-products')).not.toBeNull();
  act(() => root?.unmount()); document.body.innerHTML = '';
  mount('/catalog/raci/racimember');
  expect(q('drawer-subitem-raci')).not.toBeNull();
});

it('opens by itself on a catalog page (list or edit)', () => {
  mount('/catalog/currency/list');
  expect(q('drawer-subitem-currencies')).not.toBeNull();
  act(() => root.unmount());
  mount('/catalog/currency/edit');
  expect(q('drawer-subitem-currencies')).not.toBeNull();
  act(() => root.unmount());
  mount('/catalog/person/list');
  expect(q('drawer-subitem-persons')).not.toBeNull();
  act(() => root.unmount());
  mount('/catalog/partner/list');
  expect(q('drawer-subitem-partners')).not.toBeNull();
  act(() => root.unmount());
  mount('/catalog/country');
  expect(q('drawer-subitem-countries')).not.toBeNull();
  act(() => root.unmount());
  mount('/catalog/business/unit');
  expect(q('drawer-subitem-businessunits')).not.toBeNull();
});


it('Record (Audio, Video) and Play (Audio, Video) are closed accordions that open the media screens', () => {
  mount('/home');
  const ids = Array.from(document.querySelectorAll('[data-testid^="drawer-item-"]')).map((e) => e.getAttribute('data-testid'));
  expect(ids.indexOf('drawer-item-record')).toBe(ids.indexOf('drawer-item-posts') + 1);
  expect(ids.indexOf('drawer-item-play')).toBe(ids.indexOf('drawer-item-record') + 1);
  expect(q('drawer-subitem-record-audio')).toBeNull(); // closed
  expect(q('drawer-subitem-play-audio')).toBeNull();

  press('drawer-item-record');
  expect(mockNavigate).not.toHaveBeenCalled(); // a group only toggles
  expect(q('drawer-subitem-record-audio')!.textContent).toContain('Audio');
  expect(q('drawer-subitem-record-video')!.textContent).toContain('Video');
  press('drawer-subitem-record-audio');
  expect(mockNavigate).toHaveBeenLastCalledWith('/media/record/audio');
  press('drawer-subitem-record-video');
  expect(mockNavigate).toHaveBeenLastCalledWith('/media/record/video');

  press('drawer-item-play');
  press('drawer-subitem-play-audio');
  expect(mockNavigate).toHaveBeenLastCalledWith('/media/play/audio');
  press('drawer-subitem-play-video');
  expect(mockNavigate).toHaveBeenLastCalledWith('/media/play/video');
});

it('Record opens by itself while a record screen is shown', () => {
  mount('/media/record/video');
  expect(q('drawer-subitem-record-video')).not.toBeNull();
  expect(q('drawer-subitem-play-video')).toBeNull();
});
