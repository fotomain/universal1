/** @jest-environment jsdom */
// The screen "Organization members": the Invite row (administrator only), the ReusableTable props (add off, columns editable only for the administrator, rows of the active organization),
// the row menu (Create person, Send invitation again). The model: organizationMember.test.ts; the database: kit8/docker/tests/48_organization_members.sql.
import React, { act } from 'react';

let mockRows: any[] = [];
let mockEmail = 'anna@acme.test';
const mockInsert = jest.fn();
const mockInvoke = jest.fn();
const mockRpc = jest.fn();
const mockReload = jest.fn();
let tableProps: any = null;

// the "May create projects" panel has its own test (__tests__/permissions/assignmentsEditor.test.tsx)
jest.mock('../../../kit8/permissions/AssignmentsEditor', () => ({ __esModule: true, default: () => null }));
jest.mock('react-redux', () => ({ useSelector: (sel: any) => sel({ activeUserState: { userOrganization: { rowGUID: 'orgA' }, activeUserEmail: mockEmail } }) }));
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({ useDesignSystem: () => ({ themeColors: { text: '#000', primary: '#00f', border: '#ccc', surface: '#fff', background: '#fff', error: '#f00' } }) }));
jest.mock('../../../kit8/providers/WithSupabase', () => {
  const chain = { select: () => chain, single: () => (mockInsert as any).result() };
  const client = {
    from: () => ({ insert: (...a: any[]) => { (mockInsert as any)(...a); return chain; } }),
    functions: { invoke: (...a: any[]) => (mockInvoke as any)(...a) },
    rpc: (...a: any[]) => (mockRpc as any)(...a),
  };
  return { useSupabase: () => ({ supabase: client }) };
});
jest.mock('../../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => ({ PMIconButton: () => null }));
jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: (sel: any) => sel({ selectRowCheckBoxForm: false }) }));
jest.mock('../../../kit8/ui/components/common', () => {
  const R = require('react');
  return {
    TextInputApp: ({ testID, value, onChangeText }: any) => R.createElement('input', { 'data-testid': testID, value, onChange: (e: any) => onChangeText(e.target.value) }),
    SwitchApp: ({ testID, value, onValueChange }: any) => R.createElement('input', { type: 'checkbox', 'data-testid': testID, checked: value, onChange: (e: any) => onValueChange(e.target.checked) }),
    ButtonPrimaryApp: ({ testID, title, onPress, disabled }: any) => R.createElement('button', { 'data-testid': testID, disabled, onClick: onPress }, title),
  };
});
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { tableProps = p; return null; } }));
jest.mock('../../../kit8/catalog/organization/members/useOrganizationMembers', () => ({
  useOrganizationMembers: () => ({ rows: mockRows, loaded: true, error: '', reload: mockReload }),
}));

