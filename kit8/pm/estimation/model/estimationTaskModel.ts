// Estimation dashboard - the estimate of ONE task (pure). The task tree of the project stands on the left, the estimate GRID on the right with one row per tree row (model/estimateGridModel); a
// position belongs to a task by `rowJSON.taskGUID`, and a task carries ONE position. Lines without a task are the "unassigned" ones (an older document, a norm added with no task picked):
// they are not in the grid; the dashboard gives them to the picked task one by one. A line whose task is gone from the tree is unassigned too.
// The same structure serves the printed forms (model/estimateOutlineModel) and the examples / the table import below: they make a TASK PLAN = the stages and tasks to create in the tree.
import type { PMTaskRow } from '../../model/types';
import { buildTreeIndex, buildTreePath, ORDER_STEP, projectTreePath } from '../../view/project/scheduling';
import { ROOT_KEY } from '../../view/project/rootKey';
import { subtreeGUIDs, type LineRow } from './estimationDocumentModel';

/** `knownTasks` = the guids of the tasks of the project: a line that names a task which is not there any more is unassigned too (omit it when the tasks are not known yet) */
export const unassignedLines = (lines: readonly LineRow[], knownTasks?: ReadonlySet<string> | null): LineRow[] =>
  lines.filter((l) => !l.rowJSON.taskGUID || (!!knownTasks && knownTasks.size > 0 && !knownTasks.has(l.rowJSON.taskGUID)));

/** the lines (and everything below them) given to a task; the others are returned as they are. `canCarry` false = the row is no task: nothing changes */
export function assignLinesToTask(lines: readonly LineRow[], guids: readonly string[], taskGUID: string, canCarry = true): LineRow[] {
  if (!canCarry) return lines as LineRow[];
  const all = new Set<string>();
  for (const g of guids) subtreeGUIDs(lines as LineRow[], g).forEach((x) => all.add(x));
  return lines.map((l) => (all.has(l.rowGUID) && l.rowJSON.taskGUID !== taskGUID ? { ...l, rowJSON: { ...l.rowJSON, taskGUID } } : l));
}

/** the kind of a task row of the PM store: it is stored in `rowJSON.rowKind` (a task row has no top level `rowKind`; reading that one made EVERY row look like "no task") */
export const taskKindOf = (task: { rowJSON?: { rowKind?: string } | null; rowKind?: string } | null | undefined): string | undefined => task?.rowJSON?.rowKind ?? task?.rowKind;

/** THE RULE: an estimate belongs to a TASK only - never to a stage, a milestone or a task that has subtasks (it is a summary then). `kind` = `rowKind` of the task row. */
export const canCarryEstimate = (kind: string | undefined, hasChildren: boolean): boolean => kind === 'task' && !hasChildren;

// ---- the task plan: the stages and tasks an example or an imported table needs in the task tree ----------------------------------------------------------------------------
/** a stage / task to create (parents before children). `parentGUID` null = directly under the project; it may be a task that exists already (a stage found by its name) */
export interface TaskPlanRow { rowGUID: string; parentGUID: string | null; kind: 'stage' | 'task'; name: string }

/** the rows of the task plan as task rows of the project (what `project_import_tasks` takes): tree path under the parent, the order AFTER the rows that exist, the owner = the user.
 *  `existing` = the tasks of the project now (for the order and for the path of a parent that exists already). */
export function taskRowsFromPlan(plan: readonly TaskPlanRow[], o: { projectGUID: string; ownerGUID: string; existing?: readonly PMTaskRow[]; newGUID?: () => string }): PMTaskRow[] {
  const existing = o.existing ?? [];
  const tree = buildTreeIndex(existing as PMTaskRow[]);
  const pathOf = new Map<string, string>(existing.map((t) => [t.rowGUID, t.treePath]));
  const lastOrder = new Map<string, number>();
  const orderOf = (parent: string | null): number => {
    const key = parent ?? ROOT_KEY;
    if (!lastOrder.has(key)) {
      const kids = (tree.childrenById[key] ?? []).map((g) => existing.find((t) => t.rowGUID === g)?.orderInList ?? 0);
      lastOrder.set(key, kids.length ? Math.max(...kids) : 0);
    }
    const next = (lastOrder.get(key) as number) + ORDER_STEP;
    lastOrder.set(key, next);
    return next;
  };
  const out: PMTaskRow[] = [];
  for (const p of plan) {
    const parentPath = p.parentGUID ? pathOf.get(p.parentGUID) : projectTreePath(o.projectGUID);
    const treePath = buildTreePath(parentPath || projectTreePath(o.projectGUID), p.rowGUID);
    pathOf.set(p.rowGUID, treePath);
    out.push({
      rowGUID: p.rowGUID, treePath, projectGUID: o.projectGUID, rowOwnerGUID: o.ownerGUID, rowDuration: null, rowProgress: 0, orderInList: orderOf(p.parentGUID),
      rowJSON: { rowKind: p.kind, taskDescription: p.name, durationDays: 1 },
    } as PMTaskRow);
  }
  return out;
}

/** the stages directly under the project by name (as typed): an imported row whose stage has this name joins it instead of making a second one */
export function rootStagesByName(existing: readonly PMTaskRow[]): Map<string, string> {
  const tree = buildTreeIndex(existing as PMTaskRow[]);
  const byGUID = new Map(existing.map((t) => [t.rowGUID, t]));
  const out = new Map<string, string>();
  for (const g of tree.childrenById[ROOT_KEY] ?? []) {
    const t = byGUID.get(g)!;
    const name = String(t.rowJSON?.taskDescription ?? '').trim();
    if (taskKindOf(t) === 'stage' && name && !out.has(name.toLowerCase())) out.set(name, g);
  }
  return out;
}
