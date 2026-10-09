// Supabase access for the project versions (version_* tables + RPCs, create_tables.sql section 5b).
// Versions are written ONLY by the RPCs (one transaction each); clients read them and may sql_for_delete one.
// Until the SQL has run the tables / functions are missing: reads answer { missing: true } and
// writes throw PMMissingTableError.

import type { SupabaseClient } from '@supabase/supabase-js';
import { check, normalizeDep, normalizeTask } from '../../../crud/api/apiUtils';
import { isMissingTableError, PMMissingTableError } from '../../../crud/api/projectUserSettingsApi';
import {
  normalizeVersion,
  pmRpcVersionRestore,
  pmRpcVersionSave,
  pmRpcVersionSetTitle,
  PMProjectVersionRow,
  PMVersionData,
  versionProjectTable,
  versionProjectTaskDependenciesTable,
  versionProjectTaskTable,
} from '../../model/versionTypes';

/** PostgREST / Postgres answers for an RPC that is not there (PGRST202, 42883, schema cache). */
export function isMissingFunctionError(err: any, fn: string): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  if (code === 'PGRST202' || code === '42883') return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes(fn.toLowerCase()) && (msg.includes('does not exist') || msg.includes('could not find the function') || msg.includes('schema cache'));
}

export function createVersionApi(sb: SupabaseClient) {
  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const res = await sb.rpc(fn, args);
    if (res.error && isMissingFunctionError(res.error, fn)) throw new PMMissingTableError(versionProjectTable);
    return check(res) as T;
  }

  /** Every version of one project (newest first). */
  async function readProjectVersions(projectGUID: string): Promise<{ rows: PMProjectVersionRow[]; missing: boolean }> {
    const res = await sb.from(versionProjectTable).select('*').eq('rowGUID', projectGUID).order('orderInList', { ascending: false });
    if (res.error && isMissingTableError(res.error, versionProjectTable)) return { rows: [], missing: true };
    return { rows: (check(res) || []).map(normalizeVersion), missing: false };
  }

  /** Tasks + dependencies of one version (enough to schedule and draw it). */
  async function readVersionData(versionGUID: string): Promise<PMVersionData> {
    const [tasksRes, depsRes] = await Promise.all([
      sb.from(versionProjectTaskTable).select('*').eq('rowVersionGUID', versionGUID).order('orderInList', { ascending: true }),
      sb.from(versionProjectTaskDependenciesTable).select('*').eq('rowVersionGUID', versionGUID),
    ]);
    return {
      versionGUID,
      tasks: ((check(tasksRes) as any[]) || []).map(normalizeTask),
      deps: ((check(depsRes) as any[]) || []).map(normalizeDep),
    };
  }

  /** Saves the whole plan of the project as a new version -> its rowVersionGUID. */
  async function saveProjectVersion(projectGUID: string, title: string): Promise<string> {
    return String(await rpc<string>(pmRpcVersionSave, { p_project: projectGUID, p_title: title }));
  }

  /** Replaces the project's plan with the version -> rowVersionGUID of the automatic "before restore" version. */
  async function restoreProjectVersion(versionGUID: string, backupTitle: string): Promise<string> {
    return String(await rpc<string>(pmRpcVersionRestore, { p_version: versionGUID, p_backup_title: backupTitle }));
  }

  async function renameProjectVersion(versionGUID: string, title: string): Promise<void> {
    await rpc<null>(pmRpcVersionSetTitle, { p_version: versionGUID, p_title: title });
  }

  /** Deletes the version row; its tasks / dependencies / Kanban rows follow (FK cascade). */
  async function deleteProjectVersion(versionGUID: string): Promise<void> {
    check(await sb.from(versionProjectTable).delete().eq('rowVersionGUID', versionGUID));
  }

  return { readProjectVersions, readVersionData, saveProjectVersion, restoreProjectVersion, renameProjectVersion, deleteProjectVersion };
}

export type PMVersionApi = ReturnType<typeof createVersionApi>;
