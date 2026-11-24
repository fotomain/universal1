// BIM component: the route, the details text of "Share", "single detail = task" (kit8/pm/bim/component/bimComponentModel.ts)
import {
  BIM_COMPONENT_ROUTE, bimComponentBackTarget, bimComponentFileBase, bimComponentLayout, bimComponentParams, bimComponentPath, buildBimComponentInfoText, elementsOfTasks, parseBimComponentParams, propertyLines, singleElementOfTask,
} from '../../kit8/pm/bim/component/bimComponentModel';
import type { BimElementRow } from '../../kit8/pm/bim/model/bimModel';

const el = (ifcGuid: string, taskGUID: string | null, name = ifcGuid): BimElementRow => ({ ifcGuid, ifcClass: 'IfcWall', name, typeName: 'Basic Wall', storeyGUID: 's1', taskGUID, chunkHash: 'h', elementNumber: 0, bbox: [0, 0, 0, 1, 1, 1] });

describe('route and params', () => {
  it('path: only what is given', () => {
    expect(bimComponentPath({ projectGUID: 'p1', elementGUID: 'e1' })).toBe(`${BIM_COMPONENT_ROUTE}?projectGUID=p1&elementGUID=e1`);
    expect(bimComponentParams({ projectGUID: 'p1', elementGUID: 'e$1', taskGUID: 't1', returnTo: '/pm/project/dashboard' })).toEqual({ projectGUID: 'p1', elementGUID: 'e$1', taskGUID: 't1', returnTo: '/pm/project/dashboard' });
    expect(bimComponentPath({ projectGUID: 'p1', elementGUID: 'e$1' })).toContain('elementGUID=e%241');
  });
  it('parse: project and element are obligatory, an array takes its first value', () => {
    expect(parseBimComponentParams({ projectGUID: 'p1', elementGUID: ['e1', 'e2'], taskGUID: 't1' })).toEqual({ projectGUID: 'p1', elementGUID: 'e1', taskGUID: 't1' });
    expect(parseBimComponentParams({ projectGUID: 'p1' })).toBeNull();
    expect(parseBimComponentParams({ elementGUID: 'e1' })).toBeNull();
    expect(parseBimComponentParams(undefined)).toBeNull();
  });
  it('parse: returnTo must be a path of this app, never another site', () => {
    expect(parseBimComponentParams({ projectGUID: 'p', elementGUID: 'e', returnTo: '/pm/project/dashboard?projectGUID=p' })?.returnTo).toBe('/pm/project/dashboard?projectGUID=p');
    for (const bad of ['//evil.example', 'https://evil.example', 'javascript:alert(1)']) expect(parseBimComponentParams({ projectGUID: 'p', elementGUID: 'e', returnTo: bad })?.returnTo).toBeUndefined();
  });
});

describe('single detail = task', () => {
  const list = [el('a', 't1'), el('b', 't2'), el('c', 't2'), el('d', null)];
  const byTask = elementsOfTasks(list);
  it('a task with exactly ONE element gives it; many or none or no task give nothing', () => {
    expect(singleElementOfTask(byTask, 't1')?.ifcGuid).toBe('a');
    expect(singleElementOfTask(byTask, 't2')).toBeUndefined();
    expect(singleElementOfTask(byTask, 'nope')).toBeUndefined();
    expect(singleElementOfTask(byTask, null)).toBeUndefined();
  });
});

describe('details text of Share', () => {
  const props = { sets: { Pset_WallCommon: { FireRating: '2HR', IsExternal: true }, Dimensions: { Length: { v: 3 } } } };
  it('propertyLines: a head per set, a line per value (objects as JSON)', () => {
    expect(propertyLines(props)).toEqual([
      { head: true, text: 'Pset_WallCommon' }, { head: false, text: 'FireRating: 2HR' }, { head: false, text: 'IsExternal: true' },
      { head: true, text: 'Dimensions' }, { head: false, text: 'Length: {"v":3}' },
    ]);
    expect(propertyLines(null)).toEqual([]);
    expect(propertyLines({})).toEqual([]);
  });
  it('project, place in the plan, task, component, class, storey, id, properties, link - in this order', () => {
    const text = buildBimComponentInfoText({ projectName: 'Tower', taskPath: ['Level 1', 'Walls'], taskName: 'Wall W-12', element: el('3abc', 't1', 'Basic Wall:W-12'), storeyName: 'Level 1', properties: props, link: 'https://x/pm/bim/component?e=3abc' });
    const lines = text.split('\n');
    expect(lines.slice(0, 7)).toEqual(['Project: Tower', 'In: Level 1 › Walls', 'Task: Wall W-12', 'Component: Basic Wall:W-12', 'Class: IfcWall · Basic Wall', 'Storey: Level 1', 'IFC GlobalId: 3abc']);
    expect(text).toContain('Properties:\nPset_WallCommon\n  FireRating: 2HR');
    expect(lines[lines.length - 1]).toBe('Link: https://x/pm/bim/component?e=3abc');
  });
  it('a component without a name is told by its id; nothing optional = no empty lines of it', () => {
    const text = buildBimComponentInfoText({ element: { ifcGuid: 'g9', name: '', ifcClass: '', typeName: '' } });
    expect(text).toBe('Component: g9\nIFC GlobalId: g9');
  });
  it('the file name of the picture is safe', () => {
    expect(bimComponentFileBase({ name: 'Basic Wall:W/12 ✓', ifcGuid: 'g' })).toBe('bim_Basic_Wall_W_12');
    expect(bimComponentFileBase({ name: '', ifcGuid: 'g?' })).toBe('bim_g');
    expect(bimComponentFileBase({ name: '***', ifcGuid: '***' })).toBe('bim_component');
  });
});

describe('the screen: Back target and the heights', () => {
  it('no returnTo and no history: the dashboard at the task, else at the project', () => {
    expect(bimComponentBackTarget({ projectGUID: 'p1', taskGUID: 't1' }, null)).toBe('/pm/project/dashboard?projectGUID=p1&taskGUID=t1&view=finances');
    expect(bimComponentBackTarget({ projectGUID: 'p1' }, 't9')).toContain('taskGUID=t9');
    expect(bimComponentBackTarget({ projectGUID: 'p1' }, null)).toBe('/pm/project/dashboard?projectGUID=p1');
  });
  it('the image is 42 % of the body (200..560), the edit tables are under it and never shorter than 340', () => {
    const l = bimComponentLayout(800, false);
    expect(l.viewerH).toBe(336);
    expect(l.propsH).toBeGreaterThan(0);
    expect(l.editH).toBeGreaterThanOrEqual(340);
    expect(bimComponentLayout(300, false).viewerH).toBe(200);
    expect(bimComponentLayout(3000, false).viewerH).toBe(560);
    expect(bimComponentLayout(300, false).editH).toBe(340);
  });
  it('full screen: the image takes the whole body, nothing under it', () => {
    expect(bimComponentLayout(700, true)).toEqual({ viewerH: 700, propsH: 0, editH: 0 });
  });
});
