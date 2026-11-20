/** @jest-environment jsdom */
// The organization cut of the Monitor reports (kit8/pm/reports/common/useReportOrganizationScope): a user of two or more organizations sees the projects of the ACTIVE one only;
// a user of one organization is not scoped and nothing extra is read. The database side: kit8/docker/tests/48 (memberships) and 103 (organization_visible).
import React, { act } from 'react';

let mockActive = 'orgA';
let mockMemberships: any[] = [];
let mockProjectsByOrg: Record<string, string[]> = {};
let mockProjectError = false;
const mockFrom = jest.fn();
const mockRpc = jest.fn();

// the SAME client every render (a new one per render loops the effects that depend on it)
jest.mock('../../../../kit8/providers/WithSupabase', () => {
  const client = {
    rpc: (...a: any[]) => (mockRpc as any)(...a),
    from: (...a: any[]) => (mockFrom as any)(...a),
  };
  const value = { supabase: client };
  return { useSupabase: () => value };
});
jest.mock('../../../../kit8/catalog/organization/switch/useActiveOrganizationGUID', () => ({ useActiveOrganizationGUID: () => mockActive }));

import { cutToProjects, useReportOrganizationScope, type ReportOrganizationScope } from '../../../../kit8/pm/reports/common/useReportOrganizationScope';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let scope: ReportOrganizationScope;
let mockEnabled = true;
function Probe() {
  scope = useReportOrganizationScope(mockEnabled);
  return null;
}
const flush = () => act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); });
async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Probe />));
  await flush();
}
const rerender = async () => { act(() => root.render(<Probe />)); await flush(); };

const two = [
  { organizationGUID: 'orgA', organizationTitle: 'Acme', isAdministrator: false, isActive: true },
  { organizationGUID: 'orgB', organizationTitle: 'Beta', isAdministrator: true, isActive: false },
];
const rows = [{ id: 1, p: 'pA1' }, { id: 2, p: 'pA2' }, { id: 3, p: 'pB1' }, { id: 4, p: '' }, { id: 5, p: null }];

beforeEach(() => {
  mockEnabled = true;
  mockActive = 'orgA';
  mockMemberships = two;
  mockProjectsByOrg = { orgA: ['pA1', 'pA2'], orgB: ['pB1'] };
  mockProjectError = false;
  mockFrom.mockReset();
  mockRpc.mockReset();
  mockRpc.mockImplementation(async () => ({ data: mockMemberships, error: null }));
  mockFrom.mockImplementation((table: string) => {
    const state: any = { table, org: '' };
    const chain: any = {
      select: () => chain,
      eq: (_col: string, v: string) => { state.org = v; return chain; },
      order: () => chain,
      range: async () => (mockProjectError ? { data: null, error: { message: 'boom' } } : { data: (mockProjectsByOrg[state.org] || []).map((g) => ({ rowGUID: g })), error: null }),
    };
    return chain;
  });
});
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

describe('cutToProjects (pure)', () => {
  it('no set = no cut: the SAME array comes back', () => {
    expect(cutToProjects(rows, (r) => r.p, null)).toBe(rows);
  });
  it('keeps the rows of the projects of the set; a row without a project is dropped', () => {
    expect(cutToProjects(rows, (r) => r.p, new Set(['pA1', 'pB1'])).map((r) => r.id)).toEqual([1, 3]);
    expect(cutToProjects(rows, (r) => r.p, new Set())).toEqual([]);
  });
});

describe('the scope of a report', () => {
  it('a user of ONE organization is not scoped: nothing is cut and project_table is not read', async () => {
    mockMemberships = two.slice(0, 1);
    await mount();
    expect(scope.scoped).toBe(false);
    expect(scope.ready).toBe(true);
    expect(scope.projectGUIDs).toBeNull();
    expect(scope.filter(rows, (r) => r.p)).toBe(rows);
    expect(scope.keep('whatever')).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('a user of TWO organizations sees the projects of the active one only', async () => {
    await mount();
    expect(mockFrom).toHaveBeenCalledWith('project_table');
    expect(scope.scoped).toBe(true);
    expect(scope.ready).toBe(true);
    expect(scope.organizationGUID).toBe('orgA');
    expect([...(scope.projectGUIDs as Set<string>)].sort()).toEqual(['pA1', 'pA2']);
    expect(scope.filter(rows, (r) => r.p).map((r) => r.id)).toEqual([1, 2]);
    expect(scope.keep('pB1')).toBe(false);
    expect(scope.keep('pA2')).toBe(true);
  });

  it('a switch to the other organization cuts again: not ready (and nothing shown) until its projects are read', async () => {
    await mount();
    mockActive = 'orgB';
    act(() => root.render(<Probe />));
    // the old answer is for orgA: for orgB the set is empty and the scope is not ready, until the read of orgB arrives
    expect(scope.organizationGUID).toBe('orgB');
    expect(scope.ready).toBe(false);
    expect(scope.filter(rows, (r) => r.p)).toEqual([]);
    await flush();
    await rerender();
    expect(scope.ready).toBe(true);
    expect(scope.filter(rows, (r) => r.p).map((r) => r.id)).toEqual([3]);
  });

  it('disabled (Monitor01 inside one project): never scoped, nothing is read', async () => {
    mockEnabled = false;
    await mount();
    expect(scope.scoped).toBe(false);
    expect(scope.filter(rows, (r) => r.p)).toBe(rows);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('a failed read cuts nothing (the database still decides what the user reads)', async () => {
    mockProjectError = true;
    await mount();
    expect(scope.scoped).toBe(true);
    expect(scope.ready).toBe(true);
    expect(scope.projectGUIDs).toBeNull();
    expect(scope.filter(rows, (r) => r.p)).toBe(rows);
  });
});
