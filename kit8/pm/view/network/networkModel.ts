// Pure model of the network view (no React): turns the scheduled project (store.schedule,
// the same CPM result the Gantt draws) into
//   1. an ACTIVITY NETWORK  (activity-on-node, AON / PDM)  -> PMNetworkDiagram
//   2. an EVENT NETWORK     (activity-on-arrow, AOA)       -> PMNetworkSchedule
// plus two layouts: a layered (Sugiyama-style) layout and a time-scaled layout.
//
// Units: every ES / EF / LS / LF / event time is a WORKING-DAY offset from the project
// start, 0-based, finish exclusive (EF = ES + D) - the modern PMBOK / MS Project convention.
// Dates (ms) are kept alongside for tips and the info card.

import { DAY_MS } from '../../model/constants';
import { areTreeRelated, flattenAll, PMCalendar, PMTreeIndex, ROOT_KEY, workDaysBetween } from '../project/scheduling';
import { PMDepRef, PMLinkType, PMScheduledRow, PMTaskDependencyRow, PMTaskRow, taskColorOf } from '../../model/types';

export const NET_START = '__net_start__';
export const NET_FINISH = '__net_finish__';

// =====================================================================================
// 1. Activity network (AON)
// =====================================================================================

export interface PMNetActivity {
  guid: string;
  name: string;
  kind: 'task' | 'milestone';
  /** outline number from the tree, e.g. "2.1.3" */
  wbs: string;
  /** 1-based index among the activities (tree order) - the "ID" of the classic node box */
  seq: number;
  stageGUID: string | null;
  stageName: string | null;
  color: string | null;
  duration: number;
  es: number;
  ef: number;
  ls: number;
  lf: number;
  /** total float (working days) = LS - ES */
  tf: number;
  startMs: number;
  finishMs: number;
  lateStartMs: number;
  lateFinishMs: number;
  progress: number;
  critical: boolean;
  inCycle: boolean;
}

export interface PMNetLink {
  id: string;
  /** activity guid or NET_START */
  from: string;
  /** activity guid or NET_FINISH */
  to: string;
  type: PMLinkType;
  lag: number;
  /** the stored dependency behind the link (null for the Start / Finish connectors) */
  ref: PMDepRef | null;
  /** the dependency is set on a stage and was expanded to the stage's leaves */
  viaStage: boolean;
  /** Start / Finish connector (not a stored dependency) */
  virtual: boolean;
  critical: boolean;
}

export interface PMActivityNetwork {
  activities: PMNetActivity[];
  byGUID: Record<string, PMNetActivity>;
  links: PMNetLink[];
  /** working days from the project start to the project finish */
  projectDuration: number;
  projectStartMs: number;
  projectFinishMs: number;
}

export interface PMActivityNetworkInput {
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
  tree: PMTreeIndex;
  schedule: Record<string, PMScheduledRow>;
  projectStartMs: number;
  projectFinishMs: number;
  calendar: PMCalendar;
}

export function linkLabel(type: PMLinkType, lag: number): string {
  const l = lag > 0 ? `+${lag}` : lag < 0 ? `${lag}` : '';
  return type === 'FS' && !l ? '' : `${type}${l}`;
}

/** Slack of one precedence relation (0 = driving). */
function linkSlack(a: PMNetActivity, b: PMNetActivity, type: PMLinkType, lag: number): number {
  switch (type) {
    case 'SS':
      return b.es - a.es - lag;
    case 'FF':
      return b.ef - a.ef - lag;
    case 'SF':
      return b.ef - a.es - lag;
    default:
      return b.es - a.ef - lag;
  }
}

