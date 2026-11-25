// estimation_dashboard_user_settings_table - the LAST STATE of the estimation dashboard of one user on one work place (twin of project_dashboard_user_settings_table).
//   rowOwnerGUID = the project of the estimate | 'dashboard' (the row of the whole dashboard) · rowParentGUID = the user · userWorkPlaceGUID = the work place
//   rowJSON.estimationSettings = the settings below. Pure model: types, normalizers, row <-> state. No React, no Supabase.
import type { EstimationLayout } from '../model/estimationLayouts';
import type { EstimationCurrencyBasis } from '../model/estimationModel';

export const ESTIMATION_SETTINGS_TABLE = 'estimation_dashboard_user_settings_table';
/** rowOwnerGUID of the row that belongs to the whole dashboard (no project) */
export const ESTIMATION_DASHBOARD_ROW = 'dashboard';
/** the work place of rows made without one (the column default) */
export const ESTIMATION_NO_WORK_PLACE = 'empty';

export const ESTIMATION_TABS = ['estimate', 'document', 'norms', 'templates', 'summary', 'export'] as const;
export type EstimationTabId = (typeof ESTIMATION_TABS)[number];
const LAYOUTS: EstimationLayout[] = ['simple', 'advanced', 'quote', 'trades'];
const BASES: EstimationCurrencyBasis[] = ['budget', 'accounting', 'consolidation'];

/** widths of the columns of the tables: { [tableKey]: { [columnKey]: px } } */
export type TableColumnsWidth = Record<string, Record<string, number>>;

/** the row 'dashboard': what is not tied to one estimation project */
export interface EstimationDashboardSettings {
  /** the project opened last (the one that was asked: it may name another project as its estimation) */
  lastProjectGUID?: string | null;
  /** the tab opened last */
  lastTab?: EstimationTabId | null;
  /** the tables that are not tied to a project (the norm books) */
  tableColumnsWidth?: TableColumnsWidth;
}

/** the row of one estimation project */
export interface EstimationProjectSettings {
  /** the estimate (document) opened last in the project */
  lastDocumentGUID?: string | null;
  /** width of the task tree beside the estimate grid (px) */
  tasksTreeWidth?: number | null;
  layout?: EstimationLayout | null;
  currencyBasis?: EstimationCurrencyBasis | null;
  tableColumnsWidth?: TableColumnsWidth;
}

export type EstimationAnySettings = EstimationDashboardSettings & EstimationProjectSettings;

export interface EstimationSettingsRow {
  rowGUID?: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  userWorkPlaceGUID: string;
  rowJSON: { estimationSettings?: EstimationAnySettings };
  updated_at?: string;
}

/** the whole remembered state of one user on one work place */
export interface EstimationUserSettingsState {
  dashboard: EstimationDashboardSettings;
  byProject: Record<string, EstimationProjectSettings>;
}
export const ESTIMATION_SETTINGS_EMPTY: EstimationUserSettingsState = { dashboard: {}, byProject: {} };

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function normalizeTableColumnsWidth(v: unknown): TableColumnsWidth {
  const out: TableColumnsWidth = {};
  if (!v || typeof v !== 'object') return out;
  for (const [table, cols] of Object.entries(v as Record<string, unknown>)) {
    if (!cols || typeof cols !== 'object') continue;
    const o: Record<string, number> = {};
    for (const [k, w] of Object.entries(cols as Record<string, unknown>)) if (typeof w === 'number' && Number.isFinite(w) && w > 0) o[k] = Math.round(w);
    if (Object.keys(o).length) out[table] = o;
  }
  return out;
}