import OrganizationMembersCRUD from '../../../kit8/catalog/organization/members/OrganizationMembersCRUD';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<OrganizationMembersCRUD />));
}
const member = (email: string, o: Record<string, any> = {}, parent = 'u-' + email) => ({ rowGUID: 'm-' + email, rowOwnerGUID: 'orgA', rowParentGUID: parent, orderInList: 0, rowJSON: { userEmailForInvitation: email, organizationAdministrator: false, memberStatus: 'active', ...o } });
const type = (id: string, value: string) => act(() => {
  const el = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const click = (id: string) => act(() => { (q(id) as HTMLElement).click(); });

beforeEach(() => {
  mockRows = [member('anna@acme.test', { organizationAdministrator: true }), member('boris@acme.test')];
  mockEmail = 'anna@acme.test';
  tableProps = null;
  mockInsert.mockReset(); mockInvoke.mockReset(); mockRpc.mockReset(); mockReload.mockReset();
  (mockInsert as any).result = () => Promise.resolve({ data: { rowGUID: 'new1', rowParentGUID: 'empty' }, error: null });
  mockInvoke.mockResolvedValue({ data: { sent: true }, error: null });
  mockRpc.mockResolvedValue({ data: 'person1', error: null });
});
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

describe('the administrator', () => {
  it('sees the Invite row; the table has no add button, the flag columns are editable, only the rows of the active organization are shown', () => {
    mount();
    expect(q('organization-members-invite')).toBeTruthy();
    expect(tableProps.addEnabled).toBe(false);
    const cols = tableProps.visualColumns;
    expect(cols.find((c: any) => c.key === 'admin')).toMatchObject({ type: 'boolean', field: 'organizationAdministrator', editable: true });
    expect(cols.find((c: any) => c.key === 'person')).toMatchObject({ type: 'boolean', field: 'autoCreatePerson', editable: true });
    expect(cols.find((c: any) => c.key === 'email').editable).toBe(false);
    expect(tableProps.rowFilter({ rowOwnerGUID: 'orgA' })).toBe(true);
    expect(tableProps.rowFilter({ rowOwnerGUID: 'orgB' })).toBe(false);
  });
  it('a bad e-mail is not sent to the database', async () => {
    mount();
    type('organization-members-invite-email', 'not an email');
    click('organization-members-invite-button');
    await flush();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(q('organization-members-message')!.textContent).toContain('Enter an e-mail like name@company.com');
  });
  it('Invite inserts the row (lower case, empty user, the person switch) and sends the invitation e-mail for a user who has not logged in', async () => {
    mount();
    type('organization-members-invite-email', '  Erik@Acme.TEST ');
    click('organization-members-invite-person');   // switched OFF
    click('organization-members-invite-button');
    await flush();
    expect(mockInsert).toHaveBeenCalledWith({ rowOwnerGUID: 'orgA', rowParentGUID: 'empty', rowJSON: { userEmailForInvitation: 'erik@acme.test', autoCreatePerson: false } });
    expect(mockInvoke).toHaveBeenCalledWith('organization-invite', { body: { memberGUID: 'new1' } });
    expect(mockReload).toHaveBeenCalled();
    expect((q('organization-members-invite-email') as HTMLInputElement).value).toBe('');
  });
  it('a registered user is active at once: no invitation e-mail', async () => {
    (mockInsert as any).result = () => Promise.resolve({ data: { rowGUID: 'new2', rowParentGUID: 'u-clara' }, error: null });
    mount();
    type('organization-members-invite-email', 'clara@acme.test');
    click('organization-members-invite-button');
    await flush();
    expect(mockInsert).toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
  it('a refusal of the database is shown (the same e-mail twice)', async () => {
    (mockInsert as any).result = () => Promise.resolve({ data: null, error: { message: 'organizationMemberTable: boris@acme.test is already a member or invited in this organization' } });
    mount();
    type('organization-members-invite-email', 'boris@acme.test');
    click('organization-members-invite-button');
    await flush();
    expect(q('organization-members-message')!.textContent).toContain('already a member');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
  it('a failed invitation e-mail is shown (the function is not deployed), the member row stays', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'Function not found' } });
    mount();
    type('organization-members-invite-email', 'erik@acme.test');
    click('organization-members-invite-button');
    await flush();
    expect(q('organization-members-message')!.textContent).toContain('Function not found');
    expect(mockReload).toHaveBeenCalled();
  });
  it('the row menu: Create person for everybody, Send invitation again only for an invited member without a user', async () => {
    mount();
    const close = jest.fn();
    const active = tableProps.extraMenuItems(member('boris@acme.test'), close);
    expect(active.map((i: any) => i.label)).toEqual(['Create person']);
    const invited = tableProps.extraMenuItems(member('erik@acme.test', { memberStatus: 'invited' }, 'empty'), close);
    expect(invited.map((i: any) => i.label)).toEqual(['Create person', 'Send invitation again']);
    await act(async () => { invited[0].onPress(); await Promise.resolve(); });
    expect(mockRpc).toHaveBeenCalledWith('organization_member_create_person', { p_member: 'm-erik@acme.test' });
    expect(close).toHaveBeenCalled();
    await act(async () => { invited[1].onPress(); await Promise.resolve(); await Promise.resolve(); });
    expect(mockInvoke).toHaveBeenCalledWith('organization-invite', { body: { memberGUID: 'm-erik@acme.test' } });
  });
});

describe('a member who is no administrator', () => {
  beforeEach(() => { mockEmail = 'boris@acme.test'; mockRows = [member('boris@acme.test')]; });
  it('sees a read only note instead of the Invite row; the flag columns are not editable; no row menu', () => {
    mount();
    expect(q('organization-members-invite')).toBeNull();
    expect(q('organization-members-readonly')).toBeTruthy();
    expect(tableProps.visualColumns.find((c: any) => c.key === 'admin').editable).toBe(false);
    expect(tableProps.extraMenuItems(mockRows[0], jest.fn())).toEqual([]);
  });
});