export function buildActivityNetwork(input: PMActivityNetworkInput): PMActivityNetwork {
  const { tasks, deps, tree, schedule, calendar } = input;
  const ps = input.projectStartMs;
  const off = (ms: number) => (ms >= ps ? workDaysBetween(ps, ms, calendar) : -workDaysBetween(ms, ps, calendar));
  const byTask = new Map(tasks.map((t) => [t.rowGUID, t]));
  const hasKids = (g: string) => (tree.childrenById[g]?.length ?? 0) > 0;

  // outline numbers
  const wbs: Record<string, string> = {};
  const number = (parent: string, prefix: string) => {
    (tree.childrenById[parent] || []).forEach((g, i) => {
      wbs[g] = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      number(g, wbs[g]);
    });
  };
  number(ROOT_KEY, '');

  const order = flattenAll(tree);
  const activities: PMNetActivity[] = [];
  const byGUID: Record<string, PMNetActivity> = {};
  for (const g of order) {
    const t = byTask.get(g);
    const r = schedule[g];
    if (!t || !r || hasKids(g) || t.rowJSON.rowKind === 'stage') continue; // leaves only, no empty stages
    const tfCal = Math.max(0, r.totalFloatDays || 0);
    const lateStartMs = r.startMs + tfCal * DAY_MS;
    const lateFinishMs = r.finishMs + tfCal * DAY_MS;
    const es = off(r.startMs);
    const ef = Math.max(es, off(r.finishMs));
    const ls = off(lateStartMs);
    const lf = Math.max(ls, off(lateFinishMs));
    const parent = tree.parentById[g] ?? null;
    const a: PMNetActivity = {
      guid: g,
      name: t.rowJSON.name || '(unnamed)',
      kind: r.isMilestone || t.rowJSON.rowKind === 'milestone' ? 'milestone' : 'task',
      wbs: wbs[g] || '',
      seq: activities.length + 1,
      stageGUID: parent,
      stageName: parent ? (byTask.get(parent)?.rowJSON.name ?? null) : null,
      color: taskColorOf(t.rowJSON),
      duration: r.durationDays,
      es,
      ef,
      ls,
      lf,
      tf: Math.max(0, ls - es),
      startMs: r.startMs,
      finishMs: r.finishMs,
      lateStartMs,
      lateFinishMs,
      progress: r.progress,
      critical: r.isCritical,
      inCycle: r.inCycle,
    };
    activities.push(a);
    byGUID[g] = a;
  }

  // ---- links: stored dependencies, a stage end stands for its leaves --------------------
  const leavesMemo = new Map<string, string[]>();
  const leavesUnder = (g: string): string[] => {
    const hit = leavesMemo.get(g);
    if (hit) return hit;
    const res = hasKids(g) ? tree.childrenById[g].flatMap(leavesUnder) : byGUID[g] ? [g] : [];
    leavesMemo.set(g, res);
    return res;
  };
  const links: PMNetLink[] = [];
  const seen = new Set<string>();
  for (const d of deps) {
    const succ = byTask.get(d.rowGUID);
    const pred = byTask.get(d.rowDependsOnGUID);
    if (!succ || !pred || areTreeRelated(succ, pred)) continue;
    const viaStage = hasKids(pred.rowGUID) || hasKids(succ.rowGUID);
    const type = (d.linkType || 'FS') as PMLinkType;
    const lag = Number(d.lagDays) || 0;
    for (const from of leavesUnder(pred.rowGUID)) {
      for (const to of leavesUnder(succ.rowGUID)) {
        const key = `${from}>${to}`;
        if (from === to || seen.has(key)) continue;
        seen.add(key);
        links.push({ id: key, from, to, type, lag, ref: { rowGUID: d.rowGUID, dependsOnGUID: d.rowDependsOnGUID }, viaStage, virtual: false, critical: false });
      }
    }
  }

  // stage links expand to every leaf pair: drop the ones implied by a longer path
  // (transitive reduction of the expanded edges only - direct task links always stay)
  if (links.some((l) => l.viaStage)) {
    const out = new Map<string, PMNetLink[]>();
    for (const l of links) (out.get(l.from) || out.set(l.from, []).get(l.from)!).push(l);
    const reachesWithout = (from: string, to: string, skip: PMNetLink): boolean => {
      const stack = [from];
      const visited = new Set<string>([from]);
      while (stack.length) {
        const n = stack.pop()!;
        for (const l of out.get(n) || []) {
          if (l === skip || l.to === from) continue;
          if (l.to === to) return true;
          if (!visited.has(l.to)) {
            visited.add(l.to);
            stack.push(l.to);
          }
        }
      }
      return false;
    };
    const drop = new Set<PMNetLink>();
    for (const l of links) if (l.viaStage && reachesWithout(l.from, l.to, l)) drop.add(l);
    if (drop.size) {
      const kept = links.filter((l) => !drop.has(l));
      links.length = 0;
      links.push(...kept);
    }
  }

  for (const l of links) {
    const a = byGUID[l.from];
    const b = byGUID[l.to];
    l.critical = a.critical && b.critical && linkSlack(a, b, l.type, l.lag) <= 0;
  }

  const projectDuration = Math.max(off(input.projectFinishMs), ...activities.map((a) => a.ef), 0);

  // ---- Start / Finish connectors ---------------------------------------------------------
  const hasIn = new Set(links.map((l) => l.to));
  const hasOut = new Set(links.map((l) => l.from));
  for (const a of activities) {
    if (!hasIn.has(a.guid)) {
      links.push({
        id: `${NET_START}>${a.guid}`,
        from: NET_START,
        to: a.guid,
        type: 'FS',
        lag: 0,
        ref: null,
        viaStage: false,
        virtual: true,
        critical: a.critical && a.es === 0,
      });
    }
    if (!hasOut.has(a.guid)) {
      links.push({
        id: `${a.guid}>${NET_FINISH}`,
        from: a.guid,
        to: NET_FINISH,
        type: 'FS',
        lag: 0,
        ref: null,
        viaStage: false,
        virtual: true,
        critical: a.critical && a.ef === projectDuration,
      });
    }
  }

  return { activities, byGUID, links, projectDuration, projectStartMs: ps, projectFinishMs: input.projectFinishMs };
}

