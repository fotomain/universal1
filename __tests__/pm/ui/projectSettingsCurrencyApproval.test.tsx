/** @jest-environment jsdom */
// The currencies of a project are its own (documentation/CONSOLIDATION_WBS.html section 1): a change in the Project settings window asks an approval (Yes = save + recalculate THIS project,
// Cancel = save nothing); an unchanged currency asks nothing; the database refusal (posted documents) is told in a window.
import React, { act } from 'react';
import { cleanupUI, OWNER, press, q, renderUI, seedStore } from './pmUiTestKit';

const mockUpdate = jest.fn();
jest.mock('../../../kit8/pm/crud/queries', () => ({
  useBuildProjectRow: () => (name: string) => ({ rowGUID: 'x', treePath: 'x', rowOwnerGUID: 'x', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { name } }),
  useCreateProjectMutation: () => ({ mutate: jest.fn() }),
  useUpdateProjectMutation: () => ({ mutate: (...a: any[]) => mockUpdate(...a) }),
  useDeleteProjectMutation: () => ({ mutate: jest.fn() }),
  useSetProjectReadonlyMutation: () => ({ mutate: jest.fn() }),
  useProjectSearchQuery: () => ({ data: undefined, isFetching: false }),
  useSaveProjectUserSettings: () => ({ saveUxuiSettings: jest.fn(), isSaving: false }),
}));
jest.mock('../../../kit8/pm/crud/exchange/project/ImportExportProject', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: () => R.createElement(View, { testID: 'pm-project-exchange' }) };
});
jest.mock('../../../kit8/pm/view/kanban/PMKanbanStagesModalWindow', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));

jest.mock('../../../kit8/catalog/organization/useMyOrganization', () => ({
  useMyOrganization: () => ({ organizationGUID: 'org-1', defaults: { currencyForBudget: 'USD', currencyForAccounting: 'EUR', currencyForContract: 'GBP' }, loaded: true, saveDefaultProjectSettings: jest.fn() }),
}));
jest.mock('../../../kit8/redux/storeRef', () => ({ appDispatch: jest.fn(), getUxuiState: () => ({}) }));

let mockAnswer: 'yes' | 'cancel' = 'yes';
const mockAsk = jest.fn((_r: any) => Promise.resolve(mockAnswer));
jest.mock('../../../kit8/pm/inner/PMApproveYesNoCancelModalWindow', () => ({ __esModule: true, default: () => null, askPMApprove: (r: any) => mockAsk(r) }));
const mockErrorModal = jest.fn();
jest.mock('../../../kit8/ui/components/common/ErrorModalWindow', () => ({ __esModule: true, default: () => null, showErrorModal: (...a: any[]) => mockErrorModal(...a) }));
const mockRecalc = jest.fn((..._a: any[]) => Promise.resolve({ projectGUID: 'p', name: 'P', status: 'done', linesChanged: 2, tasksPosted: 1, tasksNeedPost: 0, linesWithoutRate: 0, postProblems: [] }));
jest.mock('../../../kit8/catalog/organization/currencies/useOrganizationCurrencyRecalc', () => ({ useProjectCurrencyRecalc: () => (...a: any[]) => mockRecalc(...a), useOrganizationCurrencyRecalc: () => jest.fn() }));

import PMRecentProjectsToolbar from '../../../kit8/pm/view/project/recent/PMRecentProjectsToolbar';

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const sampleCurrencies = [
  { rowGUID: 'cur-eur', rowOwnerGUID: 'currencyCatalog', rowParentGUID: 'empty', orderInList: 0, rowJSON: { currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', decimalDigits: 2, isActive: true } },
  { rowGUID: 'cur-usd', rowOwnerGUID: 'currencyCatalog', rowParentGUID: 'empty', orderInList: 1, rowJSON: { currencyCode: 'USD', currencyName: 'US Dollar', currencySymbol: '$', decimalDigits: 2, isActive: true } },
];

describe('Project settings window: a change of the currencies of a project', () => {
  beforeEach(() => {
    // pmUiTestKit's react-redux mock is the one in effect: it reads this state
    (globalThis as any).__pmTestReduxState = { currencyReusable: { entityDataFromServer: sampleCurrencies } }; mockUpdate.mockReset(); mockAsk.mockClear(); mockRecalc.mockClear(); mockErrorModal.mockClear(); mockAnswer = 'yes'; });
  afterEach(() => { cleanupUI(); delete (globalThis as any).__pmTestReduxState; });

  const openWithCurrencies = () => {
    const { demo, store } = seedStore();
    act(() => store.getState().setProjects(demo.projects.map((p: any, i: number) => (i === 0 ? { ...p, rowJSON: { ...p.rowJSON, currencyForBudget: 'USD', currencyForAccounting: 'EUR', currencyForContract: 'GBP' } } : p))));
    renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    press('pm-project-edit');
    press('pm-project-tab-TabBudgets');
    return demo.projects[0].rowGUID as string;
  };
  // the picker list is a FlatList (one item rendered in jsdom): the change is made with the Clear button of the field
  const pickBudgetEur = () => { press('pm-project-currencyForBudget-clear'); };

  it('Yes: the approval lists the change, the project is saved, then THIS project is recalculated with its new currencies', async () => {
    const guid = openWithCurrencies();
    pickBudgetEur();
    press('pm-project-save');
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    const req = mockAsk.mock.calls[0][0];
    expect(req.message).toContain('Budget currency: USD → -');
    expect(req.hideNo).toBe(true); // Yes / Cancel only
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][0].patch.rowJSON.currencyForBudget).toBeNull();
    await act(async () => { mockUpdate.mock.calls[0][1].onSuccess(); await Promise.resolve(); });
    expect(mockRecalc).toHaveBeenCalledTimes(1);
    expect(mockRecalc.mock.calls[0][0]).toBe(guid);
    expect(mockRecalc.mock.calls[0][1]).toEqual({ currencyForBudget: '', currencyForAccounting: 'EUR', currencyForContract: 'GBP' });
  });

  it('Cancel: nothing is saved', async () => {
    openWithCurrencies();
    mockAnswer = 'cancel';
    pickBudgetEur();
    press('pm-project-save');
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockRecalc).not.toHaveBeenCalled();
  });

  it('the refusal of the database (posted documents) is told in a window', async () => {
    openWithCurrencies();
    pickBudgetEur();
    press('pm-project-save');
    await flush();
    mockUpdate.mock.calls[0][1].onError(new Error('project currencies: the currencyForBudget cannot be changed while the project has posted documents (movements: used 1). Unpost them first.'));
    expect(mockErrorModal.mock.calls[0][0]).toContain('posted documents');
  });

  it('no change of the currencies: no question, no recalculation', async () => {
    openWithCurrencies();
    press('pm-project-save');
    await flush();
    expect(mockAsk).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate.mock.calls[0][1].onSuccess).toBeUndefined();
    expect(q('pm-project-currencies-own')).toBeNull();
  });
});
