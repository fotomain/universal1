// Permissions of the signed-in user (pure; documentation/PERMISSIONS_WBS.html, sections 5 and 7). The database is the law (RLS, RPC guards, lock triggers); this file only
// reads the answer of perm_my_matrix(project, task) so that the interface can hide or disable what the database would refuse - never to widen anything.
export type PermLetter = 'C' | 'R' | 'U' | 'D';

/** the answer of the SQL function perm_my_matrix: the letters of ALL profiles of the caller added up, per table / interface object */
export interface MyMatrix {
  profiles: string[];
  crud: Record<string, string>;
  uxui: Record<string, string>;
  isAdmin: boolean;
  canCreateProject: boolean;
  /** the project of the question is read-only (SQL PART 51): only R is left, and U of project_table for the switch itself */
  projectIsReadonly: boolean;
}

export const EMPTY_MATRIX: MyMatrix = { profiles: [], crud: {}, uxui: {}, isAdmin: false, canCreateProject: false, projectIsReadonly: false };

export const PROFILE_TITLES: Record<string, string> = {
  permissionOrganizationAdmin: 'Organization administrator',
  permissionProjectManager: 'Project manager',
  permissionProjectReadOnly: 'Project read only',
  permissionProjectSponsor: 'Project sponsor',
  permissionProjectCurator: 'Project curator',
  permissionProjectInvestor: 'Project investor',
  permissionProjectMember: 'Project member',
  permissionTaskResponsible: 'Task responsible',
  permissionTaskManager: 'Task manager',
  permissionFinancialManagerPlan: 'Financial manager (plan)',
  permissionFinancialManagerFact: 'Financial manager (fact)',
};

/** the profiles a project manager / administrator may give by hand (the others are derived from RACI or come from the members screen) */
export const ASSIGNABLE_PROFILES = [
  'permissionProjectManager',
  'permissionProjectReadOnly',
  'permissionProjectSponsor',
  'permissionProjectCurator',
  'permissionProjectInvestor',
  'permissionTaskManager',
  'permissionFinancialManagerPlan',
  'permissionFinancialManagerFact',
];

/** the profiles that mean "may create projects" when they are given for the whole ORGANIZATION */
export const CREATE_PROJECT_PROFILES = ['permissionProjectManager', 'permissionProjectCurator'];

export function matrixOf(raw: any): MyMatrix {
  if (!raw || typeof raw !== 'object') return EMPTY_MATRIX;
  const obj = (v: any) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return {
    profiles: Array.isArray(raw.profiles) ? raw.profiles.filter((p: any) => typeof p === 'string') : [],
    crud: obj(raw.crud),
    uxui: obj(raw.uxui),
    isAdmin: raw.isAdmin === true,
    canCreateProject: raw.canCreateProject === true,
    projectIsReadonly: raw.projectIsReadonly === true,
  };
}

export const hasLetter = (set: string | undefined | null, letter: PermLetter): boolean => !!set && set.toUpperCase().includes(letter);

/**
 * The same rule as perm_can for a table that the matrix does not list: the administrator has everything, everybody else reads (R). A table the matrix lists but the user's profiles give
 * nothing for is simply missing from `crud` (he has no letter there ... except that every signed-in user can read what the read-only baseline gives, which the function already returns).
 */
export function canTable(m: MyMatrix, table: string, letter: PermLetter, known: boolean = table in m.crud): boolean {
  if (m.projectIsReadonly && !(letter === 'R' || (table === 'project_table' && letter === 'U'))) return false;
  if (known) return hasLetter(m.crud[table], letter);
  return m.isAdmin || letter === 'R';
}

export const canObject = (m: MyMatrix, object: string, letter: PermLetter): boolean =>
  m.projectIsReadonly && letter !== 'R' ? false : object in m.uxui ? hasLetter(m.uxui[object], letter) : letter === 'R';

/** what the database said when it refused: "No permission: <table>, <letter>" / "... (<field>)" (SQLSTATE 42501), or null for any other error */
export interface PermissionRefusal {
  table: string;
  letter: PermLetter | string;
  field?: string;
}

export function permissionRefusalOf(error: any): PermissionRefusal | null {
  const message: string = typeof error === 'string' ? error : error?.message || '';
  const m = /No permission: ([A-Za-z0-9_."]+), ([CRUD])(?: \(([^)]*)\))?/.exec(message);
  if (!m) return null;
  return { table: m[1].replace(/"/g, ''), letter: m[2], field: m[3] || undefined };
}