/** All activities upstream / downstream of one activity (for the hover / selection highlight). */
export function relatedActivities(net: PMActivityNetwork, guid: string): Set<string> {
  const res = new Set<string>([guid]);
  const walk = (dir: 'up' | 'down') => {
    const stack = [guid];
    while (stack.length) {
      const n = stack.pop()!;
      for (const l of net.links) {
        const next = dir === 'down' ? (l.from === n ? l.to : null) : l.to === n ? l.from : null;
        if (next && !res.has(next)) {
          res.add(next);
          stack.push(next);
        }
      }
    }
  };
  walk('up');
  walk('down');
  return res;
}

// =====================================================================================
// 2. Event network (AOA): events = circles, activities = arrows, dummies = dashed arrows
// =====================================================================================

export const EV_START = 'S';
export const EV_FINISH = 'F';

export interface PMNetEvent {
  id: string;
  /** Fulkerson number: every arrow goes from a lower to a higher number */
  number: number;
  /** early time T^ES (working days) */
  early: number;
  /** late time T^LF */
  late: number;
  /** event slack = late - early */
  reserve: number;
  /** number of the event the early time comes from (bottom sector of the circle) */
  predNumber: number | null;
  predEventId: string | null;
  critical: boolean;
}

export interface PMNetArrow {
  id: string;
  from: string;
  to: string;
  kind: 'activity' | 'dummy';
  /** activity arrows */
  activityGUID?: string;
  /** dummy arrows: non-FS type / lag, e.g. "SS+2" */
  label?: string;
  /** the dependency behind a dummy arrow (only when it maps to exactly one) */
  ref?: PMDepRef | null;
  critical: boolean;
  /** activity arrows: event(to).early - EF (free float, drawn dotted in the time-scaled view) */
  freeFloat: number;
}

export interface PMEventNetwork {
  events: PMNetEvent[];
  eventsById: Record<string, PMNetEvent>;
  arrows: PMNetArrow[];
}

