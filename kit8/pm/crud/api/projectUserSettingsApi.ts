// Supabase CRUD for project_user_settings_table: the Gantt / tree settings ONE user chose for ONE project.
//   rowOwnerGUID = project_table.rowGUID · rowParentGUID = user (Supabase auth uid) · rowJSON.uxuiSettings
// One row per (project, user): saving is an upsert on that pair.
// Until kit8/sql/init/update_pm_tables_userSettings.sql has run, the table is missing: reads answer
// { missing: true } and saves throw PMMissingTableError - the React hooks then fall back to the
// legacy project_table.rowJSON.uxuiSettings.

import type { SupabaseClient } from '@supabase/supabase-js';
import { projectUserSettingsTable } from '../../model/constants';
import { PMProjectUserSettingsRow, PMUxUiSettings } from '../../model/types';
import { check } from './apiUtils';

/** The table does not exist yet (SQL upgrade not run). */
export class PMMissingTableError extends Error {
  constructor(public table: string) {
    super(`${table} is missing - run kit8/sql/init/update_pm_tables_userSettings.sql`);
  }
}

/** PostgREST / Postgres answers for a table that is not there (42P01, PGRST205, schema cache). */
export function isMissingTableError(err: any, table: string): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  if (code === '42P01' || code === 'PGRST205') return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes(table.toLowerCase()) && (msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('schema cache'));
}

export function normalizeProjectUserSettings(row: any): PMProjectUserSettingsRow {
  return { ...row, orderInList: Number(row.orderInList) || 0, rowJSON: row.rowJSON || {} };
}

export function createProjectUserSettingsApi(sb: SupabaseClient) {
  /** Every settings row of one user (all his projects) - one request for the whole projects bar. */
  async function readProjectUserSettings(userGUID: string): Promise<{ rows: PMProjectUserSettingsRow[]; missing: boolean }> {
    const res = await sb.from(projectUserSettingsTable).select('*').eq('rowParentGUID', userGUID);
    if (res.error && isMissingTableError(res.error, projectUserSettingsTable)) return { rows: [], missing: true };
    return { rows: (check(res) || []).map(normalizeProjectUserSettings), missing: false };
  }

  /** Saves the complete settings of (project, user): insert or update of the one row. */
  async function saveProjectUserSettings(projectGUID: string, userGUID: string, uxuiSettings: PMUxUiSettings): Promise<PMProjectUserSettingsRow> {
    const res = await sb
      .from(projectUserSettingsTable)
      .upsert({ rowOwnerGUID: projectGUID, rowParentGUID: userGUID, rowJSON: { uxuiSettings } }, { onConflict: 'rowOwnerGUID,rowParentGUID' })
      .select()
      .single();
    if (res.error && isMissingTableError(res.error, projectUserSettingsTable)) throw new PMMissingTableError(projectUserSettingsTable);
    return normalizeProjectUserSettings(check(res));
  }

  return { readProjectUserSettings, saveProjectUserSettings };
}
