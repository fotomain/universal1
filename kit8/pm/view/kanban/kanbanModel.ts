// Pure Kanban logic (no React / Supabase / Reanimated) - unit-tested in __tests__/pm/view/kanban.
//
//   buildKanbanBoard   tasks + tree + stages + task states + scope  ->  columns of cards
//   planKanbanMove     "put these tasks into stage S at index i"    ->  state rows to upsert
//   kanbanLeavesOf     cards a tree row stands for (a stage = every task / milestone inside it)
//   derivedKanbanStage the stage of a stage row = the EARLIEST stage of its tasks
//
// Rules: every task of a project uses the project's stage set; no state row (or a deleted stage) =
// the first stage; stageGUID 'kanbanNoState' = in NO column (not a card of the board, "No state" in the tree).
// Cards = tasks + milestones (leaf rows); stages (summary rows) are not cards.
// The Kanban stage never changes the task progress % and vice versa - EXCEPT while the project switch
// autoUpdateTaskProgressPercentFromKanban is on (planKanbanTaskProgress; useKanbanCommands applies it).
// Every stage has a percent (rowJSON.stageProgressPercent): 1..100 = FIXED (every card of the stage shows it), 0 = MANUAL (typed on the card).

import { ROOT_KEY } from '../project/rootKey';
import type { PMTreeIndex } from '../project/scheduling';

/** what the percent helpers read of the tree: the children of a row (they never need the parent, the depth or the WBS) */
type PMKanbanChildrenIndex = Pick<PMTreeIndex, 'childrenById'>;
import type { PMScheduledRow, PMTaskRow } from '../../model/types';
import { taskColorOf } from '../../model/taskColor';
import {
  PMProjectKanbanStageRow,
  PMTaskKanbanStateRow,
  PM_KANBAN_NO_STATE,
  PM_KANBAN_ORDER_STEP,
  kanbanStageProgressOf,
  kanbanCardPercentOf,
  kanbanStagePercentOf,
  isKanbanStageManualPercent,
} from '../../model/kanbanTypes';

export interface PMKanbanCard {
  guid: string;
  name: string;
  kind: 'task' | 'milestone';
  /** outline number "1.2.3" */
  wbs: string;
  /** task progress % (independent of the stage) */
  progress: number;
  /** progress % of the card in its stage: FIXED stage = the stage percent, MANUAL stage = the percent typed on the card */
  kanbanStageProgressPercent: number;
  /** true: the stage has a percent (1..100), the card cannot be typed by hand; false: MANUAL stage (0), it can */
  percentFixed: boolean;
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
  /** tasks / milestones of the scope that are in no column (kanbanNoState) */
  noStateGUIDs: string[];
}

export type PMKanbanStateWritePlan = { taskGUID: string; stageGUID: string; orderInList: number; kanbanStageProgressPercent?: number };

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
export function isKanbanCardRow(row: PMTaskRow | undefined, tree: PMKanbanChildrenIndex): boolean {
  if (!row) return false;
  if (row.rowJSON?.rowKind === 'stage' || row.rowJSON?.rowKind === 'project') return false;
  return !(tree.childrenById[row.rowGUID]?.length);
}

