/** @jest-environment jsdom */
// The organization filter of the Project dashboard (documentation/PERMISSIONS_WBS.html section 4.3): the pure rules and the select in the project bar.
// The database side (organization_switch, organization_my_memberships): kit8/docker/tests/48_organization_members.sql.
import React, { act } from 'react';

let mockActive = 'orgA';
const mockRpc = jest.fn();
const mockDispatch = jest.fn();
let selectProps: any = null;

jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
  useSelector: (sel: any) => sel({ activeUserState: { activeUserGUID: 'g32', activeUserEmail: 'clara@x.y', activeUserFirstName: 'Clara', activeUserLastName: 'S', userGUID: 'u1', userOrganization: { rowGUID: mockActive, title: 't' } } }),
  ReactReduxContext: require('react').createContext(null),
}));
// the SAME client every render (a new one per render loops the effect that depends on it)
jest.mock('../../../kit8/providers/WithSupabase', () => {
  const client = { rpc: (...a: any[]) => (mockRpc as any)(...a) };
  const value = { supabase: client };
  return { useSupabase: () => value };
});
jest.mock('../../../kit8/catalog/organization/switch/useActiveOrganizationGUID', () => ({ useActiveOrganizationGUID: () => mockActive }));
jest.mock('../../../kit8/ui/components/common/SelectItemFromListApp', () => ({ __esModule: true, default: (p: any) => { selectProps = p; return null; } }));

import OrganizationFilter from '../../../kit8/catalog/organization/switch/OrganizationFilter';
import { membershipsOf, projectsOfOrganization, showOrganizationFilter } from '../../../kit8/catalog/organization/switch/organizationSwitchModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<OrganizationFilter />));
  await flush();
}
const two = [
  { organizationGUID: 'orgA', organizationTitle: 'Acme', isAdministrator: false, isActive: true },
  { organizationGUID: 'orgB', organizationTitle: 'Beta', isAdministrator: true, isActive: false },
];
beforeEach(() => { mockActive = 'orgA'; selectProps = null; mockRpc.mockReset(); mockDispatch.mockReset(); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

describe('the rules', () => {
  it('membershipsOf cleans the answer of the RPC', () => {
    expect(membershipsOf(two)).toEqual(two);
    expect(membershipsOf([{ organizationGUID: '' }, null, { organizationGUID: 'o', organizationTitle: undefined }])).toEqual([{ organizationGUID: 'o', organizationTitle: 'o', isAdministrator: false, isActive: false }]);
    expect(membershipsOf(null)).toEqual([]);
    expect(membershipsOf({})).toEqual([]);
  });
  it('the filter is shown for two or more organizations only', () => {
    expect(showOrganizationFilter(two)).toBe(true);
    expect(showOrganizationFilter(two.slice(0, 1))).toBe(false);
    expect(showOrganizationFilter([])).toBe(false);
  });
  it('projectsOfOrganization: the projects of the active organization; no filter while it is not known; a project without an organization stays', () => {
    const ps = [{ rowGUID: 'p1', rowParentGUID: 'orgA' }, { rowGUID: 'p2', rowParentGUID: 'orgB' }, { rowGUID: 'p3' }, { rowGUID: 'p4', rowParentGUID: null }];
    expect(projectsOfOrganization(ps, 'orgA').map((p) => p.rowGUID)).toEqual(['p1', 'p3', 'p4']);
    expect(projectsOfOrganization(ps, 'orgB').map((p) => p.rowGUID)).toEqual(['p2', 'p3', 'p4']);
    expect(projectsOfOrganization(ps, '')).toHaveLength(4);
    expect(projectsOfOrganization(ps, undefined)).toHaveLength(4);
    expect(projectsOfOrganization([], 'orgA')).toEqual([]);
  });
});

describe('the select in the project bar', () => {
  it('a user of two organizations sees it, the active one selected', async () => {
    mockRpc.mockResolvedValue({ data: two, error: null });
    await mount();
    expect(mockRpc).toHaveBeenCalledWith('organization_my_memberships');
    expect(selectProps.value).toBe('orgA');
    expect(selectProps.items.map((i: any) => i.value)).toEqual(['orgA', 'orgB']);
    expect(selectProps.items[1].icon).toBe('admin_panel_settings');
  });
  it('a user of one organization sees nothing', async () => {
    mockRpc.mockResolvedValue({ data: two.slice(0, 1), error: null });
    await mount();
    expect(selectProps).toBeNull();
  });
  it('without the SQL part (the function does not exist) there is no filter and no crash', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'function organization_my_memberships() does not exist' } });
    await mount();
    expect(selectProps).toBeNull();
  });
  it('picking another organization calls organization_switch and makes it the active organization in redux', async () => {
    mockRpc.mockImplementation(async (name: string) => (name === 'organization_my_memberships' ? { data: two, error: null } : { data: { organizationGUID: 'orgB', organizationTitle: 'Beta' }, error: null }));
    await mount();
    await act(async () => { await selectProps.onSelect('orgB'); });
    expect(mockRpc).toHaveBeenCalledWith('organization_switch', { p_organization: 'orgB' });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0]).toMatchObject({ type: 'activeUserState/setActiveUser', payload: { userGUID: 'u1', userOrganization: { rowGUID: 'orgB', title: 'Beta' }, activeUserEmail: 'clara@x.y' } });
  });
  it('picking the active one does nothing; a refusal of the database changes nothing', async () => {
    mockRpc.mockResolvedValueOnce({ data: two, error: null });
    await mount();
    await act(async () => { await selectProps.onSelect('orgA'); });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'not a member' } });
    await act(async () => { await selectProps.onSelect('orgB'); });
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
