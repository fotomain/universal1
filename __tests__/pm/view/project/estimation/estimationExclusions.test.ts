// The link to the estimation belongs to ONE project of THIS database: a file never brings it, a copy of a project keeps the link but not the note of the last fill.
import { planProjectImport } from '../../../../../kit8/pm/crud/exchange/project/import/planProjectImport';
import { buildProjectExchangeFile } from '../../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { planProjectCopy } from '../../../../../kit8/catalog/project/copy/projectCopy';
import { projectTreePath } from '../../../../../kit8/pm/view/project/scheduling';

const P1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const P2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const OTHER = 'cccccccc-0000-4000-8000-0000000000c1';
const row = (guid: string, json: any): any => ({ rowGUID: guid, treePath: projectTreePath(guid), rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name: 'n', ...json } });

describe('the estimation link and the other ways a project row is made', () => {
  it('a file import never takes projectEstimationGUID / projectEstimationLastFill; the project keeps its own', () => {
    const file = buildProjectExchangeFile(row(P2, { projectEstimationGUID: OTHER, projectEstimationLastFill: { at: 'x' }, planDay: false }), [], []);
    const own = row(P1, { name: 'Mine', projectEstimationGUID: P2 });
    const plan = planProjectImport(file, own, 'u', () => 'g');
    expect(plan.projectRowJSON.projectEstimationGUID).toBe(P2);
    expect(plan.projectRowJSON).not.toHaveProperty('projectEstimationLastFill');
    expect(plan.projectRowJSON.planDay).toBe(false); // the other settings of the file are still taken
    const without = planProjectImport(file, row(P1, { name: 'Mine' }), 'u', () => 'g');
    expect(without.projectRowJSON.projectEstimationGUID).toBeUndefined();
  });

  it('Copy of a project keeps the estimation, drops the note of the last fill', () => {
    const copy = planProjectCopy(row(P1, { projectEstimationGUID: P2, projectEstimationLastFill: { at: 'x' }, projectIsReadonly: true }), 'u', 'Mine (copy)', 2, () => 'new-guid');
    expect(copy.rowJSON.projectEstimationGUID).toBe(P2);
    expect(copy.rowJSON).not.toHaveProperty('projectEstimationLastFill');
    expect(copy.rowJSON).not.toHaveProperty('projectIsReadonly');
  });
});
