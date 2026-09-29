// Pure scheduling core for the PM Gantt module: ltree paths, fractional ordering,
// UTC work-day calendar math, tree indexing and a full CPM pass (forward pass for
// dates, backward pass for total float / critical path) over a DAG of dependencies
// that may point at stages (summary rows) as well as tasks.
//
// No React / Supabase / Skia imports on purpose -> unit-testable and reusable on the
// UI thread-free side (the dashboard, the task info screen and the write-back hook).

import { DAY_MS } from './constants';
import { PMLinkType, PMScheduledRow, PMTaskDependencyRow, PMTaskRow } from './types';

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

export function isWorkDay(ms: number, cal: PMCalendar): boolean {
  if (!cal.skipWeekends) return true;
  const dow = new Date(ms).getUTCDay();
  return dow !== 0 && dow !== 6;
}

export function nextWorkDay(ms: number, cal: PMCalendar): number {
  let d = utcMidnight(ms);
  for (let guard = 0; guard < 14 && !isWorkDay(d, cal); guard++) d += DAY_MS;
  return d;
}

/** Exclusive finish of `n` working days starting at `startMs`. n = 0 -> startMs. */
export function addWorkDays(startMs: number, n: number, cal: PMCalendar): number {
  if (n <= 0) return startMs;
  if (!cal.skipWeekends) return startMs + n * DAY_MS;
  let d = startMs;
  let count = 0;
  while (count < n) {
    if (isWorkDay(d, cal)) count++;
    d += DAY_MS;
  }
  return d;
}

