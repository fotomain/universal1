/** @jest-environment jsdom */
// PMFactInputDocumentList: the columns of a document (with the totals of the DOCUMENT), the footer, the six fast filters (typed → debounced → the filter handed to the data hook),
// a click on a row opens the form, Load more, Clear filters. The data hooks are fakes (their own test: useFactDocumentList.test.tsx).
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, mustGet, press, q, qa, renderUI, textOf, typeInto, wait } from '../ui/pmUiTestKit';

const mockAnswer: { current: any } = { current: null };
const mockCalls: { filter: any; limit: number }[] = [];
const mockRefetch = jest.fn();
jest.mock('../../../kit8/pm/fact/useFactDocumentList', () => ({
  useFactDocumentList: (filter: any, limit: number) => { mockCalls.push({ filter, limit }); return { answer: mockAnswer.current, isLoading: false, error: (globalThis as any).__listError ?? null, refetch: mockRefetch }; },
  useFactProjects: () => [{ guid: 'p1', name: 'Alpha' }, { guid: 'p2', name: 'Beta' }],
}));
const mockOpen = jest.fn();
jest.mock('../../../kit8/pm/fact/useOpenFactInput', () => ({ useOpenFactInput: () => mockOpen }));
const mockCatalogs: { current: any } = { current: null };
jest.mock('../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({ useTaskLineCatalogs: () => mockCatalogs.current }));
const mockSelects: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }); } };
});
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, error }: any) => R.createElement(TextInput, { testID, value, onChangeText, accessibilityLabel: error ? 'error' : undefined }) };
});

import PMFactInputDocumentList, { FACT_LIST_FILTER_DEBOUNCE_MS } from '../../../kit8/pm/fact/PMFactInputDocumentList';
import { EMPTY_FACT_LIST_FILTER, FactListRow } from '../../../kit8/pm/fact/factInputModel';
import { emptyTaskLineCatalogs } from '../../../kit8/pm/view/task/finances/taskLineCatalogs';

const T = 'fact-list';
const doc = (guid: string, over: Partial<FactListRow> = {}): FactListRow => ({
  documentGUID: guid, documentNumber: `FI-${guid}`, documentStatus: 'draft', strongInput: false, authorGUID: 'u1', authorName: 'Anna K', createdAt: '2026-10-14T08:00:00Z', postedAt: null, unpostedAt: null,
  projectGUID: 'p1', projectName: 'Alpha', taskGUID: 't1', taskName: 'task03', lineCount: 3, firstDay: '2026-10-01', lastDay: '2026-10-09', sumForBudget: 96, sumForContract: 80.5, sumForAccounting: 1234.5, ...over,
});
const answer = (rows: FactListRow[], totalCount = rows.length) => ({
  totalCount, rows,
  totals: { sumForBudget: rows.reduce((a, r) => a + r.sumForBudget, 0), sumForContract: rows.reduce((a, r) => a + r.sumForContract, 0), sumForAccounting: rows.reduce((a, r) => a + r.sumForAccounting, 0) },
});
const lastFilter = () => mockCalls[mockCalls.length - 1].filter;
const settle = () => wait(FACT_LIST_FILTER_DEBOUNCE_MS + 60);