export function buildEventNetwork(net: PMActivityNetwork): PMEventNetwork {
  const acts = net.activities;
  if (!acts.length) return { events: [], eventsById: {}, arrows: [] };
  const endOf = (g: string) => `E:${g}`;
  const real = net.links.filter((l) => !l.virtual);
  const predsOf = new Map<string, PMNetLink[]>();
  const succCount = new Map<string, number>();
  for (const l of real) {
    (predsOf.get(l.to) || predsOf.set(l.to, []).get(l.to)!).push(l);
    succCount.set(l.from, (succCount.get(l.from) || 0) + 1);
  }

  interface A {
    id: string;
    from: string;
    to: string;
    kind: 'activity' | 'dummy';
    activityGUID?: string;
    label?: string;
    ref?: PMDepRef | null;
  }
  let arrows: A[] = [];
  const dummyKeys = new Set<string>();
  const addDummy = (from: string, to: string, label?: string, ref?: PMDepRef | null) => {
    const key = `${from}>${to}`;
    if (dummyKeys.has(key)) return;
    dummyKeys.add(key);
    arrows.push({ id: `d:${key}`, from, to, kind: 'dummy', label: label || undefined, ref: ref ?? null });
  };

  for (const a of acts) {
    const preds = predsOf.get(a.guid) || [];
    let tail = EV_START;
    if (preds.length === 1 && preds[0].type === 'FS' && preds[0].lag === 0) {
      tail = endOf(preds[0].from);
    } else if (preds.length) {
      const key = preds
        .map((p) => `${p.from}|${p.type}|${p.lag}`)
        .sort()
        .join(',');
      tail = `N:${key}`;
      for (const p of preds) addDummy(endOf(p.from), tail, linkLabel(p.type, p.lag), p.ref);
    }
    arrows.push({ id: `a:${a.guid}`, from: tail, to: endOf(a.guid), kind: 'activity', activityGUID: a.guid });
    if (!succCount.get(a.guid)) addDummy(endOf(a.guid), EV_FINISH);
  }

  // ---- simplification: drop redundant dummies, contract the rest where it is exact -----
  const outOf = (v: string) => arrows.filter((x) => x.from === v);
  const inOf = (v: string) => arrows.filter((x) => x.to === v);
  const reaches = (from: string, to: string, skip: A) => {
    const stack = [from];
    const seen = new Set([from]);
    while (stack.length) {
      const n = stack.pop()!;
      for (const x of arrows) {
        if (x === skip || x.from !== n) continue;
        if (x.to === to) return true;
        if (!seen.has(x.to)) {
          seen.add(x.to);
          stack.push(x.to);
        }
      }
    }
    return false;
  };
  const merge = (u: string, v: string) => {
    // keep S / F ids so the ends stay recognizable
    const keep = u === EV_START || u === EV_FINISH ? u : v;
    const gone = keep === u ? v : u;
    arrows = arrows.map((x) => ({ ...x, from: x.from === gone ? keep : x.from, to: x.to === gone ? keep : x.to }));
  };
  const parallelAfterMerge = (u: string, v: string) => {
    const ends = new Set<string>();
    const starts = new Set<string>();
    for (const x of arrows) {
      if (x.from === u && x.to === v) continue;
      const f = x.from === u || x.from === v ? '*' : x.from;
      const t = x.to === u || x.to === v ? '*' : x.to;
      const k = `${f}>${t}`;
      if (f === '*' && t === '*') return true; // would become a loop
      if (f === '*') {
        if (starts.has(k)) return true;
        starts.add(k);
      }
      if (t === '*') {
        if (ends.has(k)) return true;
        ends.add(k);
      }
    }
    return false;
  };

  let changed = true;
  for (let guard = 0; changed && guard < 10000; guard++) {
    changed = false;
    // critical activities first: the dummy should end up on the parallel non-critical branch
    const critEnd = (d: A) => arrows.some((x) => x.to === d.from && x.activityGUID && net.byGUID[x.activityGUID].critical);
    const dummies = arrows.filter((x) => x.kind === 'dummy').sort((a, b) => Number(critEnd(b)) - Number(critEnd(a)));
    for (const d of dummies) {
      if (reaches(d.from, d.to, d)) {
        arrows = arrows.filter((x) => x !== d);
        changed = true;
        break;
      }
      if (d.label) continue; // a labelled dummy carries information (type / lag)
      const exact = outOf(d.from).length === 1 || inOf(d.to).length === 1;
      if (exact && !(d.from === EV_START && d.to === EV_FINISH) && !parallelAfterMerge(d.from, d.to)) {
        arrows = arrows.filter((x) => x !== d);
        merge(d.from, d.to);
        changed = true;
        break;
      }
    }
  }

  // ---- event times (from the real CPM schedule) ------------------------------------------
  const ids = Array.from(new Set(arrows.flatMap((x) => [x.from, x.to])));
  const outs = new Map<string, A[]>();
  const ins = new Map<string, A[]>();
  for (const id of ids) {
    outs.set(id, []);
    ins.set(id, []);
  }
  for (const x of arrows) {
    outs.get(x.from)!.push(x);
    ins.get(x.to)!.push(x);
  }
  // topological order (ties: earliest first, then tree order)
  const treeIdx = (id: string) => {
    let best = Infinity;
    for (const x of outs.get(id)!) if (x.activityGUID) best = Math.min(best, net.byGUID[x.activityGUID].seq);
    for (const x of ins.get(id)!) if (x.activityGUID) best = Math.min(best, net.byGUID[x.activityGUID].seq + 0.5);
    return id === EV_START ? -1 : id === EV_FINISH ? Infinity : best;
  };
  const early: Record<string, number> = {};
  const pred: Record<string, string | null> = {};
  const indeg = new Map(ids.map((id) => [id, ins.get(id)!.length]));
  const ready = ids.filter((id) => indeg.get(id) === 0);
  const topo: string[] = [];
  for (const id of ids) {
    early[id] = 0;
    pred[id] = null;
  }
  while (ready.length) {
    let bi = 0;
    for (let i = 1; i < ready.length; i++) {
      const a = ready[i];
      const b = ready[bi];
      if (early[a] < early[b] || (early[a] === early[b] && treeIdx(a) < treeIdx(b))) bi = i;
    }
    const u = ready.splice(bi, 1)[0];
    topo.push(u);
    for (const x of outs.get(u)!) {
      const act = x.activityGUID ? net.byGUID[x.activityGUID] : null;
      const t = act ? act.ef : early[u];
      if (t > early[x.to] || pred[x.to] === null) {
        early[x.to] = Math.max(early[x.to], t);
        pred[x.to] = u;
      }
      const left = indeg.get(x.to)! - 1;
      indeg.set(x.to, left);
      if (left === 0) ready.push(x.to);
    }
  }
  for (const id of ids) if (!topo.includes(id)) topo.push(id); // cycles: never expected here
  const late: Record<string, number> = {};
  for (let i = topo.length - 1; i >= 0; i--) {
    const u = topo[i];
    let l = Infinity;
    for (const x of outs.get(u)!) {
      const act = x.activityGUID ? net.byGUID[x.activityGUID] : null;
      l = Math.min(l, act ? act.ls : (late[x.to] ?? net.projectDuration));
    }
    late[u] = l === Infinity ? net.projectDuration : l;
  }
  // an event can never be later than it is early (rounding / constraints)
  for (const id of ids) late[id] = Math.max(late[id], early[id]);

  const number: Record<string, number> = {};
  topo.forEach((id, i) => (number[id] = i + 1));
  const events: PMNetEvent[] = topo.map((id) => ({
    id,
    number: number[id],
    early: early[id],
    late: late[id],
    reserve: late[id] - early[id],
    predEventId: pred[id],
    predNumber: pred[id] ? number[pred[id]!] : null,
    critical: late[id] - early[id] <= 0,
  }));
  const eventsById: Record<string, PMNetEvent> = {};
  for (const e of events) eventsById[e.id] = e;

  const outArrows: PMNetArrow[] = arrows.map((x) => {
    const act = x.activityGUID ? net.byGUID[x.activityGUID] : null;
    const u = eventsById[x.from];
    const v = eventsById[x.to];
    return {
      id: x.id,
      from: x.from,
      to: x.to,
      kind: x.kind,
      activityGUID: x.activityGUID,
      label: x.label,
      ref: x.ref ?? null,
      critical: act ? act.critical : u.critical && v.critical && v.early === u.early,
      freeFloat: act ? Math.max(0, v.early - act.ef) : 0,
    };
  });
  // arrows sorted by their tail number (stable drawing order)
  outArrows.sort((a, b) => number[a.from] - number[b.from] || number[a.to] - number[b.to]);
  return { events, eventsById, arrows: outArrows };
}

