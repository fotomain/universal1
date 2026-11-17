/** @jest-environment jsdom */
// The main FAB and the hamburger menu (drawer) never stay open together:
//   1. the FAB is open and the user presses the hamburger  -> the FAB closes by itself
//   2. the drawer is open and the user presses the FAB     -> the drawer closes by itself
// The real FABProvider, the real FABAppComponent and the two real hooks of the drawer content (useCloseFabsWhenDrawerOpens,
// useRegisterDrawerCloser) around a small stand-in of the drawer navigator (a state with the "drawer" entry of the history, closeDrawer / openDrawer).
import React, { act, useState } from 'react';
import { Pressable } from 'react-native';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/home' }));
jest.mock('react-redux', () => ({
  useSelector: (fn: any) => fn({ userTheme: {}, uxuiState: { fabAnimationVariant: 'defaultFABAnimation' }, activeUserState: { userGUID: '' } }),
}));
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
jest.mock('../../../kit8/ui/components/common/FABApp', () => {
  const R = require('react');
  const { Pressable: P } = require('react-native');
  return { __esModule: true, default: ({ icon, onPress }: any) => R.createElement(P, { testID: `fabapp-${icon}`, onPress }) };
});
jest.mock('../../../kit8/lib/shareScreenshot', () => ({ useHiddenDuringScreenshot: () => false }));
jest.mock('../../../kit8/ui/components/navigation/bottomTabsLayout', () => ({ fabBottomOffset: () => 24, useBottomInset: () => 0 }));
jest.mock('../../../kit8/pm/i18n/pmT', () => ({ pmT: (t: string) => t }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const { FABProvider } = require('../../../kit8/providers/FABProvider');
const { FABAppComponent } = require('../../../kit8/ui/components/fab/FABAppComponent');
const { useCloseFabsWhenDrawerOpens } = require('../../../kit8/ui/components/useCloseFabsWhenDrawerOpens');
const { useRegisterDrawerCloser } = require('../../../kit8/ui/components/drawerCloser');

const CLOSED = { history: [{ type: 'route', key: 'home' }] };
const OPEN = { history: [{ type: 'route', key: 'home' }, { type: 'drawer', status: 'open' }] };

let closeDrawerSpy: jest.Mock;

/** the drawer navigator + its content: `state` is what the drawer content receives as props.state */
function App() {
  const [state, setState] = useState<any>(CLOSED);
  const navigation = React.useMemo(
    () => ({ openDrawer: () => setState(OPEN), closeDrawer: () => { closeDrawerSpy(); setState(CLOSED); } }),
    [],
  );
  return (
    <FABProvider>
      <FABAppComponent />
      {/* the hamburger of the app bar */}
      <Pressable testID="hamburger" onPress={() => navigation.openDrawer()} />
      <DrawerContent state={state} navigation={navigation} />
      <span data-testid="drawer-state">{state === OPEN ? 'open' : 'closed'}</span>
    </FABProvider>
  );
}
function DrawerContent({ state, navigation }: any) {
  useCloseFabsWhenDrawerOpens(state);
  useRegisterDrawerCloser(navigation, state);
  return null;
}

let root: any;
let host: HTMLElement;
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (id: string) => act(() => { (q(id) as HTMLElement).click(); });
const fabOpen = () => !!q('fab-main-actions');
const drawer = () => q('drawer-state')!.textContent;

beforeEach(() => {
  closeDrawerSpy = jest.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<App />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('1. the FAB is open and the user presses the hamburger menu: the FAB closes', () => {
  it('the list of the FAB is gone and the drawer is open', () => {
    click('fabapp-plus'); // open the FAB
    expect(fabOpen()).toBe(true);
    expect(drawer()).toBe('closed');
    click('hamburger');
    expect(drawer()).toBe('open');
    expect(fabOpen()).toBe(false);
    expect(q('fabapp-plus')).not.toBeNull(); // the plus button is back (not the cross)
    expect(q('fabapp-close')).toBeNull();
  });
  it('the hamburger with a closed FAB changes nothing about the FAB', () => {
    click('hamburger');
    expect(drawer()).toBe('open');
    expect(fabOpen()).toBe(false);
  });
});

describe('2. the hamburger menu is open and the user presses the FAB: the menu closes', () => {
  it('the drawer closes (closeDrawer of the navigator) and the FAB opens', () => {
    click('hamburger');
    expect(drawer()).toBe('open');
    click('fabapp-plus');
    expect(closeDrawerSpy).toHaveBeenCalledTimes(1);
    expect(drawer()).toBe('closed');
    expect(fabOpen()).toBe(true); // the FAB stays open: closing the drawer must not close it again
  });
  it('a closed drawer is not asked to close; closing the FAB does not touch the drawer', () => {
    click('fabapp-plus');
    expect(closeDrawerSpy).not.toHaveBeenCalled();
    click('fabapp-close');
    expect(fabOpen()).toBe(false);
    expect(closeDrawerSpy).not.toHaveBeenCalled();
  });
});

describe('both directions in a row: never both open', () => {
  it('FAB -> hamburger -> FAB -> hamburger', () => {
    click('fabapp-plus');
    click('hamburger');
    expect([fabOpen(), drawer()]).toEqual([false, 'open']);
    click('fabapp-plus');
    expect([fabOpen(), drawer()]).toEqual([true, 'closed']);
    click('hamburger');
    expect([fabOpen(), drawer()]).toEqual([false, 'open']);
    expect(closeDrawerSpy).toHaveBeenCalledTimes(1);
  });
});
