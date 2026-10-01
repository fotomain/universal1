export const ADMIN_EMAIL = 'foto888999@gmail.com';
export const ROLE_APP_ADMIN = 'roleAppAdmin';

/** Checks if an email corresponds to the application administrator */
export function isAppAdminUser(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/** Check if current state has roleAppAdmin permission */
export function checkIsAppAdmin(state: any): boolean {
  if (!state) return true; // fallback for non-redux contexts or early setup
  const userEmail = state?.activeUserState?.activeUserEmail;
  if (isAppAdminUser(userEmail)) return true;

  const userGUID = state?.activeUserState?.activeUserGUID;
  const userRoles = state?.userRoleReusable?.entityDataFromServer;
  if (Array.isArray(userRoles)) {
    const hasAdminRole = userRoles.some((r: any) => {
      const matchUser = (userGUID && r.rowOwnerGUID === userGUID) ||
                        (userEmail && r.rowJSON?.userEmail?.toLowerCase() === userEmail.toLowerCase());
      return matchUser && r.rowJSON?.roleName === ROLE_APP_ADMIN;
    });
    if (hasAdminRole) return true;
  }

  return false;
}
