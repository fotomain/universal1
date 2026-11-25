/** @jest-environment jsdom */
// PMProjectEstimationTab + ProjectEstimationGUIDInput + FillProjectFromEstimationButton: the input is always enabled (only a read-only project locks it), the table gets the summary,
// Fill is disabled with the reason written under it.
import { act } from 'react';
import { cleanupUI, press, q, qa, renderUI, textOf, typeInto } from '../../../ui/pmUiTestKit';

let mockSummaryState: any = { data: null, isLoading: false, error: null };
let mockSourceRow: any = null;
let mockSourceLoading = false;
let mockSearch: any[] = [];
let mockRate: number | null = null;
jest.mock('../../../../../kit8/pm/view/project/estimation/useProjectEstimation', () => ({
  useEstimationSummary: () => mockSummaryState,
  useEstimationRate: () => ({ data: mockRate }),
  useFillProjectFromEstimation: () => ({ run: jest.fn(), cancel: jest.fn() }),
}));
jest.mock('../../../../../kit8/pm/crud/project/projectQueries', () => ({ useReadProjectQuery: () => ({ data: mockSourceRow, isLoading: mockSourceLoading }) }));
jest.mock('../../../../../kit8/pm/crud/queries', () => ({ useProjectSearchQuery: () => ({ data: mockSearch, isFetching: false }) }));
jest.mock('../../../../../kit8/pm/view/project/estimation/FillProjectFromEstimationWindow', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../../kit8/pm/view/project/dashboardDeepLink', () => ({ openProjectBoard: (...a: any[]) => (global as any).__opened.push(a) }));
jest.mock('../../../../../kit8/pm/view/project/estimation/ProjectEstimationTable', () => ({
  __esModule: true,
  default: (p: any) => require('react').createElement(require('react-native').Text, { testID: 'table-stub' }, JSON.stringify({ hasSummary: !!p.summary, loading: !!p.loading, error: p.error ?? null, rate: p.rate ?? null, targetCurrency: p.targetCurrency ?? null })),
}));

import React from 'react';
import PMProjectEstimationTab from '../../../../../kit8/pm/view/project/estimation/PMProjectEstimationTab';
import { parseEstimationSummary } from '../../../../../kit8/pm/view/project/estimation/estimationModel';

const P1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const P2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const P3 = 'aaaaaaaa-0000-4000-8000-0000000000a3';
const side = (extra: any = {}) => ({ projectGUID: P2, name: 'Estimate', currencyForBudget: 'EUR', currencyForAccounting: 'EUR', tasks: 24, links: 31, lines: 11, linesWithoutItem: 0, linesWithoutSum: 0, items: [], ...extra });
const summary = (target: any = {}, source: any = {}) => parseEstimationSummary({ source: side(source), target: side({ projectGUID: P1, name: 'Hall 12', tasks: 1, postedTasks: 0, documents: 0, readonly: false, canCreate: true, roots: [], ...target }) });
const proj = (guid: string, name: string, json: any = {}): any => ({ rowGUID: guid, treePath: guid, rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name, currencyForBudget: 'EUR', ...json } });

const render = (props: any = {}) => {
  const onChange = props.onChange ?? jest.fn();
  renderUI(<PMProjectEstimationTab values={props.values ?? {}} onChange={onChange} savedProject={'savedProject' in props ? props.savedProject : proj(P1, 'Hall 12')} ownerGUID="u" draftBudgetCurrency={props.draftBudgetCurrency ?? 'EUR'} locked={props.locked} />);
  return onChange;
};

beforeEach(() => {
  mockSummaryState = { data: null, isLoading: false, error: null };
  mockSourceRow = null; mockSourceLoading = false; mockSearch = []; mockRate = null;
  (global as any).__opened = [];
});
afterEach(() => cleanupUI());

