/** @jest-environment jsdom */
// RouteVisitsTop (Top 5 of the hamburger menu) and useRouteVisitTracker (counts the screens through the RPC route_visit_register).
import React, { act } from 'react';

let mockRows: any[] = [];
let mockLoggedIn = true;
let mockPath = '/home';
let mockOrg = { organizationGUID: 'org1', loaded: true, numberOfVisitsEnabled: true };
const mockRpc = jest.fn(() => Promise.resolve({ data: 1, error: null }));
const mockDataHook = jest.fn();

jest.mock('expo-router', () => ({ usePathname: () => mockPath }));
jest.mock('react-redux', () => ({ useSelector: (sel: any) => sel({}) }));
jest.mock('../../../../kit8/redux/activeUserSlice', () => ({ selectIsLoggedIn: () => mockLoggedIn }));
jest.mock('../../../../kit8/providers/WithSupabase', () => {
  const client = { rpc: (...a: any[]) => (mockRpc as any)(...a) };
  return { useSupabase: () => ({ supabase: client }) };
});
jest.mock('../../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { text: '#000', primary: '#00f' } }) }));
jest.mock('../../../../kit8/catalog/organization/useMyOrganization', () => ({ useMyOrganization: () => mockOrg }));
jest.mock('../../../../kit8/catalog/user/visit/useRouteVisitData', () => ({
  useRouteVisitData: (enabled: boolean) => { mockDataHook(enabled); return { rows: enabled ? mockRows : [], loaded: true, error: '', reload: jest.fn() }; },
}));

import RouteVisitsTop from '../../../../kit8/catalog/user/visit/RouteVisitsTop';
import RouteVisitTracker from '../../../../kit8/catalog/user/visit/RouteVisitTracker';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
function mount(el: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(el));
}
const row = (route: string, n: number) => ({ rowGUID: `g${route}`, rowOwnerGUID: 'u1', rowParentGUID: route, orderInList: 0, rowJSON: { number_of_route_visits: n } });

beforeEach(() => {
  mockRows = []; mockLoggedIn = true; mockPath = '/home';
  mockOrg = { organizationGUID: 'org1', loaded: true, numberOfVisitsEnabled: true };
  mockRpc.mockClear(); mockDataHook.mockClear();
});
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

describe('RouteVisitsTop', () => {
  it('shows the 5 most visited routes with their counts, the biggest first - and nothing else', () => {
    mockRows = [row('/a', 1), row('/b', 9), row('/c', 4), row('/d', 6), row('/e', 3), row('/f', 2), row('/g', 8)];
    mount(<RouteVisitsTop />);
    const items = Array.from(document.querySelectorAll('[data-testid^="route-visits-top-g"]')).filter((e) => !e.getAttribute('data-testid')!.endsWith('-count'));
    expect(items.map((e) => e.textContent)).toEqual(['/b9', '/g8', '/d6', '/c4', '/e3']);
  });

  it('a row with a route that can be opened calls onSelectRoute; a route with :id does not', () => {
    mockRows = [row('/b', 9), row('/p/edit/:id', 5)];
    const onSelectRoute = jest.fn();
    mount(<RouteVisitsTop onSelectRoute={onSelectRoute} />);
    act(() => { q('route-visits-top-g/b')!.click(); });
    expect(onSelectRoute).toHaveBeenCalledWith('/b');
    act(() => { q('route-visits-top-g/p/edit/:id')!.click(); });
    expect(onSelectRoute).toHaveBeenCalledTimes(1);
  });

  it('draws nothing while signed out, while the Organization switch is off, or without visits', () => {
    mockRows = [row('/b', 9)];
    mockLoggedIn = false;
    mount(<RouteVisitsTop />);
    expect(q('route-visits-top')).toBeNull();
    act(() => root.unmount());
    mockLoggedIn = true; mockOrg = { ...mockOrg, numberOfVisitsEnabled: false };
    mount(<RouteVisitsTop />);
    expect(q('route-visits-top')).toBeNull();
    expect(mockDataHook).toHaveBeenLastCalledWith(false); // not even read
    act(() => root.unmount());
    mockOrg = { ...mockOrg, numberOfVisitsEnabled: true }; mockRows = [];
    mount(<RouteVisitsTop />);
    expect(q('route-visits-top')).toBeNull();
  });
});

describe('RouteVisitTracker', () => {
  it('counts the route once per change through route_visit_register', () => {
    mockPath = '/catalog/money/account/';
    mount(<RouteVisitTracker />);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('route_visit_register', { p_route: '/catalog/money/account' });
    act(() => root.render(<RouteVisitTracker />)); // same route again: no second count
    expect(mockRpc).toHaveBeenCalledTimes(1);
    mockPath = '/user/visits';
    act(() => root.render(<RouteVisitTracker />));
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenLastCalledWith('route_visit_register', { p_route: '/user/visits' });
  });

  it('does not count while signed out, while the switch is off, while the organization is being read, or at the root', () => {
    mockLoggedIn = false;
    mount(<RouteVisitTracker />);
    act(() => root.unmount());
    mockLoggedIn = true; mockOrg = { organizationGUID: 'org1', loaded: true, numberOfVisitsEnabled: false };
    mount(<RouteVisitTracker />);
    act(() => root.unmount());
    mockOrg = { organizationGUID: 'org1', loaded: false, numberOfVisitsEnabled: true };
    mount(<RouteVisitTracker />);
    act(() => root.unmount());
    mockOrg = { organizationGUID: 'org1', loaded: true, numberOfVisitsEnabled: true }; mockPath = '/';
    mount(<RouteVisitTracker />);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('counts the first screen once the organization is read', () => {
    mockOrg = { organizationGUID: 'org1', loaded: false, numberOfVisitsEnabled: true };
    mount(<RouteVisitTracker />);
    expect(mockRpc).not.toHaveBeenCalled();
    mockOrg = { organizationGUID: 'org1', loaded: true, numberOfVisitsEnabled: true };
    act(() => root.render(<RouteVisitTracker />));
    expect(mockRpc).toHaveBeenCalledWith('route_visit_register', { p_route: '/home' });
  });

  it('a failed call does not break the screen', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRpc.mockImplementationOnce(() => Promise.reject(new Error('offline')) as any);
    mount(<RouteVisitTracker />);
    await act(async () => { await Promise.resolve(); });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
