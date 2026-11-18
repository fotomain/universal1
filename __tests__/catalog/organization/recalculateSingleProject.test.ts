// recalculateSingleProject: the recalculation of ONE project after the user approved a change of ITS currencies (kit8/catalog/organization/currencies/recalculateOrganizationProjects.ts)
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
const mockUpdateProject = jest.fn(() => Promise.resolve());
jest.mock('../../../kit8/pm/crud/api/projectApi', () => ({ createProjectApi: () => ({ updateProject: (...a: any[]) => mockUpdateProject(...(a as [])) }) }));

import { recalculateSingleProject } from '../../../kit8/catalog/organization/currencies/recalculateOrganizationProjects';
import { projectTable, projectTaskTable } from '../../../kit8/pm/model/constants';
import { taskLineTable } from '../../../kit8/pm/view/task/finances/taskLineModel';

/** a client whose every call chain ends in the rows of the table it started from */
function fakeClient(tables: Record<string, any[]>, error?: string) {
  return {
    from(table: string) {
      const chain: any = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') return (res: any) => res({ data: error ? null : (tables[table] ?? []), error: error ? { message: error } : null });
          return () => chain;
        },
      });
      return chain;
    },
  };
}
const env = (sb: any) => ({ supabase: sb, currencies: { currencyForBudget: 'EUR', currencyForAccounting: 'EUR', currencyForContract: 'GBP' }, catalogs: {} as any, currencyRows: [], distributions: [], calendars: [] });

describe('recalculateSingleProject', () => {
  beforeEach(() => mockUpdateProject.mockClear());

  it('a project with no task lines is done: its currencies are written and nothing else happens', async () => {
    const sb = fakeClient({ [projectTable]: [{ rowGUID: 'p1', rowJSON: { name: 'Alpha', currencyForBudget: 'USD' } }], [taskLineTable]: [], [projectTaskTable]: [] });
    const r = await recalculateSingleProject(env(sb), 'p1');
    expect(r).toMatchObject({ projectGUID: 'p1', name: 'Alpha', status: 'done', linesChanged: 0, tasksPosted: 0 });
    expect(mockUpdateProject).toHaveBeenCalledTimes(1);
    expect((mockUpdateProject.mock.calls[0] as any[])[1].rowJSON.currencyForBudget).toBe('EUR');
  });

  it('a READ ONLY project is skipped and not written', async () => {
    const sb = fakeClient({ [projectTable]: [{ rowGUID: 'p1', rowJSON: { name: 'Alpha', projectIsReadonly: true } }] });
    const r = await recalculateSingleProject(env(sb), 'p1');
    expect(r.status).toBe('skipped');
    expect(r.reason).toContain('read only');
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });

  it('a refusal of the database (posted documents) is a failed result with the words, not an exception', async () => {
    mockUpdateProject.mockRejectedValueOnce(new Error('project currencies: the currencyForBudget cannot be changed while the project has posted documents'));
    const sb = fakeClient({ [projectTable]: [{ rowGUID: 'p1', rowJSON: { name: 'Alpha', currencyForBudget: 'USD' } }] });
    const r = await recalculateSingleProject(env(sb), 'p1');
    expect(r.status).toBe('failed');
    expect(r.reason).toContain('posted documents');
  });

  it('an unknown project and a database error are exceptions', async () => {
    await expect(recalculateSingleProject(env(fakeClient({ [projectTable]: [] })), 'nope')).rejects.toThrow('does not exist');
    await expect(recalculateSingleProject(env(fakeClient({}, 'boom')), 'p1')).rejects.toThrow('boom');
  });
});
