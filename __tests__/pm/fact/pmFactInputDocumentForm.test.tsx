/** @jest-environment jsdom */
// PMFactInputDocumentForm: the bar (Post is the LAST), the form of the document (TextInputApp / DateInputApp), the DocumentTabs, and how the table (ReusableTable) is configured in each mode.
// The data hook and the table are replaced by fakes: the table has its own tests (__tests__/ui/table), the columns theirs (factColumns.test.tsx).
import { act } from 'react';
import { cleanupUI, expectInOrder, inputValue, press, q, qa, renderUI, textOf, typeInto } from '../ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
jest.mock('../../../kit8/pm/fact/useFactInputDocument', () => ({ useFactInputDocument: () => mockDoc }));
jest.mock('../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({ useTaskLineCatalogs: () => require('../../../kit8/pm/view/task/finances/taskLineCatalogs').emptyTaskLineCatalogs() }));
const mockButtons: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/ButtonApp', () => {
  const R = require('react');
  const Real = jest.requireActual('../../../kit8/ui/components/common/ButtonApp').default;
  const Spy = (p: any) => { if (p.testID) mockButtons[p.testID] = p; return R.createElement(Real, p); };
  return { __esModule: true, default: Spy, ButtonApp: Spy };
});
const mockTable = jest.fn();
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTable(p); return require('react').createElement('div', { 'data-testid': p.testID }); } }));
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, disabled, error }: any) => R.createElement(TextInput, { testID, value, onChangeText, editable: !disabled, accessibilityLabel: error ? 'error' : undefined }) };
});

import PMFactInputDocumentForm from '../../../kit8/pm/fact/PMFactInputDocumentForm';
import { FACT_NEW_ROW_KEYS, FACT_USAGE_TIMELINE_ENTITY, FactHeaderView, FactListRow } from '../../../kit8/pm/fact/factInputModel';

const listRow = (over: Partial<FactListRow> = {}): FactListRow => ({
  documentGUID: 'h1', documentNumber: 'FI-00001', documentStatus: 'draft', strongInput: false, authorGUID: 'u1', authorName: 'Anna K', createdAt: '2026-10-14T08:00:00Z', postedAt: null, unpostedAt: null,
  projectGUID: 'p1', projectName: 'Alpha', taskGUID: 't1', taskName: 'task03', lineCount: 3, firstDay: null, lastDay: null, sumForBudget: 0, sumForContract: 0, sumForAccounting: 0, ...over,
});
const headerOf = (r: FactListRow): FactHeaderView => ({ guid: r.documentGUID, number: r.documentNumber, status: r.documentStatus, strong: r.strongInput, user: r.authorGUID, userName: r.authorName, createdAt: r.createdAt, postedAt: r.postedAt, unpostedAt: r.unpostedAt });
const rows = (): any[] => [
  { rowGUID: 'l1', rowHeaderGUID: 'h1', genusGUID: 'timeGenus', taskLineGUID: null, sumForBudget: '96.00', sumForContract: '80', sumForAccounting: '120.5' },
  { rowGUID: 'l2', rowHeaderGUID: 'h1', genusGUID: 'materialGenus', taskLineGUID: null, sumForBudget: null, sumForContract: '200', sumForAccounting: null },
  { rowGUID: 'l3', rowHeaderGUID: 'h1', genusGUID: 'materialGenus', taskLineGUID: null, sumForBudget: null, sumForContract: '0.5', sumForAccounting: null },
  { rowGUID: 'x1', rowHeaderGUID: 'h-other', genusGUID: 'timeGenus', sumForBudget: 1000, sumForContract: 1000, sumForAccounting: 1000 },
];
function setDoc(over: Record<string, any> = {}, row: FactListRow = listRow()) {
  Object.keys(mockDoc).forEach((k) => delete mockDoc[k]);
  Object.assign(mockDoc, {
    taskName: 'task03', projectGUID: 'p1', documents: [row], header: headerOf(row), isLoading: false, error: null, busy: false, select: jest.fn(), newDocument: jest.fn(async () => 'h2'),
    post: jest.fn(async () => ({ status: 'posted', lines: 3, problems: [] })), unpost: jest.fn(async () => ({ status: 'draft', lines: 0, problems: [] })), removeDocument: jest.fn(async () => true),
    refreshLines: jest.fn(), refetch: jest.fn(), ...over,
  });
  (globalThis as any).__pmTestReduxState = { [FACT_USAGE_TIMELINE_ENTITY]: { entityDataFromServer: rows() } };
}
const lastTable = () => mockTable.mock.calls.at(-1)![0];
afterEach(() => { cleanupUI(); jest.clearAllMocks(); (globalThis as any).__pmTestReduxState = undefined; });
const flush = () => act(async () => { await Promise.resolve(); });