beforeEach(() => {
  mockCalls.length = 0;
  (globalThis as any).__listError = null;
  mockAnswer.current = answer([doc('d1'), doc('d2', { documentStatus: 'posted', strongInput: true, taskName: 'task07', projectName: 'Beta', projectGUID: 'p2', taskGUID: 't2', sumForBudget: 4, sumForContract: 5, sumForAccounting: 6, firstDay: null, lastDay: null })]);
  const c = emptyTaskLineCatalogs();
  c.businessUnit = [{ rowGUID: 'bu1', rowJSON: { name: 'Sales' } }] as any;
  c.resourceRole = [{ rowGUID: 'role1', rowJSON: { name: 'Welder' } }] as any;
  c.person = [{ rowGUID: 'pe1', rowJSON: { firstName: 'Ann', lastName: 'Lee' } }] as any;
  mockCatalogs.current = c;
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('the table', () => {
  it('a row per document: number · status · mode, task · project, period, lines, the three totals of the DOCUMENT, author, created', () => {
    renderUI(<PMFactInputDocumentList />);
    expect(textOf(`${T}-title`)).toBe('Actuals');
    const r1 = textOf(`${T}-row-d1`);
    expect(r1).toContain('FI-d1');
    expect(r1).toContain('Draft');
    expect(r1).toContain('Free');
    expect(r1).toContain('task03 · Alpha');
    expect(r1).toContain('Anna K');
    expect(r1).toContain('2026-10-14');
    expect(textOf(`${T}-budget-d1`)).toBe('96.00');
    expect(textOf(`${T}-contract-d1`)).toBe('80.50');
    expect(textOf(`${T}-accounting-d1`)).toMatch(/^1.?234[.,]50$/);
    const r2 = textOf(`${T}-row-d2`);
    expect(r2).toContain('Posted');
    expect(r2).toContain('Strong');
    expect(textOf(`${T}-period-d2`)).toBe('');
  });
  it('the headers: Document, Period, Lines, sumForBudget, sumForContract, sumForAccounting, Author', () => {
    renderUI(<PMFactInputDocumentList />);
    const t = document.body.textContent || '';
    ['Document', 'Period', 'Lines', 'sumForBudget', 'sumForContract', 'sumForAccounting', 'Author', 'Created'].forEach((h) => expect(t).toContain(h));
    expect(t.indexOf('sumForBudget')).toBeLessThan(t.indexOf('sumForContract'));
    expect(t.indexOf('sumForContract')).toBeLessThan(t.indexOf('sumForAccounting'));
    expect(t.indexOf('sumForAccounting')).toBeLessThan(t.indexOf('Created'));
  });
  it('the footer adds up the listed documents', () => {
    renderUI(<PMFactInputDocumentList />);
    expect(textOf(`${T}-count`)).toBe('2 documents');
    expect(textOf(`${T}-total-budget`)).toBe('100.00');
    expect(textOf(`${T}-total-contract`)).toBe('85.50');
  });
  it('an empty list says so (and says it differently when filters are on)', async () => {
    mockAnswer.current = answer([]);
    renderUI(<PMFactInputDocumentList />);
    expect(textOf(`${T}-empty`)).toContain('No fact input documents yet');
    typeInto(`${T}-authorFilter`, 'zzz');
    await settle();
    expect(textOf(`${T}-empty`)).toContain('No document matches the filters');
  });
  it('an error of the database is shown', () => {
    (globalThis as any).__listError = 'permission denied';
    renderUI(<PMFactInputDocumentList />);
    expect(textOf(`${T}-error`)).toBe('permission denied');
  });
  it('a click on a row opens the form of THAT document', () => {
    renderUI(<PMFactInputDocumentList />);
    press(`${T}-row-d2`);
    expect(mockOpen).toHaveBeenCalledWith({ taskGUID: 't2', projectGUID: 'p2', documentGUID: 'd2' });
  });
  it('Refresh reads again', () => {
    renderUI(<PMFactInputDocumentList />);
    press(`${T}-refresh`);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe('the fast filters', () => {
  it('the six filters are there, in the order of the task', () => {
    renderUI(<PMFactInputDocumentList />);
    expectInOrder([`${T}-factTimelinePeriod-from`, `${T}-factTimelinePeriod-to`, `${T}-factProjectFilter`, `${T}-factBusinessUnitFilter`, `${T}-factRoleFilter`, `${T}-factResourceFilter`, `${T}-authorFilter`]);
  });
  it('they start empty', () => {
    renderUI(<PMFactInputDocumentList />);
    expect(lastFilter()).toEqual(EMPTY_FACT_LIST_FILTER);
    expect(q(`${T}-clear`)).toBeNull();
  });
  it('typing is applied after a pause - not on every key', async () => {
    renderUI(<PMFactInputDocumentList />);
    typeInto(`${T}-authorFilter`, 'Ann');
    expect(lastFilter().author).toBe('');
    await settle();
    expect(lastFilter().author).toBe('Ann');
  });
  it('the period: from and to', async () => {
    renderUI(<PMFactInputDocumentList />);
    typeInto(`${T}-factTimelinePeriod-from`, '2026-10-01');
    typeInto(`${T}-factTimelinePeriod-to`, '2026-10-31');
    await settle();
    expect(lastFilter()).toMatchObject({ fromDay: '2026-10-01', toDay: '2026-10-31' });
  });
  it('an unreadable date is an error of the field (the RPC filter ignores it)', () => {
    renderUI(<PMFactInputDocumentList />);
    typeInto(`${T}-factTimelinePeriod-from`, 'soon');
    expect(q(`${T}-factTimelinePeriod-from`)!.getAttribute('aria-label')).toBe('error');
    expect(q(`${T}-factTimelinePeriod-to`)!.getAttribute('aria-label')).toBeNull();
  });
  it('project / business unit / role / resource are selects: the label is the placeholder, the clear icon is inside the field (clearable)', async () => {
    renderUI(<PMFactInputDocumentList />);
    expect(mockSelects[`${T}-factProjectFilter`].items).toEqual([{ value: 'p1', label: 'Alpha' }, { value: 'p2', label: 'Beta' }]);
    expect([['factProjectFilter', 'Project'], ['factBusinessUnitFilter', 'Business unit'], ['factRoleFilter', 'Role'], ['factResourceFilter', 'Resource']].map(([k, l]) => [mockSelects[`${T}-${k}`].placeholder, mockSelects[`${T}-${k}`].clearable, mockSelects[`${T}-${k}`].label]))
      .toEqual([['Project', true, undefined], ['Business unit', true, undefined], ['Role', true, undefined], ['Resource', true, undefined]]);
    expect(mockSelects[`${T}-factBusinessUnitFilter`].items.map((i: any) => i.value)).toEqual(['bu1']);
    expect(mockSelects[`${T}-factRoleFilter`].items.map((i: any) => i.value)).toEqual(['role1']);
    const res = mockSelects[`${T}-factResourceFilter`].items;
    expect(res.every((i: any) => i.value !== '')).toBe(true);
    expect(res.find((i: any) => i.value === 'pe1')).toMatchObject({ group: 'Persons' });
    typeInto(`${T}-factProjectFilter`, 'p2');
    typeInto(`${T}-factBusinessUnitFilter`, 'bu1');
    typeInto(`${T}-factRoleFilter`, 'role1');
    typeInto(`${T}-factResourceFilter`, 'pe1');
    await settle();
    expect(lastFilter()).toMatchObject({ projectGUID: 'p2', businessUnitGUID: 'bu1', roleGUID: 'role1', resourceGUID: 'pe1' });
  });
  it('a project given by the screen fixes the filter and hides the project select', () => {
    renderUI(<PMFactInputDocumentList projectGUID="p2" />);
    expect(q(`${T}-factProjectFilter`)).toBeNull();
    expect(lastFilter().projectGUID).toBe('p2');
  });
  it('ONE row: the filters do not wrap (they scroll sideways when narrow)', () => {
    renderUI(<PMFactInputDocumentList />);
    const inner = mustGet(`${T}-filters`).firstElementChild as HTMLElement;
    expect(getComputedStyle(inner).flexWrap).toBe('nowrap');
    expect(getComputedStyle(inner).flexDirection).toBe('row');
    const ids = [`${T}-factTimelinePeriod-from`, `${T}-factTimelinePeriod-to`, `${T}-factProjectFilter`, `${T}-factBusinessUnitFilter`, `${T}-factRoleFilter`, `${T}-factResourceFilter`, `${T}-authorFilter`];
    ids.forEach((id) => expect(inner.contains(mustGet(id))).toBe(true));
  });
  it('the clear icon of a select empties its filter (onSelect with the empty value)', async () => {
    renderUI(<PMFactInputDocumentList />);
    typeInto(`${T}-factProjectFilter`, 'p2');
    await settle();
    expect(lastFilter().projectGUID).toBe('p2');
    act(() => mockSelects[`${T}-factProjectFilter`].onSelect(''));
    await settle();
    expect(lastFilter().projectGUID).toBe('');
  });
  it('Clear filters appears with a filter and empties them at once', async () => {
    renderUI(<PMFactInputDocumentList />);
    typeInto(`${T}-authorFilter`, 'Ann');
    expect(q(`${T}-clear`)).not.toBeNull();
    await settle();
    press(`${T}-clear`);
    expect(lastFilter()).toEqual(EMPTY_FACT_LIST_FILTER);
    expect(inputValue(`${T}-authorFilter`)).toBe('');
    expect(q(`${T}-clear`)).toBeNull();
  });
  it('Clear filters keeps the project fixed by the screen', async () => {
    renderUI(<PMFactInputDocumentList projectGUID="p2" />);
    typeInto(`${T}-authorFilter`, 'Ann');
    press(`${T}-clear`);
    expect(lastFilter()).toEqual({ ...EMPTY_FACT_LIST_FILTER, projectGUID: 'p2' });
  });
});

describe('Load more', () => {
  it('only when the database has more; each press asks for 200 more', async () => {
    renderUI(<PMFactInputDocumentList />);
    expect(q(`${T}-more`)).toBeNull();
    cleanupUI();
    mockAnswer.current = answer([doc('d1'), doc('d2')], 450);
    renderUI(<PMFactInputDocumentList />);
    expect(textOf(`${T}-count`)).toBe('2 of 450 documents');
    expect(textOf(`${T}-more`)).toContain('Load more');
    expect(mockCalls[mockCalls.length - 1].limit).toBe(200);
    press(`${T}-more`);
    expect(mockCalls[mockCalls.length - 1].limit).toBe(400);
  });
  it('a new filter starts from the first page again', async () => {
    mockAnswer.current = answer([doc('d1')], 450);
    renderUI(<PMFactInputDocumentList />);
    press(`${T}-more`);
    expect(mockCalls[mockCalls.length - 1].limit).toBe(400);
    typeInto(`${T}-authorFilter`, 'Ann');
    await settle();
    expect(mockCalls[mockCalls.length - 1].limit).toBe(200);
  });
});
