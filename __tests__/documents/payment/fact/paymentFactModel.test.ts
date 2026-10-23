// paymentFactModel - the pure rules of the payment fact: the answers of the database, the filters of the list, the header, the missing fields, the totals of the lines, the folders, the candidates of "Get from plan".
import {
  EMPTY_PAYMENT_FACT_FILTER, PAYMENT_FACT_DIRECTIONS, PaymentFactHeaderView, PlanCandidate, bankAmountDifference, candidatesOfSamePayee, candidatesOpenTotal, canChangePayee, canDeletePaymentFact, canEditPaymentFact,
  canGetFromPlan, canPostPaymentFact, canUnpostPaymentFact, documentsOfRoute, headerOfListRow, lineDiffersFromPlan, lineIsTyped, paymentFactDateErrors, paymentFactDocumentPath, paymentFactFilterActive, paymentFactFilterToRpc,
  paymentFactFolderNodes, paymentFactGenusOf, paymentFactLineErrors, paymentFactLinesOf, paymentFactMissing, paymentFactProblemText, paymentFactRouteParams, paymentFactTotals, parseAddFromPlanAnswer, parseCandidates,
  parseListAnswer, parsePlanPaid, parsePostAnswer, skipReasonText, formatMoney, PAYMENT_FACT_ROUTE, isPaymentFactDirection, canCreatePaymentFactFromInvoice, parseCreateFromInvoiceAnswer, createFromInvoiceSkippedText,
  paymentFactBasedOnSubtitle, PAYMENT_FACT_BASED_ON_ITEM,
} from '../../../../kit8/documents/payment/fact/paymentFactModel';

const header = (over: Partial<PaymentFactHeaderView> = {}): PaymentFactHeaderView => ({
  guid: 'd1', number: 'PF-00001', status: 'draft', paymentFactNumber: 'BANK-1', day: '2030-01-05', moneyAccountGUID: 'ma1', moneyAccountTitle: 'Bank EUR', legalEntityTitle: 'Acme', currency: 'EUR', partnerGUID: 'pt1', personGUID: '',
  payeeTitle: 'Supplier One', direction: 'outbound', bankAmount: null, taskGUID: 't1', projectGUID: 'p1', projectCount: 1, authorName: 'Anna', ...over,
});
const listRow = (over: Record<string, any> = {}) => ({
  documentGUID: 'd1', documentNumber: 'PF-00001', documentStatus: 'draft', paymentFactNumber: 'BANK-1', paymentFactDay: '2030-01-05', moneyAccountGUID: 'ma1', moneyAccountTitle: 'Bank EUR', legalEntityGUID: 'le1', legalEntityTitle: 'Acme',
  currency: 'EUR', partnerGUID: 'pt1', personGUID: '', payeeTitle: 'Supplier One', direction: 'outbound', folder: 'ma1:pt1', bankAmount: null, taskGUID: 't1', projectGUID: 'p1', projectCount: 1, authorGUID: 'u1', authorName: 'Anna',
  lineCount: 2, sumForMoneyAccount: '300.456', ...over,
});

describe('directions and genus', () => {
  it('Outbound and Inbound, and the payments genus of each', () => {
    expect(PAYMENT_FACT_DIRECTIONS.map((d) => d.value)).toEqual(['outbound', 'inbound']);
    expect(paymentFactGenusOf('outbound')).toBe('outboundPaymentGenus');
    expect(paymentFactGenusOf('inbound')).toBe('inboundPaymentGenus');
    expect(isPaymentFactDirection('inbound')).toBe(true);
    expect(isPaymentFactDirection('sideways')).toBe(false);
  });
});

