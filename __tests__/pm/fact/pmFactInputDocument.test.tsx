/** @jest-environment jsdom */
// PMFactInputDocument: the header, the DocumentTabs, Post / Unpost, the problems of a refused Post, the new document. The data hook is replaced by a fake.
import { act } from 'react';
import { cleanupUI, mustGet, press, q, qa, renderUI, textOf } from '../ui/pmUiTestKit';

const mockDoc: Record<string, any> = {};
jest.mock('../../../kit8/pm/fact/useFactInputDocument', () => ({ useFactInputDocument: () => mockDoc }));
jest.mock('../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({ useTaskLineCatalogs: () => require('../../../kit8/pm/view/task/finances/taskLineCatalogs').emptyTaskLineCatalogs() }));

import PMFactInputDocument from '../../../kit8/pm/fact/PMFactInputDocument';
import { FactHeaderRow, FactLineRow, factHeaderOf } from '../../../kit8/pm/fact/factInputModel';

const headerRow = (over: Record<string, any> = {}, guid = 'h1'): FactHeaderRow => ({
  rowGUID: guid, rowProjectGUID: 'p1', rowOwnerGUID: 't1',
  rowJSON: { documentHeader: { documentNumber: 'FI-00001', documentStatus: 'draft', strongInput: false, created_at: '2026-10-14T08:00:00Z', ...over } },
});
const line = (over: Partial<FactLineRow> = {}): FactLineRow => ({
  rowGUID: 'l1', rowProjectGUID: 'p1', rowOwnerGUID: 't1', rowHeaderGUID: 'h1', rowPeriodDatetime: '2026-10-14T00:00:00.000Z', taskLineGUID: null, genusGUID: 'timeGenus', qtyForBudget: 8, qtyForContract: 8,
  sumForContract: null, sumForBudget: null, orderInList: 1, rowJSON: { measureUnitTaskLine: 'unit_hour' }, ...over,
});

function setDoc(over: Record<string, any> = {}) {
  const rows = [headerRow()];
  Object.keys(mockDoc).forEach((k) => delete mockDoc[k]);
  Object.assign(mockDoc, {
    taskName: 'task03', projectGUID: 'p1', documents: rows, header: factHeaderOf(rows[0]), lines: [line(), line({ rowGUID: 'l2', genusGUID: 'materialGenus' }), line({ rowGUID: 'l3', genusGUID: 'materialGenus' })],
    isLoading: false, error: null, busy: false, select: jest.fn(), newDocument: jest.fn(async () => 'h2'), post: jest.fn(async () => ({ status: 'posted', lines: 3, problems: [] })),
    unpost: jest.fn(async () => ({ status: 'draft', lines: 0, problems: [] })), saveLine: jest.fn(async () => true), addLine: jest.fn(async () => true), removeLine: jest.fn(async () => true),
    removeDocument: jest.fn(async () => true), refetch: jest.fn(), ...over,
  });
}
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });
const flush = () => act(async () => { await Promise.resolve(); });

describe('the header', () => {
  it('title with the task, the number and the mode', () => {
    setDoc();
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(textOf('fact-input-title')).toBe('Facts input · task03');
    expect(textOf('fact-input-subtitle')).toContain('FI-00001');
    expect(textOf('fact-input-subtitle')).toContain('Free input');
  });
  it('the strong input says so', () => {
    const rows = [headerRow({ strongInput: true })];
    setDoc({ documents: rows, header: factHeaderOf(rows[0]) });
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(textOf('fact-input-subtitle')).toContain('Strong input');
  });
});

