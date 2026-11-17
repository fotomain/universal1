/** @jest-environment jsdom */
// The user opens the FAB while the hamburger menu (drawer) is open: the drawer closes.
import React, { act } from 'react';
import { closeDrawerIfOpen, registerDrawerCloser, useRegisterDrawerCloser } from '../../../kit8/ui/components/drawerCloser';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

describe('drawerCloser registry', () => {
  it('calls the registered closer; nothing registered = nothing happens; the newest registration wins', () => {
    expect(() => closeDrawerIfOpen()).not.toThrow();
    const a = jest.fn();
    const b = jest.fn();
    const offA = registerDrawerCloser(a);
    closeDrawerIfOpen();
    expect(a).toHaveBeenCalledTimes(1);
    const offB = registerDrawerCloser(b);
    closeDrawerIfOpen();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledTimes(1);
    offA(); // an old registration cannot withdraw the newer one
    closeDrawerIfOpen();
    expect(b).toHaveBeenCalledTimes(2);
    offB();
    closeDrawerIfOpen();
    expect(b).toHaveBeenCalledTimes(2);
  });
  it('a failing closer does not break the FAB', () => {
    const off = registerDrawerCloser(() => { throw new Error('gone'); });
    expect(() => closeDrawerIfOpen()).not.toThrow();
    off();
  });
});

describe('useRegisterDrawerCloser (inside the drawer content)', () => {
  const closedState = { history: [{ type: 'route' }] };
  const openState = { history: [{ type: 'route' }, { type: 'drawer', status: 'open' }] };
  function Content({ navigation, state }: any) {
    useRegisterDrawerCloser(navigation, state);
    return null;
  }
  it('closes the drawer only while it is open', () => {
    const navigation = { closeDrawer: jest.fn() };
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<Content navigation={navigation} state={closedState} />));
    closeDrawerIfOpen();
    expect(navigation.closeDrawer).not.toHaveBeenCalled(); // closed already
    act(() => root.render(<Content navigation={navigation} state={openState} />));
    closeDrawerIfOpen();
    expect(navigation.closeDrawer).toHaveBeenCalledTimes(1);
    act(() => root.unmount()); // the registration goes away with the drawer
    closeDrawerIfOpen();
    expect(navigation.closeDrawer).toHaveBeenCalledTimes(1);
  });
});
