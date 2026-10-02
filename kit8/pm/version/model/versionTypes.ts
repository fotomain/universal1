// Project versions (kit8/pm/version): table names, row types and small pure helpers.
// SQL: kit8/sql/init/done/create_tables.sql section 5b · documentation/PM_VERSION_STRUCTURE.html
//
// A version = a full, read-only copy of ONE project plan, saved on the user's command.
// Table name = 'version_' + original table name; every version table has rowVersionGUID and the
// rows keep their ORIGINAL rowGUID, so tasks of two versions (and of the live project) match by rowGUID.

import type { PMProjectRow, PMRowJSON, PMTaskDependencyRow, PMTaskRow } from '../../model/types';

export const versionProjectTable = 'version_project_table';
export const versionProjectTaskTable = 'version_project_task_table';
export const versionProjectTaskDependenciesTable = 'version_project_task_dependencies_table';
export const versionProjectKanbanStageTable = 'version_project_kanban_stage_table';
export const versionProjectTaskKanbanStateTable = 'version_project_task_kanban_state_table';

/** RPC: copies the five project tables into the version tables (one transaction) -> rowVersionGUID. */
export const pmRpcVersionSave = 'pm_version_save';
/** RPC: replaces the project's plan with the version's rows (same rowGUIDs) -> rowVersionGUID of the automatic backup. */
export const pmRpcVersionRestore = 'pm_version_restore';
/** RPC: versionTitle is the only editable field of a version. */
export const pmRpcVersionSetTitle = 'pm_version_set_title';

/** At most this many versions are drawn on the Gantt at once (thin bars under the task bars). */
export const PM_VERSION_MAX_CHECKED = 4;
export const PM_VERSION_TITLE_MAX = 80;

/** version_project_table.rowJSON = the project's rowJSON + the version fields. */
export interface PMVersionJSON extends PMRowJSON {
  versionTitle: string;
  /** ISO timestamp (UTC) */
  versionCreatedAt: string;
  /** 1, 2, 3 ... inside the project (= orderInList) */
  versionNumber?: number;
  versionTaskCount?: number;
}

/** Row of version_project_table: rowVersionGUID = the version, rowGUID = the project it was taken from. */
export interface PMProjectVersionRow extends Omit<PMProjectRow, 'rowJSON'> {
  rowVersionGUID: string;
  rowJSON: PMVersionJSON;
}

/** Tasks + dependencies of one version (version_project_task_table + version_project_task_dependencies_table). */
export interface PMVersionData {
  versionGUID: string;
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
}

export function normalizeVersion(row: any): PMProjectVersionRow {
  const json = row?.rowJSON || {};
  return {
    ...row,
    rowProgress: Number(row.rowProgress) || 0,
    orderInList: Number(row.orderInList) || 0,
    rowJSON: { ...json, versionTitle: String(json.versionTitle || `Version ${Number(row.orderInList) || ''}`.trim()), versionCreatedAt: String(json.versionCreatedAt || row.created_at || '') },
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-02 14:05" in the user's local time. */
export function formatVersionDateTime(value: string | number | null | undefined): string {
  const ms = typeof value === 'number' ? value : value ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Default title of a new version: project name + date and time. */
export function defaultVersionTitle(projectName: string | null | undefined, nowMs: number = Date.now()): string {
  return `${(projectName || 'Project').trim()} ${formatVersionDateTime(nowMs)}`.slice(0, PM_VERSION_TITLE_MAX);
}

/** null = ok, otherwise the message to show under the input. */
export function validateVersionTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return 'Enter a version title';
  if (t.length > PM_VERSION_TITLE_MAX) return `At most ${PM_VERSION_TITLE_MAX} characters`;
  return null;
}

// ---- colors ---------------------------------------------------------------------------------
/** Colors of the version bars on the Gantt: vivid, far from each other. */
export const PM_VERSION_COLORS = ['#00B8D9', '#36B37E', '#FF8B00', '#C026D3', '#8D6E63', '#0F766E', '#F43F5E', '#64748B'] as const;

function rgbOf(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 0 (same) .. ~441 (black vs white); non-hex colors are "far". */
export function colorDistance(a: string, b: string): number {
  const x = rgbOf(a);
  const y = rgbOf(b);
  if (!x || !y) return 999;
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
}

const TOO_CLOSE = 70;

/**
 * One color per checked version, in the order they were checked: different from each other and
 * from the colors of the active project (`avoid` = bar color, critical path color, custom task colors).
 */
export function assignVersionColors(versionGUIDs: string[], avoid: string[] = []): Record<string, string> {
  const far = PM_VERSION_COLORS.filter((c) => avoid.every((a) => colorDistance(c, a) >= TOO_CLOSE));
  const pool = far.length >= versionGUIDs.length ? far : [...far, ...PM_VERSION_COLORS.filter((c) => !far.includes(c))];
  const out: Record<string, string> = {};
  versionGUIDs.forEach((g, i) => (out[g] = pool[i % pool.length]));
  return out;
}
