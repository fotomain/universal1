// Supabase CRUD of estimation_dashboard_user_settings_table: one row per (project | 'dashboard', user, work place). Same rules as the project twin
// (kit8/pm/crud/api/projectUserSettingsApi.ts): a missing table answers { missing: true } (the SQL upgrade has not run: the dashboard keeps its choices on the device only).
import type { SupabaseClient } from '@supabase/supabase-js';
import { ESTIMATION_NO_WORK_PLACE, ESTIMATION_SETTINGS_TABLE, type EstimationSettingsRow } from './estimationUserSettingsModel';

export function isMissingEstimationSettingsTable(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  if (code === '42P01' || code === 'PGRST205') return true;
  const msg = String(err.message || err).toLowerCase();
  return msg.includes(ESTIMATION_SETTINGS_TABLE) && (msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('schema cache'));
}

export function createEstimationUserSettingsApi(sb: SupabaseClient) {
  /** every row of the user on this work place + on the work place 'empty' (the starting values) */
  async function readRows(userGUID: string, workPlaceGUID: string): Promise<{ rows: EstimationSettingsRow[]; missing: boolean }> {
    const places = workPlaceGUID === ESTIMATION_NO_WORK_PLACE ? [workPlaceGUID] : [workPlaceGUID, ESTIMATION_NO_WORK_PLACE];
    const res: any = await sb.from(ESTIMATION_SETTINGS_TABLE).select('*').eq('rowParentGUID', userGUID).in('userWorkPlaceGUID', places);
    if (res.error) {
      if (isMissingEstimationSettingsTable(res.error)) return { rows: [], missing: true };
      throw new Error(String(res.error.message || res.error));
    }
    return { rows: (res.data || []) as EstimationSettingsRow[], missing: false };
  }

  /** insert or update the rows (several owner keys in one request) */
  async function saveRows(rows: EstimationSettingsRow[]): Promise<{ missing: boolean }> {
    if (!rows.length) return { missing: false };
    const res: any = await sb.from(ESTIMATION_SETTINGS_TABLE).upsert(
      rows.map((r) => ({ rowOwnerGUID: r.rowOwnerGUID, rowParentGUID: r.rowParentGUID, userWorkPlaceGUID: r.userWorkPlaceGUID, rowJSON: r.rowJSON })),
      { onConflict: 'rowOwnerGUID,rowParentGUID,userWorkPlaceGUID' },
    );
    if (res.error) {
      if (isMissingEstimationSettingsTable(res.error)) return { missing: true };
      throw new Error(String(res.error.message || res.error));
    }
    return { missing: false };
  }

  return { readRows, saveRows };
}
