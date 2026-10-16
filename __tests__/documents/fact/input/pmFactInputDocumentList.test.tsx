/** @jest-environment jsdom */
// PMFactInputDocumentList: a ReusableTable (entity taskFactHeader) with CRUD - the rows the database listed, their columns read from the list rows, New document (RPC) / Open / Delete - and the six
// fast filters (typed → debounced → the filter handed to the data hook), Clear filters. The data hooks and the table are fakes (their own tests: useFactDocumentList, factListColumns, __tests__/ui/table).
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, mustGet, press, q, renderUI, textOf, typeInto, wait } from '../../../pm/ui/pmUiTestKit';

const mockAnswer: { current: any } = { current: null };
const mockCalls: { filter: any; limit: number; extra?: any }[] = [];
const mockRefetch = jest.fn();
jest.mock('../../../../kit8/documents/fact/input/useFactDocumentList', () => ({
  useFactDocumentList: (filter: any, limit: number, extra?: any) => { mockCalls.push({ filter, limit, extra }); return { answer: mockAnswer.current, isLoading: false, error: (globalThis as any).__listError ?? null, refetch: mockRefetch }; },
  useFactProjects: () => [{ guid: 'p1', name: 'Alpha' }, { guid: 'p2', name: 'Beta' }],
}));
const mockOpen = jest.fn();
const mockTable = jest.fn();
jest.mock('../../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
const mockCreate = jest.fn(async (_c: any, _task: string) => 'doc-new');
jest.mock('../../../../kit8/documents/fact/input/factInputApi', () => ({ createFactDocument: (...a: any[]) => (mockCreate as any)(...a) }));
const mockModal: { props: any } = { props: null };
jest.mock('../../../../kit8/documents/fact/input/PMFactNewDocumentModal', () => ({ __esModule: true, default: (p: any) => { mockModal.props = p; return p.visible ? require('react').createElement('div', { 'data-testid': p.testID }, p.error ? require('react').createElement('span', { 'data-testid': `${p.testID}-error` }, p.error) : null) : null; } }));
jest.mock('../../../../kit8/documents/fact/input/useOpenFactInput', () => ({ useOpenFactInput: () => mockOpen }));
const mockCatalogs: { current: any } = { current: null };
jest.mock('../../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({ useTaskLineCatalogs: () => mockCatalogs.current }));
const mockSelects: Record<string, any> = {};
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => { mockSelects[p.testID] = p; return R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }); } };
});
jest.mock('../../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, error }: any) => R.createElement(TextInput, { testID, value, onChangeText, accessibilityLabel: error ? 'error' : undefined }) };
});

