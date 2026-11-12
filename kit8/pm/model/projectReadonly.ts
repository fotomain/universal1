// The READ-ONLY switch of a project (SQL PART 51, kit8/pm/README.md): project_table.rowJSON.projectIsReadonly, FALSE while never saved (Project settings -> Main).
// While it is TRUE a user changes ONLY the switch: the database (guard triggers) refuses every create / change / delete of the project, its tasks, links, lines, Kanban and documents.
// This file is the pure part the interface uses to say so BEFORE it asks the database.
export const PROJECT_READONLY_KEY = 'projectIsReadonly';

/** true only when the key is stored as true (a missing value = an ordinary project) */
export const projectIsReadonly = (rowJSON: Record<string, any> | undefined | null): boolean => rowJSON?.[PROJECT_READONLY_KEY] === true;

/** what the user reads when he tries to change a read-only project */
export const projectReadonlyMessage = (projectName?: string | null): string =>
  `Read-only project${projectName ? ` "${projectName}"` : ''}: nothing can be changed. Turn off Project settings -> Main -> Read-only project first.`;

/** the refusal of the database (project_readonly_check / project_readonly_guard_project) or of the interface */
export const isProjectReadonlyError = (error: any): boolean => /^Read-only project/.test(typeof error === 'string' ? error : error?.message || '');

/**
 * The letters a read-only project leaves: everybody READS; the one change is the switch on the project row (project_table, U).
 * Used by usePermissions over the answer of perm_my_matrix.
 */
export const readonlyAllows = (table: string, letter: string): boolean => letter === 'R' || (table === 'project_table' && letter === 'U');
