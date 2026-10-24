// Monitor07 model (documentation/PARTNER_BALANCE.html section 7): the sum-kind registry, the flags, the tree with the currency rule, the footer per currency, the filters sent to the database.
import {
  BalanceRow, DEFAULT_FLAGS, SORT_OPTIONS, SUM_KINDS, balanceFilterDescriptors, balanceFiltersToRpc, balanceFooter, buildBalanceTree, buildTaskNodes, defaultDirOf, defaultFilterValues, filterItemsOf,
  flattenBalance, isReportFlags, isReportSort, mergeKindCells, setFlag, shownKinds,
} from '../../../../kit8/pm/reports/partner_balance/partnerBalanceModel';

const row = (o: Partial<BalanceRow> & Record<string, any>): BalanceRow => ({
  partner: 'pt1', partnerTitle: 'Supplier One', contract: 'c1', contractTitle: 'C-1', contractFinishDate: '2030-12-31', currencyForContract: 'EUR', currencyForAccounting: 'EUR', currencyForBudget: 'EUR',
  project: null, projectTitle: null, task: null, taskTitle: null,
  sumForContractBegin: 0, sumForContractPlus: 275, sumForContractMinus: 140, sumForContractEnd: 135,
  sumForAccountingBegin: 0, sumForAccountingPlus: 275, sumForAccountingMinus: 140, sumForAccountingEnd: 135,
  sumForBudgetBegin: 0, sumForBudgetPlus: 275, sumForBudgetMinus: 140, sumForBudgetEnd: 135, ...o,
});

describe('the registry and the flags', () => {
  it('three kinds, each with its flag and its database column; the contract is shown by default', () => {
    expect(SUM_KINDS.map((k) => [k.id, k.flag, k.column])).toEqual([
      ['contract', 'showSumForContract', 'sumForContract'], ['accounting', 'showSumForAccounting', 'sumForAccounting'], ['budget', 'showSumForBudget', 'sumForBudget'],
    ]);
    expect(shownKinds(DEFAULT_FLAGS).map((k) => k.id)).toEqual(['contract']);
  });
  it('the last shown kind cannot be switched off; hideSettled is free', () => {
    expect(setFlag(DEFAULT_FLAGS, 'showSumForContract', false)).toBe(DEFAULT_FLAGS);
    const two = setFlag(DEFAULT_FLAGS, 'showSumForBudget', true);
    expect(shownKinds(two).map((k) => k.id)).toEqual(['contract', 'budget']);
    expect(shownKinds(setFlag(two, 'showSumForContract', false)).map((k) => k.id)).toEqual(['budget']);
    expect(setFlag(DEFAULT_FLAGS, 'hideSettled', false).hideSettled).toBe(false);
  });
  it('a stored choice is checked before it is used', () => {
    expect(isReportFlags(DEFAULT_FLAGS)).toBe(true);
    expect(isReportFlags({ showSumForContract: true })).toBe(false);
    expect(isReportSort({ sortBy: 'partnerName', sortDir: 'asc' })).toBe(true);
    expect(isReportSort({ sortBy: 'colour', sortDir: 'asc' })).toBe(false);
    expect(SORT_OPTIONS.map((o) => o.value)).toEqual(['partnerName', 'sumForBudgetEnd', 'contractFinishDate']);
    expect(defaultDirOf('sumForBudgetEnd')).toBe('desc');
    expect(defaultDirOf('partnerName')).toBe('asc');
  });
});

