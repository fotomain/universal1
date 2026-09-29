import { computeUndoPlan, isEmptyUndoPlan } from '../../../../kit8/pm/view/undo/undoGanttPlan';
import { distanceToPolyline, routeLink, scaleLevelsFor } from '../../../../kit8/pm/view/gantt/ganttGeometry';
import { taskColorOf, PMProjectData, PMTaskRow, PMTaskDependencyRow } from '../../../../kit8/pm/model/types';

const P = 'p';
function task(guid: string, path: string, extra: Partial<PMTaskRow> = {}): PMTaskRow {
  return {
    rowGUID: guid,
    treePath: path,
    projectGUID: P,
    rowOwnerGUID: 'u',
    rowDuration: null,
    rowProgress: 0,
    orderInList: 1024,
    rowJSON: { rowKind: 'task', name: guid, durationDays: 1 },
    ...extra,
  };
}
function dep(succ: string, pred: string, extra: Partial<PMTaskDependencyRow> = {}): PMTaskDependencyRow {
  return { rowGUID: succ, rowDependsOnGUID: pred, projectGUID: P, rowOwnerGUID: 'u', linkType: 'FS', lagDays: 0, rowJSON: {}, ...extra };
}

const S = task('s', 'p.s', { rowJSON: { rowKind: 'stage', name: 'S', durationDays: 0 } });
const A = task('a', 'p.s.a');
const B = task('b', 'p.s.b', { orderInList: 2048 });
const base: PMProjectData = { tasks: [S, A, B], deps: [dep('b', 'a')] };

describe('undoGanttPlan', () => {
  it('is empty when nothing changed (scheduler outputs ignored)', () => {
    const cur: PMProjectData = {
      tasks: [S, { ...A, rowDuration: '2026-01-02T00:00:00Z', rowJSON: { ...A.rowJSON, startAt: '2026-01-01T00:00:00Z' } }, B],
      deps: base.deps,
    };
    expect(isEmptyUndoPlan(computeUndoPlan(cur, base))).toBe(true);
  });

  it('restores a deleted stage with its tasks (parents first) and dependencies', () => {
    const plan = computeUndoPlan({ tasks: [], deps: [] }, base);
    expect(plan.writeTasks.map((w) => [w.kind, w.row.rowGUID])).toEqual([
      ['insert', 's'],
      ['insert', 'a'],
      ['insert', 'b'],
    ]);
    expect(plan.insertDeps).toHaveLength(1);
  });

  it('restores a deleted dependency only', () => {
    const plan = computeUndoPlan({ tasks: base.tasks, deps: [] }, base);
    expect(plan.insertDeps.map((d) => `${d.rowDependsOnGUID}>${d.rowGUID}`)).toEqual(['a>b']);
    expect(plan.writeTasks).toHaveLength(0);
    expect(plan.deleteTasks).toHaveLength(0);
  });

  it('undoes a stretch (duration) and a recolored dependency', () => {
    const cur: PMProjectData = {
      tasks: [S, { ...A, rowJSON: { ...A.rowJSON, durationDays: 5 } }, B],
      deps: [dep('b', 'a', { rowJSON: { dependencyColor: '#ef4444' } })],
    };
    const plan = computeUndoPlan(cur, base);
    expect(plan.writeTasks.map((w) => [w.kind, w.row.rowGUID, w.row.rowJSON.durationDays])).toEqual([['update', 'a', 1]]);
    expect(plan.updateDeps).toHaveLength(1);
    expect(plan.updateDeps[0].rowJSON).toEqual({});
  });

  it('deletes a row created by the action (top-most only) and its new link', () => {
    const C = task('c', 'p.s.c');
    const D = task('d', 'p.s.c.d');
    const cur: PMProjectData = { tasks: [...base.tasks, C, D], deps: [...base.deps, dep('c', 'a')] };
    const plan = computeUndoPlan(cur, base);
    expect(plan.deleteTasks.map((t) => t.rowGUID)).toEqual(['c']);
    expect(plan.deleteDeps).toHaveLength(0); // goes with the task (FK cascade)
  });

  it('moves a re-parented row back', () => {
    const cur: PMProjectData = { tasks: [S, A, { ...B, treePath: 'p.b' }], deps: base.deps };
    const plan = computeUndoPlan(cur, base);
    expect(plan.writeTasks.map((w) => [w.kind, w.row.treePath])).toEqual([['update', 'p.s.b']]);
  });
});

describe('dependency arrow routing', () => {
  it('squareForm FS forward = one vertical segment', () => {
    const r = routeLink(100, 17, 200, 51, 1, 1, 'squareForm', 34);
    expect(r.points).toEqual([100, 17, 110, 17, 110, 51, 193, 51]);
  });
  it('squareForm FS backward detours along the row boundary', () => {
    const r = routeLink(200, 17, 100, 51, 1, 1, 'squareForm', 34);
    expect(r.points.length).toBe(12);
    expect(r.points[5]).toBe(34); // midY = row boundary
  });
  it('smoothForm keeps a cubic and a sampled polyline for hit-testing', () => {
    const r = routeLink(0, 0, 100, 34, 1, 1, 'smoothForm', 34);
    expect(r.c).toBeDefined();
    expect(distanceToPolyline(0, 0, r.points)).toBeLessThan(0.01);
    expect(distanceToPolyline(50, 200, r.points)).toBeGreaterThan(100);
  });
});

describe('misc', () => {
  it('Year zoom uses a quarter scale', () => {
    expect(scaleLevelsFor(1.2)).toEqual({ top: 'year', bottom: 'quarter' });
    expect(scaleLevelsFor(4)).toEqual({ top: 'year', bottom: 'month' });
  });
  it('taskColorOf prefers rowJSON.taskColor, null = automatic', () => {
    expect(taskColorOf({ rowKind: 'task', name: '', durationDays: 1, taskColor: '#fff', color: '#000' })).toBe('#fff');
    expect(taskColorOf({ rowKind: 'task', name: '', durationDays: 1, taskColor: null, color: '#000' })).toBeNull();
    expect(taskColorOf({ rowKind: 'task', name: '', durationDays: 1, color: '#000' })).toBe('#000');
  });
});
