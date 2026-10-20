// roiApi - the reads of the ROI reports (documentation/ROI_DOC.html, SQL PART 33 / 34). No React. The client is the Supabase client (any).
//   project_status_month_totals       money per project x month (one row per month: a few dozen per project)
//   roi_task_lines(project, from, to) money per task for a period, ONLY while the project switch roiForTasksFunctionalityEnabled is ON (else no rows)
//   roi_report_projects()             the projects Monitor02 shows: mine, with the task switch ON
//   project_status_month_roi          the cumulative curve in business time (the components are cumulative sums)
//   project_status_roi_history        the log "as seen on a day" (project level)
// The ratios are NOT read: every line is roiOfMoney(money) in the app (roiModel.ts).
import { RoiMoney, moneyOf } from './roiModel';
import { PMProjectRoiValues, RoiTaxSettings, roiForTasksOf, roiHistoryOf, roiTaxOf } from './roiSettings';

export const ROI_MONTH_TOTALS_TABLE = 'project_status_month_totals';
export const ROI_HISTORY_TABLE = 'project_status_roi_history';
export const ROI_MONTH_CURVE_VIEW = 'project_status_month_roi';
export const RPC_ROI_TASK_LINES = 'roi_task_lines';
export const RPC_ROI_REPORT_PROJECTS = 'roi_report_projects';

export interface RoiProjectInfo { projectGUID: string; name: string; tax: RoiTaxSettings; forTasks: boolean; history: boolean }
export interface RoiMonthRow { projectGUID: string; month: string; money: RoiMoney }
export interface RoiTaskRow { projectGUID: string; taskGUID: string; taskName: string; money: RoiMoney }
export interface RoiHistoryRow { projectGUID: string; day: string; reason: string; money: RoiMoney }

const err = (e: any): Error => new Error(e?.message || String(e));
const day10 = (v: unknown): string => String(v ?? '').slice(0, 10);

/** 'YYYY-MM-DD' (any day) -> the first day of its month, or null */
export const roiMonthStart = (day: string | null | undefined): string | null => {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec((day || '').trim());
  return m ? `${m[1]}-${m[2]}-01` : null;
};

export const parseRoiProject = (raw: any): RoiProjectInfo => {
  const j = (raw?.rowJSON || {}) as PMProjectRoiValues & { name?: string; title?: string };
  return { projectGUID: String(raw?.rowGUID), name: String(j.name ?? j.title ?? ''), tax: roiTaxOf(j), forTasks: roiForTasksOf(j), history: roiHistoryOf(j) };
};

/** the projects with the given GUIDs (my projects: the read policy), with their ROI switches */
export async function fetchRoiProjects(client: any, projectGUIDs: readonly string[] | null): Promise<RoiProjectInfo[]> {
  let q = client.from('project_table').select('rowGUID, rowJSON');
  if (projectGUIDs) {
    if (projectGUIDs.length === 0) return [];
    q = q.in('rowGUID', [...projectGUIDs]);
  }
  const { data, error } = await q;
  if (error) throw err(error);
  return ((data || []) as any[]).map(parseRoiProject).sort((a, b) => a.name.localeCompare(b.name));
}

/** the projects Monitor02 shows (task switch ON) */
export async function fetchRoiReportProjects(client: any): Promise<RoiProjectInfo[]> {
  const { data, error } = await client.rpc(RPC_ROI_REPORT_PROJECTS);
  if (error) throw err(error);
  const guids = ((data || []) as any[]).map((x) => String(typeof x === 'object' && x ? Object.values(x)[0] : x));
  return fetchRoiProjects(client, guids);
}

export const parseRoiMonthRow = (raw: any): RoiMonthRow => ({ projectGUID: String(raw.rowProjectGUID), month: day10(raw.rowTurnoverMonth), money: moneyOf(raw) });

/** the month totals of some projects (null = all of mine) in a period (months of the two days; null = no limit) */
export async function fetchRoiMonthTotals(client: any, projectGUIDs: readonly string[] | null, from?: string | null, to?: string | null): Promise<RoiMonthRow[]> {
  if (projectGUIDs && projectGUIDs.length === 0) return [];
  let q = client.from(ROI_MONTH_TOTALS_TABLE).select('*').order('rowProjectGUID').order('rowTurnoverMonth');
  if (projectGUIDs) q = q.in('rowProjectGUID', [...projectGUIDs]);
  const a = roiMonthStart(from);
  const b = roiMonthStart(to);
  if (a) q = q.gte('rowTurnoverMonth', a);
  if (b) q = q.lte('rowTurnoverMonth', b);
  const { data, error } = await q;
  if (error) throw err(error);
  return ((data || []) as any[]).map(parseRoiMonthRow);
}

/** the task lines of one project for a period (roi_task_lines: no rows while the project's task switch is OFF) */
export async function fetchRoiTaskLines(client: any, projectGUID: string, from?: string | null, to?: string | null): Promise<RoiTaskRow[]> {
  const { data, error } = await client.rpc(RPC_ROI_TASK_LINES, { p_project: projectGUID, p_from: from || null, p_to: to || null });
  if (error) throw err(error);
  return ((data || []) as any[]).map((r) => ({ projectGUID, taskGUID: String(r.rowOwnerGUID), taskName: String(r.taskName ?? ''), money: moneyOf(r) }));
}

/** the cumulative business-time curve of a project (one row per month with data) */
export async function fetchRoiMonthCurve(client: any, projectGUID: string): Promise<RoiMonthRow[]> {
  const { data, error } = await client.from(ROI_MONTH_CURVE_VIEW).select('*').eq('rowProjectGUID', projectGUID).order('rowTurnoverMonth');
  if (error) throw err(error);
  return ((data || []) as any[]).map(parseRoiMonthRow);
}

/** the history log of a project, oldest first */
export async function fetchRoiHistory(client: any, projectGUID: string): Promise<RoiHistoryRow[]> {
  const { data, error } = await client.from(ROI_HISTORY_TABLE).select('*').eq('rowProjectGUID', projectGUID).order('rowSnapshotDay');
  if (error) throw err(error);
  return ((data || []) as any[]).map((r) => ({ projectGUID: String(r.rowProjectGUID), day: day10(r.rowSnapshotDay), reason: String(r.reason ?? ''), money: moneyOf(r) }));
}