describe('DocumentTabs', () => {
  it('Time · Material · Expenses · Revenues with the number of lines of each', () => {
    setDoc();
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(qa('fact-input-tab-').filter((id) => !id.endsWith('-count'))).toEqual(['fact-input-tab-timeGenus', 'fact-input-tab-materialGenus', 'fact-input-tab-expenseGenus', 'fact-input-tab-revenueGenus']);
    expect(textOf('fact-input-tab-timeGenus-count')).toBe('1');
    expect(textOf('fact-input-tab-materialGenus-count')).toBe('2');
    expect(q('fact-input-tab-revenueGenus-count')).toBeNull();
  });
  it('opens on the given genus; a tab shows only its lines', () => {
    setDoc();
    renderUI(<PMFactInputDocument taskGUID="t1" genus="materialGenus" />);
    expect(qa('fact-input-lines-row-')).toEqual(['fact-input-lines-row-l2', 'fact-input-lines-row-l3']);
    press('fact-input-tab-timeGenus');
    expect(qa('fact-input-lines-row-')).toEqual(['fact-input-lines-row-l1']);
  });
  it('opens on the tab of the clicked task line (a strong line knows it)', async () => {
    const rows = [headerRow({ strongInput: true })];
    setDoc({ documents: rows, header: factHeaderOf(rows[0]), lines: [line({ taskLineGUID: 'tl-1' }), line({ rowGUID: 'l2', genusGUID: 'materialGenus', taskLineGUID: 'tl-2' })] });
    renderUI(<PMFactInputDocument taskGUID="t1" taskLineGUID="tl-2" />);
    await flush();
    expect(qa('fact-input-lines-row-')).toEqual(['fact-input-lines-row-l2']);
  });
});

describe('Post', () => {
  it('a draft with lines has Post; pressing it posts the document', async () => {
    setDoc();
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(q('fact-input-post')).not.toBeNull();
    expect(q('fact-input-unpost')).toBeNull();
    press('fact-input-post');
    await flush();
    expect(mockDoc.post).toHaveBeenCalledTimes(1);
    expect(q('fact-input-problems')).toBeNull();
  });
  it('a document with no lines cannot be posted', () => {
    setDoc({ lines: [] });
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(q('fact-input-post')).toBeNull();
  });
  it('a refusal lists the problems and marks the line', async () => {
    setDoc({ post: jest.fn(async () => ({ status: 'refused', lines: 3, problems: [{ lineGUID: 'l1', problem: 'dateInTheFuture' }, { lineGUID: null, problem: 'documentHasNoLines' }] })) });
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    press('fact-input-post');
    await flush();
    expect(textOf('fact-input-problems')).toContain('The document was not posted');
    expect(textOf('fact-input-problem-0')).toContain('cannot be dated in the future');
    expect(textOf('fact-input-problem-1')).toContain('no lines');
  });
  it('a document that was unposted says "Post needed"', () => {
    const rows = [headerRow({ unpostedAt: '2026-10-16T00:00:00Z' })];
    setDoc({ documents: rows, header: factHeaderOf(rows[0]) });
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(textOf('fact-input-post')).toContain('Post needed');
  });
  it('a posted document: the Posted chip and Unpost - no Post, no Delete, no Add', async () => {
    const rows = [headerRow({ documentStatus: 'posted' })];
    setDoc({ documents: rows, header: factHeaderOf(rows[0]) });
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(q('fact-input-posted')).not.toBeNull();
    expect(q('fact-input-post')).toBeNull();
    expect(q('fact-input-delete')).toBeNull();
    expect(q('fact-input-lines-add')).toBeNull();
    press('fact-input-unpost');
    await flush();
    expect(mockDoc.unpost).toHaveBeenCalledTimes(1);
  });
});

describe('documents', () => {
  it('New document asks the data hook for one', () => {
    setDoc();
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    press('fact-input-new');
    expect(mockDoc.newDocument).toHaveBeenCalledTimes(1);
  });
  it('the list of documents is offered from the second one on', () => {
    setDoc();
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(q('fact-input-documents')).toBeNull();
    const rows = [headerRow({}, 'h1'), headerRow({ documentNumber: 'FI-00002', documentStatus: 'posted' }, 'h2')];
    setDoc({ documents: rows, header: factHeaderOf(rows[0]) });
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(q('fact-input-documents')).not.toBeNull();
  });
  it('a draft can be deleted', () => {
    setDoc();
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    press('fact-input-delete');
    expect(mockDoc.removeDocument).toHaveBeenCalledTimes(1);
  });
  it('an error of the database is shown', () => {
    setDoc({ error: 'row-level security' });
    renderUI(<PMFactInputDocument taskGUID="t1" />);
    expect(textOf('fact-input-error')).toBe('row-level security');
  });
  it('Close is offered when the caller gives onClose', () => {
    setDoc();
    const onClose = jest.fn();
    renderUI(<PMFactInputDocument taskGUID="t1" onClose={onClose} />);
    press('fact-input-close');
    expect(onClose).toHaveBeenCalled();
    mustGet('fact-input');
  });
});
