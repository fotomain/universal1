// kit8/pm/view/project/estimation/estimationModel.ts: the link, the summary, the rows / totals of the table (the worked example of PROJECT_ESTIMATION.html), the reasons that disable Fill,
// the rules of the two modes and the plan of the fill (new ids, behind the old top-level rows, unposted lines, no sums of other currencies).
import {
  canBeEstimationOf, currenciesDiffer, estimationCurrencyDiffers, estimationFooter, estimationLinkOf, estimationRows, estimationTotals, estimationValuesOf,
  fillBlockReason, fillNeedsModeQuestion, fillNeedsRecalculation, lineWithoutProjectCurrencySums, parseEstimationSummary, planEstimationFill, replaceBlockedReason, round2,
  type EstimationSummary,
} from '../../../../../kit8/pm/view/project/estimation/estimationModel';
import { buildTreePath, projectTreePath } from '../../../../../kit8/pm/view/project/scheduling';

const P1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const P2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const WAGES = 'item-wages', MATERIALS = 'item-materials', HIRE = 'item-hire', TRANSPORT = 'item-transport', SALES = 'item-sales';

/** the worked example of the document: 27 200 cost, 36 000 revenue, 8 800 profit, ROI1 32.35 % */
const item = (budgetItemGUID: string | null, kind: 'cost' | 'revenue', lines: number, sumForBudget: number, vatForBudget: number, linesWithoutSum = 0) => ({ budgetItemGUID, kind, lines, sumForBudget, vatForBudget, linesWithoutSum });
const proj = (extra: any = {}) => ({ projectGUID: P2, name: 'Hall 12 - Estimate', currencyForBudget: 'EUR', currencyForAccounting: 'EUR', tasks: 24, links: 31, lines: 11, linesWithoutItem: 0, linesWithoutSum: 0, items: [], ...extra });
const rawSummary = (): any => ({
  source: proj({ items: [item(WAGES, 'cost', 3, 14200, 0), item(MATERIALS, 'cost', 4, 8650, 1816.5), item(HIRE, 'cost', 2, 3100, 651), item(TRANSPORT, 'cost', 1, 1250, 262.5), item(SALES, 'revenue', 1, 36000, 7560)] }),
  target: proj({ projectGUID: P1, name: 'Hall 12', tasks: 1, links: 0, lines: 1, items: [item(WAGES, 'cost', 1, 2000, 0)], postedTasks: 0, documents: 0, readonly: false, canCreate: true, roots: [{ rowGUID: 'own', orderInList: 5 }] }),
});

describe('the link', () => {
  it('estimationLinkOf: a GUID (lower case), else null', () => {
    expect(estimationLinkOf({ projectEstimationGUID: P2.toUpperCase() })).toBe(P2);
    expect(estimationLinkOf({ projectEstimationGUID: ' ' + P2 + ' ' })).toBe(P2);
    for (const bad of [undefined, null, '', 'abc', 12, {}]) expect(estimationLinkOf({ projectEstimationGUID: bad as any })).toBeNull();
    expect(estimationLinkOf(null)).toBeNull();
    expect(estimationValuesOf({ projectEstimationGUID: P2 })).toEqual({ projectEstimationGUID: P2, useGOSTInformationInDocuments: false });
    expect(estimationValuesOf({ useGOSTInformationInDocuments: true }).useGOSTInformationInDocuments).toBe(true);
    expect(estimationValuesOf(null)).toEqual({ projectEstimationGUID: null, useGOSTInformationInDocuments: false });
  });
  it('a project is never its own estimation', () => {
    expect(canBeEstimationOf(P1, P2)).toBe(true);
    expect(canBeEstimationOf(P1, P1.toUpperCase())).toBe(false);
    expect(canBeEstimationOf(null, P2)).toBe(true); // not saved yet: any project may be picked
    expect(canBeEstimationOf(P1, null)).toBe(false);
  });
});

