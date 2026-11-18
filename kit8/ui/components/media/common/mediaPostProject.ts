// The PROJECT a media post belongs to (if any), and what the user reads when the post cannot be deleted because that project is read-only.
// A post that lives on its own (recording, shared link, note: rowParentGUID 'empty', no fileSourceKind) has no project: only its OWNER may change it.
// A file of the Files tab (rowJSON.fileSourceKind) or a post whose parent is a project belongs to that project. Pure: no React, no redux (the saga requires it).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** the project GUID of a media post row, or '' when the post is independent of any project */
export function mediaPostProjectGUID(row: any): string {
  const json = row?.rowJSON || {};
  const parent = String(row?.rowParentGUID || '');
  const kind = String(json.fileSourceKind || '');
  if (kind === 'project') return UUID.test(parent) ? parent : '';
  if (kind === 'stage' || kind === 'task' || kind === 'chat') return UUID.test(String(json.fileSourceProjectGUID || '')) ? String(json.fileSourceProjectGUID) : '';
  if (kind) return ''; // organization / document files have no project
  return UUID.test(parent) ? parent : '';
}

/** the sentence of the snack bar when a delete is stopped by a read-only project */
export const projectReadonlyDeleteMessage = (projectName?: string | null): string =>
  `Delete process stopped! This media post belongs to the Project ${projectName || '(name not available)'} and Project is readonly now `;

/** a refusal of the database / of the files function caused by a read-only project (SQL: project_readonly_check, files_authorize reason projectReadonly) */
export const isReadonlyRefusal = (error: any): boolean => {
  const text = typeof error === 'string' ? error : `${error?.code ?? ''} ${error?.message ?? ''}`;
  return /projectReadonly/.test(text) || /^\s*Read-only project/.test(text) || /Read-only project "/.test(text);
};

/** the name inside `Read-only project "NAME": nothing can be changed ...` (the database says it), or '' */
export const projectNameOfReadonlyError = (error: any): string => {
  const text = typeof error === 'string' ? error : String(error?.message ?? '');
  return /Read-only project "([^"]*)"/.exec(text)?.[1] ?? '';
};

/** `Delete process stopped! ...` when the refusal is a read-only project, else null. knownName = the name the list already has */
export function readonlyDeleteMessageOf(error: any, knownName?: string | null): string | null {
  if (!isReadonlyRefusal(error)) return null;
  return projectReadonlyDeleteMessage(knownName || projectNameOfReadonlyError(error));
}

export interface PostProjectInfo { name: string; readonly: boolean }
