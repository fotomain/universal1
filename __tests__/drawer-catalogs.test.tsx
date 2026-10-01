/** @jest-environment jsdom */
// Hamburger menu: "Catalogs" accordion group with compact sub-rows (Currencies).
import React, { act } from 'react';

const mockNavigate = jest.fn();
let mockPath = '/home';
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate, replace: jest.fn() }), usePathname: () => mockPath }));
jest.mock('@react-navigation/drawer', () => {
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
jest.mock('../kit8/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('../kit8/components/LanguageSelectorComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('../kit8/components/DarkThemeSwitchComponent', () => ({ __esModule: true, default: () => null }));

import CustomDrawerContent, { DRAWER_SUBITEM_HEIGHT } from '../kit8/components/CustomDrawerContent';

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

it('Catalogs is a closed accordion; press opens it; Currencies, Persons, Partners, Countries, Departments navigate', () => {
  mount('/home');
  expect(q('drawer-item-catalogs')).not.toBeNull();
  expect(q('drawer-item-currencies')).toBeNull(); // not a top-level row any more
  expect(q('drawer-subitem-currencies')).toBeNull(); // closed
  expect(q('drawer-subitem-persons')).toBeNull();
  expect(q('drawer-subitem-partners')).toBeNull();
  expect(q('drawer-subitem-countries')).toBeNull();
  expect(q('drawer-subitem-departaments')).toBeNull();
  press('drawer-item-catalogs');
  expect(mockNavigate).not.toHaveBeenCalled(); // a group only toggles

  // Currencies
  const subCurr = q('drawer-subitem-currencies')!;
  expect(subCurr.textContent).toContain('Currencies');
  expect(getComputedStyle(subCurr).height).toBe(`${DRAWER_SUBITEM_HEIGHT}px`);
  press('drawer-subitem-currencies');
  expect(mockNavigate).toHaveBeenCalledWith('/currency/list');

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

  // Departments
  const subDept = q('drawer-subitem-departaments')!;
  expect(subDept.textContent).toContain('Departments');
  press('drawer-subitem-departaments');
  expect(mockNavigate).toHaveBeenCalledWith('/catalog/departament');

  press('drawer-item-catalogs');
  expect(q('drawer-subitem-currencies')).toBeNull(); // closed again
});

it('Catalogs comes right before Projects', () => {
  mount('/home');
  const ids = Array.from(document.querySelectorAll('[data-testid^="drawer-item-"]')).map((e) => e.getAttribute('data-testid'));
  expect(ids.indexOf('drawer-item-catalogs')).toBe(ids.indexOf('drawer-item-pm-projects') - 1);
});

it('opens by itself on a catalog page (list or edit)', () => {
  mount('/currency/list');
  expect(q('drawer-subitem-currencies')).not.toBeNull();
  act(() => root.unmount());
  mount('/currency/edit');
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
  mount('/catalog/departament');
  expect(q('drawer-subitem-departaments')).not.toBeNull();
});

