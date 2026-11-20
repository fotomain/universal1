import { elementsByTask, highlightedFor, taskWithDescendants, treeTargetOfElement } from '../../kit8/pm/bim/view/useBimTaskBridge';
import { fitBox, isTap, orbitBy, orbitPosition, panBy, unionBoxes, zoomBy, BIM_MIN_DISTANCE } from '../../kit8/pm/bim/view/bimCamera';
import type { BimElementRow, BimManifest } from '../../kit8/pm/bim/model/bimModel';

const tasks = {
  P: { treePath: 'P' },
  S1: { treePath: 'P.S1' },
  S2: { treePath: 'P.S2' },
  S10: { treePath: 'P.S10' }, // a stage whose label STARTS with S1: not a child of S1
  T1: { treePath: 'P.S1.T1' },
  T2: { treePath: 'P.S1.T2' },
  T3: { treePath: 'P.S2.T3' },
};
const el = (g: string, taskGUID: string | null, storeyGUID = 'st1'): BimElementRow => ({ ifcGuid: g, ifcClass: 'IfcWall', name: g, typeName: '', storeyGUID, taskGUID, chunkHash: 'h', elementNumber: 0, bbox: [0, 0, 0, 1, 1, 1] });

describe('task <-> element bridge', () => {
  const elements = [el('A', 'T1'), el('B', 'T1'), el('C', 'T2'), el('D', 'T3'), el('E', null)];
  const by = elementsByTask(elements);

  it('a stage includes every task below it, not a stage with a similar name', () => {
    expect(taskWithDescendants(tasks, 'S1').sort()).toEqual(['S1', 'T1', 'T2']);
    expect(taskWithDescendants(tasks, 'T3')).toEqual(['T3']);
    expect(taskWithDescendants(tasks, 'nope')).toEqual([]);
  });

  it('a pressed task lights its elements; a pressed stage lights all of its tasks; several checked tasks add up', () => {
    expect([...highlightedFor(['T1'], tasks, by)].sort()).toEqual(['A', 'B']);
    expect([...highlightedFor(['S1'], tasks, by)].sort()).toEqual(['A', 'B', 'C']);
    expect([...highlightedFor(['T1', 'T3'], tasks, by)].sort()).toEqual(['A', 'B', 'D']);
    expect(highlightedFor([], tasks, by).size).toBe(0);
    expect(highlightedFor(['S10'], tasks, by).size).toBe(0);
  });

  it('a grouped task lights every element of the group', () => {
    const grouped = elementsByTask([el('D1', 'T1'), el('D2', 'T1'), el('D3', 'T1')]);
    expect(highlightedFor(['T1'], tasks, grouped).size).toBe(3);
  });

  it('a pressed element scrolls to its task, else to the stage of its storey, else nowhere', () => {
    const manifest = { storeys: [{ storeyGUID: 'st1', stageGUID: 'S1' }] } as unknown as BimManifest;
    expect(treeTargetOfElement(el('A', 'T1'), manifest)).toBe('T1');
    expect(treeTargetOfElement(el('E', null), manifest)).toBe('S1');
    expect(treeTargetOfElement(el('E', null, 'other'), manifest)).toBeNull();
    expect(treeTargetOfElement(undefined, manifest)).toBeNull();
  });
});

describe('camera math', () => {
  it('orbit keeps the camera at the distance, looking at the target; the pitch is limited', () => {
    const o = { target: [1, 2, 3] as [number, number, number], yaw: 0.3, pitch: 0.4, distance: 10 };
    const p = orbitPosition(o);
    expect(Math.hypot(p[0] - 1, p[1] - 2, p[2] - 3)).toBeCloseTo(10, 6);
    expect(orbitBy(o, 0, 100000).pitch).toBeLessThan(Math.PI / 2);
    expect(orbitBy(o, 0, -100000).pitch).toBeGreaterThan(-Math.PI / 2);
    expect(orbitBy(o, 10, 0).yaw).toBeLessThan(o.yaw);
  });
  it('zoom is limited', () => {
    const o = { target: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0, distance: 10 };
    expect(zoomBy(o, 0.5).distance).toBe(5);
    expect(zoomBy(o, 0.0001).distance).toBe(BIM_MIN_DISTANCE);
    expect(zoomBy(o, 1e9, 100).distance).toBe(100);
  });
  it('pan moves the target in the plane of the screen (not along the view direction)', () => {
    const o = { target: [0, 0, 0] as [number, number, number], yaw: 0, pitch: 0, distance: 10 };
    const p = panBy(o, 100, 0, 600);
    expect(p.target[0]).toBeLessThan(0);
    expect(p.target[1]).toBeCloseTo(0, 9);
    expect(p.target[2]).toBeCloseTo(0, 9);
    expect(panBy(o, 0, 100, 600).target[1]).toBeGreaterThan(0);
  });
  it('fitBox shows the whole box: its centre is the target and the distance holds the sphere', () => {
    const box = [-10, 0, -5, 10, 20, 5];
    const o = fitBox(box, 45, 1);
    expect(o.target).toEqual([0, 10, 0]);
    const r = Math.hypot(20, 20, 10) / 2;
    expect(o.distance).toBeGreaterThan(r);
    expect(fitBox(box, 45, 0.5).distance).toBeGreaterThan(o.distance);
  });
  it('union of boxes', () => {
    expect(unionBoxes([[0, 0, 0, 1, 1, 1], [-1, 2, 0, 0, 3, 5]])).toEqual([-1, 0, 0, 1, 3, 5]);
    expect(unionBoxes([])).toBeNull();
  });
  it('a tap moves less than 8 px and lasts less than 250 ms (a mouse click 4 px)', () => {
    expect(isTap(3, 100)).toBe(true);
    expect(isTap(9, 100)).toBe(false);
    expect(isTap(3, 300)).toBe(false);
    expect(isTap(5, 100, true)).toBe(false);
  });
});
