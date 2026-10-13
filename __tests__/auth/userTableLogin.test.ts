// WP A1/A4: the sign-in step calls organization_ensure_user and returns the user AND his organization; a user without an organization is never used.
import { loginUserTable } from '../../kit8/auth/userTableLogin';
import { organizationOwnerOf } from '../../kit8/catalog/organization/ensureUserOrganization';

const rpcOk = (data: any) => ({ rpc: jest.fn().mockResolvedValue({ data, error: null }) });

describe('loginUserTable', () => {
  it('calls organization_ensure_user with the lower-cased e-mail and returns the user with the organization', async () => {
    const supabase = rpcOk({ userGUID: 'u-1', organizationGUID: 'org-1', organizationTitle: "Bob's Organization" });
    const login = await loginUserTable(supabase as any, { email: ' Bob@Example.COM ', authUID: 'auth-1', firstName: 'Bob', lastName: 'B' });
    expect(supabase.rpc).toHaveBeenCalledWith('organization_ensure_user', { p_email: 'bob@example.com', p_auth_uid: 'auth-1', p_first_name: 'Bob', p_last_name: 'B' });
    expect(login).toEqual({ userGUID: 'u-1', organization: { rowGUID: 'org-1', title: "Bob's Organization" } });
  });

  it('sends null for what it does not know', async () => {
    const supabase = rpcOk({ userGUID: 'u-1', organizationGUID: 'org-1' });
    await loginUserTable(supabase as any, { email: 'bob@example.com' });
    expect(supabase.rpc).toHaveBeenCalledWith('organization_ensure_user', { p_email: 'bob@example.com', p_auth_uid: null, p_first_name: null, p_last_name: null });
  });

  it('never returns a user without an organization', async () => {
    await expect(loginUserTable(rpcOk({ userGUID: 'u-1', organizationGUID: '' }) as any, { email: 'bob@example.com' })).rejects.toThrow('no user or no organization');
    await expect(loginUserTable(rpcOk(null) as any, { email: 'bob@example.com' })).rejects.toThrow('no user or no organization');
  });

  it('throws the message of the database', async () => {
    const supabase = { rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) };
    await expect(loginUserTable(supabase as any, { email: 'bob@example.com' })).rejects.toThrow('organization_ensure_user failed: boom');
  });

  it('needs an e-mail', async () => {
    const supabase = rpcOk({});
    await expect(loginUserTable(supabase as any, { email: '  ' })).rejects.toThrow('no email');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

it('organizationOwnerOf spells the owner as the lower-cased e-mail', () => {
  expect(organizationOwnerOf('  Bob@Example.COM ')).toBe('bob@example.com');
  expect(organizationOwnerOf('')).toBe('');
});