describe('the summary and the rows', () => {
  it('parseEstimationSummary: numbers may arrive as strings, an unknown kind is cost, a missing target is null', () => {
    const s = parseEstimationSummary({ source: { ...rawSummary().source, tasks: '24', items: [{ budgetItemGUID: '', kind: 'weird', lines: '2', sumForBudget: '10.50', vatForBudget: null, linesWithoutSum: 0 }] }, target: null });
    expect(s.source.tasks).toBe(24);
    expect(s.source.items[0]).toEqual({ budgetItemGUID: null, kind: 'cost', lines: 2, sumForBudget: 10.5, vatForBudget: 0, linesWithoutSum: 0 });
    expect(s.target).toBeNull();
    expect(parseEstimationSummary(null).source.items).toEqual([]);
  });

  it('rows: one per (kind, item); cost first; Estimate - now over BOTH projects', () => {
    const s = parseEstimationSummary(rawSummary());
    const rows = estimationRows(s, null);
    expect(rows.map((r) => r.budgetItemGUID)).toEqual([WAGES, MATERIALS, HIRE, TRANSPORT, SALES]);
    const wages = rows.find((r) => r.budgetItemGUID === WAGES)!;
    expect(wages).toMatchObject({ estimate: 14200, projectNow: 2000, difference: 12200, converted: null, lines: 3 });
    expect(rows.find((r) => r.budgetItemGUID === MATERIALS)).toMatchObject({ estimate: 8650, vat: 1816.5, projectNow: 0, difference: 8650 });
  });

  it('an item that only the project has is listed (estimate 0)', () => {
    const raw = rawSummary();
    raw.target.items.push(item('own-only', 'cost', 1, 300, 0));
    const rows = estimationRows(parseEstimationSummary(raw), null);
    expect(rows.find((r) => r.budgetItemGUID === 'own-only')).toMatchObject({ estimate: 0, projectNow: 300, difference: -300 });
  });

  it('no project yet: no Project now / difference', () => {
    const raw = rawSummary();
    raw.target = null;
    const rows = estimationRows(parseEstimationSummary(raw), null);
    expect(rows[0].projectNow).toBeNull();
    expect(rows[0].difference).toBeNull();
  });

  it('the line with no budget item is one row, last of its kind', () => {
    const raw = rawSummary();
    raw.source.items.unshift(item(null, 'cost', 1, 500, 105));
    const rows = estimationRows(parseEstimationSummary(raw), null);
    const costRows = rows.filter((r) => r.kind === 'cost');
    expect(costRows[costRows.length - 1].budgetItemGUID).toBeNull();
    expect(costRows[costRows.length - 1].estimate).toBe(500);
  });

  it('other budget currencies: converted with the rate, the difference is in the currency of the project; no rate = nothing guessed', () => {
    const raw = rawSummary();
    raw.target.currencyForBudget = 'USD';
    const s = parseEstimationSummary(raw);
    const withRate = estimationRows(s, 1.1);
    expect(withRate.find((r) => r.budgetItemGUID === WAGES)).toMatchObject({ converted: 15620, projectNow: 2000, difference: 13620 });
    const noRate = estimationRows(s, null);
    expect(noRate[0].converted).toBeNull();
    expect(noRate[0].difference).toBeNull();
    // the same currency: the rate is ignored
    expect(estimationRows(parseEstimationSummary(rawSummary()), 1.1)[0].converted).toBeNull();
    // a project that is not saved: its currency comes from the draft
    const raw2 = rawSummary();
    raw2.target = null;
    expect(estimationRows(parseEstimationSummary(raw2), 2, 'USD')[0].converted).toBe(28400);
  });

  it('estimationCurrencyDiffers: an empty currency is nothing to convert', () => {
    expect(estimationCurrencyDiffers('EUR', 'usd')).toBe(true);
    expect(estimationCurrencyDiffers('EUR', 'eur')).toBe(false);
    expect(estimationCurrencyDiffers('EUR', '')).toBe(false);
    expect(estimationCurrencyDiffers('', 'EUR')).toBe(false);
    expect(currenciesDiffer({ currencyForBudget: 'EUR', currencyForAccounting: 'EUR' }, { currencyForBudget: 'EUR', currencyForAccounting: 'GBP' })).toBe(true);
    expect(currenciesDiffer({ currencyForBudget: 'EUR', currencyForAccounting: 'EUR' }, { currencyForBudget: 'EUR', currencyForAccounting: 'EUR' })).toBe(false);
  });
});

describe('the totals (the worked example)', () => {
  it('cost 27 200, revenue 36 000, profit 8 800, ROI1 32.35 %', () => {
    const rows = estimationRows(parseEstimationSummary(rawSummary()), null);
    const f = estimationFooter(rows);
    expect(f.estimate).toEqual({ cost: 27200, revenue: 36000, profit: 8800, roi: 0.3235 });
    expect(f.now).toEqual({ cost: 2000, revenue: 0, profit: -2000, roi: -1 });
    expect(f.converted).toBeNull();
  });
  it('no cost = no ROI; round2', () => {
    expect(estimationTotals([{ kind: 'revenue', value: 100 }]).roi).toBeNull();
    expect(estimationTotals([]).profit).toBe(0);
    expect(round2(1.005 + 1.005)).toBe(2.01);
  });
});

