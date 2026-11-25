// Supabase CRUD for project_dashboard_user_settings_table: the LAST STATE of the project dashboard ONE user chose for ONE project on ONE work place.
//   rowOwnerGUID = project_table.rowGUID · rowParentGUID = user (Supabase auth uid) · userWorkPlaceGUID = the work place of the user · rowJSON.uxuiSettings
// One row per (project, user, work place): saving is an upsert on that triple.
// A work place that has no row for a project starts with the row of the work place 'empty' (the rows made before work places existed), when there is one.
// Until the SQL upgrade has run, the table is missing: reads answer { missing: true } and saves throw PMMissingTableError - the React hooks then fall back to the
// legacy project_table.rowJSON.uxuiSettings.

import type { SupabaseClient } from '@supabase/supabase-js';
import { projectUserSettingsTable } from '../../model/constants';
import { PMProjectUserSettingsRow, PMUxUiSettings } from '../../model/types';
import { check } from './apiUtils';

/** The work place of the rows that were made before work places existed (the default of the column). */
export const NO_WORK_PLACE = 'empty';

/** The table does not exist yet (SQL upgrade not run). */
export class PMMissingTableError extends Error {
  constructor(public table: string) {
    super(`${table} is missing - run kit8/sql/start/start1_sql_tables.sql and start2_sql_code.sql`);
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

/** One row per project: the row of the work place wins, the row of the work place 'empty' is the fallback. */
export function pickWorkPlaceRows(rows: PMProjectUserSettingsRow[], workPlaceGUID: string): PMProjectUserSettingsRow[] {
  const byProject = new Map<string, PMProjectUserSettingsRow>();
  for (const r of rows) {
    const own = (r.userWorkPlaceGUID ?? NO_WORK_PLACE) === workPlaceGUID;
    const cur = byProject.get(r.rowOwnerGUID);
    if (!cur || (own && (cur.userWorkPlaceGUID ?? NO_WORK_PLACE) !== workPlaceGUID)) byProject.set(r.rowOwnerGUID, r);
  }
  return [...byProject.values()];
}

export function createProjectUserSettingsApi(sb: SupabaseClient) {
  /** Every settings row of one user on one work place (all his projects) - one request for the whole projects bar. */
  async function readProjectUserSettings(userGUID: string, workPlaceGUID: string = NO_WORK_PLACE): Promise<{ rows: PMProjectUserSettingsRow[]; missing: boolean }> {
    const places = workPlaceGUID === NO_WORK_PLACE ? [NO_WORK_PLACE] : [workPlaceGUID, NO_WORK_PLACE];
    const res = await sb.from(projectUserSettingsTable).select('*').eq('rowParentGUID', userGUID).in('userWorkPlaceGUID', places);
    if (res.error && isMissingTableError(res.error, projectUserSettingsTable)) return { rows: [], missing: true };
    return { rows: pickWorkPlaceRows((check(res) || []).map(normalizeProjectUserSettings), workPlaceGUID), missing: false };
  }

  /** Saves the complete settings of (project, user, work place): insert or update of the one row. */
  async function saveProjectUserSettings(projectGUID: string, userGUID: string, uxuiSettings: PMUxUiSettings, workPlaceGUID: string = NO_WORK_PLACE): Promise<PMProjectUserSettingsRow> {
    const res = await sb
      .from(projectUserSettingsTable)
      .upsert({ rowOwnerGUID: projectGUID, rowParentGUID: userGUID, userWorkPlaceGUID: workPlaceGUID, rowJSON: { uxuiSettings } }, { onConflict: 'rowOwnerGUID,rowParentGUID,userWorkPlaceGUID' })
      .select()
      .single();
    if (res.error && isMissingTableError(res.error, projectUserSettingsTable)) throw new PMMissingTableError(projectUserSettingsTable);
    return normalizeProjectUserSettings(check(res));
  }

  return { readProjectUserSettings, saveProjectUserSettings };
}
