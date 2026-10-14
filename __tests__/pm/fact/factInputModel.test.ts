// The pure rules of the fact input document (kit8/pm/fact/factInputModel.ts; the SQL twin is tested by kit8/docker/test_fact_monitor01.sh).
import {
  EMPTY_FACT_LIST_FILTER, FACT_NEW_ROW_KEYS, FACT_TABS, FactHeaderRow, FactLineRow, factHeaderFromListRow, factLineInsert, factListDateErrors, factListFilterActive, factListFilterToRpc, factRowsOf, factTotalsOf,
  latestDraftOf, parseFactListAnswer, canAddLines, canDeleteDocument, canDeleteLines, canEditLines, canPost, canUnpost, dayOfPeriod, dayToPeriodDatetime, factGenusOf, factHeaderOf,
  factInputRouteParams, factLineSums, factPostState, factProblemText, factStrongInputOf, factTotalsByUnit, formatQty, genusOfTaskLine, latestDraft, linesOfGenus, newFreeLine, parseDayInput,
  parseFactAnswer, parseQtyInput,
} from '../../../kit8/pm/fact/factInputModel';

const header = (over: Record<string, any> = {}, guid = 'h1'): FactHeaderRow => ({
  rowGUID: guid, rowProjectGUID: 'p1', rowOwnerGUID: 't1', rowJSON: { documentHeader: { documentNumber: 'FI-00001', documentStatus: 'draft', strongInput: false, created_at: '2026-10-14T08:00:00Z', ...over } },
});
const line = (over: Partial<FactLineRow> = {}): FactLineRow => ({
  rowGUID: 'l1', rowProjectGUID: 'p1', rowOwnerGUID: 't1', rowHeaderGUID: 'h1', rowPeriodDatetime: '2026-10-14T00:00:00Z', taskLineGUID: null, genusGUID: 'timeGenus', qtyForBudget: 8, qtyForContract: 8,
  sumForContract: 80, sumForBudget: null, sumForAccounting: null, orderInList: 1, rowJSON: { measureUnitTaskLine: 'unit_hour', priceTaskLine: 10 }, ...over,
});

describe('the project setting', () => {
  it('is false unless it is exactly true', () => {
    expect(factStrongInputOf(undefined)).toBe(false);
    expect(factStrongInputOf({})).toBe(false);
    expect(factStrongInputOf({ factStrongInputByTaskLine: 'true' })).toBe(false);
    expect(factStrongInputOf({ factStrongInputByTaskLine: true })).toBe(true);
  });
});

describe('the header', () => {
  it('reads documentHeader', () => {
    const h = factHeaderOf(header({ strongInput: true, postedAt: '2026-10-15T00:00:00Z', activeUser: 'u1' }));
    expect(h).toMatchObject({ guid: 'h1', number: 'FI-00001', status: 'draft', strong: true, user: 'u1', postedAt: '2026-10-15T00:00:00Z', unpostedAt: null });
  });
  it('a header without documentHeader is a free draft', () => {
    expect(factHeaderOf({ rowGUID: 'x', rowProjectGUID: 'p', rowOwnerGUID: 't', rowJSON: {} })).toMatchObject({ status: 'draft', strong: false, number: '' });
  });
  it('the latest DRAFT is the one the menu opens', () => {
    const rows = [header({ created_at: '2026-10-10T00:00:00Z' }, 'old'), header({ created_at: '2026-10-14T00:00:00Z' }, 'new'), header({ created_at: '2026-10-20T00:00:00Z', documentStatus: 'posted' }, 'posted')];
    expect(latestDraft(rows)?.rowGUID).toBe('new');
    expect(latestDraft([header({ documentStatus: 'posted' })])).toBeUndefined();
  });
});

