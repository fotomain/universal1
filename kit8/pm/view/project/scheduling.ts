// Pure scheduling core for the PM Gantt module: ltree paths, fractional ordering,
// UTC work-day calendar math, tree indexing and a full CPM pass (forward pass for
// dates, backward pass for total float / critical path) over a DAG of dependencies
// that may point at stages (summary rows) as well as tasks.
//
// No React / Supabase / Skia imports on purpose -> unit-testable and reusable on the
// UI thread-free side (the dashboard, the task info screen and the write-back hook).

import { DAY_MS } from '../../model/constants';
import { PMLinkType, PMScheduledRow, PMTaskDependencyRow, PMTaskJSON, PMTaskRow } from '../../model/types';
import { constraintOf, PMConstraint, PMConstraintType } from '../../model/taskConstraint';
import { manualStartOf, taskModeOf } from '../../model/taskScheduleMode';

// =====================================================================================
// ltree
// =====================================================================================

/** ltree labels allow [A-Za-z0-9_] only -> GUID dashes become underscores. */
export function toLtreeLabel(guid: string): string {
  return guid.toLowerCase().replace(/-/g, '_');
}

export function projectTreePath(projectGUID: string): string {
  return toLtreeLabel(projectGUID);
}

export function buildTreePath(parentTreePath: string | null | undefined, ownRowGUID: string): string {
  const label = toLtreeLabel(ownRowGUID);
  return parentTreePath ? `${parentTreePath}.${label}` : label;
}

export function parentTreePath(treePath: string): string | null {
  const i = treePath.lastIndexOf('.');
  return i === -1 ? null : treePath.slice(0, i);
}

/** true when `ancestorPath` is a strict ltree ancestor of `path` (ltree `@>` minus equality). */
export function isTreeAncestorPath(ancestorPath: string, path: string): boolean {
  return path.length > ancestorPath.length && path.startsWith(ancestorPath + '.');
}

export function areTreeRelated(a: PMTaskRow, b: PMTaskRow): boolean {
  return a.rowGUID === b.rowGUID || isTreeAncestorPath(a.treePath, b.treePath) || isTreeAncestorPath(b.treePath, a.treePath);
}

// =====================================================================================
// Fractional ordering (orderInList: numeric). A move rewrites ONE row; only when two
// neighbours get closer than ORDER_EPSILON do we rebalance that sibling list.
// =====================================================================================

export const ORDER_STEP = 1024;
export const ORDER_EPSILON = 1e-6;

export function fractionalOrderBetween(before: number | null | undefined, after: number | null | undefined): number {
  const hasBefore = before !== null && before !== undefined;
  const hasAfter = after !== null && after !== undefined;
  if (!hasBefore && !hasAfter) return ORDER_STEP;
  if (!hasBefore) return (after as number) - ORDER_STEP;
  if (!hasAfter) return (before as number) + ORDER_STEP;
  return ((before as number) + (after as number)) / 2;
}

export function orderGapTooSmall(before: number | null | undefined, after: number | null | undefined): boolean {
  if (before === null || before === undefined || after === null || after === undefined) return false;
  return Math.abs(after - before) < ORDER_EPSILON;
}

/** Evenly re-spaced orders for an ordered sibling list (used only when a gap collapses). */
export function rebalanceOrders(orderedGUIDs: string[]): Map<string, number> {
  const out = new Map<string, number>();
  orderedGUIDs.forEach((g, i) => out.set(g, (i + 1) * ORDER_STEP));
  return out;
}

// =====================================================================================
// UTC calendar. All scheduling happens on UTC midnights so DST / device time zone can
// never shift a bar by an hour; timestamptz in Postgres stores the same instants.
// =====================================================================================

export interface PMCalendar {
  skipWeekends: boolean;
  /** A10 / A11 (Extended): a custom working week, index = UTC weekday (0 = Sunday); overrides skipWeekends */
  workWeek?: readonly boolean[];
  /** A11: UTC midnights that are NOT worked (holidays, days off) / that ARE worked (an extra working day) */
  offDays?: ReadonlySet<number>;
  extraDays?: ReadonlySet<number>;
}

export const DEFAULT_CALENDAR: PMCalendar = { skipWeekends: false };

