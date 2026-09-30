// Pure Kanban logic (no React / Supabase / Reanimated) - unit-tested in __tests__/pm/view/kanban.
//
//   buildKanbanBoard   tasks + tree + stages + task states + scope  ->  columns of cards
//   planKanbanMove     "put these tasks into stage S at index i"    ->  state rows to upsert
//   kanbanLeavesOf     cards a tree row stands for (a stage = every task / milestone inside it)
//   derivedKanbanStage the stage of a stage row = the EARLIEST stage of its tasks
//
// Rules: every task of a project uses the project's stage set; no state row (or a deleted stage) =
// the first stage. Cards = tasks + milestones (leaf rows); stages (summary rows) are not cards.
// The Kanban stage never changes the task progress % and vice versa.

import { ROOT_KEY, PMTreeIndex } from '../project/scheduling';
import type { PMScheduledRow, PMTaskRow } from '../../model/types';
import { taskColorOf } from '../../model/types';
import {
  PMProjectKanbanStageRow,
  PMTaskKanbanStateRow,
  PM_KANBAN_ORDER_STEP,
  kanbanStageProgressOf,
} from '../../model/kanbanTypes';

export interface PMKanbanCard {
  guid: string;
  name: string;
  kind: 'task' | 'milestone';
  /** outline number "1.2.3" */
  wbs: string;
  /** task progress % (independent of the stage) */
  progress: number;
  /** stage progress % (independently editable) */
  kanbanStageProgressPercent: number;
  /** name of the parent stage ('' at the root) */
  parentName: string;
  color: string | null;
  critical: boolean;
  startMs: number | null;
  finishMs: number | null;
  durationDays: number | null;
  /** index in the tree (depth-first) - order of cards without a saved order */
  treeIndex: number;
}

export interface PMKanbanColumn {
  stage: PMProjectKanbanStageRow;
  cards: PMKanbanCard[];
}

export interface PMKanbanBoard {
  columns: PMKanbanColumn[];
  /** task guid -> column index */
  columnOfTask: Record<string, number>;
  cardCount: number;
}

export interface PMKanbanInput {
  tasksById: Record<string, PMTaskRow>;
  tree: PMTreeIndex;
  schedule: Record<string, PMScheduledRow>;
  stages: PMProjectKanbanStageRow[];
  statesByTask: Record<string, PMTaskKanbanStateRow>;
  /** tree row whose subtree is shown (null / unknown = whole project) */
  scopeGUID: string | null;
}

/** A row is a card when it is a task / milestone without children. */
export function isKanbanCardRow(row: PMTaskRow | undefined, tree: PMTreeIndex): boolean {
  if (!row) return false;
  if (row.rowJSON?.rowKind === 'stage' || row.rowJSON?.rowKind === 'project') return false;
  return !(tree.childrenById[row.rowGUID]?.length);
}

/** Depth-first rows under `rootGUID` (the root itself included unless it is ROOT_KEY). */
function depthFirst(tree: PMTreeIndex, rootGUID: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (g: string) => {
    if (seen.has(g)) return;
    seen.add(g);
    if (g !== ROOT_KEY) out.push(g);
    for (const c of tree.childrenById[g] || []) visit(c);
  };
  visit(rootGUID);
  return out;
}

/** Cards a tree row stands for: itself (task / milestone) or every task / milestone inside it (stage). */
export function kanbanLeavesOf(guid: string, tasksById: Record<string, PMTaskRow>, tree: PMTreeIndex): string[] {
  if (!tasksById[guid]) return [];
  return depthFirst(tree, guid).filter((g) => isKanbanCardRow(tasksById[g], tree));
}

/** Stage GUID of a task: its saved stage when that stage still exists, else the first stage. */
export function kanbanStageOfTask(taskGUID: string, stages: PMProjectKanbanStageRow[], statesByTask: Record<string, PMTaskKanbanStateRow>): string | null {
  if (!stages.length) return null;
  const saved = statesByTask[taskGUID]?.rowJSON?.stageGUID;
  return saved && stages.some((s) => s.rowGUID === saved) ? saved : stages[0].rowGUID;
}

