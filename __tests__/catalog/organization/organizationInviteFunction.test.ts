/** @jest-environment node */
// The Edge Function organization-invite (supabase/functions/organization-invite): the pure handler with injected doubles. The Deno wiring (index.ts) and the real e-mail are checked only on the
// Supabase project of the owner.
import { handleInvite, CORS_HEADERS, type InviteDeps, type MemberRow } from '../../../supabase/functions/organization-invite/handler';

const member = (o: Partial<MemberRow> = {}, json: Record<string, any> = {}): MemberRow => ({
  rowGUID: 'm1', rowOwnerGUID: 'orgA', rowParentGUID: 'empty',
  rowJSON: { userEmailForInvitation: 'erik@acme.test', memberStatus: 'invited', organizationAdministrator: false, ...json }, ...o,
});

function deps(over: Partial<InviteDeps> = {}) {
  const patches: any[] = [];
  const d: InviteDeps = {
    callerEmail: jest.fn(async () => 'anna@acme.test'),
    loadMember: jest.fn(async () => member()),
    isAdministrator: jest.fn(async () => true),
    sendInvitation: jest.fn(async () => null),
    patchMember: jest.fn(async (guid: string, patch: Record<string, any>) => { patches.push([guid, patch]); }),
    redirectTo: 'https://app.test',
    now: () => '2026-11-02T10:00:00.000Z',
    ...over,
  };
  return { d, patches };
}
const post = (body: any, headers: Record<string, string> = { Authorization: 'Bearer t' }) =>
  new Request('https://f.test/organization-invite', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const read = async (r: Response) => ({ status: r.status, body: await r.json() });

describe('organization-invite', () => {
  it('answers the CORS preflight', async () => {
    const r = await handleInvite(new Request('https://f.test/x', { method: 'OPTIONS' }), deps().d);
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe(CORS_HEADERS['Access-Control-Allow-Origin']);
  });
  it('POST only', async () => {
    expect((await handleInvite(new Request('https://f.test/x', { method: 'GET' }), deps().d)).status).toBe(405);
  });
  it('401 without a signed-in caller (no header, or a bad token)', async () => {
    expect((await read(await handleInvite(post({ memberGUID: 'm1' }, {}), deps().d))).status).toBe(401);
    const { d } = deps({ callerEmail: jest.fn(async () => null) });
    expect((await read(await handleInvite(post({ memberGUID: 'm1' }), d))).status).toBe(401);
    expect(d.sendInvitation).not.toHaveBeenCalled();
  });
  it('400 without a memberGUID or with a body that is no JSON', async () => {
    expect((await read(await handleInvite(post({}), deps().d))).status).toBe(400);
    expect((await read(await handleInvite(post('not json'), deps().d))).status).toBe(400);
  });
  it('404 for an unknown member', async () => {
    const { d } = deps({ loadMember: jest.fn(async () => null) });
    expect((await read(await handleInvite(post({ memberGUID: 'zz' }), d))).status).toBe(404);
  });
  it('403 when the caller is no administrator of the organization of the row; nothing is sent', async () => {
    const { d, patches } = deps({ isAdministrator: jest.fn(async () => false) });
    const res = await read(await handleInvite(post({ memberGUID: 'm1' }), d));
    expect(res.status).toBe(403);
    expect(d.isAdministrator).toHaveBeenCalledWith('orgA', 'anna@acme.test');
    expect(d.sendInvitation).not.toHaveBeenCalled();
    expect(patches).toEqual([]);
  });
  it('sends the invitation to the e-mail of the row with the redirect url and writes inviteSentAt', async () => {
    const { d, patches } = deps();
    const res = await read(await handleInvite(post({ memberGUID: ' m1 ' }), d));
    expect(res).toEqual({ status: 200, body: { sent: true } });
    expect(d.sendInvitation).toHaveBeenCalledWith('erik@acme.test', 'https://app.test');
    expect(patches).toEqual([['m1', { inviteSentAt: '2026-11-02T10:00:00.000Z', inviteError: null }]]);
  });
  it('the caller e-mail is compared in lower case', async () => {
    const { d } = deps({ callerEmail: jest.fn(async () => 'Anna@ACME.test') });
    await handleInvite(post({ memberGUID: 'm1' }), d);
    expect(d.isAdministrator).toHaveBeenCalledWith('orgA', 'anna@acme.test');
  });
  it('a member who is active already needs no e-mail', async () => {
    const { d, patches } = deps({ loadMember: jest.fn(async () => member({ rowParentGUID: 'u1' }, { memberStatus: 'active' })) });
    const res = await read(await handleInvite(post({ memberGUID: 'm1' }), d));
    expect(res).toEqual({ status: 200, body: { sent: false, reason: 'active' } });
    expect(d.sendInvitation).not.toHaveBeenCalled();
    expect(patches).toEqual([]);
  });
  it('an e-mail that has an Auth account already is not an error: his first login links the row', async () => {
    const { d, patches } = deps({ sendInvitation: jest.fn(async () => 'A user with this email address has already been registered') });
    const res = await read(await handleInvite(post({ memberGUID: 'm1' }), d));
    expect(res).toEqual({ status: 200, body: { sent: false, reason: 'registered' } });
    expect(patches).toEqual([['m1', { inviteError: null }]]);
  });
  it('another failure of Supabase is kept in inviteError and answered 502', async () => {
    const { d, patches } = deps({ sendInvitation: jest.fn(async () => 'Error sending invite email') });
    const res = await read(await handleInvite(post({ memberGUID: 'm1' }), d));
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ sent: false, error: 'Error sending invite email' });
    expect(patches).toEqual([['m1', { inviteError: 'Error sending invite email' }]]);
  });
  it('a row without an e-mail is refused', async () => {
    const { d } = deps({ loadMember: jest.fn(async () => member({}, { userEmailForInvitation: '' })) });
    expect((await read(await handleInvite(post({ memberGUID: 'm1' }), d))).status).toBe(400);
  });
});

describe('index.ts (the Deno wiring)', () => {
  const fs = require('fs'); const path = require('path');
  const index = fs.readFileSync(path.join(__dirname, '../../../supabase/functions/organization-invite/index.ts'), 'utf8') as string;
  it('uses the service role only inside the function and the handler for everything else', () => {
    expect(index).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(index).toContain("import { handleInvite } from './handler.ts'");
    expect(index).toContain('inviteUserByEmail');
    expect(index).toContain("Deno.env.get('INVITE_REDIRECT_URL')");
  });
  it('the app never carries the service role key', () => {
    const files = [
      'kit8/catalog/organization/members/inviteMember.ts', 'kit8/catalog/organization/members/OrganizationMembersCRUD.tsx',
    ];
    for (const f of files) expect(fs.readFileSync(path.join(__dirname, '../../..', f), 'utf8')).not.toMatch(/SERVICE_ROLE/i);
  });
});
