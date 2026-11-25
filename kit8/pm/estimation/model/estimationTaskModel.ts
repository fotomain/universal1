// Estimation dashboard - the estimate of ONE task (pure). The task tree of the project stands on the left, the lines of the picked row on the right; a line belongs to a task by
// `rowJSON.taskGUID`. A STAGE shows the lines of every task below it (read in one piece, like the money of a stage in the Project dashboard); lines without a task are the
// "unassigned" ones (an example, a norm added with no task picked): they show only in the whole estimate, where they can be assigned to the task picked in the tree.
import { subtreeGUIDs, type LineRow } from './estimationDocumentModel';
import { addCost, calcDocument, EMPTY_COST, inThreeCurrencies, type CostBreakdown } from './estimationCalc';
import type { EstimationDocumentJSON, EstimationSums } from './estimationModel';

export type ChildrenById = Record<string, readonly string[] | undefined>;

/** the picked row and every row below it */
export function taskScopeGUIDs(taskGUID: string, childrenById: ChildrenById): Set<string> {
  const out = new Set<string>();
  const stack = [taskGUID];
  while (stack.length) {
    const g = stack.pop()!;
    if (out.has(g)) continue;
    out.add(g);
    for (const k of childrenById[g] ?? []) stack.push(k);
  }
  return out;
}

/** the lines that belong to one of the tasks */
export const linesOfScope = (lines: readonly LineRow[], scope: ReadonlySet<string>): LineRow[] =>
  lines.filter((l) => !!l.rowJSON.taskGUID && scope.has(l.rowJSON.taskGUID));

export const unassignedLines = (lines: readonly LineRow[]): LineRow[] => lines.filter((l) => !l.rowJSON.taskGUID);

/** the lines (and everything below them) given to a task; the others are returned as they are. `canCarry` false = the row is no task: nothing changes */
export function assignLinesToTask(lines: readonly LineRow[], guids: readonly string[], taskGUID: string, canCarry = true): LineRow[] {
  if (!canCarry) return lines as LineRow[];
  const all = new Set<string>();
  for (const g of guids) subtreeGUIDs(lines as LineRow[], g).forEach((x) => all.add(x));
  return lines.map((l) => (all.has(l.rowGUID) && l.rowJSON.taskGUID !== taskGUID ? { ...l, rowJSON: { ...l.rowJSON, taskGUID } } : l));
}

/** the money of a task: the sum of `current` of its top lines is the total of the scope; here the number of lines per task, for the hint under the tree row */
export function lineCountsByTask(lines: readonly LineRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lines) if (l.rowJSON.taskGUID && l.rowJSON.lineKind === 'position') out[l.rowJSON.taskGUID] = (out[l.rowJSON.taskGUID] ?? 0) + 1;
  return out;
}

/** the kind of a task row of the PM store: it is stored in `rowJSON.rowKind` (a task row has no top level `rowKind`; reading that one made EVERY row look like "no task") */
export const taskKindOf = (task: { rowJSON?: { rowKind?: string } | null; rowKind?: string } | null | undefined): string | undefined => task?.rowJSON?.rowKind ?? task?.rowKind;

/** THE RULE: an estimate belongs to a TASK only - never to a stage, a milestone or a task that has subtasks (it is a summary then). `kind` = `rowKind` of the task row. */
export const canCarryEstimate = (kind: string | undefined, hasChildren: boolean): boolean => kind === 'task' && !hasChildren;

/** what the right pane shows and what a new line gets */
export interface TaskPaneState {
  /** null = the whole estimate */
  scope: Set<string> | null;
  /** the task a new line is given to (a leaf task picked in the tree, the tree on); null = none */
  newLineTaskGUID: string | null;
  /** adding / giving lines is refused: the picked row is not a task (a stage, a milestone or a summary task: positions belong to a task) */
  addBlocked: boolean;
}

/** `kindOf` gives the `rowKind` of a row; without it every row without children counts as a task (older callers) */
export function taskPaneState(pickedGUID: string | null, wholeEstimate: boolean, childrenById: ChildrenById, kindOf?: (guid: string) => string | undefined): TaskPaneState {
  if (!pickedGUID || wholeEstimate) return { scope: null, newLineTaskGUID: null, addBlocked: false };
  const hasChildren = (childrenById[pickedGUID]?.length ?? 0) > 0;
  const ok = canCarryEstimate(kindOf ? kindOf(pickedGUID) : 'task', hasChildren);
  return { scope: taskScopeGUIDs(pickedGUID, childrenById), newLineTaskGUID: ok ? pickedGUID : null, addBlocked: !ok };
}

// ---- the TOTALS of a stage (a row that is no task: it carries no estimate, it adds up the tasks below it) ------------------------------------------------------------------
export interface StageTotalRow {
  guid: string;
  title: string;
  /** rowKind of the task row (stage | task | milestone) */
  kind: string;
  /** 0 = a direct child of the picked row */
  depth: number;
  /** positions of the row itself and of everything below it */
  positions: number;
  /** the money of the row itself and of everything below it */
  cost: CostBreakdown;
  sums: EstimationSums;
}
export interface StageTotals { rows: StageTotalRow[]; total: StageTotalRow }
export interface StageTaskInfo { rowKind?: string; title?: string }

/** the table shown instead of the estimate when a stage is picked: every row below it in tree order with its total (a task = its lines, a stage = the sum below), then the total of the picked row */
export function stageTotals(
  pickedGUID: string,
  childrenById: ChildrenById,
  taskOf: (guid: string) => StageTaskInfo | undefined,
  lines: readonly LineRow[],
  doc?: Partial<EstimationDocumentJSON> | null,
): StageTotals {
  const byTask = new Map<string, LineRow[]>();
  for (const l of lines) {
    const g = l.rowJSON.taskGUID;
    if (!g) continue;
    if (!byTask.has(g)) byTask.set(g, []);
    byTask.get(g)!.push(l);
  }
  const rows: StageTotalRow[] = [];
  const seen = new Set<string>();
  const make = (guid: string, depth: number, slot: number): StageTotalRow => {
    // own lines (a task; an old line given to a stage still counts) + the rows below
    const own = byTask.get(guid) ?? [];
    let cost = own.length ? calcDocument(own, doc).total : EMPTY_COST;
    let positions = own.filter((l) => l.rowJSON.lineKind === 'position').length;
    const row: StageTotalRow = { guid, title: taskOf(guid)?.title ?? '', kind: taskOf(guid)?.rowKind ?? 'task', depth, positions, cost, sums: inThreeCurrencies(cost.current, doc?.rates) };
    if (slot >= 0) rows[slot] = row;
    for (const k of childrenById[guid] ?? []) {
      if (seen.has(k)) continue;
      seen.add(k);
      const at = rows.length;
      rows.push(row); // placeholder, replaced below
      const child = make(k, depth + 1, at);
      cost = addCost(cost, child.cost);
      positions += child.positions;
    }
    row.cost = cost;
    row.positions = positions;
    row.sums = inThreeCurrencies(cost.current, doc?.rates);
    return row;
  };
  seen.add(pickedGUID);
  const total = make(pickedGUID, -1, -1);
  return { rows, total };
}
