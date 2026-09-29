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

it('Catalogs is a closed accordion; press opens it; Currencies is a compact sub-row that navigates', () => {
  mount('/home');
  expect(q('drawer-item-catalogs')).not.toBeNull();
  expect(q('drawer-item-currencies')).toBeNull(); // not a top-level row any more
  expect(q('drawer-subitem-currencies')).toBeNull(); // closed
  press('drawer-item-catalogs');
  expect(mockNavigate).not.toHaveBeenCalled(); // a group only toggles
  const sub = q('drawer-subitem-currencies')!;
  expect(sub.textContent).toContain('Currencies');
  expect(getComputedStyle(sub).height).toBe(`${DRAWER_SUBITEM_HEIGHT}px`);
  press('drawer-subitem-currencies');
  expect(mockNavigate).toHaveBeenCalledWith('/currency/list');
  press('drawer-item-catalogs');
  expect(q('drawer-subitem-currencies')).toBeNull(); // closed again
});

it('opens by itself on a catalog page (list or edit)', () => {
  mount('/currency/list');
  expect(q('drawer-subitem-currencies')).not.toBeNull();
  act(() => root.unmount());
  mount('/currency/edit');
  expect(q('drawer-subitem-currencies')).not.toBeNull();
});
