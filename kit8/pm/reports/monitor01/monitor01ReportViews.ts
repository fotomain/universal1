// monitor01ReportViews - the saved VIEWS of a report (kit8/sql/start PART 43: project_report_settings + the RPCs report_view_save / _list / _share / _delete).
// A View = ReportViewTitle + the settings of the report (rowJSON.settings) + "for other users enabled" (the users of the same organization see it and can restore it).
// The functions are generic: the report GUID is a parameter (Monitor01 is 'Monitor01', MONITOR01_REPORT_GUID).
import type { Monitor01ReportSettings } from './monitor01Fields';
import { normalizeMonitor01Settings } from './monitor01Fields';

export const RPC_REPORT_VIEW_SAVE = 'report_view_save';
export const RPC_REPORT_VIEW_LIST = 'report_view_list';
export const RPC_REPORT_VIEW_SHARE = 'report_view_share';
export const RPC_REPORT_VIEW_DELETE = 'report_view_delete';
/** the longest ReportViewTitle (the database cuts it too) */
export const REPORT_VIEW_TITLE_MAX = 200;

export interface ReportViewRow {
  viewGUID: string;
  viewTitle: string;
  forOtherUsersEnabled: boolean;
  /** the settings as saved (the report normalizes them when it restores the View) */
  settings: unknown;
  ownerGUID: string;
  ownerName: string;
  /** the View of the current user (only his own can be changed, shared or deleted) */
  isMine: boolean;
  updatedAt: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** the title as the database stores it (trimmed, cut); '' = missing */
export const cleanReportViewTitle = (t: string): string => (t || '').trim().slice(0, REPORT_VIEW_TITLE_MAX);
/** the View of the current user with this title (the title is compared without case, as the database does) */
export const ownViewWithTitle = (views: readonly ReportViewRow[], title: string): ReportViewRow | undefined => views.find((v) => v.isMine && same(v.viewTitle, title));

/** a row of report_view_list → typed (a missing field is '' / false, never an exception) */
export function parseReportViewRow(raw: any): ReportViewRow {
  return {
    viewGUID: String(raw?.viewGUID ?? ''),
    viewTitle: String(raw?.viewTitle ?? ''),
    forOtherUsersEnabled: raw?.forOtherUsersEnabled === true,
    settings: raw?.settings ?? {},
    ownerGUID: String(raw?.ownerGUID ?? ''),
    ownerName: String(raw?.ownerName ?? ''),
    isMine: raw?.isMine === true,
    updatedAt: String(raw?.updatedAt ?? ''),
  };
}

async function call(client: any, fn: string, args: Record<string, any>): Promise<any> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message || String(error));
  return data;
}

export async function listReportViews(client: any, reportGUID: string): Promise<ReportViewRow[]> {
  const data = await call(client, RPC_REPORT_VIEW_LIST, { p_report: reportGUID });
  return Array.isArray(data) ? data.map(parseReportViewRow).filter((v) => v.viewGUID) : [];
}
/** saves a View; the same title of the same user is replaced. Returns the GUID of the View */
export async function saveReportView(client: any, reportGUID: string, title: string, settings: Monitor01ReportSettings | Record<string, any>, forOtherUsersEnabled: boolean): Promise<string> {
  const t = cleanReportViewTitle(title);
  if (!t) throw new Error('ReportViewTitle is obligatory');
  return String(await call(client, RPC_REPORT_VIEW_SAVE, { p_report: reportGUID, p_title: t, p_settings: settings, p_for_others: forOtherUsersEnabled }));
}
export async function shareReportView(client: any, viewGUID: string, enabled: boolean): Promise<boolean> {
  return (await call(client, RPC_REPORT_VIEW_SHARE, { p_view: viewGUID, p_enabled: enabled })) === true;
}
export async function deleteReportView(client: any, viewGUID: string): Promise<boolean> {
  return (await call(client, RPC_REPORT_VIEW_DELETE, { p_view: viewGUID })) === true;
}

/** the settings of a View ready to apply to Monitor01 */
export const monitor01SettingsOfView = (view: Pick<ReportViewRow, 'settings'>): Monitor01ReportSettings => normalizeMonitor01Settings(view.settings);