describe('what the user may do', () => {
  const draftFree = factHeaderOf(header());
  const draftStrong = factHeaderOf(header({ strongInput: true }));
  const posted = factHeaderOf(header({ documentStatus: 'posted' }));
  it('free draft: add, edit, delete', () => {
    expect([canAddLines(draftFree), canEditLines(draftFree), canDeleteLines(draftFree), canDeleteDocument(draftFree)]).toEqual([true, true, true, true]);
  });
  it('strong draft: NO new lines, only update and delete', () => {
    expect([canAddLines(draftStrong), canEditLines(draftStrong), canDeleteLines(draftStrong)]).toEqual([false, true, true]);
  });
  it('posted: read only; only Unpost', () => {
    expect([canAddLines(posted), canEditLines(posted), canDeleteLines(posted), canDeleteDocument(posted), canUnpost(posted), canPost(posted, 3)]).toEqual([false, false, false, false, true, false]);
  });
  it('Post needs a draft with lines', () => {
    expect(canPost(draftFree, 0)).toBe(false);
    expect(canPost(draftFree, 1)).toBe(true);
    expect(canUnpost(draftFree)).toBe(false);
  });
  it('the Post button: Post · Posted · Post needed', () => {
    expect(factPostState(draftFree)).toBe('post');
    expect(factPostState(posted)).toBe('posted');
    expect(factPostState(factHeaderOf(header({ unpostedAt: '2026-10-16T00:00:00Z' })))).toBe('postNeeded');
  });
});

describe('tabs and lines', () => {
  it('the four tabs, in the order of the Finances table', () => {
    expect(FACT_TABS.map((t) => t.title)).toEqual(['Time', 'Material', 'Expenses', 'Revenues']);
  });
  it('an unknown genus falls back to Time', () => {
    expect(factGenusOf('materialGenus')).toBe('materialGenus');
    expect(factGenusOf('nonsense')).toBe('timeGenus');
    expect(factGenusOf(null)).toBe('timeGenus');
  });
  it('the tab of the clicked line: a strong line knows its task line, a free one uses the given genus', () => {
    const lines = [line({ rowGUID: 'a', taskLineGUID: 'tl-1', genusGUID: 'materialGenus' }), line({ rowGUID: 'b', taskLineGUID: null })];
    expect(genusOfTaskLine(lines, 'tl-1', 'timeGenus')).toBe('materialGenus');
    expect(genusOfTaskLine(lines, 'tl-9', 'expenseGenus')).toBe('expenseGenus');
    expect(genusOfTaskLine(lines, null, null)).toBe('timeGenus');
    expect(linesOfGenus(lines, 'timeGenus').map((l) => l.rowGUID)).toEqual(['b']);
  });
});

describe('the sums (the twin of the trigger)', () => {
  it('sumForContract = qty x price, sumForBudget / sumForAccounting = qty x the sum of one unit', () => {
    expect(factLineSums(6, { priceTaskLine: 10, unitSumForBudget: 12, unitSumForAccounting: 15 })).toEqual({ sumForContract: 60, sumForBudget: 72, sumForAccounting: 90 });
    expect(factLineSums(2.5, { priceTaskLine: 3.33 })).toEqual({ sumForContract: 8.33, sumForBudget: null, sumForAccounting: null });
  });
  it('no price: no sum (never guessed)', () => {
    expect(factLineSums(5, {})).toEqual({ sumForContract: null, sumForBudget: null, sumForAccounting: null });
    expect(factLineSums(5, null)).toEqual({ sumForContract: null, sumForBudget: null, sumForAccounting: null });
  });
  it('totals per unit - hours and pieces are never added', () => {
    const t = factTotalsByUnit([
      line({ qtyForContract: 8, sumForContract: 80 }),
      line({ rowGUID: 'l2', qtyForContract: 2, sumForContract: 20 }),
      line({ rowGUID: 'l3', qtyForContract: 100, sumForContract: null, rowJSON: { measureUnitTaskLine: 'unit_pcs' } }),
    ]);
    expect(t).toEqual([{ unit: 'unit_hour', qty: 10, sumForContract: 100 }, { unit: 'unit_pcs', qty: 100, sumForContract: null }]);
  });
});