/** a stored / typed value -> safe settings of the dashboard row (unknown keys and wrong types are dropped) */
export function normalizeDashboardSettings(v: unknown): EstimationDashboardSettings {
  const o: any = v && typeof v === 'object' ? v : {};
  const out: EstimationDashboardSettings = {};
  if ('lastProjectGUID' in o) out.lastProjectGUID = str(o.lastProjectGUID);
  const tab = (ESTIMATION_TABS as readonly string[]).includes(o.lastTab) ? (o.lastTab as EstimationTabId) : null;
  if (tab) out.lastTab = tab;
  const w = normalizeTableColumnsWidth(o.tableColumnsWidth);
  if (Object.keys(w).length) out.tableColumnsWidth = w;
  return out;
}

/** a stored / typed value -> safe settings of a project row */
export function normalizeProjectSettings(v: unknown): EstimationProjectSettings {
  const o: any = v && typeof v === 'object' ? v : {};
  const out: EstimationProjectSettings = {};
  if ('lastDocumentGUID' in o) out.lastDocumentGUID = str(o.lastDocumentGUID);
  if (typeof o.tasksTreeWidth === 'number' && Number.isFinite(o.tasksTreeWidth) && o.tasksTreeWidth > 0) out.tasksTreeWidth = Math.round(o.tasksTreeWidth);
  if (LAYOUTS.includes(o.layout)) out.layout = o.layout;
  if (BASES.includes(o.currencyBasis)) out.currencyBasis = o.currencyBasis;
  const w = normalizeTableColumnsWidth(o.tableColumnsWidth);
  if (Object.keys(w).length) out.tableColumnsWidth = w;
  return out;
}

/** rows of the table (any work place) -> the state of ONE work place: the row of the work place wins, the row of the work place 'empty' is the starting value */
export function stateFromRows(rows: EstimationSettingsRow[], workPlaceGUID: string): EstimationUserSettingsState {
  const state: EstimationUserSettingsState = { dashboard: {}, byProject: {} };
  const chosen = new Map<string, EstimationSettingsRow>();
  for (const r of rows) {
    const own = r.userWorkPlaceGUID === workPlaceGUID;
    if (!own && r.userWorkPlaceGUID !== ESTIMATION_NO_WORK_PLACE) continue;
    const cur = chosen.get(r.rowOwnerGUID);
    if (!cur || (own && cur.userWorkPlaceGUID !== workPlaceGUID)) chosen.set(r.rowOwnerGUID, r);
  }
  for (const [owner, r] of chosen) {
    const s = r.rowJSON?.estimationSettings;
    if (owner === ESTIMATION_DASHBOARD_ROW) state.dashboard = normalizeDashboardSettings(s);
    else state.byProject[owner] = normalizeProjectSettings(s);
  }
  return state;
}

/** the row to upsert for one owner key ('dashboard' or a project) of the state */
export function rowOfState(state: EstimationUserSettingsState, ownerKey: string, userGUID: string, workPlaceGUID: string): EstimationSettingsRow {
  const estimationSettings = ownerKey === ESTIMATION_DASHBOARD_ROW ? state.dashboard : state.byProject[ownerKey] ?? {};
  return { rowOwnerGUID: ownerKey, rowParentGUID: userGUID, userWorkPlaceGUID: workPlaceGUID, rowJSON: { estimationSettings } };
}

/** the state after a patch of one owner key; the same object when nothing changed (the store then notifies nobody) */
export function patchState(state: EstimationUserSettingsState, ownerKey: string, patch: EstimationAnySettings): EstimationUserSettingsState {
  const isDashboard = ownerKey === ESTIMATION_DASHBOARD_ROW;
  const cur: EstimationAnySettings = isDashboard ? state.dashboard : state.byProject[ownerKey] ?? {};
  const merged = isDashboard ? normalizeDashboardSettings({ ...cur, ...patch }) : normalizeProjectSettings({ ...cur, ...patch });
  // a patch with null / undefined removes the key (normalize drops wrong values, a null id is kept as null on purpose)
  if (JSON.stringify(merged) === JSON.stringify(cur)) return state;
  return isDashboard ? { ...state, dashboard: merged } : { ...state, byProject: { ...state.byProject, [ownerKey]: merged } };
}