export function utcMidnight(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

export function todayUTC(): number {
  return utcMidnight(Date.now());
}

export function addDaysMs(ms: number, days: number): number {
  return ms + days * DAY_MS;
}

export function diffDaysMs(a: number, b: number): number {
  return Math.round((a - b) / DAY_MS);
}

/** every calendar day is a working day (no weekend rule, no week, no exception): the fast path of the day maths */
function isPlainCalendar(cal: PMCalendar): boolean {
  return !cal.skipWeekends && !cal.workWeek && !cal.offDays?.size && !cal.extraDays?.size;
}

/** the scans below stop after this many days: a calendar can never make a loop endless */
const MAX_SCAN_DAYS = 36600;

export function isWorkDay(ms: number, cal: PMCalendar): boolean {
  if (cal.offDays?.size || cal.extraDays?.size) {
    const day = utcMidnight(ms);
    if (cal.offDays?.has(day)) return false;
    if (cal.extraDays?.has(day)) return true;
  }
  if (cal.workWeek) return cal.workWeek[new Date(ms).getUTCDay()] === true;
  if (!cal.skipWeekends) return true;
  const dow = new Date(ms).getUTCDay();
  return dow !== 0 && dow !== 6;
}

export function nextWorkDay(ms: number, cal: PMCalendar): number {
  let d = utcMidnight(ms);
  for (let guard = 0; guard < MAX_SCAN_DAYS && !isWorkDay(d, cal); guard++) d += DAY_MS;
  return d;
}

/** The working day on or before `ms` (the last day of a project typed on a weekend is the Friday before). */
export function previousWorkDay(ms: number, cal: PMCalendar): number {
  let d = utcMidnight(ms);
  for (let guard = 0; guard < MAX_SCAN_DAYS && !isWorkDay(d, cal); guard++) d -= DAY_MS;
  return d;
}

/** Exclusive finish of `n` working days starting at `startMs`. n = 0 -> startMs. */
export function addWorkDays(startMs: number, n: number, cal: PMCalendar): number {
  if (n <= 0) return startMs;
  if (isPlainCalendar(cal)) return startMs + n * DAY_MS;
  let d = startMs;
  let count = 0;
  for (let guard = 0; count < n && guard < MAX_SCAN_DAYS; guard++) {
    if (isWorkDay(d, cal)) count++;
    d += DAY_MS;
  }
  return d;
}

/** Inverse of addWorkDays: the start that makes `n` working days end at `finishMs`. */
export function subtractWorkDays(finishMs: number, n: number, cal: PMCalendar): number {
  if (n <= 0) return finishMs;
  if (isPlainCalendar(cal)) return finishMs - n * DAY_MS;
  let d = finishMs;
  let count = 0;
  for (let guard = 0; count < n && guard < MAX_SCAN_DAYS; guard++) {
    d -= DAY_MS;
    if (isWorkDay(d, cal)) count++;
  }
  return d;
}

/** Moves a boundary by a lag (k > 0) or lead (k < 0) measured in working days. */
export function shiftWorkDays(ms: number, k: number, cal: PMCalendar): number {
  if (!k) return ms;
  if (k > 0) return addWorkDays(nextWorkDay(ms, cal), k, cal);
  return subtractWorkDays(ms, -k, cal);
}

export function workDaysBetween(startMs: number, finishMs: number, cal: PMCalendar): number {
  if (finishMs <= startMs) return 0;
  if (isPlainCalendar(cal)) return Math.round((finishMs - startMs) / DAY_MS);
  let count = 0;
  for (let d = startMs; d < finishMs; d += DAY_MS) if (isWorkDay(d, cal)) count++;
  return count;
}

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateShort(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

export function formatDateISO(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' -> UTC midnight ms, or null when invalid. */
export function parseDateISO(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ms) ? ms : null;
}

// =====================================================================================
// Tree index (Project -> Stage -> Task) derived from ltree treePath.
// =====================================================================================

export const ROOT_KEY = '__root__';

export interface PMTreeIndex {
  parentById: Record<string, string | null>;
  childrenById: Record<string, string[]>; // ROOT_KEY holds the top-level rows
  depthById: Record<string, number>;
  /** Outline (WBS) number from the treePath hierarchy + sibling order: "1", "1.2", "1.2.3". */
  wbsById: Record<string, string>;
}

export function buildTreeIndex(tasks: PMTaskRow[]): PMTreeIndex {
  const byGUID = new Map(tasks.map((t) => [t.rowGUID, t]));
  const labelToGUID = new Map(tasks.map((t) => [toLtreeLabel(t.rowGUID), t.rowGUID]));
  const parentById: Record<string, string | null> = {};
  const childrenById: Record<string, string[]> = { [ROOT_KEY]: [] };
  const depthById: Record<string, number> = {};

  for (const t of tasks) childrenById[t.rowGUID] = [];

  for (const t of tasks) {
    const segs = t.treePath.split('.');
    const parentLabel = segs.length >= 2 ? segs[segs.length - 2] : null;
    let parent = parentLabel ? labelToGUID.get(parentLabel) ?? null : null; // project label -> root
    if (parent === t.rowGUID) parent = null;
    parentById[t.rowGUID] = parent;
    childrenById[parent ?? ROOT_KEY].push(t.rowGUID);
  }

  const cmp = (a: string, b: string) => {
    const ta = byGUID.get(a)!;
    const tb = byGUID.get(b)!;
    return ta.orderInList - tb.orderInList || (ta.rowJSON?.taskDescription || '').localeCompare(tb.rowJSON?.taskDescription || '');
  };
  for (const key of Object.keys(childrenById)) childrenById[key].sort(cmp);

  const visit = (guid: string, depth: number, seen: Set<string>) => {
    if (seen.has(guid)) return;
    seen.add(guid);
    depthById[guid] = depth;
    for (const c of childrenById[guid] || []) visit(c, depth + 1, seen);
  };
  const seen = new Set<string>();
  for (const r of childrenById[ROOT_KEY]) visit(r, 0, seen);
  // defensive: anything unreachable (corrupt paths) is shown at the root
  for (const t of tasks) {
    if (!seen.has(t.rowGUID)) {
      parentById[t.rowGUID] = null;
      childrenById[ROOT_KEY].push(t.rowGUID);
      visit(t.rowGUID, 0, seen);
    }
  }
  return { parentById, childrenById, depthById, wbsById: buildWbsNumbers(childrenById) };
}

/**
 * Outline numbers ("1", "1.1", "1.1.1") for every row: depth-first over the treePath
 * hierarchy, each level numbered by the sibling order (orderInList). Numbers follow
 * the FULL tree, so they stay stable when a stage is collapsed.
 */
export function buildWbsNumbers(childrenById: Record<string, string[]>): Record<string, string> {
  const wbsById: Record<string, string> = {};
  const visit = (guid: string, wbs: string) => {
    wbsById[guid] = wbs;
    let n = 0;
    // `in` check: defensive against corrupt paths listing a row twice / cycles
    for (const c of childrenById[guid] || []) if (!(c in wbsById)) visit(c, `${wbs}.${++n}`);
  };
  let n = 0;
  for (const r of childrenById[ROOT_KEY] || []) if (!(r in wbsById)) visit(r, String(++n));
  return wbsById;
}

/** Depth-first row order, skipping children of collapsed rows (expanded defaults to true). */
export function flattenVisible(tree: PMTreeIndex, expanded: Record<string, boolean>): string[] {
  const out: string[] = [];
  const visit = (guid: string) => {
    out.push(guid);
    if (expanded[guid] === false) return;
    for (const c of tree.childrenById[guid] || []) visit(c);
  };
  for (const r of tree.childrenById[ROOT_KEY] || []) visit(r);
  return out;
}

export function flattenAll(tree: PMTreeIndex): string[] {
  return flattenVisible(tree, {});
}

export function isSummaryRow(tree: PMTreeIndex, task: PMTaskRow): boolean {
  return (tree.childrenById[task.rowGUID]?.length ?? 0) > 0 || task.rowJSON?.rowKind === 'stage';
}

// =====================================================================================
// CPM scheduler
// =====================================================================================

export interface PMScheduleInput {
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
  projectStartMs: number;
  calendar?: PMCalendar;
  /** A1 manually scheduled tasks (model/taskScheduleMode.ts) are honored. Default false. */
  manualEnabled?: boolean;
  /** A3 the 8 constraint types (model/taskConstraint.ts) are honored; false = only the old Start No Earlier Than (manualStartAt). */
  constraintsEnabled?: boolean;
  /** A3 MS Project "Tasks will always honor their constraint dates" (default true). */
  constraintsAlwaysHonored?: boolean;
  /** A4 'finish' = plan backward from projectFinishDayMs; the start is a result (model/scheduleFrom.ts). Default 'start'. */
  scheduleFrom?: 'start' | 'finish';
  /** A4 the typed LAST day of the project (UTC midnight), used only when scheduleFrom = 'finish'. */
  projectFinishDayMs?: number | null;
  /** A10 task calendars by id (taskCalendarId of a task); a task without one uses `calendar`. */
  calendars?: Record<string, PMCalendar>;
  /** A12 split tasks, A14 inactive tasks, A8 elapsed durations, A5 deadlines, B4 lag in percent, B5 external predecessors: honored while true. */
  splitEnabled?: boolean;
  inactiveEnabled?: boolean;
  elapsedEnabled?: boolean;
  deadlineEnabled?: boolean;
  lagPercentEnabled?: boolean;
  externalEnabled?: boolean;
  /** B5 the stored dates of tasks of OTHER projects (task GUID -> start / exclusive finish). */
  externalDates?: Record<string, { startMs: number; finishMs: number }>;
  /**
   * Resource optimization (kit8/pm/resourceleveling): the LEVELING DELAY of a task (rowJSON.taskLevelingDelayDays, working days of the task calendar) is honored while true.
   * The delay moves a task AWAY FROM THE ANCHOR: later when the project is planned from its start, earlier when it is planned from its finish (Q5). Default false:
   * the plan is exactly what it was before the function existed.
   */
  levelingEnabled?: boolean;
  /** ... a manually scheduled task is moved by its delay too (resourceLevelingManualTasks) */
  levelingManualTasks?: boolean;
  /** ... the delays to use INSTEAD of the rowJSON values (the engine tries delays without writing rows): task GUID -> working days */
  levelingDelays?: Record<string, number>;
}

export interface PMScheduleResult {
  rows: Record<string, PMScheduledRow>;
  projectStartMs: number;
  projectFinishMs: number;
  cycleGUIDs: string[];
  /** A4 finish mode only: the calculated start lies before today */
  projectStartInPast?: boolean;
}

interface LeafEdge {
  from: string; // predecessor leaf
  to: string; // successor leaf
  type: PMLinkType;
  lag: number;
}

/** the duration of a row in working days (a milestone 0; an empty stage is a 1-day placeholder) */
export function durationOf(task: PMTaskRow): number {
  if (task.rowJSON?.rowKind === 'milestone') return 0;
  const d = Math.round(Number(task.rowJSON?.durationDays ?? 1));
  const safe = Number.isFinite(d) && d > 0 ? d : 0;
  // an empty stage (no children yet) is drawn as a 1-day placeholder summary
  return task.rowJSON?.rowKind === 'stage' ? Math.max(1, safe) : safe;
}

/**
 * Expands the explicit dependency list into leaf-to-leaf constraints:
 *  - a constraint on a stage applies to every leaf inside the stage;
 *  - a predecessor stage stands for all its leaves (topologically), while its
 *    aggregate start/finish is used for the date maths.
 * Links between rows of the same branch (ancestor/descendant) are ignored.
 */
function buildLeafGraph(tasks: PMTaskRow[], deps: PMTaskDependencyRow[], tree: PMTreeIndex, lagOf?: (pred: PMTaskRow | undefined, d: PMTaskDependencyRow) => number) {
  const byGUID = new Map(tasks.map((t) => [t.rowGUID, t]));
  const isSummary = (g: string) => (tree.childrenById[g]?.length ?? 0) > 0;

  const leavesMemo = new Map<string, string[]>();
  const leavesUnder = (g: string): string[] => {
    const cached = leavesMemo.get(g);
    if (cached) return cached;
    const res = isSummary(g) ? tree.childrenById[g].flatMap(leavesUnder) : [g];
    leavesMemo.set(g, res);
    return res;
  };

  const depsBySucc = new Map<string, PMTaskDependencyRow[]>();
  for (const d of deps) {
    if (!byGUID.has(d.rowGUID) || !byGUID.has(d.rowDependsOnGUID)) continue;
    if (areTreeRelated(byGUID.get(d.rowGUID)!, byGUID.get(d.rowDependsOnGUID)!)) continue;
    if (!depsBySucc.has(d.rowGUID)) depsBySucc.set(d.rowGUID, []);
    depsBySucc.get(d.rowGUID)!.push(d);
  }

  const leaves = flattenAll(tree).filter((g) => !isSummary(g));
  /** the links that hold a leaf (also those of its stages): predecessor row, type and lag in working days */
  const constraintsByLeaf = new Map<string, { pred: string; type: PMLinkType; lag: number }[]>();
  const edges: LeafEdge[] = [];
  for (const leaf of leaves) {
    const cons: { pred: string; type: PMLinkType; lag: number }[] = [];
    for (let g: string | null = leaf; g; g = tree.parentById[g] ?? null) {
      for (const d of depsBySucc.get(g) || []) {
        const pred = byGUID.get(d.rowDependsOnGUID)!;
        if (areTreeRelated(pred, byGUID.get(leaf)!)) continue;
        cons.push({ pred: d.rowDependsOnGUID, type: d.linkType || 'FS', lag: lagOf ? lagOf(pred, d) : Number(d.lagDays) || 0 });
      }
    }
    constraintsByLeaf.set(leaf, cons);
    for (const c of cons) {
      for (const pl of leavesUnder(c.pred)) {
        if (pl !== leaf) edges.push({ from: pl, to: leaf, type: c.type, lag: c.lag });
      }
    }
  }
  return { byGUID, isSummary, leavesUnder, leaves, constraintsByLeaf, edges };
}

/** Kahn topological sort; ties keep tree order. Returns [ordered, inCycle]. */
function topoSort(nodes: string[], edges: LeafEdge[]): [string[], string[]] {
  const rank = new Map(nodes.map((g, i) => [g, i]));
  const indeg = new Map(nodes.map((g) => [g, 0]));
  const out = new Map<string, string[]>();
  for (const e of edges) {
    if (!rank.has(e.from) || !rank.has(e.to)) continue;
    indeg.set(e.to, (indeg.get(e.to) || 0) + 1);
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from)!.push(e.to);
  }
  // small binary-heap-free priority queue: fine for project-sized graphs
  const ready = nodes.filter((g) => indeg.get(g) === 0);
  const ordered: string[] = [];
  while (ready.length) {
    let bi = 0;
    for (let i = 1; i < ready.length; i++) if (rank.get(ready[i])! < rank.get(ready[bi])!) bi = i;
    const g = ready.splice(bi, 1)[0];
    ordered.push(g);
    for (const n of out.get(g) || []) {
      const left = (indeg.get(n) || 0) - 1;
      indeg.set(n, left);
      if (left === 0) ready.push(n);
    }
  }
  const done = new Set(ordered);
  const cyclic = nodes.filter((g) => !done.has(g));
  return [ordered, cyclic];
}

// A12 the working-day segments of a split task (pure): `after` = working days of work done before the gap, `gap` = working days of pause.
export interface PMSplit { after: number; gap: number }
export function splitsOf(json: Partial<PMTaskJSON> | undefined, dur: number): PMSplit[] {
  const raw = Array.isArray(json?.taskSplits) ? json!.taskSplits! : [];
  const out: PMSplit[] = [];
  for (const s of raw) {
    const after = Math.round(Number((s as any)?.after));
    const gap = Math.round(Number((s as any)?.gap));
    if (Number.isFinite(after) && Number.isFinite(gap) && after > 0 && after < dur && gap > 0) out.push({ after, gap });
  }
  return out.sort((a, b) => a.after - b.after).filter((s, i, a) => i === 0 || s.after > a[i - 1].after);
}

/** the pieces of a split task from its first day: [{ startMs, finishMs (exclusive) }] */
export function splitSegments(startMs: number, dur: number, splits: PMSplit[], cal: PMCalendar): { startMs: number; finishMs: number }[] {
  const segs: { startMs: number; finishMs: number }[] = [];
  let cursor = nextWorkDay(startMs, cal);
  let done = 0;
  for (const s of splits) {
    const f = addWorkDays(cursor, s.after - done, cal);
    segs.push({ startMs: cursor, finishMs: f });
    done = s.after;
    cursor = nextWorkDay(shiftWorkDays(f, s.gap, cal), cal);
  }
  segs.push({ startMs: cursor, finishMs: addWorkDays(cursor, dur - done, cal) });
  return segs;
}

/**
 * The leaf graph of a plan as scheduleProject builds it, for the database (Resource optimization, server side computations): the leaves in topological order, the links that hold each leaf
 * (the predecessor is a row: a leaf or a stage) and the leaves under every row. Pure; the same graph the scheduler walks.
 */
export function leafGraphOf(tasks: PMTaskRow[], deps: PMTaskDependencyRow[], lagOf?: (pred: PMTaskRow | undefined, d: PMTaskDependencyRow) => number) {
  const tree = buildTreeIndex(tasks);
  const g = buildLeafGraph(tasks, deps, tree, lagOf);
  const [topo, cyclic] = topoSort(g.leaves, g.edges);
  return { leaves: g.leaves, topo, cyclic, constraintsByLeaf: g.constraintsByLeaf, leavesUnder: g.leavesUnder, isSummary: g.isSummary };
}

export function scheduleProject(input: PMScheduleInput): PMScheduleResult {
  const baseCal = input.calendar ?? DEFAULT_CALENDAR;
  const honor = input.constraintsAlwaysHonored !== false;
  const constraintsOn = input.constraintsEnabled === true;
  const manualOn = input.manualEnabled === true;
  const finishDay = input.scheduleFrom === 'finish' && typeof input.projectFinishDayMs === 'number' && Number.isFinite(input.projectFinishDayMs) ? utcMidnight(input.projectFinishDayMs) : null;
  const finishMode = finishDay !== null;
  let projectStartMs = nextWorkDay(utcMidnight(input.projectStartMs), baseCal);

  // A14 inactive tasks (and everything under an inactive stage) are not part of the plan: they are scheduled on their own afterwards
  let planTasks = input.tasks;
  const inactiveTasks: PMTaskRow[] = [];
  if (input.inactiveEnabled) {
    const off = input.tasks.filter((t) => (t.rowJSON as PMTaskJSON)?.taskInactive === true);
    if (off.length) {
      const offPaths = off.map((t) => t.treePath + '.');
      const isOff = (t: PMTaskRow) => (t.rowJSON as PMTaskJSON)?.taskInactive === true || offPaths.some((p) => t.treePath.startsWith(p));
      planTasks = input.tasks.filter((t) => !isOff(t));
      for (const t of input.tasks) if (isOff(t)) inactiveTasks.push(t);
    }
  }
  const tree = buildTreeIndex(planTasks);
  const lagOf = (pred: PMTaskRow | undefined, d: PMTaskDependencyRow): number => {
    const pct = (d.rowJSON as any)?.lagPercent;
    if (input.lagPercentEnabled && pred && typeof pct === 'number' && Number.isFinite(pct)) return Math.round((durationOf(pred) * pct) / 100);
    return Number(d.lagDays) || 0;
  };
  const g = buildLeafGraph(planTasks, input.deps, tree, lagOf);
  const [topo, cyclic] = topoSort(g.leaves, g.edges);
  const cycleSet = new Set(cyclic);

  // ---- what decides each leaf: a manual start, a constraint, its calendar, its duration kind, its splits, its external predecessors ------------------------------------------
  interface Plan {
    manualStart: number | null;
    con: PMConstraint;
    subFixed: number | null;
    cal: PMCalendar;
    elapsed: boolean;
    splits: PMSplit[];
    gaps: number;
    ext: { dates: { startMs: number; finishMs: number }; type: PMLinkType; lag: number }[];
    /** leveling delay in working days of `cal` (0 = none) */
    delay: number;
  }
  const plans = new Map<string, Plan>();
  for (const leaf of g.leaves) {
    const task = g.byGUID.get(leaf)!;
    const json = task.rowJSON as PMTaskJSON;
    const stage = json?.rowKind === 'stage';
    const manual = !stage && taskModeOf(json, manualOn) === 'manual' ? manualStartOf(json) : null;
    const sub = !stage && json?.taskIsSubproject === true;
    // legacy: Start No Earlier Than (manualStartAt) applies to every leaf; the other 7 types only to a plain task / milestone of a project that switched them on
    const con = manual !== null ? { type: 'ASAP' as PMConstraintType, dateMs: null, implicit: true } : constraintOf(json, constraintsOn && !stage && !sub);
    const dur = durationOf(task);
    const splits = input.splitEnabled && !stage ? splitsOf(json, dur) : [];
    const ext: Plan['ext'] = [];
    if (input.externalEnabled && !stage && Array.isArray(json?.externalPredecessors)) {
      for (const e of json.externalPredecessors!) {
        const dates = input.externalDates?.[e?.taskGUID];
        if (dates) ext.push({ dates, type: e.linkType || 'FS', lag: Number(e.lagDays) || 0 });
      }
    }
    const calId = (json?.taskCalendarId as string | null | undefined) || null;
    // the leveling delay never applies to a stage, a subproject task, a milestone, a task fixed by Must Start / Finish On (honored), or a manual task unless allowed
    let delay = 0;
    if (input.levelingEnabled && !stage && !sub && dur > 0) {
      const raw = input.levelingDelays ? input.levelingDelays[leaf] : json?.taskLevelingDelayDays;
      delay = Math.max(0, Math.round(Number(raw) || 0));
      if (delay > 0 && manual !== null && !input.levelingManualTasks) delay = 0;
      if (delay > 0 && honor && (con.type === 'MSO' || con.type === 'MFO')) delay = 0;
    }
    plans.set(leaf, {
      manualStart: manual === null ? null : utcMidnight(manual),
      con,
      subFixed: sub && con.type === 'SNET' ? con.dateMs : null,
      cal: (calId && input.calendars?.[calId]) || baseCal,
      elapsed: input.elapsedEnabled === true && !stage && json?.durationElapsed === true,
      splits,
      gaps: splits.reduce((a, s) => a + s.gap, 0),
      ext,
      delay,
    });
  }
  const planOf = (leaf: string) => plans.get(leaf)!;
  const calOf = (leaf: string) => plans.get(leaf)!.cal;
  const durOf = (leaf: string) => durationOf(g.byGUID.get(leaf)!);

  // the exclusive finish of a leaf that starts on `es`, and the start of a leaf that must end at `endEx` (a milestone starts where it ends)
  const finishOf = (leaf: string, es: number): number => {
    const p = planOf(leaf);
    const d = durOf(leaf);
    if (p.elapsed) return es + d * DAY_MS;
    return addWorkDays(es, d + p.gaps, p.cal);
  };
  const startFor = (leaf: string, endEx: number): number => {
    const p = planOf(leaf);
    const d = durOf(leaf);
    if (d <= 0) return endEx;
    if (p.elapsed) return endEx - d * DAY_MS;
    return subtractWorkDays(endEx, d + p.gaps, p.cal);
  };
  const snap = (leaf: string, ms: number): number => (planOf(leaf).elapsed ? utcMidnight(ms) : nextWorkDay(ms, calOf(leaf)));
  const lastDayEx = (dayMs: number) => utcMidnight(dayMs) + DAY_MS; // the exclusive finish of a typed last day

  // ---- forward pass (from `pStart`): dates, constraints, conflicts ---------------------------------------------------------------------------------------------------------
  const forward = (pStart: number) => {
    const ES = new Map<string, number>();
    const EF = new Map<string, number>();
    const conflict = new Map<string, 'constraintWins' | 'linkWins'>();
    const engine = new Map<string, number>();
    const aggregate = (guid: string): [number, number] | null => {
      if (!g.isSummary(guid)) return ES.has(guid) ? [ES.get(guid)!, EF.get(guid)!] : null;
      let s = Infinity;
      let f = -Infinity;
      for (const l of g.leavesUnder(guid)) {
        if (!ES.has(l)) continue;
        s = Math.min(s, ES.get(l)!);
        f = Math.max(f, EF.get(l)!);
      }
      return s === Infinity ? null : [s, f];
    };
    for (const leaf of [...topo, ...cyclic]) {
      const dur = durOf(leaf);
      const plan = planOf(leaf);
      const cal = plan.cal;
      let linkEs = pStart;
      const apply = (type: PMLinkType, lag: number, ps: number, pf: number) => {
        switch (type || 'FS') {
          case 'FS': linkEs = Math.max(linkEs, shiftWorkDays(pf, lag, cal)); break;
          case 'SS': linkEs = Math.max(linkEs, shiftWorkDays(ps, lag, cal)); break;
          case 'FF': linkEs = Math.max(linkEs, startFor(leaf, shiftWorkDays(pf, lag, cal))); break;
          case 'SF': linkEs = Math.max(linkEs, startFor(leaf, shiftWorkDays(ps, lag, cal))); break;
        }
      };
      for (const c of g.constraintsByLeaf.get(leaf) || []) {
        const agg = aggregate(c.pred);
        if (!agg) continue; // predecessor not scheduled yet (only inside a cycle)
        apply(c.type, c.lag, agg[0], agg[1]);
      }
      for (const e of plan.ext) apply(e.type, e.lag, e.dates.startMs, e.dates.finishMs); // B5: fixed dates of a task of another project
      const linkStart = snap(leaf, linkEs);
      let es = linkEs;
      if (plan.manualStart !== null) {
        es = plan.manualStart;
        if (linkStart > snap(leaf, es)) { conflict.set(leaf, 'constraintWins'); engine.set(leaf, linkStart); }
      } else if (plan.subFixed !== null && finishMode) {
        es = plan.subFixed;
      } else {
        const { type, dateMs: D } = plan.con;
        const sD = D === null ? 0 : snap(leaf, D);
        const fromFinish = D === null ? 0 : dur <= 0 ? D : startFor(leaf, lastDayEx(D));
        const finishTry = (s: number) => finishOf(leaf, snap(leaf, s));
        switch (type) {
          case 'SNET': es = Math.max(linkEs, D!); break;
          case 'FNET': es = Math.max(linkEs, fromFinish); break;
          case 'MSO':
          case 'MFO': {
            const fixed = type === 'MSO' ? sD : snap(leaf, fromFinish);
            if (honor) { es = fixed; if (linkStart > fixed) { conflict.set(leaf, 'constraintWins'); engine.set(leaf, linkStart); } }
            else { es = Math.max(linkEs, fixed); if (linkStart > fixed) { conflict.set(leaf, 'linkWins'); engine.set(leaf, linkStart); } }
            break;
          }
          case 'SNLT':
            if (linkStart > sD) { if (honor) { es = sD; conflict.set(leaf, 'constraintWins'); } else conflict.set(leaf, 'linkWins'); engine.set(leaf, linkStart); }
            break;
          case 'FNLT': {
            const late = dur <= 0 ? linkStart > sD : finishTry(linkStart) > lastDayEx(D!);
            if (late) { if (honor) { es = snap(leaf, fromFinish); conflict.set(leaf, 'constraintWins'); } else conflict.set(leaf, 'linkWins'); engine.set(leaf, linkStart); }
            break;
          }
          default: break; // ASAP, ALAP (placed by the extra pass below)
        }
      }
      es = snap(leaf, es);
      // Resource optimization: the delay is added to the position the links and the constraint gave (planned from the finish the delay is taken from the late side instead)
      if (plan.delay > 0 && !finishMode) es = snap(leaf, shiftWorkDays(es, plan.delay, plan.cal));
      ES.set(leaf, es);
      EF.set(leaf, finishOf(leaf, es));
    }
    return { ES, EF, conflict, engine };
  };

  const outEdges = new Map<string, LeafEdge[]>();
  for (const e of g.edges) {
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from)!.push(e);
  }
  // the latest EXCLUSIVE finish of `leaf` that the successors allow, from their dates (sStart / sFinish give the successor's start / finish)
  const limitFrom = (leaf: string, bound: number, sStart: (to: string) => number | undefined, sFinish: (to: string) => number | undefined): number => {
    let lf = bound;
    for (const e of outEdges.get(leaf) || []) {
      const st = sStart(e.to);
      const fi = sFinish(e.to);
      if (st === undefined || fi === undefined) continue;
      const scal = calOf(e.to);
      switch (e.type) {
        case 'FS': lf = Math.min(lf, shiftWorkDays(st, -e.lag, scal)); break;
        case 'SS': lf = Math.min(lf, finishOf(leaf, shiftWorkDays(st, -e.lag, scal))); break;
        case 'FF': lf = Math.min(lf, shiftWorkDays(fi, -e.lag, scal)); break;
        case 'SF': lf = Math.min(lf, finishOf(leaf, shiftWorkDays(fi, -e.lag, scal))); break;
      }
    }
    return lf;
  };

  const LF = new Map<string, number>();
  const LS = new Map<string, number>();
  let ES = new Map<string, number>();
  let EF = new Map<string, number>();
  let conflict = new Map<string, 'constraintWins' | 'linkWins'>();
  let engine = new Map<string, number>();
  let projectFinishMs: number;

  if (!finishMode) {
    // ---- scheduled from the project START: forward pass, As Late As Possible pass, backward pass for the slack ---------------------------------------------------------------
    ({ ES, EF, conflict, engine } = forward(projectStartMs));
    projectFinishMs = projectStartMs;
    for (const f of EF.values()) projectFinishMs = Math.max(projectFinishMs, f);

    // As Late As Possible: reverse topological order, uses the SCHEDULED dates of the successors (free slack); a successor is never moved
    for (let i = topo.length - 1; i >= 0; i--) {
      const leaf = topo[i];
      const plan = planOf(leaf);
      if (plan.manualStart !== null || plan.con.type !== 'ALAP') continue;
      const lf = limitFrom(leaf, projectFinishMs, (to) => ES.get(to), (to) => EF.get(to));
      const es = startFor(leaf, lf);
      if (es > ES.get(leaf)!) {
        ES.set(leaf, es);
        EF.set(leaf, finishOf(leaf, es));
      }
    }

    // backward pass (total slack / critical path)
    for (let i = topo.length - 1; i >= 0; i--) {
      const leaf = topo[i];
      const dur = durOf(leaf);
      let lf = limitFrom(leaf, projectFinishMs, (to) => LS.get(to), (to) => LF.get(to));
      const plan = planOf(leaf);
      if (plan.manualStart === null && plan.con.dateMs !== null) {
        const D = plan.con.dateMs;
        switch (plan.con.type) {
          case 'MSO':
          case 'SNLT': lf = Math.min(lf, finishOf(leaf, snap(leaf, D))); break;
          case 'MFO':
          case 'FNLT': lf = Math.min(lf, dur <= 0 ? D : lastDayEx(D)); break;
          default: break;
        }
      }
      LF.set(leaf, lf);
      LS.set(leaf, startFor(leaf, lf));
    }
  } else {
    // ---- scheduled from the project FINISH date: backward placement (as late as possible), the start is a RESULT, then a forward pass from it for the early dates / slack -------
    const finishEx = lastDayEx(previousWorkDay(finishDay!, baseCal)); // exclusive finish of the last WORKING day on or before the typed one
    for (let i = topo.length - 1; i >= 0; i--) {
      const leaf = topo[i];
      const dur = durOf(leaf);
      const plan = planOf(leaf);
      if (plan.manualStart !== null || plan.subFixed !== null) {
        let s = snap(leaf, plan.manualStart ?? plan.subFixed!);
        if (plan.delay > 0) s = snap(leaf, shiftWorkDays(s, -plan.delay, plan.cal));
        LS.set(leaf, s);
        LF.set(leaf, finishOf(leaf, s));
        continue;
      }
      let lf = limitFrom(leaf, dur <= 0 ? finishEx - DAY_MS : finishEx, (to) => LS.get(to), (to) => LF.get(to)); // a milestone sits ON the last day
      if (plan.delay > 0) lf = shiftWorkDays(lf, -plan.delay, plan.cal); // Resource optimization: earlier than the latest position, away from the finish anchor
      const { type, dateMs: D } = plan.con;
      if (D !== null) {
        const sD = snap(leaf, D);
        const endEx = dur <= 0 ? D : lastDayEx(D);
        switch (type) {
          case 'MSO': { const fx = finishOf(leaf, sD); if (lf < fx) conflict.set(leaf, honor ? 'constraintWins' : 'linkWins'); if (honor || lf > fx) lf = fx; break; }
          case 'MFO': if (lf < endEx) conflict.set(leaf, honor ? 'constraintWins' : 'linkWins'); if (honor || lf > endEx) lf = endEx; break;
          case 'SNLT': lf = Math.min(lf, finishOf(leaf, sD)); break;
          case 'FNLT': lf = Math.min(lf, endEx); break;
          case 'FNET': if (lf < endEx) { conflict.set(leaf, honor ? 'constraintWins' : 'linkWins'); if (honor) lf = endEx; } break;
          case 'SNET': if (startFor(leaf, lf) < sD) { conflict.set(leaf, honor ? 'constraintWins' : 'linkWins'); if (honor) lf = finishOf(leaf, sD); } break;
          default: break;
        }
      }
      LF.set(leaf, lf);
      LS.set(leaf, startFor(leaf, lf));
    }
    let s = Infinity;
    for (const leaf of topo) s = Math.min(s, LS.get(leaf)!);
    if (s !== Infinity) projectStartMs = nextWorkDay(s, baseCal);
    const fwd = forward(projectStartMs);
    ES = fwd.ES;
    EF = fwd.EF;
    // the conflicts of the PLACEMENT are the ones shown; a cyclic leaf keeps its forward dates
    projectFinishMs = finishEx;
    for (const leaf of topo) projectFinishMs = Math.max(projectFinishMs, LF.get(leaf)!);
  }

  // ---- assemble leaves ----------------------------------------------------------------
  const rows: Record<string, PMScheduledRow> = {};
  for (const leaf of g.leaves) {
    const task = g.byGUID.get(leaf)!;
    const json = task.rowJSON as PMTaskJSON;
    const plan = planOf(leaf);
    const inCycle = cycleSet.has(leaf);
    const dur = durOf(leaf);
    const early = ES.get(leaf)!;
    const earlyEnd = EF.get(leaf)!;
    // the placed dates: early (from start) / late (from finish), except a cyclic leaf and a task that asked for As Soon As Possible
    const useLate = finishMode && !inCycle && !(plan.con.type === 'ASAP' && !plan.con.implicit && plan.manualStart === null);
    const s = useLate ? LS.get(leaf)! : early;
    const f = useLate ? LF.get(leaf)! : earlyEnd;
    const slack = inCycle ? 0 : diffDaysMs(LS.get(leaf) ?? early, early);
    const row: PMScheduledRow = {
      startAt: new Date(s).toISOString(),
      finishAt: new Date(f).toISOString(),
      startMs: s,
      finishMs: f,
      durationDays: dur,
      isSummary: false,
      isMilestone: dur === 0,
      progress: clampProgress(task.rowProgress),
      totalFloatDays: Math.max(0, slack),
      isCritical: !inCycle && slack <= 0,
      inCycle,
      slackDays: slack,
      earlyStartMs: early,
      lateStartMs: LS.get(leaf) ?? early,
    };
    if (plan.manualStart !== null) row.isManual = true;
    else if (!plan.con.implicit) row.constraintType = plan.con.type;
    if (plan.delay > 0) row.levelingDelayDays = plan.delay;
    const cf = conflict.get(leaf);
    if (cf) {
      row.constraintConflict = cf;
      const eng = engine.get(leaf);
      if (eng !== undefined) row.engineStartMs = eng;
    }
    if (plan.splits.length && dur > 0) row.segments = splitSegments(s, dur, plan.splits, plan.cal);
    if (plan.ext.length) row.hasExternal = true;
    if (input.deadlineEnabled && json?.taskDeadline) {
      const dl = Date.parse(json.taskDeadline);
      if (Number.isFinite(dl)) {
        row.deadlineMs = utcMidnight(dl);
        row.deadlineMissed = (dur <= 0 ? s : f - DAY_MS) > row.deadlineMs;
      }
    }
    rows[leaf] = row;
  }

  // ---- roll up summaries (post-order) ---------------------------------------------------
  const rollUp = (guid: string): void => {
    if (!g.isSummary(guid)) return;
    const kids = tree.childrenById[guid];
    kids.forEach(rollUp);
    const task = g.byGUID.get(guid)!;
    let s = Infinity;
    let f = -Infinity;
    let weighted = 0;
    let weight = 0;
    let minFloat = Infinity;
    let minSlack = Infinity;
    let critical = false;
    let inCycle = false;
    let conflictKind: 'constraintWins' | 'linkWins' | undefined;
    for (const leaf of g.leavesUnder(guid)) {
      const r = rows[leaf];
      s = Math.min(s, r.startMs);
      f = Math.max(f, r.finishMs);
      const w = progressWeight(r.durationDays);
      weighted += r.progress * w;
      weight += w;
      minFloat = Math.min(minFloat, r.totalFloatDays);
      minSlack = Math.min(minSlack, r.slackDays ?? r.totalFloatDays);
      critical = critical || r.isCritical;
      inCycle = inCycle || r.inCycle;
      if (r.constraintConflict && !conflictKind) conflictKind = r.constraintConflict;
    }
    const leaves = g.leavesUnder(guid);
    const progress = weight > 0 ? weighted / weight : leaves.length ? leaves.reduce((a, l) => a + rows[l].progress, 0) / leaves.length : clampProgress(task.rowProgress);
    rows[guid] = {
      startAt: new Date(s).toISOString(),
      finishAt: new Date(f).toISOString(),
      startMs: s,
      finishMs: f,
      durationDays: workDaysBetween(s, f, baseCal),
      isSummary: true,
      isMilestone: false,
      progress: Math.round(progress * 10) / 10,
      totalFloatDays: minFloat === Infinity ? 0 : minFloat,
      isCritical: critical,
      inCycle,
      slackDays: minSlack === Infinity ? 0 : minSlack,
      ...(conflictKind ? { constraintConflict: conflictKind } : {}),
    };
  };
  for (const r of tree.childrenById[ROOT_KEY]) rollUp(r);

  // empty stages (no children yet) are leaves above; show them as a 1-day placeholder
  for (const t of planTasks) {
    if (t.rowJSON?.rowKind === 'stage' && !g.isSummary(t.rowGUID) && rows[t.rowGUID]) {
      rows[t.rowGUID].isSummary = true;
      rows[t.rowGUID].isMilestone = false;
    }
  }

  // A14 inactive rows: their own dates (start no earlier than / the project start, their duration), not part of any roll-up, critical path or progress
  for (const t of inactiveTasks) {
    const json = t.rowJSON as PMTaskJSON;
    const dur = durationOf(t);
    const con = constraintOf(json, false);
    const cal = ((json?.taskCalendarId as string | null | undefined) && input.calendars?.[json.taskCalendarId as string]) || baseCal;
    const s = nextWorkDay(Math.max(projectStartMs, con.dateMs ?? 0), cal);
    const f = addWorkDays(s, dur, cal);
    rows[t.rowGUID] = {
      startAt: new Date(s).toISOString(), finishAt: new Date(f).toISOString(), startMs: s, finishMs: f, durationDays: dur,
      isSummary: json?.rowKind === 'stage', isMilestone: dur === 0 && json?.rowKind !== 'stage', progress: clampProgress(t.rowProgress),
      totalFloatDays: 0, isCritical: false, inCycle: false, slackDays: 0, isInactive: true,
    };
  }

  const result: PMScheduleResult = { rows, projectStartMs, projectFinishMs, cycleGUIDs: cyclic };
  if (finishMode) result.projectStartInPast = projectStartMs < todayUTC();
  return result;
}

