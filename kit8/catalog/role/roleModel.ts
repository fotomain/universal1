import type { CardItem } from '../../ui/components/list/web/lib/types';

export const rolesTable = "roleTable";
export const ROLE_ENTITY = "roleReusable";
export const ROLE_CATALOG_OWNER = "roleCatalog";

export const ROLE_READ_PARAMS = {
  paginationSize: 1000,
  originationCurrentPage: 0,
};

export const ROLE_ROUTES = {
  list: '/catalog/role/list',
  edit: '/catalog/role/edit',
} as const;

export interface RoleRowJSON {
  roleName: string;
  roleTitle: string;
  roleDescription?: string;
  isActive: boolean;
}

export interface RoleRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: RoleRowJSON;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_ROLES: RoleRowJSON[] = [
  {
    roleName: 'roleUser',
    roleTitle: 'User',
    roleDescription: 'Standard user with basic access',
    isActive: true,
  },
  {
    roleName: 'roleOrganizationAdmin',
    roleTitle: 'Organization Admin',
    roleDescription: 'Administrator of organizational assets and teams',
    isActive: true,
  },
  {
    roleName: 'roleProjectManager',
    roleTitle: 'Project Manager',
    roleDescription: 'Manager with authority over project planning and execution',
    isActive: true,
  },
  {
    roleName: 'roleAppAdmin',
    roleTitle: 'App Admin',
    roleDescription: 'System-wide administrator with full control',
    isActive: true,
  },
];

export const emptyRole = (): RoleRowJSON => ({
  roleName: '',
  roleTitle: '',
  roleDescription: '',
  isActive: true,
});

export interface RoleErrors {
  roleName?: string;
  roleTitle?: string;
}

export function validateRole(
  values: Partial<RoleRowJSON>,
  others: RoleRow[] = []
): RoleErrors {
  const errors: RoleErrors = {};
  const name = (values.roleName || '').trim();
  const title = (values.roleTitle || '').trim();

  if (!name) {
    errors.roleName = 'Role name is required (e.g. roleUser).';
  } else if (!/^[A-Za-z0-9_]{3,50}$/.test(name)) {
    errors.roleName = 'Role name must be 3-50 alphanumeric characters (or underscore).';
  } else if (others.some((r) => r.rowJSON?.roleName?.toLowerCase() === name.toLowerCase())) {
    errors.roleName = `Role "${name}" already exists.`;
  }

  if (!title) {
    errors.roleTitle = 'Role title is required (e.g. Project Manager).';
  }

  return errors;
}

export function roleToCard(row: RoleRow, idx = 0): CardItem {
  const j = row?.rowJSON || ({} as RoleRowJSON);
  return {
    id: row?.rowGUID || `role-${idx + 1}`,
    title: j.roleTitle || j.roleName || 'Unnamed Role',
    description: [j.roleName, j.roleDescription, j.isActive === false ? 'inactive' : ''].filter(Boolean).join(' · '),
    orderInList: row?.orderInList ?? (idx + 1) * 1000,
    rawItem: row,
  };
}