describe('the answers of the database', () => {
  it('parsePostAnswer: posted | draft | refused (anything else) with the problems', () => {
    expect(parsePostAnswer({ status: 'posted', lines: 3, problems: [] })).toEqual({ status: 'posted', lines: 3, problems: [] });
    expect(parsePostAnswer({ status: 'draft' }).status).toBe('draft');
    expect(parsePostAnswer({ status: 'refused', lines: 2, problems: [{ lineGUID: 'l1', problem: 'sumMissing' }, { problem: 'moneyAccountMissing' }] }))
      .toEqual({ status: 'refused', lines: 2, problems: [{ lineGUID: 'l1', problem: 'sumMissing' }, { lineGUID: null, problem: 'moneyAccountMissing' }] });
    expect(parsePostAnswer(null)).toEqual({ status: 'refused', lines: 0, problems: [] });
  });
  it('parseCandidates: the rows are typed, the money is rounded to 2 decimals, a bad direction is outbound', () => {
    const [r] = parseCandidates({ rows: [{ planLineGUID: 'pl1', taskGUID: 't1', taskTitle: 'Task', projectGUID: 'p1', projectName: 'Proj', direction: 'inbound', partnerGUID: 'pt3', personGUID: null, payeeTitle: 'Cust', contractGUID: 'c4', contractInfo: 'C-4', budgetItem: 'bi', businessUnit: null, currency: 'EUR', plannedDay: '2030-01-07T00:00:00', planSum: '500', paid: 100.004, open: '399.996' }, { planLineGUID: 'pl2', direction: 'x' }] });
    expect(r).toMatchObject({ planLineGUID: 'pl1', direction: 'inbound', partnerGUID: 'pt3', personGUID: null, businessUnit: null, plannedDay: '2030-01-07', planSum: 500, paid: 100, open: 400 });
    expect(parseCandidates({ rows: [{ planLineGUID: 'pl2', direction: 'x' }] })[0].direction).toBe('outbound');
    expect(parseCandidates(null)).toEqual([]);
  });
  it('parseAddFromPlanAnswer and the texts of the reasons', () => {
    expect(parseAddFromPlanAnswer({ added: 2, skipped: [{ planLineGUID: 'a', reason: 'wrongPayee' }] })).toEqual({ added: 2, skipped: [{ planLineGUID: 'a', reason: 'wrongPayee' }] });
    expect(parseAddFromPlanAnswer(null)).toEqual({ added: 0, skipped: [] });
    for (const r of ['planPaymentNotPosted', 'notYourProject', 'wrongDirection', 'wrongPayee', 'nothingOpen']) expect(skipReasonText(r)).not.toBe(r);
    expect(skipReasonText('whatever')).toBe('whatever');
  });
  it('parsePlanPaid: per plan payment, rounded', () => {
    expect(parsePlanPaid([{ planLineGUID: 'a', planSum: 100, paid: '40.005', open: '59.995' }])).toEqual([{ planLineGUID: 'a', planSum: 100, paid: 40.01, open: 60 }]);
    expect(parsePlanPaid(null)).toEqual([]);
  });
  it('parseListAnswer: rows, totals per currency; the amount of the account is rounded; a row without a direction has ""', () => {
    const a = parseListAnswer({ totalCount: 2, totalsByCurrency: [{ currency: 'EUR', count: 2, sumForMoneyAccount: 300.456 }], rows: [listRow(), listRow({ documentGUID: 'd2', direction: '', bankAmount: 5 })] });
    expect(a.totalCount).toBe(2);
    expect(a.totalsByCurrency).toEqual([{ currency: 'EUR', count: 2, sumForMoneyAccount: 300.46 }]);
    expect(a.rows[0]).toMatchObject({ documentGUID: 'd1', sumForMoneyAccount: 300.46, direction: 'outbound', bankAmount: null, lineCount: 2 });
    expect(a.rows[1]).toMatchObject({ direction: '', bankAmount: 5 });
    expect(parseListAnswer(undefined)).toEqual({ totalCount: 0, totalsByCurrency: [], rows: [] });
  });
});

describe('the filters of the list', () => {
  it('only what is set goes to the RPC; the dates are read (YYYYMMDD / DDMMYYYY), an unreadable one is an error of the field', () => {
    expect(paymentFactFilterActive(EMPTY_PAYMENT_FACT_FILTER)).toBe(false);
    const f = { ...EMPTY_PAYMENT_FACT_FILTER, number: ' BANK ', fromDay: '20300101', moneyAccountGUID: 'ma1', direction: 'inbound' };
    expect(paymentFactFilterActive(f)).toBe(true);
    expect(paymentFactFilterToRpc(f, { taskGUID: 't1' })).toEqual({ taskGUID: 't1', fromDay: '2030-01-01', number: 'BANK', moneyAccountGUID: 'ma1', direction: 'inbound' });
    expect(paymentFactDateErrors({ ...EMPTY_PAYMENT_FACT_FILTER, fromDay: '99999999', toDay: '' })).toEqual({ fromDay: true, toDay: false });
    expect(paymentFactFilterToRpc({ ...EMPTY_PAYMENT_FACT_FILTER, fromDay: '99999999' })).toEqual({});
  });
});