describe('the tree: Partner -> Contract in the order the database sent', () => {
  const rows = [row({}), row({ contract: 'c5', contractTitle: 'C-5', currencyForContract: 'USD', sumForContractEnd: 5, sumForContractPlus: 5, sumForContractMinus: 0 }),
                row({ partner: 'pt2', partnerTitle: 'Supplier Two', contract: '', contractTitle: '', contractFinishDate: null, sumForContractEnd: 25 })];
  it('a partner line per partner, a contract line per contract; the no-contract line has its own label', () => {
    const tree = buildBalanceTree(rows);
    expect(tree.map((n) => [n.level, n.label, n.children.map((c) => c.label)])).toEqual([['partner', 'Supplier One', ['C-1', 'C-5']], ['partner', 'Supplier Two', ['(no contract)']]]);
    expect(tree[1].children[0].key).toBe('c|pt2|none');
  });
  it('two contracts in two currencies: the contract sum of the partner is MIXED (never added); the accounting sums are in one currency and ARE added', () => {
    const [p1] = buildBalanceTree(rows);
    expect(p1.currency).toBeNull();
    expect(p1.cells.contract.currency).toBeNull();
    expect(p1.cells.accounting).toMatchObject({ currency: 'EUR', end: 270 });
    expect(p1.finishDate).toBe('2030-12-31');
  });
  it('two rows of ONE contract (two accounting currencies) add the contract sum and mix the accounting currency', () => {
    const [p] = buildBalanceTree([row({ currencyForAccounting: 'EUR' }), row({ currencyForAccounting: 'USD', sumForContractEnd: 10, sumForContractPlus: 10, sumForContractMinus: 0 })]);
    expect(p.children).toHaveLength(1);
    expect(p.children[0].cells.contract).toMatchObject({ currency: 'EUR', end: 145, plus: 285, minus: 140 });
    expect(p.children[0].cells.accounting.currency).toBeNull();
  });
  it('mergeKindCells: an empty currency is ignored, Begin + Plus - Minus = End survives', () => {
    const a = { begin: 10, plus: 5, minus: 3, end: 12, currency: 'EUR' };
    const b = { begin: 0, plus: 0, minus: 0, end: 0, currency: '' };
    const m = mergeKindCells([a, b]);
    expect(m).toEqual({ ...a });
    expect(m.begin + m.plus - m.minus).toBe(m.end);
    expect(mergeKindCells([b, b]).currency).toBe('');
  });
  it('the visible lines follow the open nodes; the tasks of a contract come from the loaded task rows', () => {
    const tree = buildBalanceTree(rows);
    expect(flattenBalance(tree, new Set()).map((l) => l.node.key)).toEqual(['p|pt1', 'p|pt2']);
    expect(flattenBalance(tree, new Set(['p|pt1'])).map((l) => [l.node.key, l.depth])).toEqual([['p|pt1', 0], ['c|pt1|c1', 1], ['c|pt1|c5', 1], ['p|pt2', 0]]);
    const c1 = tree[0].children[0];
    const tasks = { [c1.key]: buildTaskNodes(c1, [row({ project: 'pr1', projectTitle: 'Alpha', task: 't3', taskTitle: 'Task 112', sumForContractEnd: 80 }), row({ project: 'pr1', projectTitle: 'Alpha', task: 't4', taskTitle: 'Task 113', sumForContractEnd: 55 })]) };
    const lines = flattenBalance(tree, new Set(['p|pt1', c1.key]), tasks);
    expect(lines.map((l) => [l.node.level, l.node.label, l.depth])).toEqual([
      ['partner', 'Supplier One', 0], ['contract', 'C-1', 1], ['task', 'Alpha / Task 112', 2], ['task', 'Alpha / Task 113', 2], ['contract', 'C-5', 1], ['partner', 'Supplier Two', 0]]);
    expect(lines[2].node.cells.contract.end).toBe(80);
  });
});