// =====================================================================================
// Progress formula (the SQL function pm_recalc_project_progress uses the same one):
//
//   progress(summary or project) = round1( Σ wᵢ·pᵢ / Σ wᵢ )   over its LEAF rows i
//   wᵢ = max(workingDaysᵢ, 1)      pᵢ = leaf progress 0..100
//
// = "duration-weighted earned progress": a 10-day task at 50% moves the project 10x more
// than a 1-day task at 50%. Milestones (0 days) still count as 1 day, so reaching one is
// visible. Empty stages are not leaves (they carry no work). No leaves -> 0.
// =====================================================================================

export function progressWeight(workingDays: number): number {
  const d = Number(workingDays);
  return Math.max(1, Number.isFinite(d) ? d : 0);
}

export function roundProgress(v: number): number {
  return Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
}

/** Project progress from the schedule rows (leaves only; see formula above). */
export function computeProjectProgress(rows: Record<string, PMScheduledRow>): number {
  let weighted = 0;
  let weight = 0;
  for (const r of Object.values(rows)) {
    if (r.isSummary || r.isInactive) continue;
    const w = progressWeight(r.durationDays);
    weighted += r.progress * w;
    weight += w;
  }
  return weight > 0 ? roundProgress(weighted / weight) : 0;
}

function clampProgress(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

// =====================================================================================
// Dependency validation (client-side mirror of pm_dependency_creates_cycle in SQL).
// =====================================================================================

export type PMDependencyProblem = 'self' | 'same-branch' | 'duplicate' | 'cycle' | 'missing' | null;

export function validateNewDependency(
  tasks: PMTaskRow[],
  deps: PMTaskDependencyRow[],
  predGUID: string,
  succGUID: string
): PMDependencyProblem {
  if (predGUID === succGUID) return 'self';
  const pred = tasks.find((t) => t.rowGUID === predGUID);
  const succ = tasks.find((t) => t.rowGUID === succGUID);
  if (!pred || !succ) return 'missing';
  if (areTreeRelated(pred, succ)) return 'same-branch';
  if (deps.some((d) => d.rowDependsOnGUID === predGUID && d.rowGUID === succGUID)) return 'duplicate';
  const probe: PMTaskDependencyRow = {
    rowGUID: succGUID,
    rowDependsOnGUID: predGUID,
    projectGUID: succ.projectGUID,
    rowOwnerGUID: succ.rowOwnerGUID,
    linkType: 'FS',
    lagDays: 0,
  };
  const tree = buildTreeIndex(tasks);
  const graph = buildLeafGraph(tasks, [...deps, probe], tree);
  const [, cyclic] = topoSort(graph.leaves, graph.edges);
  return cyclic.length ? 'cycle' : null;
}

export function describeDependencyProblem(p: PMDependencyProblem): string {
  switch (p) {
    case 'self':
      return 'A task cannot depend on itself.';
    case 'same-branch':
      return 'A row cannot depend on its own stage or on its own sub-rows.';
    case 'duplicate':
      return 'This dependency already exists.';
    case 'cycle':
      return 'This dependency would create a cycle.';
    case 'missing':
      return 'Task not found.';
    default:
      return '';
  }
}

/** Link type from the two bar ends a user connected (DHTMLX-style drag-to-link). */
export function linkTypeFromEnds(fromEnd: 'start' | 'finish', toEnd: 'start' | 'finish'): PMLinkType {
  return `${fromEnd === 'start' ? 'S' : 'F'}${toEnd === 'start' ? 'S' : 'F'}` as PMLinkType;
}

export const LINK_TYPES: PMLinkType[] = ['FS', 'SS', 'FF', 'SF'];
