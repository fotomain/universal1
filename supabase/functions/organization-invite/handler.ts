// organization-invite - the invitation e-mail of an organization member (documentation/PERMISSIONS_WBS.html, section 4.5).
// The administrator adds a row to organizationMemberTable; the app then calls this function with the GUID of the row. The function:
//   1. takes the caller from his JWT and checks that he is an ACTIVE ADMINISTRATOR of the organization of that row (the service role key never leaves this function);
//   2. a member who is a registered user needs no e-mail (he is active already): answer { sent: false, reason: 'active' };
//   3. otherwise sends the Supabase Auth invitation (auth.admin.inviteUserByEmail) and writes inviteSentAt / inviteError into the member row.
// This file is PURE (no Deno, no network): index.ts injects the Supabase clients, the Jest test (__tests__/catalog/organization/organizationInviteFunction.test.ts) injects doubles.
export interface MemberRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  rowJSON: Record<string, any>;
}

export interface InviteDeps {
  /** the e-mail of the signed-in caller from the Authorization header (null = not signed in / bad token) */
  callerEmail: (authorization: string) => Promise<string | null>;
  loadMember: (memberGUID: string) => Promise<MemberRow | null>;
  /** is this e-mail an active administrator member of the organization */
  isAdministrator: (organizationGUID: string, email: string) => Promise<boolean>;
  /** auth.admin.inviteUserByEmail(email, { redirectTo }) -> an error text or null */
  sendInvitation: (email: string, redirectTo: string | undefined) => Promise<string | null>;
  /** merge into rowJSON of the member row (the service role: the guard of the table lets it) */
  patchMember: (memberGUID: string, patch: Record<string, any>) => Promise<void>;
  redirectTo?: string;
  now?: () => string;
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const;

const json = (status: number, body: Record<string, any>): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

/** Supabase says it when the e-mail has an Auth account already (the person registered but never opened this app): no e-mail is needed, his first login links the row */
const isAlreadyRegistered = (message: string): boolean => /already (been )?registered|already exists|email_exists/i.test(message);

export async function handleInvite(req: Request, deps: InviteDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const authorization = req.headers.get('Authorization') || '';
  const caller = authorization ? await deps.callerEmail(authorization) : null;
  if (!caller) return json(401, { error: 'Sign in first.' });

  let memberGUID = '';
  try {
    const body = await req.json();
    memberGUID = typeof body?.memberGUID === 'string' ? body.memberGUID.trim() : '';
  } catch {
    memberGUID = '';
  }
  if (!memberGUID) return json(400, { error: 'memberGUID is required.' });

  const member = await deps.loadMember(memberGUID);
  if (!member) return json(404, { error: 'No such member.' });
  if (!(await deps.isAdministrator(member.rowOwnerGUID, caller.toLowerCase()))) {
    return json(403, { error: 'Only the administrator of the organization can send invitations.' });
  }

  const email = String(member.rowJSON?.userEmailForInvitation ?? '').trim().toLowerCase();
  if (!email) return json(400, { error: 'The member has no e-mail.' });
  const hasUser = !!member.rowParentGUID && member.rowParentGUID !== 'empty';
  if (hasUser || member.rowJSON?.memberStatus === 'active') return json(200, { sent: false, reason: 'active' });

  const now = deps.now ? deps.now() : new Date().toISOString();
  const failure = await deps.sendInvitation(email, deps.redirectTo);
  if (failure && isAlreadyRegistered(failure)) {
    await deps.patchMember(memberGUID, { inviteError: null });
    return json(200, { sent: false, reason: 'registered' });
  }
  if (failure) {
    await deps.patchMember(memberGUID, { inviteError: failure.slice(0, 300) });
    return json(502, { sent: false, error: failure });
  }
  await deps.patchMember(memberGUID, { inviteSentAt: now, inviteError: null });
  return json(200, { sent: true });
}