describe('the header and what the user may do', () => {
  it('headerOfListRow keeps the fields of the form', () => {
    expect(headerOfListRow(parseListAnswer({ rows: [listRow()] }).rows[0])).toMatchObject({ guid: 'd1', number: 'PF-00001', status: 'draft', day: '2030-01-05', moneyAccountGUID: 'ma1', partnerGUID: 'pt1', direction: 'outbound', currency: 'EUR' });
  });
  it('a draft can be edited, deleted, posted (with lines) and asked "Get from plan"; a posted one can only be unposted', () => {
    const d = header();
    expect([canEditPaymentFact(d), canDeletePaymentFact(d), canPostPaymentFact(d, 1), canPostPaymentFact(d, 0), canUnpostPaymentFact(d), canGetFromPlan(d)]).toEqual([true, true, true, false, false, true]);
    const p = header({ status: 'posted' });
    expect([canEditPaymentFact(p), canDeletePaymentFact(p), canPostPaymentFact(p, 1), canUnpostPaymentFact(p), canGetFromPlan(p)]).toEqual([false, false, false, true, false]);
  });
  it('the payee and the direction are fixed while the document has lines (the database refuses the change)', () => {
    expect(canChangePayee(header(), 0)).toBe(true);
    expect(canChangePayee(header(), 1)).toBe(false);
    expect(canChangePayee(header({ status: 'posted' }), 0)).toBe(false);
  });
  it('paymentFactMissing lists what Post still needs, in the order of the form', () => {
    expect(paymentFactMissing(header(), 1)).toEqual([]);
    expect(paymentFactMissing(header({ paymentFactNumber: ' ', day: '', moneyAccountGUID: '', partnerGUID: '', personGUID: '', direction: '' }), 0))
      .toEqual(['documentHasNoLines', 'paymentFactNumberMissing', 'paymentFactDateMissing', 'moneyAccountMissing', 'payeeMissing', 'directionMissing']);
    expect(paymentFactMissing(header({ partnerGUID: '', personGUID: 'pe1' }), 1)).toEqual([]);
  });
  it('every problem code of the database has a sentence; an unknown code is shown as it is', () => {
    const codes = ['documentIsPosted', 'documentIsNotPosted', 'documentHasNoLines', 'paymentFactNumberMissing', 'paymentFactDateMissing', 'moneyAccountMissing', 'accountCurrencyMissing', 'dateBeforeOpening', 'payeeMissing', 'directionMissing',
      'budgetItemMissing', 'budgetItemNotPayment', 'contractMissing', 'currencyMissing', 'sumMissing', 'notYourProject', 'sumForAccountingMissing', 'sumForBudgetMissing', 'sumForMoneyAccountMissing'];
    for (const c of codes) expect(paymentFactProblemText(c)).not.toBe(c);
    expect(paymentFactProblemText('somethingNew')).toBe('somethingNew');
  });
});

