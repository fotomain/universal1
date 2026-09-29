import { buildTreeIndex, scheduleProject } from '../../../../kit8/pm/view/project/scheduling';
import { buildActivityNetwork, buildEventNetwork, EV_FINISH, EV_START, layeredLayout, NET_FINISH, NET_START, relatedActivities, timeScaledLayout } from '../../../../kit8/pm/view/network/networkModel';
import { PMLinkType, PMTaskDependencyRow, PMTaskRow } from '../../../../kit8/pm/model/types';

const t = (guid: string, path: string, kind: 'stage' | 'task' | 'milestone', days: number): PMTaskRow => ({
  rowGUID: guid,
  treePath: path,
  projectGUID: 'p',
  rowOwnerGUID: 'u',
  rowDuration: null,
  rowProgress: 0,
  orderInList: 1024,
  rowJSON: { rowKind: kind, name: guid.toUpperCase(), durationDays: days },
});
const d = (pred: string, succ: string, linkType: PMLinkType = 'FS', lagDays = 0): PMTaskDependencyRow => ({
  rowGUID: succ,
  rowDependsOnGUID: pred,
  projectGUID: 'p',
  rowOwnerGUID: 'u',
  linkType,
  lagDays,
});

function build(tasks: PMTaskRow[], deps: PMTaskDependencyRow[]) {
  const calendar = { skipWeekends: false };
  const res = scheduleProject({ tasks, deps, projectStartMs: Date.UTC(2026, 0, 5), calendar });
  return buildActivityNetwork({ tasks, deps, tree: buildTreeIndex(tasks), schedule: res.rows, projectStartMs: res.projectStartMs, projectFinishMs: res.projectFinishMs, calendar });
}

// textbook: A(3) -> B(2), A -> C(4), B + C -> D(1)   critical: A C D = 8 days
const TASKS = [t('a', 'p.a', 'task', 3), t('b', 'p.b', 'task', 2), t('c', 'p.c', 'task', 4), t('d', 'p.d', 'task', 1)];
const DEPS = [d('a', 'b'), d('a', 'c'), d('b', 'd'), d('c', 'd')];

describe('activity network (AON)', () => {
  const net = build(TASKS, DEPS);
  it('CPM numbers: ES / EF / LS / LF / TF, 0-based, EF = ES + D', () => {
    const v = (g: string) => {
      const a = net.byGUID[g];
      return [a.es, a.ef, a.ls, a.lf, a.tf, a.critical];
    };
    expect(v('a')).toEqual([0, 3, 0, 3, 0, true]);
    expect(v('b')).toEqual([3, 5, 5, 7, 2, false]);
    expect(v('c')).toEqual([3, 7, 3, 7, 0, true]);
    expect(v('d')).toEqual([7, 8, 7, 8, 0, true]);
    expect(net.projectDuration).toBe(8);
  });
  it('links + Start / Finish connectors, critical links', () => {
    const ids = net.links.map((l) => `${l.id}:${l.critical ? 'c' : '-'}`).sort();
    expect(ids).toEqual(
      [`${NET_START}>a:c`, 'a>b:-', 'a>c:c', 'b>d:-', 'c>d:c', `d>${NET_FINISH}:c`].sort()
    );
  });
  it('relatedActivities = upstream + downstream', () => {
    expect([...relatedActivities(net, 'b')].sort()).toEqual([NET_FINISH, NET_START, 'a', 'b', 'd'].sort());
  });
  it('a link on a stage is expanded to leaves and transitively reduced', () => {
    const tasks = [t('s', 'p.s', 'stage', 0), t('x', 'p.s.x', 'task', 1), t('y', 'p.s.y', 'task', 1), t('z', 'p.z', 'task', 1)];
    const n = build(tasks, [d('x', 'y'), d('s', 'z')]);
    const real = n.links.filter((l) => !l.virtual).map((l) => l.id).sort();
    expect(real).toEqual(['x>y', 'y>z']); // x>z is implied by x>y>z
    expect(n.activities.map((a) => a.wbs)).toEqual(['1.1', '1.2', '2']);
  });
});