describe('Project settings -> Estimation', () => {
  it('no estimation yet: the input is there and enabled, a hint, no table, Fill disabled with its reason', () => {
    render();
    expect(q('pm-project-tab-estimation-content')).not.toBeNull();
    expect((q('pm-project-estimation-input-text') as HTMLInputElement).readOnly).toBeFalsy();
    expect(q('pm-project-estimation-input-empty')).not.toBeNull();
    expect(q('table-stub')).toBeNull();
    expect(textOf('pm-estimation-fill-button-reason')).toBe('Pick the estimation project first.');
  });

  it('the list offers the other projects, never the project itself; a pick is handed up', () => {
    mockSearch = [proj(P1, 'Hall 12'), proj(P2, 'Hall 12 - Estimate'), proj(P3, 'Other')];
    const onChange = render();
    press('pm-project-estimation-input-toggle');
    expect(q('pm-project-estimation-input-list')).not.toBeNull();
    expect(q(`pm-project-estimation-input-item-${P1}`)).toBeNull();
    expect(q(`pm-project-estimation-input-item-${P2}`)).not.toBeNull();
    press(`pm-project-estimation-input-item-${P2}`);
    expect(onChange).toHaveBeenCalledWith({ projectEstimationGUID: P2 });
  });

  it('a project that is not saved yet may pick any project (also the list shows all)', () => {
    mockSearch = [proj(P1, 'A'), proj(P2, 'B')];
    renderUI(<PMProjectEstimationTab values={{}} onChange={jest.fn()} savedProject={null} ownerGUID="u" />);
    press('pm-project-estimation-input-toggle');
    expect(qa('pm-project-estimation-input-item-')).toHaveLength(2);
  });

  it('the estimation is named: Clear removes the link, Open opens it, the table gets the summary', () => {
    mockSourceRow = proj(P2, 'Hall 12 - Estimate', { projectStartDate: '2026-12-01' });
    mockSummaryState = { data: summary(), isLoading: false, error: null };
    const onChange = render({ values: { projectEstimationGUID: P2 }, savedProject: proj(P1, 'Hall 12', { projectEstimationGUID: P2 }) });
    expect(JSON.parse(textOf('table-stub')).hasSummary).toBe(true);
    expect(textOf('pm-project-estimation-input-info')).toContain('2026-12-01');
    press('pm-project-estimation-input-open');
    expect((global as any).__opened[0][0]).toBe(P2);
    press('pm-project-estimation-input-clear');
    expect(onChange).toHaveBeenCalledWith({ projectEstimationGUID: null });
  });

  it('Fill is enabled when it can be done and says what will be copied', () => {
    mockSourceRow = proj(P2, 'Estimate');
    mockSummaryState = { data: summary(), isLoading: false, error: null };
    render({ values: { projectEstimationGUID: P2 }, savedProject: proj(P1, 'Hall 12', { projectEstimationGUID: P2 }) });
    expect(q('pm-estimation-fill-button-reason')).toBeNull();
    expect(textOf('pm-estimation-fill-button-what')).toContain('24 tasks, 31 links and 11 task lines will be copied');
  });

  it('the reasons, written under the disabled button', () => {
    mockSourceRow = proj(P2, 'Estimate');
    const link = { projectEstimationGUID: P2 };
    // a project that is not saved yet
    mockSummaryState = { data: summary(), isLoading: false, error: null };
    renderUI(<PMProjectEstimationTab values={link} onChange={jest.fn()} savedProject={null} ownerGUID="u" />);
    expect(textOf('pm-estimation-fill-button-reason')).toContain('Save the project first');
    cleanupUI();
    // the link was changed in the window and not saved
    render({ values: link, savedProject: proj(P1, 'Hall 12') });
    expect(textOf('pm-estimation-fill-button-reason')).toContain('save the settings first');
    cleanupUI();
    // read-only / no right / empty estimation
    mockSummaryState = { data: summary({ readonly: true }), isLoading: false, error: null };
    render({ values: link, savedProject: proj(P1, 'Hall 12', link) });
    expect(textOf('pm-estimation-fill-button-reason')).toContain('Read-only project');
    cleanupUI();
    mockSummaryState = { data: summary({ canCreate: false }), isLoading: false, error: null };
    render({ values: link, savedProject: proj(P1, 'Hall 12', link) });
    expect(textOf('pm-estimation-fill-button-reason')).toContain('may not create tasks');
    cleanupUI();
    mockSummaryState = { data: summary({}, { tasks: 0 }), isLoading: false, error: null };
    render({ values: link, savedProject: proj(P1, 'Hall 12', link) });
    expect(textOf('pm-estimation-fill-button-reason')).toContain('has no tasks');
  });

  it('an estimation that cannot be read: the message, the table says it, Fill is disabled', () => {
    mockSourceRow = null;
    mockSummaryState = { data: null, isLoading: false, error: new Error('No permission: the estimation project does not exist or you cannot read it') };
    const link = { projectEstimationGUID: P2 };
    render({ values: link, savedProject: proj(P1, 'Hall 12', link) });
    expect(textOf('pm-project-estimation-input-notfound')).toContain('not found');
    expect(JSON.parse(textOf('table-stub')).error).toBe('the estimation project does not exist or you cannot read it');
    expect(textOf('pm-estimation-fill-button-reason')).toContain('not found');
  });

  it('a read-only project: the input is shown but locked (no clear, no list)', () => {
    mockSourceRow = proj(P2, 'Estimate');
    mockSummaryState = { data: summary(), isLoading: false, error: null };
    const link = { projectEstimationGUID: P2 };
    render({ values: link, savedProject: proj(P1, 'Hall 12', link), locked: true });
    expect(q('pm-project-estimation-input-locked')).not.toBeNull();
    expect(q('pm-project-estimation-input-clear')).toBeNull();
    expect(q('pm-project-estimation-input-toggle')).toBeNull();
    expect((q('pm-project-estimation-input-text') as HTMLInputElement).readOnly).toBe(true);
  });

  it('the note of the last fill is shown while it belongs to the estimation that is named', () => {
    mockSourceRow = proj(P2, 'Estimate');
    mockSummaryState = { data: summary(), isLoading: false, error: null };
    const link = { projectEstimationGUID: P2 };
    render({ values: link, savedProject: proj(P1, 'Hall 12', { ...link, projectEstimationLastFill: { at: '2026-12-02T10:14:00.000Z', sourceGUID: P2, mode: 'append', tasks: 24, lines: 11 } }) });
    expect(textOf('pm-project-estimation-last')).toContain('2026-12-02 10:14');
    expect(textOf('pm-project-estimation-last')).toContain('24 tasks');
  });

  it('the currency of the draft reaches the table (a project that is not saved yet), the rate too', () => {
    mockSourceRow = proj(P2, 'Estimate');
    mockRate = 1.1;
    const raw = summary({ currencyForBudget: 'USD' });
    mockSummaryState = { data: raw, isLoading: false, error: null };
    const link = { projectEstimationGUID: P2 };
    render({ values: link, savedProject: proj(P1, 'Hall 12', link), draftBudgetCurrency: 'USD' });
    expect(JSON.parse(textOf('table-stub'))).toMatchObject({ rate: 1.1, targetCurrency: 'USD' });
  });

  it('typing in the field searches (the text is kept in the field while it is open)', async () => {
    mockSearch = [proj(P3, 'Other')];
    render();
    typeInto('pm-project-estimation-input-text', 'Oth');
    await act(async () => { await Promise.resolve(); });
    expect(q('pm-project-estimation-input-list')).not.toBeNull();
    expect(q(`pm-project-estimation-input-item-${P3}`)).not.toBeNull();
  });
});