describe('Fill: why it is disabled', () => {
  const summary = (): EstimationSummary => parseEstimationSummary(rawSummary());
  const ok = { savedEstimationGUID: P2, draftEstimationGUID: P2, projectSaved: true, loading: false, summary: summary() };
  it('null when everything is fine', () => expect(fillBlockReason(ok)).toBeNull());
  it('in the order the user can fix things', () => {
    expect(fillBlockReason({ ...ok, savedEstimationGUID: null, draftEstimationGUID: null })).toBe('noEstimation');
    expect(fillBlockReason({ ...ok, projectSaved: false })).toBe('projectNotSaved');
    expect(fillBlockReason({ ...ok, savedEstimationGUID: null })).toBe('unsavedSettings');
    expect(fillBlockReason({ ...ok, loading: true })).toBe('loading');
    expect(fillBlockReason({ ...ok, summary: null })).toBe('estimationMissing');
    const empty = summary(); empty.source.tasks = 0;
    expect(fillBlockReason({ ...ok, summary: empty })).toBe('estimationEmpty');
    const ro = summary(); ro.target!.readonly = true;
    expect(fillBlockReason({ ...ok, summary: ro })).toBe('projectReadonly');
    const noRight = summary(); noRight.target!.canCreate = false;
    expect(fillBlockReason({ ...ok, summary: noRight })).toBe('noRight');
  });
});

describe('Fill: the two modes', () => {
  it('the user is asked only while the project has rows of its own', () => {
    expect(fillNeedsModeQuestion({ tasks: 3 })).toBe(true);
    expect(fillNeedsModeQuestion({ tasks: 0 })).toBe(false);
    expect(fillNeedsModeQuestion(null)).toBe(false);
  });
  it('Replace is refused while something is posted or a document exists', () => {
    expect(replaceBlockedReason({ postedTasks: 0, documents: 0 })).toBeNull();
    expect(replaceBlockedReason({ postedTasks: 2, documents: 0 })).toBe('posted');
    expect(replaceBlockedReason({ postedTasks: 0, documents: 1 })).toBe('documents');
    expect(replaceBlockedReason(null)).toBeNull();
  });
  it('Recalculate is offered when the budget / accounting currencies differ', () => {
    const s = parseEstimationSummary(rawSummary());
    expect(fillNeedsRecalculation(s.source, s.target)).toBe(false);
    const raw = rawSummary(); raw.target.currencyForAccounting = 'USD';
    const d = parseEstimationSummary(raw);
    expect(fillNeedsRecalculation(d.source, d.target)).toBe(true);
    expect(fillNeedsRecalculation(d.source, null)).toBe(false);
  });
});

