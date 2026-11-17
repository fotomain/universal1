/** @jest-environment jsdom */
// The main FAB with the customization of the app: appPM80 adds New Project, All Projects, Add Calendar event on the home, under the items
// the FAB has anyway; other apps and other screens are not touched.
import React, { act } from 'react';

const mockPush = jest.fn();
let mockPathname = '/home';
let mockUserState: any = { userGUID: '' };
let mockContext: any = null;
const mockOpenProjectSettings = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), usePathname: () => mockPathname }));
jest.mock('react-redux', () => ({
  useSelector: (fn: any) => fn({ userTheme: {}, uxuiState: { fabAnimationVariant: mockVariant }, activeUserState: mockUserState }),
}));
let mockVariant = 'defaultFABAnimation';
jest.mock('react-native-paper', () => {
  const R = require('react');
  const { View, Text } = require('react-native');
  return {
    MD3LightTheme: { colors: {}, fonts: {} },
    MD3DarkTheme: { colors: {}, fonts: {} },
    Text: ({ children, style }: any) => R.createElement(Text, { style }, children),
    Surface: ({ children, style }: any) => R.createElement(View, { style }, children),
    useTheme: () => ({ colors: { surface: '#fff', surfaceVariant: '#eee', onSurface: '#000', onSurfaceVariant: '#000', primary: '#63f' } }),
  };
});
jest.mock('../../../kit8/providers/FABProvider', () => ({
  useFAB: () => ({ registerFAB: () => () => undefined, notifyFABOpen: jest.fn(), notifyFABClose: jest.fn() }),
  useFABCurrentContextActions: () => mockContext,
}));
jest.mock('../../../kit8/ui/components/common/FABApp', () => {
  const R = require('react');
  const { Pressable } = require('react-native');
  return { __esModule: true, default: ({ icon, onPress }: any) => R.createElement(Pressable, { testID: `fabapp-${icon}`, onPress }) };
});
jest.mock('../../../kit8/lib/shareScreenshot', () => ({ useHiddenDuringScreenshot: () => false }));
jest.mock('../../../kit8/ui/components/navigation/bottomTabsLayout', () => ({ fabBottomOffset: () => 24, useBottomInset: () => 0 }));
jest.mock('../../../kit8/pm/i18n/pmT', () => ({ pmT: (t: string) => t }));
jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: { getState: () => ({ openProjectSettings: mockOpenProjectSettings }) } }));
['appPosts/HomeAppPostsPage', 'appCC1/HomeAppCC1', 'appOnTrend/HomeAppOnTrend', 'appClothes1/HomeAppClothes1', 'appPM80/home/HomeAppPM80'].forEach((m) =>
  jest.doMock(`../../../apps/${m}`, () => ({ __esModule: true, default: function FakeHome() { return null; } })),
);

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const { FABAppComponent } = require('../../../kit8/ui/components/fab/FABAppComponent');
const { AppCustomizationProvider } = require('../../../kit8/providers/AppCustomizationProvider');
const { getAppCustomization } = require('../../../apps/appCustomization');
const { registerDrawerCloser } = require('../../../kit8/ui/components/drawerCloser');

let root: any;
let host: HTMLElement;
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (id: string) => act(() => { (q(id) as HTMLElement).click(); });

function mount(app: string) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(
    <AppCustomizationProvider value={getAppCustomization(app)}>
      <FABAppComponent />
    </AppCustomizationProvider>,
  ));
  click('fabapp-plus'); // open the list
}
/** the labels of the open list, in the order of the screen (top to bottom) */
const labels = () => Array.from(host.querySelectorAll('[data-testid="fab-main-actions"] [dir="auto"], [data-testid="fab-main-actions"] div[class*="css-text"]')).map((e) => e.textContent).filter(Boolean);
const listText = () => q('fab-main-actions')?.textContent || '';