// =====================================================================================
// 3. Layered layout (left -> right): longest-path layers, dummy points for long edges,
//    barycenter crossing reduction, isotonic (PAVA) vertical placement
// =====================================================================================

export interface PMLayoutNodeIn {
  id: string;
  w: number;
  h: number;
  /** initial vertical order key (tree order) */
  rank: number;
}
export interface PMLayoutEdgeIn {
  id: string;
  from: string;
  to: string;
}
export interface PMLayoutBox {
  x: number;
  y: number;
  w: number;
  h: number;
  layer: number;
}
export interface PMLayoutResult {
  nodes: Record<string, PMLayoutBox>;
  /** polyline per edge: source port, bend points (dummy nodes), target port */
  edges: Record<string, [number, number][]>;
  width: number;
  height: number;
}
export interface PMLayoutOptions {
  gapX: number;
  gapY: number;
  margin: number;
  /** height reserved for an edge passing through a layer */
  dummyH?: number;
  sweeps?: number;
}

interface LNode {
  id: string;
  w: number;
  h: number;
  rank: number;
  layer: number;
  dummy: boolean;
  pos: number;
  y: number;
}

export function layeredLayout(nodesIn: PMLayoutNodeIn[], edgesIn: PMLayoutEdgeIn[], opt: PMLayoutOptions): PMLayoutResult {
  const dummyH = opt.dummyH ?? 10;
  const nodes = new Map<string, LNode>();
  for (const n of nodesIn) nodes.set(n.id, { id: n.id, w: n.w, h: n.h, rank: n.rank, layer: 0, dummy: false, pos: 0, y: 0 });
  const edges = edgesIn.filter((e) => nodes.has(e.from) && nodes.has(e.to) && e.from !== e.to);

  // ---- layers: longest path from the sources (cycle-safe) ----
  const indeg = new Map<string, number>();
  const out = new Map<string, string[]>();
  for (const id of nodes.keys()) {
    indeg.set(id, 0);
    out.set(id, []);
  }
  for (const e of edges) {
    indeg.set(e.to, indeg.get(e.to)! + 1);
    out.get(e.from)!.push(e.to);
  }
  const queue = [...nodes.keys()].filter((id) => indeg.get(id) === 0);
  const done = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    done.add(id);
    for (const t of out.get(id)!) {
      nodes.get(t)!.layer = Math.max(nodes.get(t)!.layer, nodes.get(id)!.layer + 1);
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  // nodes caught in a cycle: after their processed predecessors
  for (const n of nodes.values()) if (!done.has(n.id)) n.layer = Math.max(n.layer, 1);
  // ---- dummy chains for edges spanning several layers ----
  const chains = new Map<string, string[]>(); // edge id -> node ids along the edge
  const segs: { from: string; to: string }[] = [];
  for (const e of edges) {
    const a = nodes.get(e.from)!;
    const b = nodes.get(e.to)!;
    const chain = [e.from];
    if (b.layer - a.layer > 1) {
      for (let l = a.layer + 1; l < b.layer; l++) {
        const id = `${e.id}#${l}`;
        nodes.set(id, { id, w: 0, h: dummyH, rank: a.rank + (b.rank - a.rank) * ((l - a.layer) / (b.layer - a.layer)), layer: l, dummy: true, pos: 0, y: 0 });
        chain.push(id);
      }
    }
    chain.push(e.to);
    chains.set(e.id, chain);
    for (let i = 0; i + 1 < chain.length; i++) if (nodes.get(chain[i])!.layer < nodes.get(chain[i + 1])!.layer) segs.push({ from: chain[i], to: chain[i + 1] });
  }

  const layerCount = Math.max(0, ...[...nodes.values()].map((n) => n.layer)) + 1;
  const layers: LNode[][] = Array.from({ length: layerCount }, () => []);
  for (const n of nodes.values()) layers[n.layer].push(n);
  for (const L of layers) {
    L.sort((a, b) => a.rank - b.rank);
    L.forEach((n, i) => (n.pos = i));
  }
  const predsOf = new Map<string, LNode[]>();
  const succsOf = new Map<string, LNode[]>();
  for (const id of nodes.keys()) {
    predsOf.set(id, []);
    succsOf.set(id, []);
  }
  for (const s of segs) {
    predsOf.get(s.to)!.push(nodes.get(s.from)!);
    succsOf.get(s.from)!.push(nodes.get(s.to)!);
  }

  // ---- crossing reduction: barycenter sweeps, keep the best ordering ----
  const crossings = () => {
    let c = 0;
    for (let l = 0; l + 1 < layerCount; l++) {
      const pairs: [number, number][] = [];
      for (const n of layers[l]) for (const s of succsOf.get(n.id)!) pairs.push([n.pos, s.pos]);
      for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) if ((pairs[i][0] - pairs[j][0]) * (pairs[i][1] - pairs[j][1]) < 0) c++;
    }
    return c;
  };
  const snapshot = () => layers.map((L) => L.map((n) => n.id));
  let best = snapshot();
  let bestC = crossings();
  const sweeps = opt.sweeps ?? 8;
  for (let s = 0; s < sweeps && bestC > 0; s++) {
    const down = s % 2 === 0;
    const range = down ? [...Array(layerCount).keys()].slice(1) : [...Array(layerCount).keys()].reverse().slice(1);
    for (const l of range) {
      const L = layers[l];
      const key = new Map<LNode, number>();
      for (const n of L) {
        const nb = down ? predsOf.get(n.id)! : succsOf.get(n.id)!;
        key.set(n, nb.length ? nb.reduce((a, m) => a + m.pos, 0) / nb.length : n.pos);
      }
      L.sort((a, b) => key.get(a)! - key.get(b)! || a.pos - b.pos);
      L.forEach((n, i) => (n.pos = i));
    }
    const c = crossings();
    if (c < bestC) {
      bestC = c;
      best = snapshot();
    }
  }
  best.forEach((ids, l) => {
    layers[l] = ids.map((id) => nodes.get(id)!);
    layers[l].forEach((n, i) => (n.pos = i));
  });

  // ---- vertical placement: each node wants the mean center of its neighbours; order and
  //      spacing are kept with an isotonic regression (pool-adjacent-violators) ----
  for (const L of layers) {
    let y = 0;
    for (const n of L) {
      n.y = y;
      y += n.h + opt.gapY;
    }
  }
  const center = (n: LNode) => n.y + n.h / 2;
  const place = (L: LNode[], desired: number[]) => {
    // offsets: minimal cumulative spacing, so q_i = y_i - off_i must be non-decreasing
    const offs: number[] = [];
    let acc = 0;
    L.forEach((n, i) => {
      offs.push(acc);
      acc += n.h + (n.dummy && L[i + 1]?.dummy ? opt.gapY / 3 : opt.gapY);
    });
    const blocks: { sum: number; cnt: number; start: number }[] = [];
    desired.forEach((d, i) => {
      blocks.push({ sum: d - offs[i], cnt: 1, start: i });
      while (
        blocks.length > 1 &&
        blocks[blocks.length - 2].sum / blocks[blocks.length - 2].cnt > blocks[blocks.length - 1].sum / blocks[blocks.length - 1].cnt
      ) {
        const b = blocks.pop()!;
        const a = blocks[blocks.length - 1];
        a.sum += b.sum;
        a.cnt += b.cnt;
      }
    });
    for (const b of blocks) for (let i = b.start; i < b.start + b.cnt; i++) L[i].y = b.sum / b.cnt + offs[i];
  };
  for (let it = 0; it < 8; it++) {
    const down = it % 2 === 0;
    const order = down ? [...Array(layerCount).keys()] : [...Array(layerCount).keys()].reverse();
    for (const l of order) {
      const L = layers[l];
      const desired = L.map((n) => {
        const nb = [...(down || it > 5 ? predsOf.get(n.id)! : []), ...(!down || it > 5 ? succsOf.get(n.id)! : [])];
        return (nb.length ? nb.reduce((a, m) => a + center(m), 0) / nb.length : center(n)) - n.h / 2;
      });
      place(L, desired);
    }
  }

  // ---- x per layer, normalize ----
  const layerW = layers.map((L) => Math.max(0, ...L.map((n) => n.w)));
  const layerX: number[] = [];
  let x = opt.margin;
  layerW.forEach((w, l) => {
    layerX[l] = x;
    x += (w || 0) + opt.gapX;
  });
  const minY = Math.min(...[...nodes.values()].map((n) => n.y));
  let maxY = 0;
  const outNodes: Record<string, PMLayoutBox> = {};
  for (const n of nodes.values()) {
    n.y = n.y - minY + opt.margin;
    maxY = Math.max(maxY, n.y + n.h);
    if (!n.dummy) outNodes[n.id] = { x: layerX[n.layer] + (layerW[n.layer] - n.w) / 2, y: n.y, w: n.w, h: n.h, layer: n.layer };
  }
  const outEdges: Record<string, [number, number][]> = {};
  for (const e of edges) {
    const chain = chains.get(e.id)!;
    const pts: [number, number][] = [];
    chain.forEach((id, i) => {
      const n = nodes.get(id)!;
      if (n.dummy) {
        const cx = layerX[n.layer] + layerW[n.layer] / 2;
        pts.push([layerX[n.layer] - opt.gapX * 0.15, n.y + n.h / 2]);
        pts.push([cx + layerW[n.layer] / 2 + opt.gapX * 0.15, n.y + n.h / 2]);
      } else {
        const b = outNodes[id];
        pts.push(i === 0 ? [b.x + b.w, b.y + b.h / 2] : [b.x, b.y + b.h / 2]);
      }
    });
    outEdges[e.id] = pts;
  }
  return { nodes: outNodes, edges: outEdges, width: x - opt.gapX + opt.margin, height: maxY + opt.margin };
}