describe('planEstimationFill', () => {
  const T_STAGE = 'bbbbbbbb-0000-4000-8000-000000000001', T_A = 'bbbbbbbb-0000-4000-8000-000000000002', T_B = 'bbbbbbbb-0000-4000-8000-000000000003', T_X = 'bbbbbbbb-0000-4000-8000-000000000004';
  const source: any = { rowGUID: P2, treePath: projectTreePath(P2), rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name: 'Hall 12 - Estimate', currencyForBudget: 'EUR', projectEstimationGUID: P1, projectStartAt: '2026-01-01T00:00:00Z' } };
  const target: any = { rowGUID: P1, treePath: projectTreePath(P1), rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name: 'Hall 12', currencyForBudget: 'USD' } };
  const task = (guid: string, parent: string, desc: string, order: number, extra: any = {}): any => ({ rowGUID: guid, treePath: buildTreePath(parent, guid), projectGUID: P2, rowOwnerGUID: 'u', rowDuration: null, rowProgress: 20, orderInList: order, rowJSON: { rowKind: 'task', taskDescription: desc, durationDays: 2, ...extra } });
  const stage = task(T_STAGE, projectTreePath(P2), 'Stage', 1, { rowKind: 'stage' });
  const a = task(T_A, stage.treePath, 'A', 1, { taskIsSubproject: true, taskSubprojectGUID: 'other' });
  const b = task(T_B, stage.treePath, 'B', 2);
  const x = task(T_X, projectTreePath(P2), 'X', 2);
  const deps: any[] = [{ rowGUID: T_B, rowDependsOnGUID: T_A, projectGUID: P2, rowOwnerGUID: 'u', linkType: 'FS', lagDays: 0, rowJSON: {} }];
  const lines: any[] = [
    { rowGUID: 'l1', rowOwnerGUID: T_A, rowParentGUID: 'timeGenus', orderInList: 1, rowJSON: { taskIsPosted: true, sumForBudget: 100, sumVATForBudget: 21, sumForAccounting: 90, sumVATForAccounting: 19, fxSnapshotTaskLine: { day: 'x' }, sumForContract: 100, budgetItemTaskLine: WAGES } },
    { rowGUID: 'l2', rowOwnerGUID: T_B, rowParentGUID: 'materialGenus', orderInList: 1, rowJSON: { sumForBudget: 7 } },
  ];
  let n = 0;
  const run = (over: any = {}) => planEstimationFill({ source, tasks: [stage, a, b, x], dependencies: deps, taskLines: lines, target, ownerGUID: 'u', existingRoots: [], dropCurrencySums: false, newGUID: () => `new-${++n}`, ...over });

  it('new ids, tree paths under the target, links on the new ids, the settings of the estimation are not used', () => {
    n = 0;
    const p = run();
    expect(p.tasks).toHaveLength(4);
    expect(p.tasks.every((t) => t.projectGUID === P1 && t.treePath.startsWith(projectTreePath(P1) + '.'))).toBe(true);
    expect(p.tasks.map((t) => t.rowGUID).sort()).toEqual(['new-1', 'new-2', 'new-3', 'new-4']);
    expect(p.dependencies).toHaveLength(1);
    expect(p.dependencies[0].rowGUID).toBe(p.idMap[T_B]);
    expect(p.dependencies[0].rowDependsOnGUID).toBe(p.idMap[T_A]);
    expect(p.newRoots.sort()).toEqual([p.idMap[T_STAGE], p.idMap[T_X]].sort());
  });
  it('the subproject mark of a task is not copied', () => {
    const p = run();
    const copyOfA = p.tasks.find((t) => t.rowGUID === p.idMap[T_A])!;
    expect(copyOfA.rowJSON).not.toHaveProperty('taskIsSubproject');
    expect(copyOfA.rowJSON).not.toHaveProperty('taskSubprojectGUID');
    expect(copyOfA.rowJSON.taskDescription).toBe('A');
  });
  it('the new top-level rows go BEHIND the rows the project has (Append / Replace keep the order), the rows inside keep theirs', () => {
    const p = run({ existingRoots: [{ rowGUID: 'o1', orderInList: 3 }, { rowGUID: 'o2', orderInList: 7 }] });
    const byId = (guid: string) => p.tasks.find((t) => t.rowGUID === p.idMap[guid])!;
    expect(byId(T_STAGE).orderInList).toBe(8 + 1);
    expect(byId(T_X).orderInList).toBe(8 + 2);
    expect(byId(T_A).orderInList).toBe(1);
    expect(run().tasks.find((t) => t.rowJSON.taskDescription === 'X')!.orderInList).toBe(2); // an empty project: as in the estimation
  });
  it('the lines come out UNPOSTED on the new task ids', () => {
    const p = run();
    expect(p.taskLines).toHaveLength(2);
    expect(p.taskLines[0].rowOwnerGUID).toBe(p.idMap[T_A]);
    expect(p.taskLines[0].rowJSON.taskIsPosted).toBe(false);
    expect(p.taskLines[0].rowJSON.sumForBudget).toBe(100); // same currencies: the sums stay
    expect(p.taskLines[0].rowGUID).not.toBe('l1');
  });
  it('other currencies: the sums of the currencies of the estimation are dropped, the contract sum and the budget item stay', () => {
    const p = run({ dropCurrencySums: true });
    expect(p.taskLines[0].rowJSON).toMatchObject({ sumForBudget: null, sumVATForBudget: null, sumForAccounting: null, sumVATForAccounting: null, fxSnapshotTaskLine: null, sumForContract: 100, budgetItemTaskLine: WAGES, taskIsPosted: false });
    expect(lineWithoutProjectCurrencySums({ a: 1, sumForBudget: 5 })).toEqual({ a: 1, sumForBudget: null });
  });
});
