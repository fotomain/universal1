/** @jest-environment jsdom */
// usePermissions: one call of perm_make_matrix per project / task, cached; open until the answer is there; the answer narrows the interface.
import React, { act } from 'react';

const mockRpc = jest.fn();
let mockClient: any;
jest.mock('../../kit8/providers/WithSupabase', () => ({ useSupabase: () => { if (!mockClient) throw new Error('no provider'); return { supabase: mockClient }; } }));

import { usePermissions, usePermissionStore, useDocumentRights } from '../../kit8/permissions/usePermissions';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
let last: any;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });

function Probe({ project, task }: { project?: string; task?: string }) {
  last = { p: usePermissions(project, task) };
  return null;
}
function DocProbe({ project }: { project?: string }) {
  last = { d: useDocumentRights('vendor_invoice_header', project) };
  return null;
}
async function mount(props: any = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<Probe {...props} />));
  await flush();
}
const answer = { profiles: ['permissionProjectReadOnly'], crud: { task_line_table: 'R', vendor_invoice_header: 'R' }, uxui: { permissionVendorInvoice: 'R' }, isAdmin: false, canCreateProject: false };

beforeEach(() => { mockRpc.mockReset(); usePermissionStore.getState().clear(); mockClient = { rpc: (...a: any[]) => (mockRpc as any)(...a) }; last = null; });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

it('without a Supabase provider everything is allowed (tests, the first second)', async () => {
  mockClient = null;
  await mount({ project: 'p1' });
  expect(last.p.ready).toBe(false);
  expect(last.p.can('task_line_table', 'D')).toBe(true);
  expect(last.p.canCreateProject).toBe(true);
});

it('asks perm_my_matrix once per project / task and narrows the interface to the answer', async () => {
  mockRpc.mockResolvedValue({ data: answer, error: null });
  await mount({ project: 'p1', task: 't1' });
  expect(mockRpc).toHaveBeenCalledWith('perm_my_matrix', { p_project: 'p1', p_task: 't1' });
  expect(mockRpc).toHaveBeenCalledTimes(1);
  expect(last.p.ready).toBe(true);
  expect(last.p.can('task_line_table', 'R')).toBe(true);
  expect(last.p.can('task_line_table', 'U')).toBe(false);
  expect(last.p.canUi('permissionVendorInvoice', 'C')).toBe(false);
  expect(last.p.canCreateProject).toBe(false);
});

it('useDocumentRights: the letters U / D / C of the header table (the Post and Delete buttons of the document forms)', async () => {
  mockRpc.mockResolvedValue({ data: answer, error: null });
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<DocProbe project="p1" />));
  await flush();
  expect(last.d).toMatchObject({ canChange: false, canDelete: false, canCreate: false, ready: true });
  mockRpc.mockClear();
  usePermissionStore.getState().put('p1|-', { ...answer, crud: { vendor_invoice_header: 'CRUD' } } as any);
  await flush();
  expect(last.d).toMatchObject({ canChange: true, canDelete: true, canCreate: true });
});

it('a second component with the same key shares the answer (no second call)', async () => {
  mockRpc.mockResolvedValue({ data: answer, error: null });
  await mount({ project: 'p1' });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const r2 = createRoot(host);
  act(() => r2.render(<Probe project="p1" />));
  await flush();
  expect(mockRpc).toHaveBeenCalledTimes(1);
  act(() => r2.unmount());
});

it('an error of the RPC leaves the interface open (the database decides)', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'function perm_my_matrix does not exist' } });
  await mount({ project: 'p1' });
  expect(last.p.ready).toBe(false);
  expect(last.p.can('task_line_table', 'D')).toBe(true);
});
