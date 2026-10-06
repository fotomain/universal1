import type { CardItem } from '../../ui/components/list/web/lib/types';

export const userRolesTable = "userRoleTable";
export const USER_ROLE_ENTITY = "userRoleReusable";

export const USER_ROLE_READ_PARAMS = {
  paginationSize: 1000,
  originationCurrentPage: 0,
};

export const USER_ROLE_ROUTES = {
  list: '/user/roles/list',
  edit: '/user/role/edit',
} as const;

export interface UserRoleRowJSON {
  userEmail: string;
  userId?: string;
  roleName: string;
  roleTitle?: string;
  roleGUID?: string;
  isActive: boolean;
}

export interface UserRoleRow {
  rowGUID: string;
  /** user's GUID / UID / email */
  rowOwnerGUID: string;
  /** roleGUID or empty */
  rowParentGUID: string;
  orderInList: number;
  rowJSON: UserRoleRowJSON;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_USER_ROLES = [
  'roleUser',
  'roleOrganizationAdmin',
  'roleProjectManager',
];

export const emptyUserRole = (): UserRoleRowJSON => ({
  userEmail: '',
  roleName: 'roleUser',
  roleTitle: 'User',
  isActive: true,
});

export interface UserRoleErrors {
  userEmail?: string;
  roleName?: string;
}

export function validateUserRole(
  values: Partial<UserRoleRowJSON>,
  others: UserRoleRow[] = []
): UserRoleErrors {
  const errors: UserRoleErrors = {};
  const email = (values.userEmail || '').trim();
  const role = (values.roleName || '').trim();

  if (!email) {
    errors.userEmail = 'User email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.userEmail = 'Valid email is required.';
  }

  if (!role) {
    errors.roleName = 'Role name is required.';
  } else if (
    others.some(
      (r) =>
        r.rowJSON?.userEmail?.toLowerCase() === email.toLowerCase() &&
        r.rowJSON?.roleName === role
    )
  ) {
    errors.roleName = `User already has role "${role}".`;
  }

  return errors;
}

export function userRoleToCard(row: UserRoleRow, idx = 0): CardItem {
  const j = row?.rowJSON || ({} as UserRoleRowJSON);
  return {
    id: row?.rowGUID || `user-role-${idx + 1}`,
    title: `${j.userEmail || 'User'} · ${j.roleTitle || j.roleName || 'Role'}`,
    description: [j.roleName, j.isActive === false ? 'inactive' : 'active'].filter(Boolean).join(' · '),
    orderInList: row?.orderInList ?? (idx + 1) * 1000,
    rawItem: row,
  };
}