describe('the date and the quantity as the user types them', () => {
  it('days: ISO or dd.mm.yyyy, real days only', () => {
    expect(parseDayInput('2026-10-14')).toBe('2026-10-14');
    expect(parseDayInput(' 14.10.2026 ')).toBe('2026-10-14');
    expect(parseDayInput('2026-02-30')).toBeNull();
    expect(parseDayInput('2026-13-01')).toBeNull();
    expect(parseDayInput('tomorrow')).toBeNull();
    expect(parseDayInput('')).toBeNull();
  });
  it('the start of the day, and the day back', () => {
    expect(dayToPeriodDatetime('2026-10-14')).toBe('2026-10-14T00:00:00.000Z');
    expect(dayOfPeriod('2026-10-14T00:00:00.000Z')).toBe('2026-10-14');
    expect(dayOfPeriod('2026-10-13T22:00:00+00:00')).toBe('2026-10-14');       // the +12 h rule of the database: a zone offset never moves the day
    expect(dayOfPeriod('2026-10-14')).toBe('2026-10-14');
    expect(dayOfPeriod(null)).toBe('');
  });
  it('quantities: >= 0, point or comma, 2 decimals', () => {
    expect(parseQtyInput('8')).toBe(8);
    expect(parseQtyInput('2,5')).toBe(2.5);
    expect(parseQtyInput('1.234')).toBe(1.23);
    expect(parseQtyInput('-1')).toBeNull();
    expect(parseQtyInput('abc')).toBeNull();
    expect(parseQtyInput('')).toBeNull();
    expect(parseQtyInput(4)).toBe(4);
    expect(formatQty(8)).toBe('8');
    expect(formatQty(2.5)).toBe('2.5');
    expect(formatQty(null)).toBe('');
  });
});

describe('the answers of Post / Unpost', () => {
  it('a posted answer', () => {
    expect(parseFactAnswer({ status: 'posted', lines: 5, problems: [] })).toEqual({ status: 'posted', lines: 5, problems: [] });
  });
  it('a refusal names the lines', () => {
    const a = parseFactAnswer({ status: 'refused', lines: 2, problems: [{ lineGUID: 'x', problem: 'taskLineMissing' }, { lineGUID: null, problem: 'documentHasNoLines' }] });
    expect(a.status).toBe('refused');
    expect(a.problems).toEqual([{ lineGUID: 'x', problem: 'taskLineMissing' }, { lineGUID: null, problem: 'documentHasNoLines' }]);
  });
  it('garbage never throws and is a refusal', () => {
    expect(parseFactAnswer(null)).toEqual({ status: 'refused', lines: 0, problems: [] });
    expect(parseFactAnswer('x')).toEqual({ status: 'refused', lines: 0, problems: [] });
  });
  it('every problem the database can return has a sentence', () => {
    for (const code of ['documentIsPosted', 'documentIsNotPosted', 'documentHasNoLines', 'dateInTheFuture', 'taskLineMissing']) expect(factProblemText(code)).not.toBe(code);
    expect(factProblemText('somethingNew')).toBe('somethingNew');
  });
});

describe('new lines and the route', () => {
  it('a free line is disconnected from the task lines', () => {
    const l = newFreeLine({ guid: 'h1' }, 'materialGenus', '2026-10-14', 7, { measureUnitTaskLine: 'unit_pcs' });
    expect(l).toMatchObject({ rowHeaderGUID: 'h1', taskLineGUID: null, genusGUID: 'materialGenus', qtyForContract: 0, orderInList: 7, rowPeriodDatetime: '2026-10-14T00:00:00.000Z' });
  });
  it('route params keep only what is given', () => {
    expect(factInputRouteParams({ taskGUID: 't1' })).toEqual({ taskGUID: 't1' });
    expect(factInputRouteParams({ taskGUID: 't1', projectGUID: 'p1', taskLineGUID: 'l1', genus: 'timeGenus', documentGUID: 'd1' })).toEqual({ taskGUID: 't1', projectGUID: 'p1', taskLineGUID: 'l1', genus: 'timeGenus', documentGUID: 'd1' });
  });
});

