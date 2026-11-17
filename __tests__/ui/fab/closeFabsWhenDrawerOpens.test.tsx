/** @jest-environment jsdom */
// The drawer opens (hamburger / swipe) while the main FAB is open: the FAB closes.
import React, { act } from 'react';
import { FABProvider, useFAB } from '../../../kit8/providers/FABProvider';
import { useCloseFabsWhenDrawerOpens } from '../../../kit8/ui/components/useCloseFabsWhenDrawerOpens';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

const closed = jest.fn();
/** stands for FABAppComponent: registers its listener and "opens" */
function FakeFab() {
  const { registerFAB, notifyFABOpen } = useFAB();
  React.useEffect(() => registerFAB('app-global-fab', (openId) => { if (openId !== 'app-global-fab') closed(); }), [registerFAB]);
  return <button data-testid="open" onClick={() => notifyFABOpen('app-global-fab')} />;
}
function DrawerContent({ state }: { state: any }) {
  useCloseFabsWhenDrawerOpens(state);
  return null;
}

const closedDrawer = { history: [{ type: 'route', key: 'home' }] };
const openDrawer = { history: [{ type: 'route', key: 'home' }, { type: 'drawer', status: 'open' }] };

function mount(state: any) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const render = (s: any) => act(() => root.render(<FABProvider><FakeFab /><DrawerContent state={s} /></FABProvider>));
  render(state);
  return { render, host, root };
}

beforeEach(() => closed.mockClear());

describe('the FAB closes when the drawer opens', () => {
  it('open FAB + the drawer opens = the FAB closes', () => {
    const { render, host } = mount(closedDrawer);
    act(() => (host.querySelector('[data-testid="open"]') as HTMLElement).click()); // the FAB is open
    expect(closed).not.toHaveBeenCalled();
    render(openDrawer); // the hamburger was pressed
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it('a closed drawer does nothing; a drawer that stays open does not close the FAB again', () => {
    const { render, host } = mount(closedDrawer);
    act(() => (host.querySelector('[data-testid="open"]') as HTMLElement).click());
    render(closedDrawer);
    expect(closed).not.toHaveBeenCalled();
    render(openDrawer);
    expect(closed).toHaveBeenCalledTimes(1);
    act(() => (host.querySelector('[data-testid="open"]') as HTMLElement).click()); // the user opens the FAB over the open drawer
    render({ ...openDrawer, history: [...openDrawer.history] }); // same "open" state, new object
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it('works outside a FABProvider (no throw)', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    expect(() => act(() => root.render(<DrawerContent state={openDrawer} />))).not.toThrow();
  });
});
