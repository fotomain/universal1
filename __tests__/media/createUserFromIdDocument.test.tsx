/** @jest-environment jsdom */
// "Create user" of an ID card / passport: the e-mail rule, the member row + invitation, the button that then reads "User created."
import React from 'react';
import { cleanup, flush, pressAsync, q, render, text } from './mediaUiTestKit';

const mockState: any = { activeUserState: { activeUserEmail: 'Boss@Company.com', userOrganization: { rowGUID: 'org-1' } } };
jest.mock('react-redux', () => ({ useSelector: (fn: any) => fn(mockState), useDispatch: () => jest.fn() }));
jest.mock('../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: (globalThis as any).__sb }) }));
jest.mock('../../kit8/ui/components/common', () => {
  const R = require('react');
  const RN = require('react-native');
  return { ButtonSecondaryApp: ({ children, onPress, disabled, testID, icon }: any) => R.createElement(RN.Pressable, { testID, onPress: disabled ? undefined : onPress, 'data-icon': icon, accessibilityState: { disabled: !!disabled } }, R.createElement(RN.Text, null, children)),
    ButtonPrimaryApp: () => null, TextInputApp: () => null, SwitchApp: () => null };
});

import { emailDomainOf, userEmailFromIdDocument } from '../../kit8/ui/components/media/nfc/iddocread/idUserEmail';
import { createUserFromIdDocument } from '../../kit8/ui/components/media/nfc/iddocread/createUserFromIdDocument';
import CreateUserFromIDDocumentButton from '../../kit8/ui/components/media/nfc/iddocread/CreateUserFromIDDocumentButton';

describe('the e-mail of the user', () => {
  it('first given name + "." + surname + the domain of the signed-in user', () => {
    expect(userEmailFromIdDocument('JURIJS', 'TERENTJEVS', 'boss@company.com')).toBe('jurijs.terentjevs@company.com');
    expect(userEmailFromIdDocument('JURIJS PETERIS', 'TERENTJEVS', 'Boss@Mail.Company.com')).toBe('jurijs.terentjevs@mail.company.com');
  });
  it('marks of letters are dropped, a surname of several words is joined with a dash', () => {
    expect(userEmailFromIdDocument('Šarlote', 'VAN DER Bērzs', 'a@b.lv')).toBe('sarlote.van-der-berzs@b.lv');
    expect(userEmailFromIdDocument("JEAN-LUC", "O'BRIEN", 'a@b.lv')).toBe('jean.obrien@b.lv');
  });
  it('no e-mail without a name or without a domain (a guest)', () => {
    expect(userEmailFromIdDocument('', 'X', 'a@b.lv')).toBeNull();
    expect(userEmailFromIdDocument('A', '', 'a@b.lv')).toBeNull();
    expect(userEmailFromIdDocument('A', 'B', '')).toBeNull();
    expect(userEmailFromIdDocument('A', 'B', 'guest')).toBeNull();
    expect(emailDomainOf('x@y.z')).toBe('y.z');
  });
});

describe('createUserFromIdDocument', () => {
  const sb = (insertResult: any, invokeResult: any = { data: { sent: true } }) => {
    const calls: any = { rows: [], invoked: [] };
    const client = {
      from: (t: string) => ({ insert: (row: any) => { calls.rows.push({ t, row }); return { select: () => ({ single: async () => insertResult }) }; } }),
      functions: { invoke: async (name: string, o: any) => { calls.invoked.push({ name, o }); return invokeResult; } },
    };
    return { client, calls };
  };

  it('saves the member row of the active organization, then sends the invitation of a person who has not logged in', async () => {
    const { client, calls } = sb({ data: { rowGUID: 'm1', rowParentGUID: 'empty' }, error: null });
    const r = await createUserFromIdDocument({ supabase: client, organizationGUID: 'org-1', email: 'jurijs.terentjevs@company.com' });
    expect(r).toEqual({ ok: true, status: 'created' });
    expect(calls.rows[0].t).toBe('organizationMemberTable');
    expect(calls.rows[0].row).toMatchObject({ rowOwnerGUID: 'org-1', rowParentGUID: 'empty', rowJSON: { userEmailForInvitation: 'jurijs.terentjevs@company.com' } });
    expect(calls.invoked).toEqual([{ name: 'organization-invite', o: { body: { memberGUID: 'm1' } } }]);
  });

  it('a user that is registered already is active at once: no invitation', async () => {
    const { client, calls } = sb({ data: { rowGUID: 'm1', rowParentGUID: 'user-9' }, error: null });
    expect(await createUserFromIdDocument({ supabase: client, organizationGUID: 'org-1', email: 'a@b.lv' })).toEqual({ ok: true, status: 'created' });
    expect(calls.invoked).toEqual([]);
  });

  it('the member is saved but the invitation e-mail failed: created, with the reason', async () => {
    const { client } = sb({ data: { rowGUID: 'm1', rowParentGUID: 'empty' }, error: null }, { data: { error: 'function not deployed' } });
    expect(await createUserFromIdDocument({ supabase: client, organizationGUID: 'org-1', email: 'a@b.lv' })).toEqual({ ok: true, status: 'created', inviteError: 'function not deployed' });
  });

  it('the e-mail is a member already / the database refuses (not an administrator) / nothing to write to', async () => {
    expect(await createUserFromIdDocument({ supabase: sb({ data: null, error: { code: '23505', message: 'duplicate key' } }).client, organizationGUID: 'o', email: 'a@b.lv' })).toEqual({ ok: true, status: 'exists' });
    expect(await createUserFromIdDocument({ supabase: sb({ data: null, error: { message: 'No permission: only an administrator' } }).client, organizationGUID: 'o', email: 'a@b.lv' })).toEqual({ ok: false, error: 'No permission: only an administrator' });
    expect(await createUserFromIdDocument({ supabase: null, organizationGUID: 'o', email: 'a@b.lv' })).toEqual({ ok: false, error: 'Not connected.' });
    expect(await createUserFromIdDocument({ supabase: {}, organizationGUID: '', email: 'a@b.lv' })).toEqual({ ok: false, error: 'There is no active organization.' });
  });
});

describe('CreateUserFromIDDocumentButton', () => {
  afterEach(() => { cleanup(); mockState.activeUserState.activeUserEmail = 'Boss@Company.com'; });

  it('shows the e-mail it will make; after the press it reads "User created." and is off', async () => {
    const create = jest.fn(async () => ({ ok: true, status: 'created' } as const));
    render(<CreateUserFromIDDocumentButton givenNames="JURIJS" surname="TERENTJEVS" create={create as any} />);
    expect(text('create-user-from-id')).toBe('Create user');
    expect(text('create-user-from-id-email')).toBe('jurijs.terentjevs@company.com');
    await pressAsync('create-user-from-id');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ organizationGUID: 'org-1', email: 'jurijs.terentjevs@company.com' }));
    await flush();
    expect(text('create-user-from-id')).toBe('User created.');
    await pressAsync('create-user-from-id');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('a refusal keeps the button ready and says why; an invitation that was not sent is said under "User created."', async () => {
    const create = jest.fn().mockResolvedValueOnce({ ok: false, error: 'No permission' }).mockResolvedValueOnce({ ok: true, status: 'created', inviteError: 'no function' });
    render(<CreateUserFromIDDocumentButton givenNames="A" surname="B" create={create as any} />);
    await pressAsync('create-user-from-id');
    await flush();
    expect(text('create-user-from-id')).toBe('Create user');
    expect(text('create-user-from-id-note')).toBe('No permission');
    await pressAsync('create-user-from-id');
    await flush();
    expect(text('create-user-from-id')).toBe('User created.');
    expect(text('create-user-from-id-note')).toContain('no function');
  });

  it('a guest (no e-mail with a domain): the button is off and says why', async () => {
    mockState.activeUserState.activeUserEmail = 'guest';
    const create = jest.fn();
    render(<CreateUserFromIDDocumentButton givenNames="A" surname="B" create={create as any} />);
    expect(q('create-user-from-id-no-email')).not.toBeNull();
    await pressAsync('create-user-from-id');
    expect(create).not.toHaveBeenCalled();
  });
});