describe('the list of documents (task_fact_document_list)', () => {
  const raw = (over: Record<string, any> = {}) => ({
    documentGUID: 'd1', documentNumber: 'FI-00001', documentStatus: 'posted', strongInput: true, authorGUID: 'u1', authorName: 'Anna K', createdAt: '2026-10-14T08:00:00Z', postedAt: '2026-10-15T08:00:00Z', unpostedAt: null,
    projectGUID: 'p1', projectName: 'Alpha', taskGUID: 't1', taskName: 'task01', lineCount: 3, firstDay: '2026-10-12', lastDay: '2026-10-14', sumForBudget: '96.00', sumForContract: 280, sumForAccounting: '120', ...over,
  });
  it('numeric strings become numbers; a missing field never throws', () => {
    const a = parseFactListAnswer({ totalCount: '2', totals: { sumForBudget: '1.5', sumForContract: 2, sumForAccounting: null }, rows: [raw(), raw({ documentGUID: 'd2', documentStatus: undefined, strongInput: undefined, unpostedAt: undefined, firstDay: undefined })] });
    expect(a.totalCount).toBe(2);
    expect(a.totals).toEqual({ sumForBudget: 1.5, sumForContract: 2, sumForAccounting: 0 });
    expect(a.rows[0]).toMatchObject({ documentGUID: 'd1', documentStatus: 'posted', strongInput: true, sumForBudget: 96, sumForContract: 280, sumForAccounting: 120, lineCount: 3 });
    expect(a.rows[1]).toMatchObject({ documentStatus: 'draft', strongInput: false, firstDay: null, unpostedAt: null });
    expect(parseFactListAnswer(null)).toEqual({ totalCount: 0, totals: { sumForBudget: 0, sumForContract: 0, sumForAccounting: 0 }, rows: [] });
  });
  it('the form header comes from a row of the list (with the name of the author)', () => {
    const a = parseFactListAnswer({ totalCount: 1, totals: {}, rows: [raw()] });
    expect(factHeaderFromListRow(a.rows[0])).toEqual({ guid: 'd1', number: 'FI-00001', status: 'posted', strong: true, user: 'u1', userName: 'Anna K', createdAt: '2026-10-14T08:00:00Z', postedAt: '2026-10-15T08:00:00Z', unpostedAt: null });
  });
  it('the latest draft of a list that is newest first', () => {
    const a = parseFactListAnswer({ totalCount: 3, totals: {}, rows: [raw({ documentGUID: 'a' }), raw({ documentGUID: 'b', documentStatus: 'draft' }), raw({ documentGUID: 'c', documentStatus: 'draft' })] });
    expect(latestDraftOf(a.rows)?.documentGUID).toBe('b');
    expect(latestDraftOf([])).toBeUndefined();
  });
  it('the filter to the RPC: only what is set and readable; dates in any form', () => {
    expect(factListFilterToRpc(EMPTY_FACT_LIST_FILTER)).toEqual({});
    expect(factListFilterToRpc({ ...EMPTY_FACT_LIST_FILTER, fromDay: '12.10.2026', toDay: '2026-10-31', projectGUID: 'p1', businessUnitGUID: 'bu1', roleGUID: 'r1', resourceGUID: 'x1', author: ' ann ' }))
      .toEqual({ fromDay: '2026-10-12', toDay: '2026-10-31', projectGUID: 'p1', businessUnitGUID: 'bu1', roleGUID: 'r1', resourceGUID: 'x1', author: 'ann' });
    expect(factListFilterToRpc({ ...EMPTY_FACT_LIST_FILTER, fromDay: 'soon' })).toEqual({});                  // an unreadable date is not a filter
    expect(factListFilterToRpc(EMPTY_FACT_LIST_FILTER, { taskGUID: 't1' })).toEqual({ taskGUID: 't1' });
  });
  it('active filter, date errors', () => {
    expect(factListFilterActive(EMPTY_FACT_LIST_FILTER)).toBe(false);
    expect(factListFilterActive({ ...EMPTY_FACT_LIST_FILTER, author: ' ' })).toBe(false);
    expect(factListFilterActive({ ...EMPTY_FACT_LIST_FILTER, roleGUID: 'r' })).toBe(true);
    expect(factListDateErrors({ ...EMPTY_FACT_LIST_FILTER, fromDay: 'soon', toDay: '2026-10-31' })).toEqual({ fromDay: true, toDay: false });
  });
});

