// The organization filter of the Project dashboard (documentation/PERMISSIONS_WBS.html, section 4.3): a user who is a member of several organizations picks ONE of them; only the projects of
// that organization can be selected. Picking = organization_switch (SQL PART 45): userTable.rowJSON.userOrganization is the ACTIVE organization, a new project belongs to it.
// Pure (no React, no Supabase): the rules are tested without a screen.
export interface OrganizationMembership {
  organizationGUID: string;
  organizationTitle: string;
  isAdministrator: boolean;
  isActive: boolean;
}

/** the answer of the RPC organization_my_memberships as a clean list (anything else = none) */
export function membershipsOf(data: unknown): OrganizationMembership[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((m) => m && typeof m.organizationGUID === 'string' && m.organizationGUID)
    .map((m) => ({
      organizationGUID: m.organizationGUID,
      organizationTitle: String(m.organizationTitle ?? m.organizationGUID),
      isAdministrator: m.isAdministrator === true,
      isActive: m.isActive === true,
    }));
}

/** the filter is shown only for a user of two or more organizations */
export const showOrganizationFilter = (memberships: OrganizationMembership[]): boolean => memberships.length >= 2;

/**
 * The projects that can be selected: those of the active organization. Nothing is filtered while the organization is not known yet (login step not finished), and a project
 * without an organization (an old project of an owner with no user row) stays visible.
 */
export function projectsOfOrganization<T extends { rowParentGUID?: string | null }>(projects: readonly T[], organizationGUID: string | null | undefined): T[] {
  if (!organizationGUID) return projects.slice();
  return projects.filter((p) => !p.rowParentGUID || p.rowParentGUID === organizationGUID);
}