/** Inverse of addWorkDays: the start that makes `n` working days end at `finishMs`. */
export function subtractWorkDays(finishMs: number, n: number, cal: PMCalendar): number {
  if (n <= 0) return finishMs;
  if (!cal.skipWeekends) return finishMs - n * DAY_MS;
  let d = finishMs;
  let count = 0;
  while (count < n) {
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
  if (!cal.skipWeekends) return Math.round((finishMs - startMs) / DAY_MS);
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
    return ta.orderInList - tb.orderInList || (ta.rowJSON?.name || '').localeCompare(tb.rowJSON?.name || '');
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
}

export interface PMScheduleResult {
  rows: Record<string, PMScheduledRow>;
  projectStartMs: number;
  projectFinishMs: number;
  cycleGUIDs: string[];
}

interface LeafEdge {
  from: string; // predecessor leaf
  to: string; // successor leaf
  type: PMLinkType;
  lag: number;
}

function durationOf(task: PMTaskRow): number {
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
function buildLeafGraph(tasks: PMTaskRow[], deps: PMTaskDependencyRow[], tree: PMTreeIndex) {
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
  const constraintsByLeaf = new Map<string, PMTaskDependencyRow[]>();
  const edges: LeafEdge[] = [];
  for (const leaf of leaves) {
    const cons: PMTaskDependencyRow[] = [];
    for (let g: string | null = leaf; g; g = tree.parentById[g] ?? null) {
      for (const d of depsBySucc.get(g) || []) {
        const pred = byGUID.get(d.rowDependsOnGUID)!;
        if (areTreeRelated(pred, byGUID.get(leaf)!)) continue;
        cons.push(d);
      }
    }
    constraintsByLeaf.set(leaf, cons);
    for (const c of cons) {
      for (const pl of leavesUnder(c.rowDependsOnGUID)) {
        if (pl !== leaf) edges.push({ from: pl, to: leaf, type: c.linkType || 'FS', lag: Number(c.lagDays) || 0 });
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

export function scheduleProject(input: PMScheduleInput): PMScheduleResult {
  const cal = input.calendar ?? DEFAULT_CALENDAR;
  const projectStartMs = nextWorkDay(utcMidnight(input.projectStartMs), cal);
  const tree = buildTreeIndex(input.tasks);
  const g = buildLeafGraph(input.tasks, input.deps, tree);
  const [topo, cyclic] = topoSort(g.leaves, g.edges);
  const cycleSet = new Set(cyclic);

  const ES = new Map<string, number>();
  const EF = new Map<string, number>();

  const aggregate = (guid: string): [number, number] | null => {
    if (!g.isSummary(guid)) {
      return ES.has(guid) ? [ES.get(guid)!, EF.get(guid)!] : null;
    }
    let s = Infinity;
    let f = -Infinity;
    for (const l of g.leavesUnder(guid)) {
      if (!ES.has(l)) continue;
      s = Math.min(s, ES.get(l)!);
      f = Math.max(f, EF.get(l)!);
    }
    return s === Infinity ? null : [s, f];
  };

  // ---- forward pass -----------------------------------------------------------------
  for (const leaf of [...topo, ...cyclic]) {
    const task = g.byGUID.get(leaf)!;
    const dur = durationOf(task);
    let es = projectStartMs;
    const manual = task.rowJSON?.manualStartAt ? Date.parse(task.rowJSON.manualStartAt) : NaN;
    if (Number.isFinite(manual)) es = Math.max(es, utcMidnight(manual));

    for (const c of g.constraintsByLeaf.get(leaf) || []) {
      const agg = aggregate(c.rowDependsOnGUID);
      if (!agg) continue; // predecessor not scheduled yet (only inside a cycle)
      const [ps, pf] = agg;
      const lag = Number(c.lagDays) || 0;
      switch (c.linkType || 'FS') {
        case 'FS':
          es = Math.max(es, shiftWorkDays(pf, lag, cal));
          break;
        case 'SS':
          es = Math.max(es, shiftWorkDays(ps, lag, cal));
          break;
        case 'FF':
          es = Math.max(es, subtractWorkDays(shiftWorkDays(pf, lag, cal), dur, cal));
          break;
        case 'SF':
          es = Math.max(es, subtractWorkDays(shiftWorkDays(ps, lag, cal), dur, cal));
          break;
      }
    }
    es = nextWorkDay(es, cal);
    ES.set(leaf, es);
    EF.set(leaf, addWorkDays(es, dur, cal));
  }

  let projectFinishMs = projectStartMs;
  for (const f of EF.values()) projectFinishMs = Math.max(projectFinishMs, f);

  // ---- backward pass (total float / critical path) -------------------------------------
  const LF = new Map<string, number>();
  const LS = new Map<string, number>();
  const outEdges = new Map<string, LeafEdge[]>();
  for (const e of g.edges) {
    if (!outEdges.has(e.from)) outEdges.set(e.from, []);
    outEdges.get(e.from)!.push(e);
  }
  for (let i = topo.length - 1; i >= 0; i--) {
    const leaf = topo[i];
    const dur = durationOf(g.byGUID.get(leaf)!);
    let lf = projectFinishMs;
    for (const e of outEdges.get(leaf) || []) {
      if (!LS.has(e.to)) continue;
      const sLS = LS.get(e.to)!;
      const sLF = LF.get(e.to)!;
      switch (e.type) {
        case 'FS':
          lf = Math.min(lf, shiftWorkDays(sLS, -e.lag, cal));
          break;
        case 'SS':
          lf = Math.min(lf, addWorkDays(shiftWorkDays(sLS, -e.lag, cal), dur, cal));
          break;
        case 'FF':
          lf = Math.min(lf, shiftWorkDays(sLF, -e.lag, cal));
          break;
        case 'SF':
          lf = Math.min(lf, addWorkDays(shiftWorkDays(sLF, -e.lag, cal), dur, cal));
          break;
      }
    }
    LF.set(leaf, lf);
    LS.set(leaf, subtractWorkDays(lf, dur, cal));
  }

  // ---- assemble leaves ----------------------------------------------------------------
  const rows: Record<string, PMScheduledRow> = {};
  for (const leaf of g.leaves) {
    const task = g.byGUID.get(leaf)!;
    const s = ES.get(leaf)!;
    const f = EF.get(leaf)!;
    const inCycle = cycleSet.has(leaf);
    const floatDays = inCycle ? 0 : Math.max(0, diffDaysMs(LS.get(leaf) ?? s, s));
    const dur = durationOf(task);
    rows[leaf] = {
      startAt: new Date(s).toISOString(),
      finishAt: new Date(f).toISOString(),
      startMs: s,
      finishMs: f,
      durationDays: dur,
      isSummary: false,
      isMilestone: dur === 0,
      progress: clampProgress(task.rowProgress),
      totalFloatDays: floatDays,
      isCritical: !inCycle && floatDays <= 0,
      inCycle,
    };
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
    let critical = false;
    let inCycle = false;
    for (const leaf of g.leavesUnder(guid)) {
      const r = rows[leaf];
      s = Math.min(s, r.startMs);
      f = Math.max(f, r.finishMs);
      const w = progressWeight(r.durationDays);
      weighted += r.progress * w;
      weight += w;
      minFloat = Math.min(minFloat, r.totalFloatDays);
      critical = critical || r.isCritical;
      inCycle = inCycle || r.inCycle;
    }
    const leaves = g.leavesUnder(guid);
    const progress = weight > 0 ? weighted / weight : leaves.length ? leaves.reduce((a, l) => a + rows[l].progress, 0) / leaves.length : clampProgress(task.rowProgress);
    rows[guid] = {
      startAt: new Date(s).toISOString(),
      finishAt: new Date(f).toISOString(),
      startMs: s,
      finishMs: f,
      durationDays: workDaysBetween(s, f, cal),
      isSummary: true,
      isMilestone: false,
      progress: Math.round(progress * 10) / 10,
      totalFloatDays: minFloat === Infinity ? 0 : minFloat,
      isCritical: critical,
      inCycle,
    };
  };
  for (const r of tree.childrenById[ROOT_KEY]) rollUp(r);

  // empty stages (no children yet) are leaves above; show them as a 1-day placeholder
  for (const t of input.tasks) {
    if (t.rowJSON?.rowKind === 'stage' && !g.isSummary(t.rowGUID) && rows[t.rowGUID]) {
      rows[t.rowGUID].isSummary = true;
      rows[t.rowGUID].isMilestone = false;
    }
  }

  return { rows, projectStartMs, projectFinishMs, cycleGUIDs: cyclic };
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
    if (r.isSummary) continue;
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