export function buildKanbanBoard(input: PMKanbanInput): PMKanbanBoard {
  const { tasksById, tree, schedule, stages, statesByTask } = input;
  const sorted = [...stages].sort((a, b) => a.orderInList - b.orderInList);
  const scope = input.scopeGUID && tasksById[input.scopeGUID] ? input.scopeGUID : ROOT_KEY;
  const all = depthFirst(tree, ROOT_KEY);
  const treeIndex: Record<string, number> = {};
  all.forEach((g, i) => (treeIndex[g] = i));
  const rows = (scope === ROOT_KEY ? all : depthFirst(tree, scope)).filter((g) => isKanbanCardRow(tasksById[g], tree));

  const columns: PMKanbanColumn[] = sorted.map((stage) => ({ stage, cards: [] }));
  const colIndex: Record<string, number> = {};
  sorted.forEach((s, i) => (colIndex[s.rowGUID] = i));
  const columnOfTask: Record<string, number> = {};
  if (!columns.length) return { columns, columnOfTask, cardCount: 0 };

  for (const g of rows) {
    const t = tasksById[g];
    const sch = schedule[g];
    const parent = tree.parentById[g];
    const state = statesByTask[g];
    const kanbanStageProgressPercent = kanbanStageProgressOf(state, 0);
    const card: PMKanbanCard = {
      guid: g,
      name: t.rowJSON?.name || '',
      kind: t.rowJSON?.rowKind === 'milestone' || sch?.isMilestone ? 'milestone' : 'task',
      wbs: tree.wbsById[g] || '',
      progress: Math.round(sch?.progress ?? t.rowProgress ?? 0),
      kanbanStageProgressPercent,
      parentName: parent ? tasksById[parent]?.rowJSON?.name || '' : '',
      color: taskColorOf(t.rowJSON),
      critical: !!sch?.isCritical,
      startMs: sch ? sch.startMs : null,
      finishMs: sch ? sch.finishMs : null,
      durationDays: sch ? sch.durationDays : null,
      treeIndex: treeIndex[g] ?? 0,
    };
    const stageGUID = kanbanStageOfTask(g, sorted, statesByTask)!;
    const ci = colIndex[stageGUID] ?? 0;
    columns[ci].cards.push(card);
    columnOfTask[g] = ci;
  }

  // saved order first (orderInList of a state that belongs to THIS column), then tree order
  for (const col of columns) {
    const key = (c: PMKanbanCard) => {
      const st = statesByTask[c.guid];
      return st && st.rowJSON?.stageGUID === col.stage.rowGUID ? st.orderInList : Number.POSITIVE_INFINITY;
    };
    col.cards.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      if (ka !== kb) return ka < kb ? -1 : 1;
      return a.treeIndex - b.treeIndex;
    });
  }
  return { columns, columnOfTask, cardCount: rows.length };
}

/**
 * State rows to write when `taskGUIDs` are put into `targetStageGUID` before the card that is at
 * `index` of the column as displayed now (index = cards.length / undefined = at the end).
 * The whole target column is renumbered (1024, 2048, ...); only rows that change are returned.
 */
export function planKanbanMove(
  board: PMKanbanBoard,
  statesByTask: Record<string, PMTaskKanbanStateRow>,
  taskGUIDs: string[],
  targetStageGUID: string,
  index?: number
): { taskGUID: string; stageGUID: string; orderInList: number; kanbanStageProgressPercent?: number }[] {
  const col = board.columns.find((c) => c.stage.rowGUID === targetStageGUID);
  if (!col || !taskGUIDs.length) return [];
  const moving = Array.from(new Set(taskGUIDs));
  const movingSet = new Set(moving);
  const current = col.cards.map((c) => c.guid);
  const at = index === undefined ? current.length : Math.max(0, Math.min(index, current.length));
  const before = current.slice(0, at).filter((g) => !movingSet.has(g));
  const after = current.slice(at).filter((g) => !movingSet.has(g));
  const next = [...before, ...moving, ...after];
  // dropped where it already is: nothing to write
  if (next.length === current.length && next.every((g, i) => g === current[i])) return [];
  const writes: { taskGUID: string; stageGUID: string; orderInList: number; kanbanStageProgressPercent?: number }[] = [];
  next.forEach((g, i) => {
    const orderInList = (i + 1) * PM_KANBAN_ORDER_STEP;
    const st = statesByTask[g];
    if (st && st.rowJSON?.stageGUID === targetStageGUID && st.orderInList === orderInList) return;
    const write: { taskGUID: string; stageGUID: string; orderInList: number; kanbanStageProgressPercent?: number } = {
      taskGUID: g,
      stageGUID: targetStageGUID,
      orderInList,
    };
    if (st?.rowJSON?.kanbanStageProgressPercent !== undefined) {
      write.kanbanStageProgressPercent = st.rowJSON.kanbanStageProgressPercent;
    }
    writes.push(write);
  });
  return writes;
}

