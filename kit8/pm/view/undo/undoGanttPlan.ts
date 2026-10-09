// Pure diff: what must be written to turn the CURRENT project data back into the
// snapshot taken before an action (restores tasks AND dependencies, whatever the action
// changed - sql_for_delete, move, stretch, reorder, re-parent, link, color, ...).
//
// Scheduler outputs (rowJSON.startAt, rowDuration) are ignored when comparing: they are
// recomputed and written back automatically after the restore.

import { depKey, PMProjectData, PMTaskDependencyRow, PMTaskRow } from '../../model/types';

export interface UndoGanttPlan {
  /** dependencies to sql_for_delete (present now, absent in the snapshot) */
  deleteDeps: PMTaskDependencyRow[];
  /** top-most rows to sql_for_delete (their subtrees go with them) */
  deleteTasks: PMTaskRow[];
  /** inserts + updates, ordered parents first (by target tree depth) */
  writeTasks: { kind: 'insert' | 'update'; row: PMTaskRow }[];
  insertDeps: PMTaskDependencyRow[];
  updateDeps: PMTaskDependencyRow[];
}

const depth = (treePath: string) => treePath.split('.').length;

function stableJSON(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableJSON).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJSON(o[k])}`)
    .join(',')}}`;
}

function taskSignature(t: PMTaskRow): string {
  const { startAt: _s, ...json } = (t.rowJSON || {}) as any;
  return stableJSON({ treePath: t.treePath, orderInList: Number(t.orderInList), rowProgress: Number(t.rowProgress), rowJSON: json });
}

function depSignature(d: PMTaskDependencyRow): string {
  return stableJSON({ linkType: d.linkType || 'FS', lagDays: Number(d.lagDays) || 0, rowJSON: d.rowJSON || {} });
}

export function computeUndoPlan(current: PMProjectData, target: PMProjectData): UndoGanttPlan {
  const curTasks = new Map(current.tasks.map((t) => [t.rowGUID, t]));
  const tgtTasks = new Map(target.tasks.map((t) => [t.rowGUID, t]));

  // ---- tasks to sql_for_delete: keep only the top-most (the DB deletes subtrees) ----
  const gone = current.tasks.filter((t) => !tgtTasks.has(t.rowGUID));
  const gonePaths = gone.map((t) => t.treePath);
  const deleteTasks = gone.filter((t) => !gonePaths.some((p) => p !== t.treePath && t.treePath.startsWith(p + '.')));
  const deletedSet = new Set<string>();
  for (const t of current.tasks) {
    if (deleteTasks.some((d) => t.treePath === d.treePath || t.treePath.startsWith(d.treePath + '.'))) deletedSet.add(t.rowGUID);
  }

  // ---- inserts + updates, parents first ----
  const writeTasks: UndoGanttPlan['writeTasks'] = [];
  for (const t of target.tasks) {
    const cur = curTasks.get(t.rowGUID);
    if (!cur || deletedSet.has(t.rowGUID)) writeTasks.push({ kind: 'insert', row: t });
    else if (taskSignature(cur) !== taskSignature(t)) writeTasks.push({ kind: 'update', row: t });
  }
  writeTasks.sort((a, b) => depth(a.row.treePath) - depth(b.row.treePath) || a.row.orderInList - b.row.orderInList);

  // ---- dependencies ----
  const curDeps = new Map(current.deps.map((d) => [depKey(d), d]));
  const tgtDeps = new Map(target.deps.map((d) => [depKey(d), d]));
  const deleteDeps: PMTaskDependencyRow[] = [];
  for (const [k, d] of curDeps) {
    // edges touching deleted tasks disappear with them (FK cascade)
    if (!tgtDeps.has(k) && !deletedSet.has(d.rowGUID) && !deletedSet.has(d.rowDependsOnGUID)) deleteDeps.push(d);
  }
  const insertDeps: PMTaskDependencyRow[] = [];
  const updateDeps: PMTaskDependencyRow[] = [];
  for (const [k, d] of tgtDeps) {
    const cur = curDeps.get(k);
    const cascaded = cur && (deletedSet.has(cur.rowGUID) || deletedSet.has(cur.rowDependsOnGUID));
    if (!cur || cascaded) insertDeps.push(d);
    else if (depSignature(cur) !== depSignature(d)) updateDeps.push(d);
  }

  return { deleteDeps, deleteTasks, writeTasks, insertDeps, updateDeps };
}

export function isEmptyUndoPlan(p: UndoGanttPlan): boolean {
  return !p.deleteDeps.length && !p.deleteTasks.length && !p.writeTasks.length && !p.insertDeps.length && !p.updateDeps.length;
}