beforeEach(() => {
  mockPush.mockClear();
  mockOpenProjectSettings.mockClear();
  mockPathname = '/home';
  mockUserState = { userGUID: '' };
  mockContext = null;
  mockVariant = 'defaultFABAnimation';
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('main FAB + app customization', () => {
  it('appPM80 on the home: the items the FAB has anyway, then (nearest the button) New Project, All Projects, Add Calendar event', () => {
    mount('appPM80');
    const t = listText();
    const order = ['Record Video', 'Record Audio', 'Scroll Top', 'New Project', 'All Projects', 'Add Calendar event'].map((l) => t.indexOf(l));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order); // in this order, top to bottom
  });

  it('the reanimated animation stacks upward from the button: the same order for the eye', () => {
    mockVariant = 'reanimatedBasicFABAnimation';
    mount('appPM80');
    const t = listText();
    // the first item of the array is the nearest to the button: the extras reversed, then the rest
    const order = ['Add Calendar event', 'All Projects', 'New Project', 'Record Video'].map((l) => t.indexOf(l));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('other apps and other screens are not touched', () => {
    mount('appClothes1');
    expect(listText()).not.toContain('New Project');
    expect(listText()).toContain('Scroll Top');
    act(() => root.unmount());
    host.remove();
    mockPathname = '/pm/project/dashboard';
    mockContext = [{ icon: 'plus', label: 'Add task', onPress: jest.fn() }];
    mount('appPM80');
    expect(listText()).toContain('Add task'); // the commands of the screen stay
    expect(listText()).not.toContain('New Project'); // the extras belong to the home only
  });

  it('the recording items point to routes that exist', () => {
    mount('appClothes1');
    expect(listText()).toContain('Record Video');
    click('fabapp-video-outline');
    expect(mockPush).toHaveBeenCalledWith('/media/record/video');
  });

  it('a press runs the action of the app: a signed in user -> the New project window of the dashboard; a guest -> sign in', () => {
    mockUserState = { userGUID: '11111111-1111-4111-8111-111111111111' };
    mount('appPM80');
    click('fabapp-folder-plus-outline');
    expect(mockOpenProjectSettings).toHaveBeenCalledWith('new');
    expect(mockPush).toHaveBeenCalledWith('/pm/project/dashboard');
    act(() => root.unmount());
    host.remove();
    mockPush.mockClear();
    mockOpenProjectSettings.mockClear();
    mockUserState = { userGUID: '' };
    mount('appPM80');
    click('fabapp-folder-plus-outline');
    expect(mockOpenProjectSettings).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/user/signin', params: { returnTo: '/home' } });
  });

  it('opening the FAB closes an open hamburger menu (and closing the FAB does not touch it)', () => {
    const closeDrawer = jest.fn();
    const off = registerDrawerCloser(closeDrawer);
    mount('appPM80'); // mount() opens the FAB
    expect(closeDrawer).toHaveBeenCalledTimes(1);
    click('fabapp-close'); // the main button now closes the list
    expect(closeDrawer).toHaveBeenCalledTimes(1);
    off();
  });
});

describe('a press on the TEXT of an FAB item does the same call as a press on its round button', () => {
  const items: Array<{ label: string; icon: string }> = [
    { label: 'Record Video', icon: 'video-outline' },
    { label: 'Record Audio', icon: 'microphone-outline' },
    { label: 'Scroll Top', icon: 'arrow-up-bold-outline' },
    { label: 'New Project', icon: 'folder-plus-outline' },
    { label: 'All Projects', icon: 'folder-multiple-outline' },
    { label: 'Add Calendar event', icon: 'calendar-plus' },
  ];

  /** what a press did: the router calls, the New project request, the scroll, and whether the list is still open */
  function pressAndRecord(how: 'label' | 'button', item: { label: string; icon: string }) {
    mockPush.mockClear();
    mockOpenProjectSettings.mockClear();
    const scrollTo = jest.fn();
    (window as any).scrollTo = scrollTo;
    mockUserState = { userGUID: '11111111-1111-4111-8111-111111111111' };
    mount('appPM80'); // mount() opens the FAB
    click(how === 'label' ? `fab-action-label-${item.label}` : `fabapp-${item.icon}`);
    const result = {
      push: mockPush.mock.calls,
      openProjectSettings: mockOpenProjectSettings.mock.calls,
      scrolled: scrollTo.mock.calls.length,
      listOpen: !!q('fab-main-actions'),
    };
    act(() => root.unmount());
    host.remove();
    return result;
  }

  items.forEach((item) => {
    it(`${item.label}: the text and the button give the same result, and the list closes`, () => {
      const byButton = pressAndRecord('button', item);
      const byLabel = pressAndRecord('label', item);
      expect(byLabel).toEqual(byButton);
      expect(byLabel.listOpen).toBe(false);
      // and it really did something
      expect(byLabel.push.length + byLabel.scrolled).toBeGreaterThan(0);
    });
  });

  it('the texts lead to the real places (New Project asks for its window, All Projects, the calendar event, the recorders)', () => {
    expect(pressAndRecord('label', items[3])).toMatchObject({ push: [['/pm/project/dashboard']], openProjectSettings: [['new']] });
    expect(pressAndRecord('label', items[4]).push).toEqual([['/catalog/project']]);
    expect(pressAndRecord('label', items[5]).push).toEqual([[{ pathname: '/user/calendar', params: { new: 'event' } }]]);
    expect(pressAndRecord('label', items[0]).push).toEqual([['/media/record/video']]);
    expect(pressAndRecord('label', items[1]).push).toEqual([['/media/record/audio']]);
    expect(pressAndRecord('label', items[2]).scrolled).toBe(1);
  });

  it('every item of the open list has a pressable text', () => {
    mount('appPM80');
    items.forEach((item) => expect(q(`fab-action-label-${item.label}`)).not.toBeNull());
  });

  it('a guest: the text of New Project sends to sign in, like the button', () => {
    mockUserState = { userGUID: '' };
    mount('appPM80');
    click('fab-action-label-New Project');
    expect(mockOpenProjectSettings).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/user/signin', params: { returnTo: '/home' } });
  });
});