describe('the lines', () => {
  const rows = [
    { rowGUID: 'l1', rowHeaderGUID: 'd1', rowJSON: { paymentFactCurrency: 'EUR', sumForContract: 100, sumForMoneyAccount: 100 } },
    { rowGUID: 'l2', rowHeaderGUID: 'd1', rowJSON: { paymentFactCurrency: 'EUR', sumForContract: 200.1, sumForMoneyAccount: 200.1 } },
    { rowGUID: 'l3', rowHeaderGUID: 'd1', rowJSON: { paymentFactCurrency: 'USD', sumForContract: 50, sumForMoneyAccount: null } },
    { rowGUID: 'x1', rowHeaderGUID: 'd2', rowJSON: { paymentFactCurrency: 'EUR', sumForContract: 999 } },
  ];
  it('the rows of ONE document', () => {
    expect(paymentFactLinesOf(rows, 'd1').map((r) => r.rowGUID)).toEqual(['l1', 'l2', 'l3']);
    expect(paymentFactLinesOf(rows, null)).toEqual([]);
    expect(paymentFactLinesOf(null, 'd1')).toEqual([]);
  });
  it('totals: the amount of the money account, the contract sums PER currency (never added), the lines that have no amount', () => {
    const t = paymentFactTotals(paymentFactLinesOf(rows, 'd1'));
    expect(t).toEqual({ lineCount: 3, sumForMoneyAccount: 300.1, byCurrency: [{ currency: 'EUR', sumForContract: 300.1 }, { currency: 'USD', sumForContract: 50 }], withoutAccountSum: 1 });
    expect(paymentFactTotals([])).toEqual({ lineCount: 0, sumForMoneyAccount: 0, byCurrency: [], withoutAccountSum: 0 });
  });
  it('the control amount of the bank: none = null; else bank minus the lines', () => {
    const t = { sumForMoneyAccount: 300.1 };
    expect(bankAmountDifference(null, t)).toBeNull();
    expect(bankAmountDifference(undefined, t)).toBeNull();
    expect(bankAmountDifference(300.1, t)).toBe(0);
    expect(bankAmountDifference(310, t)).toBe(9.9);
  });
  it('paymentFactLineErrors: contract, budget item, currency, sum > 0, and the reason of a missing rate', () => {
    expect(paymentFactLineErrors({ rowJSON: {} })).toEqual(['A line needs a contract.', 'A line needs a budget item.', 'A line needs a currency (it comes from the contract).', 'A line needs a sum greater than 0.']);
    expect(paymentFactLineErrors({ rowJSON: { paymentFactContract: 'c', paymentFactBudgetItem: 'b', paymentFactCurrency: 'EUR', sumForContract: 5 } })).toEqual([]);
    expect(paymentFactLineErrors({ rowJSON: { paymentFactContract: 'c', paymentFactBudgetItem: 'b', paymentFactCurrency: 'EUR', sumForContract: 5, paymentFactFxProblem: 'No Budget exchange rate of USD on or before 2030-01-05' } })).toEqual(['No Budget exchange rate of USD on or before 2030-01-05']);
  });
  it('a line differs from the plan when it pays another sum than the plan payment had open; a typed amount is marked', () => {
    expect(lineDiffersFromPlan({ paymentPlanLineGUID: 'pl', rowJSON: { paymentFactPlanSum: 100, sumForContract: 150 } })).toBe(true);
    expect(lineDiffersFromPlan({ paymentPlanLineGUID: 'pl', rowJSON: { paymentFactPlanSum: 100, sumForContract: 100 } })).toBe(false);
    expect(lineDiffersFromPlan({ paymentPlanLineGUID: null, rowJSON: { paymentFactPlanSum: 100, sumForContract: 150 } })).toBe(false);
    expect(lineIsTyped({ rowJSON: { moneyAccountSumSource: 'typed' } })).toBe(true);
    expect(lineIsTyped({ rowJSON: { moneyAccountSumSource: 'auto' } })).toBe(false);
  });
  it('formatMoney', () => {
    expect(formatMoney(1234.5)).toMatch(/1.?234[.,]50/);
    expect(formatMoney(null)).toBe('');
  });
});

describe('"Get from plan"', () => {
  const cand = (guid: string, over: Partial<PlanCandidate> = {}): PlanCandidate => ({
    planLineGUID: guid, taskGUID: 't1', taskTitle: 'T', projectGUID: 'p1', projectName: 'P', direction: 'outbound', partnerGUID: 'pt1', personGUID: null, payeeTitle: 'S1', contractGUID: 'c1', contractInfo: 'C-1', budgetItem: 'bi',
    businessUnit: null, currency: 'EUR', plannedDay: '2030-01-05', planSum: 100, paid: 0, open: 100, ...over,
  });
  it('the first one checked fixes the payee: only the payments of the same payee and direction can go with it', () => {
    const rows = [cand('a'), cand('b', { contractGUID: 'c2', open: 40 }), cand('c', { partnerGUID: 'pt2' }), cand('d', { direction: 'inbound' }), cand('e', { partnerGUID: null, personGUID: 'pe1' })];
    expect(candidatesOfSamePayee(rows, rows[0]).map((r) => r.planLineGUID)).toEqual(['a', 'b']);
    expect(candidatesOfSamePayee(rows, rows[4]).map((r) => r.planLineGUID)).toEqual(['e']);
    expect(candidatesOfSamePayee(rows, undefined)).toBe(rows);
    expect(candidatesOpenTotal(rows, new Set(['a', 'b']))).toBe(140);
    expect(candidatesOpenTotal(rows, new Set())).toBe(0);
  });
});

