// The organization of a user is made by the SQL function organization_ensure_user (kit8/auth/userTableLogin.ts) in the same transaction as the user, so the
// old client-side ensureUserOrganization is gone. What stays: how the owner of an organization is spelled.
//   organizationTable.rowOwnerGUID = rowJSON.createdByUser = the e-mail of its creator (lower case; the creator is its administrator).
//   A user belongs to ONE organization (userTable.rowJSON.userOrganization); an organization has many users (organizationInvitationTable).

/** rowOwnerGUID / createdByUser of the organization created by this user. */
export const organizationOwnerOf = (userEmail: string): string => (userEmail || '').trim().toLowerCase();
