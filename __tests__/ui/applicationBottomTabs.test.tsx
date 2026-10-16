/** @jest-environment jsdom */
// ApplicationBottomTabsApp: navigates with expo-router, marks the active tab by the path, follows the design system, and tells redux the bar is on the screen (the FAB stands above it).
import { act } from 'react';
import { cleanupUI, press, q, qa, renderUI, textOf } from '../pm/ui/pmUiTestKit';

const mockPush = jest.fn();
let mockPath = '/posts/mediapostcrud';
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => mockPath }));
const mockDispatch = jest.fn();
jest.doMock('react-redux', () => ({ ...jest.requireActual('react-redux'), useDispatch: () => mockDispatch, useSelector: (fn: any) => fn({ activeUserState: { activeUserGUID: 'user-1' } }) }));
jest.doMock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.doMock('@expo/vector-icons/MaterialCommunityIcons', () => ({ __esModule: true, default: ({ name }: any) => require('react').createElement('span', { 'data-icon': name }) }));
let mockSystem = 'native';
jest.doMock('../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ activeSystem: mockSystem, themeColors: { primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626', card: '#fff' } }) }));
jest.doMock('react-native-safe-area-context', () => ({ SafeAreaInsetsContext: require('react').createContext({ bottom: 20, top: 0, left: 0, right: 0 }) }));

const ApplicationBottomTabsApp = require('../../kit8/ui/components/app_bottom_tabs/ApplicationBottomTabsApp').default;
import React from 'react';
import { setBottomTabsAreVisible } from '../../kit8/redux/uxuiSlice';

const TABS = [
  { tabIcon: 'home', tabTitle: 'Home', tabRoute: 'home' },
  { tabIcon: 'link-variant', tabTitle: 'Media', tabRoute: 'posts/mediapostcrud' },
  { tabIcon: 'format-list-checks', tabTitle: 'My', tabRoute: 'raci/racidashboard', params: { raciGUID: 'g' } },
];
afterEach(() => { cleanupUI(); jest.clearAllMocks(); mockPath = '/posts/mediapostcrud'; mockSystem = 'native'; });

it('shows a tab for each item; the tab of the current path is selected', () => {
  renderUI(<ApplicationBottomTabsApp tabsArray={TABS} />);
  expect(qa('app-bottom-tabs-tab-')).toEqual(['app-bottom-tabs-tab-0', 'app-bottom-tabs-tab-1', 'app-bottom-tabs-tab-2']);
  expect(q('app-bottom-tabs-tab-1')!.getAttribute('aria-selected')).toBe('true');
  expect(q('app-bottom-tabs-tab-0')!.getAttribute('aria-selected')).toBe('false');
  expect(textOf('app-bottom-tabs-tab-0')).toBe('Home');
});

it('a press goes to the route with expo-router (the params are the query string)', () => {
  renderUI(<ApplicationBottomTabsApp tabsArray={TABS} />);
  press('app-bottom-tabs-tab-0');
  expect(mockPush).toHaveBeenLastCalledWith('/home');
  press('app-bottom-tabs-tab-2');
  expect(mockPush).toHaveBeenLastCalledWith('/raci/racidashboard?raciGUID=g');
});

it('the default tabs: the dashboard of the user gets the GUID of the active user', () => {
  renderUI(<ApplicationBottomTabsApp />);
  expect(qa('app-bottom-tabs-tab-').length).toBe(4);
  press('app-bottom-tabs-tab-2');
  expect(mockPush).toHaveBeenLastCalledWith('/raci/racidashboard?raciGUID=user-1');
});

it('while it is mounted redux knows the bar is visible (the FAB stands above it); when it goes, it is hidden again', () => {
  renderUI(<ApplicationBottomTabsApp tabsArray={TABS} />);
  expect(mockDispatch).toHaveBeenCalledWith(setBottomTabsAreVisible(true));
  cleanupUI();
  expect(mockDispatch).toHaveBeenLastCalledWith(setBottomTabsAreVisible(false));
});

it('the design system changes the look: the MD3 family has the pill behind the active icon, native has none', () => {
  mockSystem = 'paper';
  renderUI(<ApplicationBottomTabsApp tabsArray={TABS} />);
  const pill = (i: number) => (q(`app-bottom-tabs-tab-${i}`)!.querySelector('[data-icon]')!.parentElement as HTMLElement).style.backgroundColor;
  expect(pill(1)).not.toBe('');
  expect(pill(0)).toBe('');
  cleanupUI();
  mockSystem = 'native';
  renderUI(<ApplicationBottomTabsApp tabsArray={TABS} />);
  expect(pill(1)).toBe('');
});

it('the bar leaves room for the system bar at the bottom (the inset)', () => {
  renderUI(<ApplicationBottomTabsApp tabsArray={TABS} />);
  const bar = q('app-bottom-tabs')!;
  expect(bar.style.paddingBottom).toBe('26px');                       // 6 + the inset 20
});