describe('event network (AOA)', () => {
  it('textbook network needs exactly one dummy (B and C run parallel between the same events)', () => {
    const ev = buildEventNetwork(build(TASKS, DEPS));
    const acts = ev.arrows.filter((a) => a.kind === 'activity');
    const dummies = ev.arrows.filter((a) => a.kind === 'dummy');
    expect(acts).toHaveLength(4);
    expect(dummies).toHaveLength(1);
    expect(ev.events).toHaveLength(5);
    // no two activity arrows share both ends
    const ends = new Set(acts.map((a) => `${a.from}>${a.to}`));
    expect(ends.size).toBe(4);
    // Fulkerson numbering: tail < head
    for (const a of ev.arrows) expect(ev.eventsById[a.from].number).toBeLessThan(ev.eventsById[a.to].number);
    const first = ev.events[0];
    const last = ev.events[ev.events.length - 1];
    expect(first.id).toBe(EV_START);
    expect(last.id).toBe(EV_FINISH);
    expect([first.early, last.early, last.late]).toEqual([0, 8, 8]);
    // event after B: early 5, late 7 (reserve 2)
    const afterB = ev.eventsById[acts.find((a) => a.activityGUID === 'b')!.to];
    expect([afterB.early, afterB.late, afterB.reserve]).toEqual([5, 7, 2]);
  });
  it('a chain collapses to consecutive events without dummies', () => {
    const ev = buildEventNetwork(build([t('a', 'p.a', 'task', 1), t('b', 'p.b', 'task', 2)], [d('a', 'b')]));
    expect(ev.arrows.map((a) => a.kind)).toEqual(['activity', 'activity']);
    expect(ev.events.map((e) => e.early)).toEqual([0, 1, 3]);
    expect(ev.events.map((e) => e.predNumber)).toEqual([null, 1, 2]);
  });
  it('SS / lag links keep a labelled dummy', () => {
    const ev = buildEventNetwork(build([t('a', 'p.a', 'task', 4), t('b', 'p.b', 'task', 2)], [d('a', 'b', 'SS', 1)]));
    expect(ev.arrows.filter((a) => a.kind === 'dummy').map((a) => a.label)).toContain('SS+1');
  });
  it('empty project', () => {
    expect(buildEventNetwork(build([], [])).events).toEqual([]);
  });
});

describe('layouts', () => {
  it('layered: left to right, no overlaps inside a layer, long edges bend', () => {
    const net = build(TASKS, DEPS);
    const nodes = [{ id: NET_START, w: 20, h: 20, rank: -1 }, ...net.activities.map((a) => ({ id: a.guid, w: 100, h: 60, rank: a.seq })), { id: NET_FINISH, w: 20, h: 20, rank: 1e9 }];
    const L = layeredLayout(nodes, net.links, { gapX: 40, gapY: 20, margin: 10 });
    expect(L.nodes.a.x).toBeLessThan(L.nodes.b.x);
    expect(L.nodes.b.layer).toBe(L.nodes.c.layer);
    const [b, c] = [L.nodes.b, L.nodes.c].sort((p, q) => p.y - q.y);
    expect(b.y + b.h + 20).toBeLessThanOrEqual(c.y + 0.001);
    expect(L.edges['a>b'][0]).toEqual([L.nodes.a.x + 100, L.nodes.a.y + 30]);
    expect(L.width).toBeGreaterThan(L.nodes[NET_FINISH].x);
  });
  it('time-scaled: x = early time, critical chain on lane 0', () => {
    const net = build(TASKS, DEPS);
    const ev = buildEventNetwork(net);
    const T = timeScaledLayout(ev, net, { dayPx: 10, laneH: 50, top: 30, margin: 20 });
    for (const e of ev.events) expect(T.eventX[e.id]).toBe(20 + e.early * 10);
    const crit = ev.arrows.filter((a) => a.kind === 'activity' && a.critical);
    for (const a of crit) expect(T.arrowY[a.id]).toBe(30 + 25);
  });
});

describe('demo projects', () => {
  const { buildDemoData } = require('../../../../kit8/pm/model/seedDemo');
  let n = 0;
  const demo = buildDemoData('u', Date.UTC(2026, 8, 28), () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, null);
  for (const p of demo.projects) {
    it(`${p.rowJSON.name}: valid AOA (no parallel activities, tail < head) and a layout`, () => {
      const tasks = demo.tasks.filter((x: PMTaskRow) => x.projectGUID === p.rowGUID);
      const deps = demo.deps.filter((x: PMTaskDependencyRow) => x.projectGUID === p.rowGUID);
      const net = build(tasks, deps);
      expect(net.activities.length).toBeGreaterThan(0);
      const ev = buildEventNetwork(net);
      const acts = ev.arrows.filter((a) => a.kind === 'activity');
      expect(acts).toHaveLength(net.activities.length);
      expect(new Set(acts.map((a) => `${a.from}>${a.to}`)).size).toBe(acts.length);
      for (const a of ev.arrows) expect(ev.eventsById[a.from].number).toBeLessThan(ev.eventsById[a.to].number);
      for (const e of ev.events) expect(e.late).toBeGreaterThanOrEqual(e.early);
      const L = layeredLayout(
        ev.events.map((e) => ({ id: e.id, w: 50, h: 50, rank: e.number })),
        ev.arrows,
        { gapX: 100, gapY: 30, margin: 20 }
      );
      for (const e of ev.events) expect(Number.isFinite(L.nodes[e.id].y)).toBe(true);
      const T = timeScaledLayout(ev, net, { dayPx: 10, laneH: 50, top: 30, margin: 20 });
      // no two events on the same spot
      const spots = new Set(ev.events.map((e) => `${T.eventX[e.id]}:${T.eventY[e.id]}`));
      expect(spots.size).toBe(ev.events.length);
    });
  }
});
