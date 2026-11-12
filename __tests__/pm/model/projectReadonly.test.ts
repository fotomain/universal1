// The read-only switch of a project: the pure rules (kit8/pm/model/projectReadonly.ts) and what usePermissions makes of the answer of perm_my_matrix.
import { isProjectReadonlyError, PROJECT_READONLY_KEY, projectIsReadonly, projectReadonlyMessage, readonlyAllows } from '../../../kit8/pm/model/projectReadonly';
import { canObject, canTable, EMPTY_MATRIX, matrixOf } from '../../../kit8/permissions/permissionModel';

describe('projectIsReadonly', () => {
  it('is FALSE while never saved, TRUE only for a stored true', () => {
    expect(PROJECT_READONLY_KEY).toBe('projectIsReadonly');
    expect(projectIsReadonly(undefined)).toBe(false);
    expect(projectIsReadonly(null)).toBe(false);
    expect(projectIsReadonly({})).toBe(false);
    expect(projectIsReadonly({ projectIsReadonly: false })).toBe(false);
    expect(projectIsReadonly({ projectIsReadonly: 'true' })).toBe(false);
    expect(projectIsReadonly({ projectIsReadonly: true })).toBe(true);
  });
  it('the message names the project and is recognised (also the one of the database)', () => {
    expect(projectReadonlyMessage('Bridge')).toContain('Read-only project "Bridge"');
    expect(isProjectReadonlyError(projectReadonlyMessage())).toBe(true);
    expect(isProjectReadonlyError(new Error('Read-only project "P": nothing can be changed (task_line_table). Turn off ...'))).toBe(true);
    expect(isProjectReadonlyError({ message: 'No permission: task_line_table, U' })).toBe(false);
    expect(isProjectReadonlyError(null)).toBe(false);
  });
  it('a read-only project leaves R everywhere and U of the project row (the switch)', () => {
    expect(readonlyAllows('project_task_table', 'R')).toBe(true);
    expect(readonlyAllows('project_table', 'U')).toBe(true);
    expect(readonlyAllows('project_table', 'D')).toBe(false);
    expect(readonlyAllows('project_task_table', 'U')).toBe(false);
    expect(readonlyAllows('task_line_table', 'C')).toBe(false);
  });
});

describe('the permission matrix of a read-only project', () => {
  const raw = { profiles: ['permissionProjectManager'], crud: { project_table: 'CRUD', project_task_table: 'CRUD', task_line_table: 'CRUD' }, uxui: { permissionProjectMembers: 'CRUD' }, isAdmin: true, canCreateProject: true };
  it('matrixOf reads the flag (false when missing)', () => {
    expect(EMPTY_MATRIX.projectIsReadonly).toBe(false);
    expect(matrixOf(raw).projectIsReadonly).toBe(false);
    expect(matrixOf({ ...raw, projectIsReadonly: true }).projectIsReadonly).toBe(true);
    expect(matrixOf({ ...raw, projectIsReadonly: 'yes' }).projectIsReadonly).toBe(false);
  });
  it('an open project: the letters of the profiles', () => {
    const m = matrixOf(raw);
    expect(canTable(m, 'project_task_table', 'U')).toBe(true);
    expect(canTable(m, 'task_line_table', 'D')).toBe(true);
    expect(canObject(m, 'permissionProjectMembers', 'U')).toBe(true);
  });
  it('a read-only project: only R, and U of project_table - also for the administrator and for a table the matrix does not list', () => {
    const m = matrixOf({ ...raw, projectIsReadonly: true });
    for (const t of ['project_task_table', 'task_line_table', 'some_generic_table']) {
      expect(canTable(m, t, 'R')).toBe(true);
      expect(canTable(m, t, 'C')).toBe(false);
      expect(canTable(m, t, 'U')).toBe(false);
      expect(canTable(m, t, 'D')).toBe(false);
    }
    expect(canTable(m, 'project_table', 'U')).toBe(true);
    expect(canTable(m, 'project_table', 'D')).toBe(false);
    expect(canObject(m, 'permissionProjectMembers', 'R')).toBe(true);
    expect(canObject(m, 'permissionProjectMembers', 'U')).toBe(false);
  });
});