describe('folders, routes', () => {
  it('the folders of the list: money account → payee (what the documents have)', () => {
    const nodes = paymentFactFolderNodes(parseListAnswer({ rows: [listRow(), listRow({ documentGUID: 'd2', partnerGUID: 'pt2', payeeTitle: 'Alpha' }), listRow({ documentGUID: 'd3', moneyAccountGUID: 'ma2', moneyAccountTitle: 'Aaa Cash', partnerGUID: '', personGUID: 'pe1', payeeTitle: 'Pat' }), listRow({ documentGUID: 'd4', moneyAccountGUID: '' })] }).rows);
    expect(nodes.filter((n) => n.parentId === null).map((n) => n.title)).toEqual(['Aaa Cash', 'Bank EUR']);
    expect(nodes.filter((n) => n.parentId === 'ma1').map((n) => [n.id, n.title])).toEqual([['ma1:pt2', 'Alpha'], ['ma1:pt1', 'Supplier One']]);
    expect(nodes.find((n) => n.id === 'ma2:pe1')).toMatchObject({ parentId: 'ma2', title: 'Pat' });
    expect(paymentFactFolderNodes([])).toEqual([]);
  });
  it('the route params only carry what is set; the documents of the route (a tab each); the path of one document', () => {
    expect(PAYMENT_FACT_ROUTE).toBe('/pm/project/task/payment-fact');
    expect(paymentFactRouteParams({ taskGUID: 't', projectGUID: 'p', documentGUID: 'd', documents: ['d', 'e'] })).toEqual({ taskGUID: 't', projectGUID: 'p', documentGUID: 'd', documents: 'd,e' });
    expect(paymentFactRouteParams({})).toEqual({});
    expect(documentsOfRoute('d2', 'd1, d2,d3')).toEqual(['d1', 'd2', 'd3']);
    expect(documentsOfRoute('d9', 'd1')).toEqual(['d9', 'd1']);
    expect(documentsOfRoute(null, null)).toEqual([]);
    expect(paymentFactDocumentPath('a b')).toBe('/pm/project/task/payment-fact?documentGUID=a%20b');
  });
});

describe('"Create based on → Payment fact" of an invoice', () => {
  it('only a POSTED invoice is paid', () => {
    expect(canCreatePaymentFactFromInvoice({ status: 'posted' })).toBe(true);
    expect(canCreatePaymentFactFromInvoice({ status: 'draft' })).toBe(false);
    expect(canCreatePaymentFactFromInvoice(null)).toBe(false);
  });
  it('the answer: the documents made (with their task) and why none was made', () => {
    expect(parseCreateFromInvoiceAnswer({ documents: [{ documentGUID: 'n1', lineCount: '2', taskGUID: 't1' }], skipped: [] })).toEqual({ documents: [{ documentGUID: 'n1', lineCount: 2, taskGUID: 't1' }], skipped: [] });
    expect(parseCreateFromInvoiceAnswer({ documents: [], skipped: [{ reason: 'nothingToPay' }] }).skipped).toEqual([{ reason: 'nothingToPay' }]);
    expect(parseCreateFromInvoiceAnswer(null)).toEqual({ documents: [], skipped: [] });
    expect(createFromInvoiceSkippedText('nothingToPay')).toContain('Nothing is left to pay');
    expect(createFromInvoiceSkippedText('other')).toBe('other');
  });
  it('the item of the menu says the direction', () => {
    expect(PAYMENT_FACT_BASED_ON_ITEM).toMatchObject({ id: 'paymentFact', title: 'Payment fact' });
    expect(paymentFactBasedOnSubtitle('vendor')).toContain('outbound');
    expect(paymentFactBasedOnSubtitle('customer')).toContain('inbound');
  });
});
