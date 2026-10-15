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

it('Catalogs, then Budgets, come right before Projects', () => {
  mount('/home');
  const ids = Array.from(document.querySelectorAll('[data-testid^="drawer-item-"]')).map((e) => e.getAttribute('data-testid'));
  expect(ids.indexOf('drawer-item-budgets')).toBe(ids.indexOf('drawer-item-pm-projects') - 1);
  expect(ids.indexOf('drawer-item-catalogs')).toBe(ids.indexOf('drawer-item-budgets') - 1);
});

it('Reports (after Products) is a closed accordion with Monitor01, which opens the separate screen', () => {
  mount('/home');
  const ids = Array.from(document.querySelectorAll('[data-testid^="drawer-item-"]')).map((e) => e.getAttribute('data-testid'));
  expect(ids.indexOf('drawer-item-reports')).toBe(ids.indexOf('drawer-item-products') + 1);
  expect(q('drawer-subitem-reports-monitor01')).toBeNull(); // closed
  press('drawer-item-reports');
  expect(q('drawer-subitem-reports-monitor01')!.textContent).toContain('Monitor01');
  press('drawer-subitem-reports-monitor01');
  expect(mockNavigate).toHaveBeenCalledWith('/pm/reports/monitor01');
});

it('Budgets is a closed accordion: Budget Items, Budget scenarios, Business units, Resource contract templates, Resource roles (also kept in Catalogs), a divider, then Actuals and Vendor invoices', () => {
  mount('/home');
  expect(q('drawer-subitem-budgets-budgetitems')).toBeNull(); // closed
  expect(q('drawer-divider-budgets-divider')).toBeNull();
  press('drawer-item-budgets');
  const subs = Array.from(document.querySelectorAll('[data-testid^="drawer-subitem-"]')).map((e) => e.textContent);
  const labels = ['Budget Items', 'Budget scenarios', 'Business units', 'Resource contract templates', 'Resource roles', 'Actuals', 'Vendor invoices'];
  expect(subs).toHaveLength(labels.length);
  labels.forEach((label, i) => expect(subs[i]).toContain(label)); // in this order (the mocked icon adds its name to the text)
  // the divider sits between the catalogs and Actuals
  const order = Array.from(document.querySelectorAll('[data-testid^="drawer-subitem-"], [data-testid^="drawer-divider-"]')).map((e) => e.getAttribute('data-testid'));
  expect(order.indexOf('drawer-divider-budgets-divider')).toBe(order.indexOf('drawer-subitem-budgets-resourceroles') + 1);
  expect(order.indexOf('drawer-subitem-budgets-actuals')).toBe(order.indexOf('drawer-divider-budgets-divider') + 1);
  expect(order.indexOf('drawer-subitem-budgets-vendorinvoices')).toBe(order.indexOf('drawer-subitem-budgets-actuals') + 1);   // Vendor invoices right after Actuals
  press('drawer-subitem-budgets-budgetscenarios');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/budget/scenario/list');
  press('drawer-subitem-budgets-businessunits');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/business/unit');
  press('drawer-subitem-budgets-actuals');
  expect(mockNavigate).toHaveBeenCalledWith('/pm/fact/list');
  press('drawer-subitem-budgets-vendorinvoices');
  expect(mockNavigate).toHaveBeenCalledWith('/pm/vendor-invoice/list');
  press('drawer-item-catalogs');
  for (const id of ['budgetitems', 'budgetscenarios', 'businessunits', 'templateresourcecontracts', 'resourceroles']) expect(q(`drawer-subitem-${id}`)).not.toBeNull();
  expect(q('drawer-subitem-actuals')).toBeNull(); // Actuals is not a catalog
  expect(q('drawer-subitem-legalentities')).not.toBeNull(); // the legal entities are a catalog (Catalogs > Legal entities)
});

it('the divider is not a button and Budgets opens by itself on the Actuals list', () => {
  mount('/pm/fact/list');
  expect(q('drawer-subitem-budgets-actuals')).not.toBeNull();
  expect(q('drawer-divider-budgets-divider')!.getAttribute('data-testid')).toBe('drawer-divider-budgets-divider');
  expect(q('drawer-divider-budgets-divider')!.textContent).toBe('');
});

it('Products (product catalog dashboard) is a menu item after Projects and opens the dashboard', () => {
  mount('/home');
  const ids = Array.from(document.querySelectorAll('[data-testid^="drawer-item-"]')).map((e) => e.getAttribute('data-testid'));
  expect(ids.indexOf('drawer-item-products')).toBe(ids.indexOf('drawer-item-pm-projects') + 1);
  press('drawer-item-products');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/product/dashboard');
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