/** Earliest stage of the tasks inside a stage row (null = no tasks / no stages). */
export function derivedKanbanStage(
  guid: string,
  tasksById: Record<string, PMTaskRow>,
  tree: PMTreeIndex,
  stages: PMProjectKanbanStageRow[],
  statesByTask: Record<string, PMTaskKanbanStateRow>
): PMProjectKanbanStageRow | null {
  const sorted = [...stages].sort((a, b) => a.orderInList - b.orderInList);
  let best = -1;
  for (const g of kanbanLeavesOf(guid, tasksById, tree)) {
    const s = kanbanStageOfTask(g, sorted, statesByTask);
    const i = sorted.findIndex((x) => x.rowGUID === s);
    if (i >= 0 && (best < 0 || i < best)) best = i;
  }
  return best >= 0 ? sorted[best] : null;
}

/** Average Kanban stage progress % of the tasks inside a stage/summary row (0 = no tasks). */
export function derivedKanbanProgress(
  guid: string,
  tasksById: Record<string, PMTaskRow>,
  tree: PMTreeIndex,
  statesByTask: Record<string, PMTaskKanbanStateRow>
): number {
  const leaves = kanbanLeavesOf(guid, tasksById, tree);
  if (!leaves.length) return 0;
  let sum = 0;
  for (const g of leaves) {
    sum += kanbanStageProgressOf(statesByTask[g], 0);
  }
  return Math.round(sum / leaves.length);
}

/** Optimistic cache update: applies `writes` to the state rows of a project. */
export function applyKanbanStateWrites(
  states: PMTaskKanbanStateRow[],
  projectGUID: string,
  writes: { taskGUID: string; stageGUID: string; orderInList: number; kanbanStageProgressPercent?: number }[]
): PMTaskKanbanStateRow[] {
  const byTask = new Map(states.map((s) => [s.rowParentGUID, s]));
  for (const w of writes) {
    const prev = byTask.get(w.taskGUID);
    const prevPercent = prev?.rowJSON?.kanbanStageProgressPercent;
    const nextPercent = w.kanbanStageProgressPercent !== undefined ? w.kanbanStageProgressPercent : prevPercent;
    byTask.set(w.taskGUID, {
      rowGUID: prev?.rowGUID ?? `optimistic-${w.taskGUID}`,
      rowOwnerGUID: projectGUID,
      rowParentGUID: w.taskGUID,
      orderInList: w.orderInList,
      rowJSON: {
        ...(prev?.rowJSON || {}),
        stageGUID: w.stageGUID,
        ...(nextPercent !== undefined ? { kanbanStageProgressPercent: nextPercent } : {}),
      },
    });
  }
  return Array.from(byTask.values());
}

/** Column under a board x (content coordinates): fixed-width columns with a gap. -1 = none. */
export function kanbanColumnAtX(x: number, columnCount: number, columnWidth: number, gap: number, padding: number): number {
  'worklet';
  const local = x - padding;
  if (local < 0 || columnCount <= 0) return -1;
  const stride = columnWidth + gap;
  const i = Math.floor(local / stride);
  if (i >= columnCount) return -1;
  return local - i * stride <= columnWidth ? i : -1;
}