describe('the bar', () => {
  it('the POST button is the LAST one', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" onClose={jest.fn()} />);
    expectInOrder(['fact-input-new', 'fact-input-delete', 'fact-input-close', 'fact-input-post']);
    const buttons = qa('fact-input-').filter((id) => ['new', 'delete', 'unpost', 'close', 'posted', 'post'].some((k) => id === `fact-input-${k}`));
    expect(buttons[buttons.length - 1]).toBe('fact-input-post');
  });
  it('a posted document: Unpost and the Posted chip, no Post, no Delete', () => {
    setDoc({}, listRow({ documentStatus: 'posted' }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" onClose={jest.fn()} />);
    expect(q('fact-input-posted')).not.toBeNull();
    expect(q('fact-input-unpost')).not.toBeNull();
    expect(q('fact-input-post')).toBeNull();
    expect(q('fact-input-delete')).toBeNull();
  });
  it('the Posted button is BIG: a large button like Post (the other buttons of the bar are small), not a small chip', () => {
    setDoc({}, listRow({ documentStatus: 'posted' }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" onClose={jest.fn()} />);
    expect(q('fact-input-posted')!.getAttribute('role')).toBe('button');
    expect(textOf('fact-input-posted')).toContain('Posted');
    expect(mockButtons['fact-input-posted']).toMatchObject({ size: 'large', icon: 'check' });
    expect(mockButtons['fact-input-unpost'].size).toBe('small');
    cleanupUI();
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" onClose={jest.fn()} />);
    expect(mockButtons['fact-input-post'].size).toBe('large');             // Post and Posted are the same size
  });
  it('a document without lines cannot be posted', () => {
    setDoc();
    (globalThis as any).__pmTestReduxState = { [FACT_USAGE_TIMELINE_ENTITY]: { entityDataFromServer: [] } };
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(q('fact-input-post')).toBeNull();
  });
  it('"Post needed" after an Unpost', () => {
    setDoc({}, listRow({ unpostedAt: '2026-10-16T00:00:00Z' }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(textOf('fact-input-post')).toContain('Post needed');
  });
  it('New document, Delete, Unpost and Close call their commands', async () => {
    setDoc();
    const onClose = jest.fn();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" onClose={onClose} />);
    press('fact-input-new'); press('fact-input-delete'); press('fact-input-close');
    expect(mockDoc.newDocument).toHaveBeenCalledTimes(1);
    expect(mockDoc.removeDocument).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
    cleanupUI();
    setDoc({}, listRow({ documentStatus: 'posted' }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    press('fact-input-unpost');
    await flush();
    expect(mockDoc.unpost).toHaveBeenCalledTimes(1);
  });
  it('the list of documents is offered from the second one on', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(q('fact-input-documents')).toBeNull();
    setDoc({ documents: [listRow(), listRow({ documentGUID: 'h2', documentNumber: 'FI-00002' })] });
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(q('fact-input-documents')).not.toBeNull();
  });
});

describe('Post', () => {
  it('posts and shows nothing when it went through', async () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    press('fact-input-post');
    await flush();
    expect(mockDoc.post).toHaveBeenCalledTimes(1);
    expect(q('fact-input-problems')).toBeNull();
  });
  it('a refusal lists the problems', async () => {
    setDoc({ post: jest.fn(async () => ({ status: 'refused', lines: 3, problems: [{ lineGUID: 'l1', problem: 'dateInTheFuture' }, { lineGUID: null, problem: 'documentHasNoLines' }] })) });
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    press('fact-input-post');
    await flush();
    expect(textOf('fact-input-problems')).toContain('The document was not posted');
    expect(textOf('fact-input-problem-0')).toContain('cannot be dated in the future');
    expect(textOf('fact-input-problem-1')).toContain('no lines');
  });
  it('an error of the database is shown', () => {
    setDoc({ error: 'row-level security' });
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(textOf('fact-input-error')).toBe('row-level security');
  });
});

describe('the form of the document', () => {
  it('number, author, created (read only inputs), the mode', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(inputValue('fact-input-field-number')).toBe('FI-00001');
    expect(inputValue('fact-input-field-author')).toBe('Anna K');
    expect(inputValue('fact-input-field-created')).toBe('2026-10-14');
    expect(inputValue('fact-input-field-mode')).toBe('Free');
    expect((q('fact-input-field-created') as HTMLInputElement).readOnly || (q('fact-input-field-created') as HTMLInputElement).disabled).toBe(true);
    expect(textOf('fact-input-subtitle')).toContain('Free input');
  });
  it('the strong input says so', () => {
    setDoc({}, listRow({ strongInput: true }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(inputValue('fact-input-field-mode')).toBe('Strong');
    expect(textOf('fact-input-subtitle')).toContain('Strong input');
  });
  it('the date of NEW lines is asked only where lines can be added (free draft)', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(q('fact-input-field-newday')).not.toBeNull();
    cleanupUI();
    setDoc({}, listRow({ strongInput: true }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(q('fact-input-field-newday')).toBeNull();
    cleanupUI();
    setDoc({}, listRow({ documentStatus: 'posted' }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(q('fact-input-field-newday')).toBeNull();
  });
  it('the totals of the document are added up from its lines (not the lines of another document)', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(textOf('fact-input-totals')).toContain('3');
    expect(textOf('fact-input-total-budget')).toContain('96');
    expect(textOf('fact-input-total-contract')).toContain('280.5');
    expect(textOf('fact-input-total-accounting')).toContain('120.5');
  });
});

describe('DocumentTabs', () => {
  it('Time · Material · Expenses · Revenues with the number of lines of each', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(qa('fact-input-tab-').filter((id) => !id.endsWith('-count'))).toEqual(['fact-input-tab-timeGenus', 'fact-input-tab-materialGenus', 'fact-input-tab-expenseGenus', 'fact-input-tab-revenueGenus']);
    expect(textOf('fact-input-tab-timeGenus-count')).toBe('1');
    expect(textOf('fact-input-tab-materialGenus-count')).toBe('2');
    expect(q('fact-input-tab-revenueGenus-count')).toBeNull();
  });
  it('opens on the given genus; a tab filters the table to its lines', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" genus="materialGenus" />);
    const rf = lastTable().rowFilter;
    expect(rows().filter(rf).map((r) => r.rowGUID)).toEqual(['l2', 'l3']);
    press('fact-input-tab-timeGenus');
    expect(rows().filter(lastTable().rowFilter).map((r) => r.rowGUID)).toEqual(['l1']);
  });
  it('opens on the tab of the clicked task line (a strong line knows it)', async () => {
    setDoc({}, listRow({ strongInput: true }));
    (globalThis as any).__pmTestReduxState = { [FACT_USAGE_TIMELINE_ENTITY]: { entityDataFromServer: [
      { rowGUID: 'l1', rowHeaderGUID: 'h1', genusGUID: 'timeGenus', taskLineGUID: 'tl-1' }, { rowGUID: 'l2', rowHeaderGUID: 'h1', genusGUID: 'materialGenus', taskLineGUID: 'tl-2' }] } };
    renderUI(<PMFactInputDocumentForm taskGUID="t1" taskLineGUID="tl-2" />);
    await flush();
    expect([{ rowHeaderGUID: 'h1', genusGUID: 'materialGenus' }, { rowHeaderGUID: 'h1', genusGUID: 'timeGenus' }].filter(lastTable().rowFilter)).toHaveLength(1);
  });
});

describe('the table', () => {
  it('reads the lines of the TASK (all documents, all genus) through the redux entity; the table filters ONE document and ONE tab', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    const p = lastTable();
    expect(p).toMatchObject({ entityName: FACT_USAGE_TIMELINE_ENTITY, listOwnerGUID: 't1', listParentGUID: '*', realtime: true, reorderEnabled: false });
    expect(p.rowFilter({ rowHeaderGUID: 'h-other', genusGUID: 'timeGenus' })).toBe(false);
    expect(p.rowFilter({ rowHeaderGUID: 'h1', genusGUID: 'timeGenus' })).toBe(true);
    expect(p.rowFilter({ rowHeaderGUID: 'h1', genusGUID: 'materialGenus' })).toBe(false);
  });
  it('a row the table made and the server has not confirmed yet is shown (it carries the control keys in its rowJSON)', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    const mine = { rowGUID: 'n', rowJSON: { [FACT_NEW_ROW_KEYS.header]: 'h1', [FACT_NEW_ROW_KEYS.genus]: 'timeGenus' } };
    expect(lastTable().rowFilter(mine)).toBe(true);
  });
  it('FREE draft: add, edit, menu, selection', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(lastTable()).toMatchObject({ addEnabled: true, crudPanelEnabled: true, contextMenuEnabled: true, selectionEnabled: true });
  });
  it('STRONG draft: no new lines (addEnabled false) - update and delete stay', () => {
    setDoc({}, listRow({ strongInput: true }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(lastTable()).toMatchObject({ addEnabled: false, crudPanelEnabled: true, contextMenuEnabled: true, selectionEnabled: true });
  });
  it('POSTED: read only - no panel, no menu, no selection, no add', () => {
    setDoc({}, listRow({ documentStatus: 'posted' }));
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(lastTable()).toMatchObject({ addEnabled: false, crudPanelEnabled: false, contextMenuEnabled: false, selectionEnabled: false });
    expect(lastTable().visualColumns.filter((c: any) => c.type !== 'rowNumber').every((c: any) => c.editable === false)).toBe(true);
  });
  it('a new row gets the document, the tab and the "date of new lines"', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" genus="materialGenus" />);
    typeInto('fact-input-field-newday', '2026-11-05');
    expect(lastTable().newRowDefaults).toEqual({ rowOwnerGUID: 't1', rowJSON: { [FACT_NEW_ROW_KEYS.header]: 'h1', [FACT_NEW_ROW_KEYS.genus]: 'materialGenus', [FACT_NEW_ROW_KEYS.day]: '2026-11-05' } });
  });
  it('a date of new lines that is not a day is an error of the field and falls back to today', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    typeInto('fact-input-field-newday', 'soon');
    expect(q('fact-input-field-newday')!.getAttribute('aria-label')).toBe('error');
    expect(lastTable().newRowDefaults.rowJSON[FACT_NEW_ROW_KEYS.day]).toBe(new Date().toISOString().slice(0, 10));
  });
  it('another tab or another status makes a fresh table (the key changes)', () => {
    setDoc();
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(q('fact-input-lines')).not.toBeNull();
    press('fact-input-tab-materialGenus');
    expect(q('fact-input-lines')).not.toBeNull();
  });
  it('without a document there is no table', () => {
    setDoc({ header: null, documents: [] });
    renderUI(<PMFactInputDocumentForm taskGUID="t1" />);
    expect(q('fact-input-lines')).toBeNull();
    expect(mockTable).not.toHaveBeenCalled();
  });
});