/** Depth-first rows under `rootGUID` (the root itself included unless it is ROOT_KEY). */
function depthFirst(tree: PMKanbanChildrenIndex, rootGUID: string): string[] {
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
export function kanbanLeavesOf(guid: string, tasksById: Record<string, PMTaskRow>, tree: PMKanbanChildrenIndex): string[] {
  if (!tasksById[guid]) return [];
  return depthFirst(tree, guid).filter((g) => isKanbanCardRow(tasksById[g], tree));
}

/** Stage GUID of a task: its saved stage when that stage still exists, else the first stage; null = kanbanNoState (no column). */
export function kanbanStageOfTask(taskGUID: string, stages: readonly PMProjectKanbanStageRow[], statesByTask: Record<string, PMTaskKanbanStateRow | undefined>): string | null {
  if (!stages.length) return null;
  const saved = statesByTask[taskGUID]?.rowJSON?.stageGUID;
  if (saved === PM_KANBAN_NO_STATE) return null;
  return saved && stages.some((s) => s.rowGUID === saved) ? saved : stages[0].rowGUID;
}

/** true when the task is in no Kanban column (rowJSON.stageGUID = 'kanbanNoState'). */
export function isTaskKanbanNoState(taskGUID: string, statesByTask: Record<string, PMTaskKanbanStateRow | undefined>): boolean {
  return statesByTask[taskGUID]?.rowJSON?.stageGUID === PM_KANBAN_NO_STATE;
}

/**
 * Stage shown in the tree's Kanban cell: a task = its stage (null = kanbanNoState); a stage row = the
 * earliest stage of its tasks (null when all of them are kanbanNoState; the first stage when it has none).
 */
export function kanbanStageForRow(
  guid: string,
  tasksById: Record<string, PMTaskRow>,
  tree: PMKanbanChildrenIndex,
  stages: readonly PMProjectKanbanStageRow[],
  statesByTask: Record<string, PMTaskKanbanStateRow | undefined>
): PMProjectKanbanStageRow | null {
  if (!stages.length) return null;
  if (isKanbanCardRow(tasksById[guid], tree)) {
    const s = kanbanStageOfTask(guid, stages, statesByTask);
    return s ? stages.find((x) => x.rowGUID === s) ?? null : null;
  }
  const derived = derivedKanbanStage(guid, tasksById, tree, stages as PMProjectKanbanStageRow[], statesByTask as Record<string, PMTaskKanbanStateRow>);
  if (derived) return derived;
  return kanbanLeavesOf(guid, tasksById, tree).length ? null : [...stages].sort((a, b) => a.orderInList - b.orderInList)[0];
}

/** State rows that put `taskGUIDs` into kanbanNoState (no column); tasks already there are skipped. */
export function planKanbanClear(statesByTask: Record<string, PMTaskKanbanStateRow | undefined>, taskGUIDs: string[]): PMKanbanStateWritePlan[] {
  const writes: PMKanbanStateWritePlan[] = [];
  for (const g of Array.from(new Set(taskGUIDs))) {
    const st = statesByTask[g];
    if (st?.rowJSON?.stageGUID === PM_KANBAN_NO_STATE) continue;
    const w: PMKanbanStateWritePlan = { taskGUID: g, stageGUID: PM_KANBAN_NO_STATE, orderInList: st?.orderInList ?? PM_KANBAN_ORDER_STEP };
    if (st?.rowJSON?.kanbanStageProgressPercent !== undefined) w.kanbanStageProgressPercent = st.rowJSON.kanbanStageProgressPercent;
    writes.push(w);
  }
  return writes;
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
  const noStateGUIDs: string[] = [];
  if (!columns.length) return { columns, columnOfTask, cardCount: 0, noStateGUIDs };

  for (const g of rows) {
    // kanbanNoState: in no column
    if (statesByTask[g]?.rowJSON?.stageGUID === PM_KANBAN_NO_STATE) {
      noStateGUIDs.push(g);
      continue;
    }
    const t = tasksById[g];
    const sch = schedule[g];
    const parent = tree.parentById[g];
    const state = statesByTask[g];
    const card: PMKanbanCard = {
      guid: g,
      name: t.rowJSON?.taskDescription || '',
      kind: t.rowJSON?.rowKind === 'milestone' || sch?.isMilestone ? 'milestone' : 'task',
      wbs: tree.wbsById[g] || '',
      progress: Math.round(sch?.progress ?? t.rowProgress ?? 0),
      kanbanStageProgressPercent: 0,
      percentFixed: false,
      parentName: parent ? tasksById[parent]?.rowJSON?.taskDescription || '' : '',
      color: taskColorOf(t.rowJSON),
      critical: !!sch?.isCritical,
      startMs: sch ? sch.startMs : null,
      finishMs: sch ? sch.finishMs : null,
      durationDays: sch ? sch.durationDays : null,
      treeIndex: treeIndex[g] ?? 0,
    };
    const stageGUID = kanbanStageOfTask(g, sorted, statesByTask)!;
    const ci = colIndex[stageGUID] ?? 0;
    card.kanbanStageProgressPercent = kanbanCardPercentOf(columns[ci].stage.rowJSON, state);
    card.percentFixed = !isKanbanStageManualPercent(columns[ci].stage.rowJSON);
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
  return { columns, columnOfTask, cardCount: rows.length - noStateGUIDs.length, noStateGUIDs };
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
  const fixedPercent = isKanbanStageManualPercent(col.stage.rowJSON) ? null : kanbanStagePercentOf(col.stage.rowJSON);
  next.forEach((g, i) => {
    const orderInList = (i + 1) * PM_KANBAN_ORDER_STEP;
    const st = statesByTask[g];
    if (st && st.rowJSON?.stageGUID === targetStageGUID && st.orderInList === orderInList && (fixedPercent === null || st.rowJSON.kanbanStageProgressPercent === fixedPercent)) return;
    const write: { taskGUID: string; stageGUID: string; orderInList: number; kanbanStageProgressPercent?: number } = {
      taskGUID: g,
      stageGUID: targetStageGUID,
      orderInList,
    };
    // a FIXED target stage stores its percent on the card; a MANUAL one keeps what was typed
    if (fixedPercent !== null) write.kanbanStageProgressPercent = fixedPercent;
    else if (st?.rowJSON?.kanbanStageProgressPercent !== undefined) write.kanbanStageProgressPercent = st.rowJSON.kanbanStageProgressPercent;
    writes.push(write);
  });
  return writes;
}

/** Earliest stage of the tasks inside a stage row (null = no tasks / no stages). */
export function derivedKanbanStage(
  guid: string,
  tasksById: Record<string, PMTaskRow>,
  tree: PMKanbanChildrenIndex,
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
  tree: PMKanbanChildrenIndex,
  statesByTask: Record<string, PMTaskKanbanStateRow>,
  stages?: readonly PMProjectKanbanStageRow[]
): number {
  const leaves = kanbanLeavesOf(guid, tasksById, tree);
  if (!leaves.length) return 0;
  let sum = 0;
  for (const g of leaves) {
    sum += stages ? kanbanTaskPercentOf(g, stages, statesByTask) : kanbanStageProgressOf(statesByTask[g], 0);
  }
  return Math.round(sum / leaves.length);
}

/**
 * Kanban percent of ONE task: its FIXED stage's percent, or the percent typed on its card (MANUAL stage). kanbanNoState / no stages = the stored percent.
 * Without `stages` use kanbanStageProgressOf.
 */
export function kanbanTaskPercentOf(
  taskGUID: string,
  stages: readonly PMProjectKanbanStageRow[],
  statesByTask: Record<string, PMTaskKanbanStateRow | undefined>
): number {
  const state = statesByTask[taskGUID];
  const stageGUID = kanbanStageOfTask(taskGUID, [...stages].sort((a, b) => a.orderInList - b.orderInList), statesByTask);
  const stage = stageGUID ? stages.find((s) => s.rowGUID === stageGUID) : undefined;
  return stage ? kanbanCardPercentOf(stage.rowJSON, state) : kanbanStageProgressOf(state, 0);
}

/** Kanban percent shown for a tree row: a task = kanbanTaskPercentOf; a stage row = the average of its tasks. */
export function kanbanPercentForRow(
  guid: string,
  tasksById: Record<string, PMTaskRow>,
  tree: PMKanbanChildrenIndex,
  stages: readonly PMProjectKanbanStageRow[],
  statesByTask: Record<string, PMTaskKanbanStateRow | undefined>
): number {
  if (!isKanbanCardRow(tasksById[guid], tree)) return derivedKanbanProgress(guid, tasksById, tree, statesByTask as Record<string, PMTaskKanbanStateRow>, stages);
  return kanbanTaskPercentOf(guid, stages, statesByTask);
}

/**
 * Task progress % to write (switch autoUpdateTaskProgressPercentFromKanban on) when `taskGUIDs` are put into `targetStageGUID`:
 * only a FIXED target stage (percent 1..100) sets the progress, and only for tasks that CHANGE column (a reorder inside the column writes nothing).
 * A MANUAL target stage (0) sets nothing: the percent is typed on the card afterwards.
 */
export function planKanbanTaskProgress(board: PMKanbanBoard, taskGUIDs: string[], targetStageGUID: string): { taskGUID: string; progress: number }[] {
  const ti = board.columns.findIndex((c) => c.stage.rowGUID === targetStageGUID);
  if (ti < 0) return [];
  const json = board.columns[ti].stage.rowJSON;
  if (isKanbanStageManualPercent(json)) return [];
  const progress = kanbanStagePercentOf(json);
  return Array.from(new Set(taskGUIDs))
    .filter((g) => board.columnOfTask[g] !== ti)
    .map((taskGUID) => ({ taskGUID, progress }));
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
