// Estimation dashboard - the estimate of ONE task (pure). The task tree of the project stands on the left, the estimate GRID on the right with one row per tree row (model/estimateGridModel); a
// position belongs to a task by `rowJSON.taskGUID`, and a task carries ONE position. Lines without a task are the "unassigned" ones (an example, an import, a norm added with no task picked): they
// are not in the grid; the dashboard gives them to the picked task one by one.
import { subtreeGUIDs, type LineRow } from './estimationDocumentModel';

export const unassignedLines = (lines: readonly LineRow[]): LineRow[] => lines.filter((l) => !l.rowJSON.taskGUID);

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