// =====================================================================================
// 4. Time-scaled layout of the event network: x = event early time, lanes greedy
//    (critical chain first, then each chain stays on its tail's lane when it can)
// =====================================================================================

export interface PMTimeScaledLayout {
  eventX: Record<string, number>;
  eventY: Record<string, number>;
  /** y of the lane an activity arrow runs on */
  arrowY: Record<string, number>;
  width: number;
  height: number;
  laneCount: number;
  x0: number;
  dayPx: number;
}

export function timeScaledLayout(
  ev: PMEventNetwork,
  net: PMActivityNetwork,
  opt: { dayPx: number; laneH: number; top: number; margin: number },
): PMTimeScaledLayout {
  const lanes: [number, number][][] = [];
  const eventsOnLane: Map<number, number>[] = [];
  const eventLane: Record<string, number> = {};
  const arrowLane: Record<string, number> = {};
  const ensure = (l: number) => {
    while (lanes.length <= l) {
      lanes.push([]);
      eventsOnLane.push(new Map());
    }
  };
  const eps = 1e-6;
  const free = (l: number, t0: number, t1: number, needU: string | null, needV: string | null) => {
    ensure(l);
    for (const [a, b] of lanes[l]) if (t0 < b - eps && t1 > a + eps) return false;
    if (t1 - t0 < eps) for (const [a, b] of lanes[l]) if (t0 > a + eps && t0 < b - eps) return false;
    for (const id of [needU, needV]) {
      if (!id) continue;
      const t = ev.eventsById[id].early;
      const other = eventsOnLane[l].get(Math.round(t * 1000));
      if (other !== undefined) return false;
    }
    return true;
  };
  const claimEvent = (id: string, l: number) => {
    if (eventLane[id] !== undefined) return;
    ensure(l);
    eventLane[id] = l;
    eventsOnLane[l].set(Math.round(ev.eventsById[id].early * 1000), 1);
  };
  claimEvent(ev.events[0]?.id ?? EV_START, 0);

  const acts = ev.arrows.filter((a) => a.kind === 'activity');
  acts.sort((a, b) => {
    const A = net.byGUID[a.activityGUID!];
    const B = net.byGUID[b.activityGUID!];
    return Number(B.critical) - Number(A.critical) || ev.eventsById[a.from].early - ev.eventsById[b.from].early || A.seq - B.seq;
  });
  for (const a of acts) {
    const t0 = ev.eventsById[a.from].early;
    const t1 = Math.max(t0, ev.eventsById[a.to].early);
    const needU = eventLane[a.from] === undefined ? a.from : null;
    const needV = eventLane[a.to] === undefined ? a.to : null;
    const candidates = [eventLane[a.from], eventLane[a.to]].filter((l) => l !== undefined) as number[];
    let lane = candidates.find((l) => free(l, t0, t1, needU, needV));
    for (let l = 0; lane === undefined; l++) if (free(l, t0, t1, needU, needV)) lane = l;
    ensure(lane);
    lanes[lane].push([t0, t1]);
    arrowLane[a.id] = lane;
    if (needU) claimEvent(a.from, lane);
    if (needV) claimEvent(a.to, lane);
  }
  for (const e of ev.events) {
    if (eventLane[e.id] !== undefined) continue;
    let l = 0;
    while (!free(l, e.early, e.early, e.id, null)) l++;
    claimEvent(e.id, l);
  }
  const laneCount = Math.max(1, lanes.length);
  const x0 = opt.margin;
  const eventX: Record<string, number> = {};
  const eventY: Record<string, number> = {};
  const arrowY: Record<string, number> = {};
  for (const e of ev.events) {
    eventX[e.id] = x0 + e.early * opt.dayPx;
    eventY[e.id] = opt.top + eventLane[e.id] * opt.laneH + opt.laneH / 2;
  }
  for (const a of acts) arrowY[a.id] = opt.top + arrowLane[a.id] * opt.laneH + opt.laneH / 2;
  const maxT = Math.max(net.projectDuration, ...ev.events.map((e) => e.early));
  return {
    eventX,
    eventY,
    arrowY,
    width: x0 + maxT * opt.dayPx + opt.margin * 2,
    height: opt.top + laneCount * opt.laneH + opt.margin,
    laneCount,
    x0,
    dayPx: opt.dayPx,
  };
}
