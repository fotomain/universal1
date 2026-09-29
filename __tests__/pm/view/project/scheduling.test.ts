import {
  addWorkDays,
  buildTreeIndex,
  flattenVisible,
  fractionalOrderBetween,
  parseDateISO,
  ROOT_KEY,
  scheduleProject,
  validateNewDependency,
} from '../../../../kit8/pm/view/project/scheduling';
import { buildDemoData } from '../../../../kit8/pm/model/seedDemo';
import { PMTaskRow } from '../../../../kit8/pm/model/types';

const START = Date.UTC(2026, 9, 5); // Monday 2026-10-05
let n = 0;
const guid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const DAY = 86400000;

function demo() {
  n = 0;
  const data = buildDemoData('11111111-1111-4111-8111-111111111111', START, guid);
  const byName = (name: string) => data.tasks.find((t) => t.rowJSON.name === name) as PMTaskRow;
  return { data, byName };
}

describe('pm scheduling - TRD use case', () => {
  it('builds Project -> Stage -> Task trees from ltree paths', () => {
    const { data } = demo();
    const p1 = data.projects[0].rowGUID;
    const tasks = data.tasks.filter((t) => t.projectGUID === p1);
    const tree = buildTreeIndex(tasks);
    expect(tree.childrenById[ROOT_KEY].length).toBe(2);
    expect(flattenVisible(tree, {}).length).toBe(8);
    const stage1 = tree.childrenById[ROOT_KEY][0];
    expect(flattenVisible(tree, { [stage1]: false }).length).toBe(5);
  });

  it('numbers rows 1 / 1.1 / 1.1.1 from treePath + sibling order', () => {
    const P = 'p';
    const row = (id: string, path: string, orderInList: number) =>
      ({ rowGUID: id, treePath: `${P}.${path}`, projectGUID: P, orderInList, rowJSON: { name: id } }) as unknown as PMTaskRow;
    const tree = buildTreeIndex([
      row('b', 'b', 2048), // listed first, ordered second
      row('a', 'a', 1024),
      row('a2', 'a.a2', 2048),
      row('a1', 'a.a1', 1024),
      row('a11', 'a.a1.a11', 1024),
    ]);
    expect(tree.wbsById).toEqual({ a: '1', a1: '1.1', a11: '1.1.1', a2: '1.2', b: '2' });
  });

  it('keeps outline numbers when a stage is collapsed (they follow the full tree)', () => {
    const { data } = demo();
    const p1 = data.projects[0].rowGUID;
    const tree = buildTreeIndex(data.tasks.filter((t) => t.projectGUID === p1));
    const [s1, s2] = tree.childrenById[ROOT_KEY];
    expect(tree.wbsById[s1]).toBe('1');
    expect(tree.wbsById[s2]).toBe('2');
    expect(tree.childrenById[s1].map((g) => tree.wbsById[g])).toEqual(tree.childrenById[s1].map((_, i) => `1.${i + 1}`));
  });

  it('Task 113 starts after the finish of Task 111 and Task 112', () => {
    const { data, byName } = demo();
    const p1 = data.projects[0].rowGUID;
    const res = scheduleProject({
      tasks: data.tasks.filter((t) => t.projectGUID === p1),
      deps: data.deps.filter((d) => d.projectGUID === p1),
      projectStartMs: START,
    });
    const r111 = res.rows[byName('Task 111').rowGUID];
    const r112 = res.rows[byName('Task 112').rowGUID];
    const r113 = res.rows[byName('Task 113').rowGUID];
    expect(r111.finishMs).toBe(START + 3 * DAY);
    expect(r112.finishMs).toBe(START + 5 * DAY);
    expect(r113.startMs).toBe(START + 5 * DAY); // max(111, 112) finish
    expect(r113.finishMs).toBe(START + 7 * DAY);
    // 111 has 2 days of slack, 112 -> 113 is critical
    expect(r111.totalFloatDays).toBe(2);
    expect(r112.isCritical).toBe(true);
    expect(r113.isCritical).toBe(true);
    const stage1 = res.rows[byName('Stage 1').rowGUID];
    expect(stage1.isSummary).toBe(true);
    expect(stage1.startMs).toBe(START);
    expect(stage1.finishMs).toBe(START + 7 * DAY);
  });

  it('Project 2: Task 213 / 223 start after the two previous tasks', () => {
    const { data, byName } = demo();
    const p2 = data.projects[1].rowGUID;
    const res = scheduleProject({
      tasks: data.tasks.filter((t) => t.projectGUID === p2),
      deps: data.deps.filter((d) => d.projectGUID === p2),
      projectStartMs: START,
    });
    expect(res.rows[byName('Task 213').rowGUID].startMs).toBe(START + 7 * DAY);
    expect(res.rows[byName('Task 223').rowGUID].startMs).toBe(START + 7 * DAY);
    expect(res.projectFinishMs).toBe(START + 10 * DAY);
  });

  it('supports SS / FF / SF links, lag and a stage-level predecessor', () => {
    const { data, byName } = demo();
    const p1 = data.projects[0].rowGUID;
    const tasks = data.tasks.filter((t) => t.projectGUID === p1);
    const owner = tasks[0].rowOwnerGUID;
    const mk = (pred: string, succ: string, linkType: any, lagDays = 0) => ({
      rowGUID: byName(succ).rowGUID,
      rowDependsOnGUID: byName(pred).rowGUID,
      projectGUID: p1,
      rowOwnerGUID: owner,
      linkType,
      lagDays,
    });
    const deps = [
      ...data.deps.filter((d) => d.projectGUID === p1),
      mk('Stage 1', 'Stage 2', 'FS', 1), // whole Stage 2 starts 1 day after Stage 1
    ];
    const res = scheduleProject({ tasks, deps, projectStartMs: START });
    expect(res.rows[byName('Task 121').rowGUID].startMs).toBe(START + 8 * DAY);
    expect(res.rows[byName('Task 123').rowGUID].startMs).toBe(START + 13 * DAY);

    const ss = scheduleProject({ tasks, deps: [mk('Task 111', 'Task 121', 'SS', 2)], projectStartMs: START });
    expect(ss.rows[byName('Task 121').rowGUID].startMs).toBe(START + 2 * DAY);
    const ff = scheduleProject({ tasks, deps: [mk('Task 112', 'Task 121', 'FF')], projectStartMs: START });
    expect(ff.rows[byName('Task 121').rowGUID].finishMs).toBe(START + 5 * DAY);
  });

  it('rejects cycles, including cycles through a stage', () => {
    const { data, byName } = demo();
    const p1 = data.projects[0].rowGUID;
    const tasks = data.tasks.filter((t) => t.projectGUID === p1);
    const deps = data.deps.filter((d) => d.projectGUID === p1);
    expect(validateNewDependency(tasks, deps, byName('Task 113').rowGUID, byName('Task 111').rowGUID)).toBe('cycle');
    expect(validateNewDependency(tasks, deps, byName('Stage 1').rowGUID, byName('Task 111').rowGUID)).toBe('same-branch');
    expect(validateNewDependency(tasks, deps, byName('Task 111').rowGUID, byName('Task 113').rowGUID)).toBe('duplicate');
    expect(validateNewDependency(tasks, deps, byName('Task 113').rowGUID, byName('Task 121').rowGUID)).toBe(null);
    const withStageLink = [
      ...deps,
      { ...deps[0], rowGUID: byName('Stage 2').rowGUID, rowDependsOnGUID: byName('Task 113').rowGUID },
    ];
    // Task 121 is inside Stage 2 which already waits for Task 113 -> 121 -> 111 -> 113 closes a loop
    expect(validateNewDependency(tasks, withStageLink, byName('Task 121').rowGUID, byName('Task 111').rowGUID)).toBe('cycle');
  });

  it('work-day calendar skips weekends', () => {
    // Fri 2026-10-09 + 1 working day -> exclusive finish Sat, + 2 -> Tue
    const fri = Date.UTC(2026, 9, 9);
    expect(addWorkDays(fri, 1, { skipWeekends: true })).toBe(fri + DAY);
    expect(addWorkDays(fri, 2, { skipWeekends: true })).toBe(Date.UTC(2026, 9, 13));
    expect(parseDateISO('2026-10-05')).toBe(START);
    expect(parseDateISO('nope')).toBe(null);
  });

  it('fractional ordering only needs the moved row', () => {
    expect(fractionalOrderBetween(null, null)).toBe(1024);
    expect(fractionalOrderBetween(1024, 2048)).toBe(1536);
    expect(fractionalOrderBetween(null, 1024)).toBe(0);
    expect(fractionalOrderBetween(1024, null)).toBe(2048);
  });
});