describe('the footer: one line per currency', () => {
  it('EUR and USD contract sums are two lines; accounting and budget join the line of their own currency', () => {
    const rows = [row({}), row({ contract: 'c5', currencyForContract: 'USD', sumForContractBegin: 0, sumForContractPlus: 5, sumForContractMinus: 0, sumForContractEnd: 5, currencyForAccounting: 'EUR', currencyForBudget: 'EUR' })];
    const f = balanceFooter(rows, shownKinds({ ...DEFAULT_FLAGS, showSumForAccounting: true }));
    expect(f.map((l) => l.label)).toEqual(['EUR', 'USD']);
    expect(f[0].cells.contract?.end).toBe(135);
    expect(f[0].cells.accounting?.end).toBe(270);
    expect(f[1].cells.contract?.end).toBe(5);
    expect(f[1].cells.accounting).toBeUndefined();
  });
  it('a row with no currency and no numbers makes no line', () => {
    const f = balanceFooter([row({ currencyForAccounting: '', sumForAccountingPlus: 0, sumForAccountingMinus: 0, sumForAccountingEnd: 0, sumForAccountingBegin: 0 })], shownKinds({ ...DEFAULT_FLAGS, showSumForAccounting: true }));
    expect(f.map((l) => l.label)).toEqual(['EUR']);
    expect(f[0].cells.accounting).toBeUndefined();
  });
});

describe('the filters', () => {
  it('the first run is the current month up to today', () => {
    expect(defaultFilterValues(new Date(2030, 0, 17))).toMatchObject({ dateFrom: '2030-01-01', dateTo: '2030-01-17', projectFilter: '' });
  });
  it('what the database takes: dates, ids, the sums bigger / smaller than, the first shown kind, hideSettled', () => {
    const q = balanceFiltersToRpc({ ...defaultFilterValues(new Date(2030, 0, 17)), partnerFilter: 'pt1', partnerContractFilter: 'c1', sumBiggerThan: '30', sumSmallerThan: '-5,5' }, { ...DEFAULT_FLAGS, showSumForContract: false, showSumForBudget: true });
    expect(q).toEqual({ from: '2030-01-01', to: '2030-01-17', invalid: false, filters: { partnerFilter: 'pt1', partnerContractFilter: 'c1', sumBiggerThan: 30, sumSmallerThan: -5.5, sumKind: 'budget', hideSettled: true } });
  });
  it('a task or a contract without its project / partner is not sent; an unreadable date or amount is no filter; dateFrom after dateTo is invalid', () => {
    const q = balanceFiltersToRpc({ dateFrom: 'x', dateTo: '', projectFilter: '', taskFilter: 't1', partnerFilter: '', partnerContractFilter: 'c1', legalEntityFilter: '', sumBiggerThan: 'abc', sumSmallerThan: '' }, DEFAULT_FLAGS);
    expect(q.from).toBeNull();
    expect(q.to).toBeNull();
    expect(q.filters).toEqual({ sumKind: 'contract', hideSettled: true });
    expect(balanceFiltersToRpc({ ...defaultFilterValues(), dateFrom: '2030-02-01', dateTo: '2030-01-01' }, DEFAULT_FLAGS).invalid).toBe(true);
  });
  it('the descriptors: dates, project, task (waits for the project), partner, contract (waits for the partner), the sums; the legal entity only when there are two', () => {
    const items = filterItemsOf({ projects: [{ id: 'p', title: 'P' }], tasks: [], partners: [{ id: 'pt1', title: 'S1' }], contracts: [{ id: 'none', title: '(no contract)' }], legalEntities: [{ id: 'le1', title: 'A' }] });
    expect(items.partners).toEqual([{ value: 'pt1', label: 'S1' }]);
    const d = balanceFilterDescriptors(items, defaultFilterValues());
    expect(d.map((x) => x.id)).toEqual(['dateFrom', 'dateTo', 'projectFilter', 'taskFilter', 'partnerFilter', 'partnerContractFilter', 'sumBiggerThan', 'sumSmallerThan']);
    expect((d[3] as any).disabled).toBe(true);
    expect((d[5] as any).disabled).toBe(true);
    const d2 = balanceFilterDescriptors({ ...items, legalEntities: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] }, { ...defaultFilterValues(), projectFilter: 'p', partnerFilter: 'pt1' });
    expect(d2.map((x) => x.id)).toContain('legalEntityFilter');
    expect((d2[3] as any).disabled).toBe(false);
    expect((d2[5] as any).disabled).toBe(false);
  });
});