describe('a line made by the table (createOne)', () => {
  it('the control keys become columns; the quantity starts at 0; rowParentGUID is dropped; nulls are not kept', () => {
    const insert = factLineInsert({
      rowGUID: 'n1', rowOwnerGUID: 't1', rowParentGUID: 'empty', orderInList: 5,
      rowJSON: { [FACT_NEW_ROW_KEYS.header]: 'h1', [FACT_NEW_ROW_KEYS.genus]: 'materialGenus', [FACT_NEW_ROW_KEYS.day]: '2026-10-20', resourceRoleItem: null, measureUnitTaskLine: 'unit_pcs', priceTaskLine: 2, note: '' },
    });
    expect(insert).toEqual({
      rowGUID: 'n1', rowOwnerGUID: 't1', rowHeaderGUID: 'h1', genusGUID: 'materialGenus', rowPeriodDatetime: '2026-10-20T00:00:00.000Z', qtyForContract: 0, orderInList: 5,
      rowJSON: { measureUnitTaskLine: 'unit_pcs', priceTaskLine: 2 },
    });
    expect(insert).not.toHaveProperty('rowParentGUID');
  });
  it('an unknown genus falls back to Time; no day = today', () => {
    const insert = factLineInsert({ rowGUID: 'n2', rowOwnerGUID: 't1', rowJSON: { [FACT_NEW_ROW_KEYS.header]: 'h1', [FACT_NEW_ROW_KEYS.genus]: 'nonsense' } });
    expect(insert.genusGUID).toBe('timeGenus');
    expect(insert.rowPeriodDatetime).toBe(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  });
});

describe('the live totals of a document (the rows the table holds)', () => {
  const r = (over: Record<string, any>) => ({ rowGUID: 'x', rowHeaderGUID: 'h1', genusGUID: 'timeGenus', sumForBudget: 0, sumForContract: 0, sumForAccounting: 0, ...over });
  const rows = [r({ rowGUID: 'a', sumForBudget: '10.10', sumForContract: 20, sumForAccounting: null }), r({ rowGUID: 'b', genusGUID: 'materialGenus', sumForBudget: 0.2, sumForContract: '5.55', sumForAccounting: 7 }),
    r({ rowGUID: 'c', rowHeaderGUID: 'h2', sumForBudget: 999 }), { rowGUID: 'n', rowJSON: { [FACT_NEW_ROW_KEYS.header]: 'h1', [FACT_NEW_ROW_KEYS.genus]: 'timeGenus' } }];
  it('the rows of ONE document (a row that is not saved yet is already there), optionally one tab', () => {
    expect(factRowsOf(rows, 'h1').map((x) => x.rowGUID)).toEqual(['a', 'b', 'n']);
    expect(factRowsOf(rows, 'h1', 'materialGenus').map((x) => x.rowGUID)).toEqual(['b']);
    expect(factRowsOf(rows, 'h1', 'timeGenus').map((x) => x.rowGUID)).toEqual(['a', 'n']);
    expect(factRowsOf(rows, null)).toEqual([]);
    expect(factRowsOf(undefined, 'h1')).toEqual([]);
  });
  it('added in cents: a missing sum counts 0', () => {
    expect(factTotalsOf(factRowsOf(rows, 'h1'))).toEqual({ lineCount: 3, sumForBudget: 10.3, sumForContract: 25.55, sumForAccounting: 7 });
    expect(factTotalsOf([])).toEqual({ lineCount: 0, sumForBudget: 0, sumForContract: 0, sumForAccounting: 0 });
  });
});
