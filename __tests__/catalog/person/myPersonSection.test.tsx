/** @jest-environment jsdom */
// The profile block "Person": a user without a person creates it (person_create_own); one who has it sees that; nothing while the state is unknown (documentation/PERMISSIONS_WBS.html 4.6).
import React, { act } from 'react';

let mockPersonRows: any = [];
let mockReadError: any = null;
const mockRpc = jest.fn();
const mockEq = jest.fn();

jest.mock('../../../kit8/providers/WithSupabase', () => {
  const client = {
    from: () => ({ select: () => ({ eq: (...a: any[]) => { (mockEq as any)(...a); return { limit: () => Promise.resolve({ data: mockPersonRows, error: mockReadError }) }; } }) }),
    rpc: (...a: any[]) => (mockRpc as any)(...a),
  };
  const value = { supabase: client };
  return { useSupabase: () => value };
});
jest.mock('../../../kit8/ui/components/common', () => {
  const R = require('react');
  return { ButtonPrimaryApp: ({ testID, title, onPress, disabled }: any) => R.createElement('button', { 'data-testid': testID, disabled, onClick: onPress }, title) };
});

import MyPersonSection, { myPersonStateOf } from '../../../kit8/catalog/person/MyPersonSection';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
async function mount(email = 'Boris@Acme.test') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<MyPersonSection email={email} />));
  await flush();
}
beforeEach(() => { mockPersonRows = []; mockReadError = null; mockRpc.mockReset(); mockEq.mockReset(); mockRpc.mockResolvedValue({ data: 'p1', error: null }); });
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

it('the state of the person', () => {
  expect(myPersonStateOf([{ rowGUID: 'p' }])).toBe('exists');
  expect(myPersonStateOf([])).toBe('none');
  expect(myPersonStateOf(null)).toBe('unknown');
});
it('a user without a person: the person is looked up by his e-mail (lower case) and "Create my person" calls person_create_own, then reads again', async () => {
  await mount();
  expect(mockEq).toHaveBeenCalledWith('rowJSON->>personEmail', 'boris@acme.test');
  expect(q('my-person-create')).toBeTruthy();
  mockPersonRows = [{ rowGUID: 'p1' }];
  await act(async () => { q('my-person-create')!.click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  expect(mockRpc).toHaveBeenCalledWith('person_create_own');
  expect(q('my-person-exists')).toBeTruthy();
  expect(q('my-person-create')).toBeNull();
});
it('a user who has a person sees that, no button', async () => {
  mockPersonRows = [{ rowGUID: 'p1' }];
  await mount();
  expect(q('my-person-exists')).toBeTruthy();
  expect(q('my-person-create')).toBeNull();
});
it('nothing while the state cannot be read', async () => {
  mockReadError = { message: 'boom' };
  await mount();
  expect(document.body.textContent).toBe('');
});
it('a refusal of the database is shown', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'person_create_own: sign in first' } });
  await mount();
  await act(async () => { q('my-person-create')!.click(); await Promise.resolve(); await Promise.resolve(); });
  expect(q('my-person-error')!.textContent).toContain('sign in first');
});
