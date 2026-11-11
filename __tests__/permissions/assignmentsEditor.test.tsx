/** @jest-environment jsdom */
// AssignmentsEditor: the rows of the assignment table with the e-mail of the member, give a profile, remove one, a refusal in words.
// The rules (who may write, which profiles by hand): kit8/docker/tests/49_permission_profiles.sql.
import React, { act } from 'react';

const mockCalls: any[] = [];
let mockAssignments: any[] = [];
let mockMembers: any[] = [];
let mockWriteError: any = null;
let mockButtons: Record<string, any> = {};
let mockSelects: Record<string, any> = {};

jest.mock('../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { text: '#000', primary: '#06f', error: '#c00', border: '#ccc', surface: '#fff', background: '#fff' } }) }));
jest.mock('../../kit8/providers/WithSupabase', () => {
  const chain = (table: string) => {
    const state: any = { table, op: 'select' };
    const api: any = {
      select: () => { state.op = 'select'; return api; },
      insert: (row: any) => { state.op = 'insert'; mockCalls.push({ table, op: 'insert', row }); return Promise.resolve({ error: mockWriteError }); },
      delete: () => { state.op = 'delete'; return api; },
      eq: (col: string, val: any) => {
        if (state.op === 'delete') { mockCalls.push({ table, op: 'delete', col, val }); return Promise.resolve({ error: mockWriteError }); }
        return Promise.resolve({ data: table === 'project_permission_profile_user_table' ? mockAssignments : mockMembers, error: null });
      },
    };
    return api;
  };
  const client = { from: chain };
  const value = { supabase: client };
  return { useSupabase: () => value };
});
jest.mock('../../kit8/ui/components/common/ButtonApp', () => ({ __esModule: true, default: (p: any) => { mockButtons[p.testID] = p; return null; } }));
jest.mock('../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../kit8/ui/components/common/SelectItemFromListApp', () => ({ __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return null; } }));

import AssignmentsEditor, { assignmentRowsOf, memberEmailsOf } from '../../kit8/permissions/AssignmentsEditor';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
async function mount(props: any = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<AssignmentsEditor ownerGUID="p1" organizationGUID="orgA" profiles={['permissionProjectManager', 'permissionProjectReadOnly']} testID="ae" {...props} />));
  await flush();
}
beforeEach(() => {
  mockCalls.length = 0; mockButtons = {}; mockSelects = {}; mockWriteError = null;
  mockAssignments = [
    { rowGUID: 'a2', rowParentGUID: 'u2', rowJSON: { permissionProfileGUID: 'permissionProjectReadOnly' } },
    { rowGUID: 'a1', rowParentGUID: 'u1', rowJSON: { permissionProfileGUID: 'permissionProjectManager', permissionAutomatic: true } },
  ];
  mockMembers = [
    { rowParentGUID: 'u1', rowJSON: { userEmailForInvitation: 'anna@acme.test', memberStatus: 'active' } },
    { rowParentGUID: 'u2', rowJSON: { userEmailForInvitation: 'boris@acme.test', memberStatus: 'active' } },
    { rowParentGUID: 'empty', rowJSON: { userEmailForInvitation: 'invited@acme.test', memberStatus: 'invited' } },
  ];
});
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

describe('the rules', () => {
  it('assignmentRowsOf: cleaned and sorted by user and profile', () => {
    expect(assignmentRowsOf(mockAssignments).map((r) => r.rowGUID)).toEqual(['a1', 'a2']);
    expect(assignmentRowsOf(mockAssignments)[0]).toEqual({ rowGUID: 'a1', userGUID: 'u1', profile: 'permissionProjectManager', automatic: true });
    expect(assignmentRowsOf([{ rowGUID: 'x', rowParentGUID: 'u', rowJSON: {} }, null as any])).toEqual([]);
    expect(assignmentRowsOf(null)).toEqual([]);
  });
  it('memberEmailsOf: only ACTIVE members that have a user', () => {
    expect(memberEmailsOf(mockMembers)).toEqual({ u1: 'anna@acme.test', u2: 'boris@acme.test' });
  });
});

describe('the editor', () => {
  it('lists the e-mail and the profile of every assignment; the offered members are the active ones', async () => {
    await mount();
    expect(document.body.innerHTML).toBe(document.body.innerHTML);
    expect(mockButtons['ae-remove-a1']).toBeTruthy();
    expect(mockButtons['ae-remove-a2']).toBeTruthy();
    expect(mockSelects['ae-user'].items.map((i: any) => i.label)).toEqual(['anna@acme.test', 'boris@acme.test']);
    expect(mockSelects['ae-profile'].items.map((i: any) => i.value)).toEqual(['permissionProjectManager', 'permissionProjectReadOnly']);
  });
  it('Give writes the row of the project with the chosen profile', async () => {
    await mount();
    act(() => mockSelects['ae-user'].onSelect('u2'));
    act(() => mockSelects['ae-profile'].onSelect('permissionProjectReadOnly'));
    await act(async () => { mockButtons['ae-add-button'].onPress(); });
    await flush();
    expect(mockCalls).toContainEqual({ table: 'project_permission_profile_user_table', op: 'insert', row: { rowOwnerGUID: 'p1', rowParentGUID: 'u2', rowJSON: { permissionProfileGUID: 'permissionProjectReadOnly' } } });
  });
  it('Give without a member only says so', async () => {
    await mount();
    await act(async () => { mockButtons['ae-add-button'].onPress(); });
    expect(mockCalls).toHaveLength(0);
  });
  it('Remove deletes the row by its GUID', async () => {
    await mount();
    await act(async () => { await mockButtons['ae-remove-a2'].onPress(); });
    await flush();
    expect(mockCalls).toContainEqual({ table: 'project_permission_profile_user_table', op: 'delete', col: 'rowGUID', val: 'a2' });
  });
  it('canEdit=false: no add bar, no Remove mockButtons', async () => {
    await mount({ canEdit: false });
    expect(mockSelects['ae-user']).toBeUndefined();
    expect(mockButtons['ae-remove-a1']).toBeUndefined();
  });
  it('a refusal of the database stays visible (no crash)', async () => {
    mockWriteError = { message: 'No permission: project_permission_profile_user_table, C' };
    await mount();
    act(() => mockSelects['ae-user'].onSelect('u2'));
    await act(async () => { mockButtons['ae-add-button'].onPress(); });
    await flush();
    expect(mockCalls.some((c) => c.op === 'insert')).toBe(true);
  });
});
