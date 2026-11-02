// reportRegistry - the reports of the app that have a GUID (the REPORT GUID of project_report_settings.rowParentGUID, where the saved Views of the report are kept).
//   viewsAlwaysOn   the Views (View → Save View / Restore View in the toolbar) of this report are ALWAYS switched on: there is no project / organization switch for them
// A new report is registered here once; its screen reads `reportDef(guid)`.
import { MONITOR01_REPORT_GUID } from '../monitor01/monitor01Fields';

export interface ReportDef {
  /** the REPORT GUID (a stable text, never changed: the saved Views point to it) */
  guid: string;
  /** the English title (shown in the app language by pmT) */
  title: string;
  viewsAlwaysOn: boolean;
}

export const REPORTS: readonly ReportDef[] = [
  { guid: MONITOR01_REPORT_GUID, title: 'Monitor01', viewsAlwaysOn: true },
];

export const reportDef = (guid: string): ReportDef | undefined => REPORTS.find((r) => r.guid === guid);
/** the saved Views of the report are available (a registered report whose Views are always on) */
export const reportViewsEnabled = (guid: string): boolean => !!reportDef(guid)?.viewsAlwaysOn;