import PMFactInputDocumentList, { FACT_LIST_FILTER_DEBOUNCE_MS } from '../../../../kit8/documents/fact/input/PMFactInputDocumentList';
import { EMPTY_FACT_LIST_FILTER, FACT_HEADER_ENTITY, FactListRow } from '../../../../kit8/documents/fact/input/factInputModel';
import { factListColumns } from '../../../../kit8/documents/fact/input/factListColumns';
import { emptyTaskLineCatalogs } from '../../../../kit8/pm/view/task/finances/taskLineCatalogs';

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
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });
const lastTable = () => mockTable.mock.calls.at(-1)![0];
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('the table (ReusableTable with CRUD)', () => {
  it('reads the documents of the redux entity taskFactHeader (all owners, newest first), not custom rows', () => {
    renderUI(<PMFactInputDocumentList />);
    expect(lastTable()).toMatchObject({ entityName: FACT_HEADER_ENTITY, listOwnerGUID: '*', listParentGUID: '*', reorderEnabled: false, itemLabel: 'Document' });
    expect(lastTable().readParams).toEqual({ orderBy: 'created_at', ascending: false });
    expect(q(`${T}-lines`)).not.toBeNull();
  });
  it('the project given by the screen scopes the read', () => {
    renderUI(<PMFactInputDocumentList projectGUID="p2" />);
    expect(lastTable().readParams).toEqual({ orderBy: 'created_at', ascending: false, match: { rowProjectGUID: 'p2' } });
  });
  it('rowFilter: exactly the documents the database listed for the filters', () => {
    renderUI(<PMFactInputDocumentList />);
    const rf = lastTable().rowFilter;
    expect(rf({ rowGUID: 'd1' })).toBe(true);
    expect(rf({ rowGUID: 'd2' })).toBe(true);
    expect(rf({ rowGUID: 'not-listed' })).toBe(false);
  });
  it('the columns read their cells from the list rows by GUID (author, task, totals of the document ...)', () => {
    renderUI(<PMFactInputDocumentList />);
    const cols = lastTable().visualColumns;
    const read = (key: string, guid: string) => cols.find((c: any) => c.key === key).fromStored(null, { rowGUID: guid });
    expect(cols.map((c: any) => c.key)).toEqual(['n', 'document', 'status', 'input', 'task', 'project', 'period', 'lines', 'sumForBudget', 'sumForContract', 'sumForAccounting', 'author', 'created']);
    expect(read('document', 'd1')).toBe('FI-d1');
    expect(read('sumForBudget', 'd1')).toBe(96);
    expect(read('sumForContract', 'd1')).toBe(80.5);
    expect(read('sumForAccounting', 'd1')).toBe(1234.5);
    expect(read('author', 'd1')).toBe('Anna K');
    expect(read('status', 'd2')).toBe('Posted');
    expect(read('input', 'd2')).toBe('Strong');
    expect(read('task', 'd2')).toBe('task07');
  });
  it('CRUD - Create: the add button opens the New fact document window; Create makes the document by the RPC and opens its form', async () => {
    renderUI(<PMFactInputDocumentList />);
    expect(q(`${T}-new`)).toBeNull();
    act(() => lastTable().onAdd());
    expect(q(`${T}-new`)).not.toBeNull();
    await act(async () => { mockModal.props.onCreate('t9', 'p1'); });
    await flush();
    expect(mockCreate).toHaveBeenCalledWith(expect.anything(), 't9');
    expect(mockOpen).toHaveBeenCalledWith({ taskGUID: 't9', projectGUID: 'p1', documentGUID: 'doc-new' });
    expect(mockRefetch).toHaveBeenCalled();
    expect(q(`${T}-new`)).toBeNull();                                     // the window is closed
  });
  it('a refused Create keeps the window open and shows the message', async () => {
    mockCreate.mockRejectedValueOnce(new Error('not allowed'));
    renderUI(<PMFactInputDocumentList />);
    act(() => lastTable().onAdd());
    await act(async () => { mockModal.props.onCreate('t9', 'p1'); });
    await flush();
    expect(textOf(`${T}-new-error`)).toBe('not allowed');
    expect(mockOpen).not.toHaveBeenCalled();
  });
  it('CRUD - Open: a click on a row (and the menu "Open document") opens the form of THAT document', () => {
    renderUI(<PMFactInputDocumentList />);
    expect(lastTable().openLabel).toBe('Open document');
    lastTable().onRowOpen({ rowGUID: 'd2' });
    expect(mockOpen).toHaveBeenCalledWith({ taskGUID: 't2', projectGUID: 'p2', documentGUID: 'd2' });
  });
  it('CRUD - Read / Delete: the table keeps its own selection, delete and menu (crud panel on, no reorder)', () => {
    renderUI(<PMFactInputDocumentList />);
    expect(lastTable().crudPanelEnabled).toBeUndefined();                 // the default: on
    expect(lastTable().addEnabled).toBeUndefined();
    expect(lastTable().contextMenuEnabled).toBeUndefined();
  });
  it('the empty text says it differently when filters are on', async () => {
    renderUI(<PMFactInputDocumentList />);
    expect(lastTable().emptyText).toContain('No fact input documents yet');
    typeInto(`${T}-authorFilter`, 'zzz');
    await settle();
    expect(lastTable().emptyText).toContain('No document matches the filters');
  });
  it('the list asks for up to 1000 documents; the table has its own search, sort and column filters', () => {
    renderUI(<PMFactInputDocumentList />);
    expect(mockCalls[mockCalls.length - 1].limit).toBe(1000);
  });
  it('an error of the database is shown', () => {
    (globalThis as any).__listError = 'permission denied';
    renderUI(<PMFactInputDocumentList />);
    expect(textOf(`${T}-error`)).toBe('permission denied');
  });
  it('Refresh reads again', () => {
    renderUI(<PMFactInputDocumentList />);
    press(`${T}-refresh`);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
  it('a document made / posted elsewhere (the redux entity changes by realtime) reads the list again', () => {
    (globalThis as any).__pmTestReduxState = { [FACT_HEADER_ENTITY]: { entityDataFromServer: [{ rowGUID: 'd1', updated_at: '1', rowJSON: { documentHeader: { documentStatus: 'draft' } } }] } };
    const view = renderUI(<PMFactInputDocumentList />);
    expect(mockRefetch).not.toHaveBeenCalled();                           // the first look is not a change
    (globalThis as any).__pmTestReduxState = { [FACT_HEADER_ENTITY]: { entityDataFromServer: [{ rowGUID: 'd1', updated_at: '2', rowJSON: { documentHeader: { documentStatus: 'posted' } } }] } };
    view.rerender(<PMFactInputDocumentList />);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe('factListColumns', () => {
  it('all cells are read only; the numbers are summed by the table footer, the lines are not', () => {
    const cols = factListColumns(() => doc('x'));
    expect(cols.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
    expect(cols.find((c: any) => c.key === 'sumForBudget')).toMatchObject({ type: 'number' });
    expect((cols.find((c: any) => c.key === 'lines') as any).total).toBe(false);
  });
  it('a row the list has not read yet shows blank cells and 0 totals', () => {
    const cols = factListColumns(() => undefined);
    expect((cols.find((c: any) => c.key === 'author') as any).fromStored(null, { rowGUID: 'zz' })).toBe('');
    expect((cols.find((c: any) => c.key === 'sumForBudget') as any).fromStored(null, { rowGUID: 'zz' })).toBe(0);
  });
  it('the period is "first – last" or blank', () => {
    const cols = factListColumns((row) => (row.rowGUID === 'a' ? doc('a') : doc('b', { firstDay: null, lastDay: null })));
    expect((cols.find((c: any) => c.key === 'period') as any).fromStored(null, { rowGUID: 'a' })).toBe('2026-10-01 – 2026-10-09');
    expect((cols.find((c: any) => c.key === 'period') as any).fromStored(null, { rowGUID: 'b' })).toBe('');
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

describe('the task / task line scope (menu "Go to → Fact input")', () => {
  it('no scope: no chip, nothing extra is sent to the database', () => {
    renderUI(<PMFactInputDocumentList />);
    expect(q(`${T}-scope`)).toBeNull();
    expect(mockCalls[mockCalls.length - 1].extra).toEqual({});
  });
  it('taskGUID + taskLineGUID: a chip says it and the list RPC gets both keys; its x shows all the documents again', () => {
    renderUI(<PMFactInputDocumentList taskGUID="t-1" taskLineGUID="aaaaaaaa-0000" />);
    expect(q(`${T}-scope`)).not.toBeNull();
    expect(textOf(`${T}-scope-label`)).toContain('Task line aaaaaaaa');
    expect(mockCalls[mockCalls.length - 1].extra).toEqual({ taskGUID: 't-1', taskLineGUID: 'aaaaaaaa-0000' });
    press(`${T}-scope-clear`);
    expect(q(`${T}-scope`)).toBeNull();
    expect(mockCalls[mockCalls.length - 1].extra).toEqual({});
  });
  it('the scope is independent of the project fixed by the screen and of Clear filters', () => {
    renderUI(<PMFactInputDocumentList projectGUID="p2" taskGUID="t-1" />);
    expect(lastFilter()).toEqual({ ...EMPTY_FACT_LIST_FILTER, projectGUID: 'p2' });
    expect(mockCalls[mockCalls.length - 1].extra).toEqual({ taskGUID: 't-1' });
  });
});
