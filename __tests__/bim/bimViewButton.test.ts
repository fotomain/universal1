import { PM_DEFAULT_VIEW_BUTTONS_ORDER, PM_LAST_VIEW_BUTTON, pmMainViewOf, viewButtonsOrderOf } from '../../kit8/pm/model/types';
import { bimModelFacts, projectIsBimBased } from '../../kit8/pm/bim/model/bimModel';

describe('the BIM button of the view switch', () => {
  it('BIM is the LAST button; Budgets is the one before it, whatever order the user saved', () => {
    expect(PM_LAST_VIEW_BUTTON).toBe('showBimView');
    expect(PM_DEFAULT_VIEW_BUTTONS_ORDER[PM_DEFAULT_VIEW_BUTTONS_ORDER.length - 1]).toBe('showBimView');
    const order = viewButtonsOrderOf(['showBimView', 'showGanttChart', 'showPlanView']);
    expect(order[order.length - 1]).toBe('showBimView');
    expect(order.indexOf('showPlanView')).toBe(order.length - 2 === order.indexOf('showPlanView') ? order.length - 2 : order.indexOf('showPlanView'));
    expect(viewButtonsOrderOf(null).slice(-2)).toEqual(['showPlanView', 'showBimView']);
    expect(new Set(order).size).toBe(order.length);
  });

  it('the saved view showBimView is understood; an unknown one is the Gantt', () => {
    expect(pmMainViewOf('showBimView')).toBe('showBimView');
    expect(pmMainViewOf('showSomethingElse')).toBe('showGanttChart');
  });

  it('projectIsBIMBased is true only when it is stored true', () => {
    expect(projectIsBimBased({ projectIsBIMBased: true })).toBe(true);
    for (const v of [{}, { projectIsBIMBased: false }, { projectIsBIMBased: 'true' }, null, undefined]) expect(projectIsBimBased(v as any)).toBe(false);
  });

  it('the facts of a model for the BIM tab', () => {
    const f = bimModelFacts({ modelGUID: 'm', revision: 2, sourceName: 'a.ifc', ifcSchema: 'IFC4', unitScale: 0.3048, converterVersion: 'bim-converter-1', originShift: [0, 0, 0], bbox: [], counts: { storeys: 4, elements: 58, tasks: 58, chunks: 4 }, created_at: '2026-11-20T10:11:12Z', sourceSha256: 'abcdef0123456789' });
    expect(f.find((x) => x.label === 'Elements')?.value).toBe('58');
    expect(f.find((x) => x.label === 'Imported')?.value).toBe('2026-11-20 10:11');
    expect(f.find((x) => x.label === 'Model hash')?.value).toBe('abcdef012345');
    expect(f.find((x) => x.label === 'Unit scale')?.value).toBe('0.3048');
  });
});
