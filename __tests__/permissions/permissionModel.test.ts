// The pure rules of kit8/permissions (documentation/PERMISSIONS_WBS.html sections 5, 7): the answer of perm_my_matrix, the letters, the words of a refusal.
// The database side (perm_can, the policies, the locks): kit8/docker/tests/49_permission_profiles.sql and 53_permission_enforcement.sql.
import { canObject, canTable, EMPTY_MATRIX, hasLetter, matrixOf, permissionRefusalOf, PROFILE_TITLES, ASSIGNABLE_PROFILES, CREATE_PROJECT_PROFILES } from '../../kit8/permissions/permissionModel';
import { permissionRefusalText, withPermissionText } from '../../kit8/permissions/permissionText';

const m = matrixOf({
  profiles: ['permissionProjectReadOnly', 'permissionFinancialManagerFact'],
  crud: { project_task_table: 'R', vendor_invoice_header: 'CDRU', partnerTable: 'R' },
  uxui: { permissionVendorInvoice: 'CDRU', permissionTaskTimeTab: 'R' },
  isAdmin: false,
  canCreateProject: false,
});

describe('matrixOf', () => {
  it('reads the answer of the RPC', () => {
    expect(m.profiles).toHaveLength(2);
    expect(m.crud.vendor_invoice_header).toBe('CDRU');
    expect(m.canCreateProject).toBe(false);
  });
  it('a missing, wrong or partial answer is the empty matrix', () => {
    expect(matrixOf(null)).toBe(EMPTY_MATRIX);
    expect(matrixOf('x')).toBe(EMPTY_MATRIX);
    expect(matrixOf({ crud: [], uxui: 5, profiles: [1, 'a'] })).toEqual({ profiles: ['a'], crud: {}, uxui: {}, isAdmin: false, canCreateProject: false });
  });
});

describe('the letters', () => {
  it('hasLetter', () => {
    expect(hasLetter('CRUD', 'U')).toBe(true);
    expect(hasLetter('R', 'U')).toBe(false);
    expect(hasLetter(undefined, 'R')).toBe(false);
    expect(hasLetter('own', 'R')).toBe(false);
  });
  it('a table of the matrix: its letters', () => {
    expect(canTable(m, 'vendor_invoice_header', 'D')).toBe(true);
    expect(canTable(m, 'project_task_table', 'U')).toBe(false);
    expect(canTable(m, 'project_task_table', 'R')).toBe(true);
  });
  it('a table in no row (the same rule as perm_can): the administrator has all, the others read', () => {
    expect(canTable(m, 'table_nobody_knows', 'R')).toBe(true);
    expect(canTable(m, 'table_nobody_knows', 'C')).toBe(false);
    expect(canTable({ ...m, isAdmin: true }, 'table_nobody_knows', 'D')).toBe(true);
  });
  it('an interface object', () => {
    expect(canObject(m, 'permissionVendorInvoice', 'C')).toBe(true);
    expect(canObject(m, 'permissionTaskTimeTab', 'U')).toBe(false);
    expect(canObject(m, 'permissionUnknown', 'R')).toBe(true);
    expect(canObject(m, 'permissionUnknown', 'C')).toBe(false);
  });
});

describe('the words of a refusal (SQLSTATE 42501)', () => {
  it('permissionRefusalOf reads the text of perm_require / the lock triggers', () => {
    expect(permissionRefusalOf({ message: 'No permission: vendor_invoice_header, D' })).toEqual({ table: 'vendor_invoice_header', letter: 'D', field: undefined });
    expect(permissionRefusalOf({ message: 'No permission: project_task_table, U (taskDescription)' })).toEqual({ table: 'project_task_table', letter: 'U', field: 'taskDescription' });
    expect(permissionRefusalOf('No permission: task_line_table, C')).toMatchObject({ table: 'task_line_table', letter: 'C' });
  });
  it('any other error is not a refusal', () => {
    expect(permissionRefusalOf({ message: 'duplicate key' })).toBeNull();
    expect(permissionRefusalOf(null)).toBeNull();
    expect(permissionRefusalText({ message: 'boom' })).toBe('');
  });
  it('the sentence names the operation and the table; a locked field is added', () => {
    expect(permissionRefusalText({ message: 'No permission: partnerTable, C' })).toBe('You have no permission to create in partnerTable.');
    expect(permissionRefusalText({ message: 'No permission: project_task_table, U (taskDescription)' })).toBe('You have no permission to change in project_task_table. Locked: taskDescription');
  });
  it('withPermissionText replaces the message and keeps the original as the hint; other errors stay as they are', () => {
    const e = { message: 'No permission: partnerTable, D', code: '42501' };
    expect(withPermissionText(e)).toMatchObject({ message: 'You have no permission to delete in partnerTable.', hint: 'No permission: partnerTable, D', code: '42501' });
    const other = { message: 'x' };
    expect(withPermissionText(other)).toBe(other);
  });
});

describe('the profile lists', () => {
  it('every profile has a title; the hand-assigned ones are a subset without the derived and the administrator profile', () => {
    expect(Object.keys(PROFILE_TITLES)).toHaveLength(11);
    for (const p of ASSIGNABLE_PROFILES) expect(PROFILE_TITLES[p]).toBeTruthy();
    for (const p of ['permissionOrganizationAdmin', 'permissionTaskResponsible', 'permissionProjectMember']) expect(ASSIGNABLE_PROFILES).not.toContain(p);
    expect(CREATE_PROJECT_PROFILES).toEqual(['permissionProjectManager', 'permissionProjectCurator']);
  });
});
