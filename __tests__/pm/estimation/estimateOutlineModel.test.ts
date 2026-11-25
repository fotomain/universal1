// The outline of an estimate: what the printed forms list and in which order - the task tree is the hierarchy (no section lines), older documents keep theirs at the end.
import { calcDocument } from '../../../kit8/pm/estimation/model/estimationCalc';
import { buildEstimateOutline } from '../../../kit8/pm/estimation/model/estimateOutlineModel';
import { newLineRow, recalcLines } from '../../../kit8/pm/estimation/model/estimationDocumentModel';
import { taskRowsFromPlan, type TaskPlanRow } from '../../../kit8/pm/estimation/model/estimationTaskModel';

const P = '11111111-1111-1111-1111-111111111111';
const g = (n: number) => `aaaaaaaa-0000-0000-0000-${String(n).padStart(12, '0')}`;
const plan: TaskPlanRow[] = [
  { rowGUID: g(1), parentGUID: null, kind: 'stage', name: 'Structure' },
  { rowGUID: g(2), parentGUID: g(1), kind: 'stage', name: 'Frame' },
  { rowGUID: g(3), parentGUID: g(2), kind: 'task', name: 'Columns' },
  { rowGUID: g(4), parentGUID: g(1), kind: 'task', name: 'Slab' },
  { rowGUID: g(5), parentGUID: g(1), kind: 'stage', name: 'Empty stage' },
  { rowGUID: g(6), parentGUID: null, kind: 'task', name: 'Site cleaning' },
];
const tasks = taskRowsFromPlan(plan, { projectGUID: P, ownerGUID: 'u' });
const pos = (task: string | null, title: string, price: number, order: number) => newLineRow(P, 'd', 'position', 'empty', order, { title, qty: 1, unitMaterials: price, ...(task ? { taskGUID: task } : {}) });
const outline = (lines: ReturnType<typeof pos>[], t: typeof tasks | null = tasks) => {
  const doc = { index: 1 };
  const calc = recalcLines(lines, doc as any);
  return buildEstimateOutline({ tasks: t, lines: calc.lines, byLine: calc.calc.byLine, doc });
};

describe('buildEstimateOutline', () => {
  test('stages are headings with the sum of everything below them, tasks give their positions, in the order and with the outline numbers of the tree; empty stages are left out', () => {
    const o = outline([pos(g(6), 'Clean', 10, 10), pos(g(3), 'Column', 100, 20), pos(g(4), 'Slab 20 cm', 200, 30)]);
    expect(o.entries.map((e) => [e.type, e.type === 'position' ? e.title : (e as any).title, e.depth, e.wbs])).toEqual([
      ['stage', 'Structure', 0, '1'],
      ['stage', 'Frame', 1, '1.1'],
      ['position', 'Column', 2, '1.1.1'],
      ['position', 'Slab 20 cm', 1, '1.2'],
      ['position', 'Clean', 0, '2'],
    ]);
    const stage = o.entries[0] as any;
    expect(stage.cost.current).toBe(300);
    expect((o.entries[1] as any).cost.current).toBe(100);
    expect(o.placed).toBe(3);
    expect(o.unplaced).toBe(0);
  });
  test('a position with no description takes the name of its task and knows the stage it stands in', () => {
    const o = outline([pos(g(3), '', 100, 10), pos(g(6), '', 5, 20)]);
    const [a, b] = o.positions;
    expect([a.title, a.stage]).toEqual(['Columns', 'Frame']);
    expect([b.title, b.stage]).toEqual(['Site cleaning', '']);
  });
  test('lines the tree cannot place follow under one heading: no task, a task that is gone, a section of an older document with its positions; an empty old section is not listed', () => {
    const sec = newLineRow(P, 'd', 'section', 'empty', 40, { title: 'Old section' });
    const emptySec = newLineRow(P, 'd', 'section', 'empty', 45, { title: 'Nothing here' });
    const o = outline([pos(g(3), 'Column', 100, 10), pos(null, 'Loose', 7, 20), pos('deleted', 'Lost', 3, 30), sec as any, emptySec as any, { ...pos(null, 'In section', 50, 50), rowParentGUID: sec.rowGUID }]);
    expect(o.entries.map((e) => e.type)).toEqual(['stage', 'stage', 'position', 'unplaced', 'position', 'position', 'section', 'position']);
    expect(o.entries.filter((e) => e.type === 'section').map((e: any) => e.title)).toEqual(['Old section']);
    expect(o.placed).toBe(1);
    expect(o.unplaced).toBe(3);
    expect((o.entries.find((e) => e.type === 'unplaced') as any).cost.current).toBe(60);
    // every position appears exactly once
    expect(o.positions).toHaveLength(4);
  });
  test('no tasks at all = the document is outlined by its own line tree, with no heading in front', () => {
    const sec = newLineRow(P, 'd', 'section', 'empty', 10, { title: 'S' });
    const p1 = { ...pos(null, 'One', 1, 20), rowParentGUID: sec.rowGUID };
    const o = outline([sec as any, p1], null);
    expect(o.entries.map((e) => e.type)).toEqual(['section', 'position']);
    expect(o.placed).toBe(0);
  });
  test('the totals of the outline are the totals of the document (nothing is lost, nothing counted twice)', () => {
    const lines = [pos(g(6), 'a', 10, 10), pos(g(3), 'b', 100, 20), pos(null, 'c', 1, 30)];
    const calc = calcDocument(recalcLines(lines, {} as any).lines, {} as any);
    const o = outline(lines);
    const sum = o.positions.reduce((a, p) => a + (calc.byLine[p.line.rowGUID]?.current ?? 0), 0);
    expect(sum).toBe(calc.total.current);
  });
});
