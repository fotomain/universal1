// Organization members - who is a member of which organization (SQL PART 45 of kit8/sql/start, documentation/PERMISSIONS_WBS.html section 4).
//   organizationMemberTable  rowGUID (own id) · rowOwnerGUID = the organization · rowParentGUID = the user (userTable.rowGUID), 'empty' while an invited user has not logged in yet
//                            · rowJSON { userEmailForInvitation (lower case), organizationAdministrator, memberStatus 'invited' | 'active', autoCreatePerson (default true),
//                                        invitedAt, invitedBy, registeredAt (first session in this organization), inviteSentAt, inviteError }
//   The administrator adds a row (an e-mail of a registered user is ACTIVE at once, any other is INVITED until his first login) and marks other members as administrators. The database
//   (trigger organization_member_guard) keeps the rules: nobody deletes himself, the organization keeps an administrator, a member who owns projects is not removed, the key fields are not edited.
// Pure (no React, no Supabase): the rules are tested without a screen.
import type { DefRow, ProductTableDef } from '../../product/productModel';

export const ORGANIZATION_MEMBER_ROUTES = { list: '/catalog/organization/members' } as const;

export const ORGANIZATION_MEMBER_TABLE: ProductTableDef = {
  table: 'organizationMemberTable',
  entity: 'organizationMemberReusable',
  itemLabel: 'Member',
  catalogOwner: null,
  purpose: 'The users of your organization: who is the administrator, who is invited and has not logged in yet.',
  emptyRowJSON: () => ({ userEmailForInvitation: null, organizationAdministrator: false, autoCreatePerson: true }),
};
export const ORGANIZATION_MEMBER_ENTITY = ORGANIZATION_MEMBER_TABLE.entity;

export type MemberStatus = 'invited' | 'active';

export interface OrganizationMemberJSON {
  userEmailForInvitation: string;
  organizationAdministrator: boolean;
  memberStatus: MemberStatus;
  autoCreatePerson: boolean;
  invitedAt?: string | null;
  invitedBy?: string | null;
  registeredAt?: string | null;
  inviteSentAt?: string | null;
  inviteError?: string | null;
}

const EMAIL = /^[^@\s]+@[^@\s]+$/;

/** the e-mail as the database keeps it: trimmed, lower case */
export const normalizeMemberEmail = (v: unknown): string => String(v ?? '').trim().toLowerCase();
export const isValidMemberEmail = (v: unknown): boolean => EMAIL.test(normalizeMemberEmail(v));

export const memberEmail = (r: DefRow<any> | null | undefined): string => normalizeMemberEmail(r?.rowJSON?.userEmailForInvitation);
export const memberStatusOf = (r: DefRow<any> | null | undefined): MemberStatus => (r?.rowJSON?.memberStatus === 'active' ? 'active' : 'invited');
export const memberIsAdministrator = (r: DefRow<any> | null | undefined): boolean => r?.rowJSON?.organizationAdministrator === true;
/** the member row has a user (he has logged in, or was a registered user when added) */
export const memberHasUser = (r: DefRow<any> | null | undefined): boolean => !!r?.rowParentGUID && r.rowParentGUID !== 'empty';
/** English words of the status (pmT translates them) */
export const memberStatusLabel = (status: MemberStatus): string => (status === 'active' ? 'Active' : 'Invited');

/** the rows of ONE organization: administrators first, then by e-mail */
export function membersOfOrganization(rows: DefRow<any>[] | null | undefined, organizationGUID: string): DefRow<any>[] {
  return (rows || [])
    .filter((r) => r.rowOwnerGUID === organizationGUID)
    .slice()
    .sort((a, b) => Number(memberIsAdministrator(b)) - Number(memberIsAdministrator(a)) || memberEmail(a).localeCompare(memberEmail(b)));
}

/** is the signed-in user (by e-mail) an ACTIVE administrator of the organization, from the rows he can read (the administrator reads them all, a member only his own) */
export function isAdministratorIn(rows: DefRow<any>[] | null | undefined, organizationGUID: string, myEmail: string | null | undefined): boolean {
  const me = normalizeMemberEmail(myEmail);
  if (!me) return false;
  return (rows || []).some((r) => r.rowOwnerGUID === organizationGUID && memberEmail(r) === me && memberStatusOf(r) === 'active' && memberIsAdministrator(r));
}

/** the row the "Invite" button inserts; the database sets the status, the user, invitedAt and invitedBy (anything else sent is ignored) */
export function inviteRowOf(organizationGUID: string, email: string, autoCreatePerson = true): { rowOwnerGUID: string; rowParentGUID: 'empty'; rowJSON: { userEmailForInvitation: string; autoCreatePerson: boolean } } {
  return { rowOwnerGUID: organizationGUID, rowParentGUID: 'empty', rowJSON: { userEmailForInvitation: normalizeMemberEmail(email), autoCreatePerson } };
}

/** '2026-11-02T10:11:12.345+00:00' -> '2026-11-02 10:11' (UTC as stored); '' for nothing */
export function formatMemberDate(v: unknown): string {
  const s = String(v ?? '');
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(s);
  return m ? `${m[1]} ${m[2]}` : s.slice(0, 16);
}

/** the invitation e-mail can be sent (again) for a member who has not logged in yet */
export const canSendInvitation = (r: DefRow<any> | null | undefined): boolean => memberStatusOf(r) === 'invited' && !memberHasUser(r);
