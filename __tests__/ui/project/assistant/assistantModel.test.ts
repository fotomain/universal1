// The expert of the Create New Project Assistant: steps, notes, hand over (pure).
import {
  assistantPatchFor,
  assistantValuesFrom,
  daysBetween,
  addMonthsISO,
  defaultAssistantValues,
  firstStepWithError,
  hasError,
  hasMeaningfulInput,
  isISODate,
  nextStepId,
  previousStepId,
  reviewLines,
  stepNotes,
  visibleSteps,
  type AssistantContext,
} from '../../../../kit8/ui/project/assistant/model/assistantModel';

const TODAY = '2026-11-17';
const ctx = (over: Partial<AssistantContext> = {}): AssistantContext => ({
  target: 'new',
  projectCount: 3,
  existingNames: ['Warehouse Riga'],
  consolidationCurrency: 'USD',
  today: TODAY,
  ...over,
});
const v = (over: Record<string, any> = {}) => ({ ...defaultAssistantValues(TODAY), ...over });

describe('dates', () => {
  it('accepts real dates only', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-2-3')).toBe(false);
    expect(isISODate('')).toBe(false);
  });
  it('counts days and adds months with the end of a short month', () => {
    expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2026-11-17', 3)).toBe('2027-02-17');
  });
});

describe('steps in the order of a project manager', () => {
  it('asks identity -> schedule -> currencies -> budgets -> (resources) -> control -> review', () => {
    expect(visibleSteps(v())).toEqual(['identity', 'schedule', 'currencies', 'budgets', 'control', 'review']);
    expect(visibleSteps(v({ projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true }))).toEqual(['identity', 'schedule', 'currencies', 'budgets', 'resources', 'control', 'review']);
    // a cost budget without time costs has nothing to book
    expect(visibleSteps(v({ projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false }))).not.toContain('resources');
  });
  it('walks forward and back over the visible steps', () => {
    const a = v();
    expect(nextStepId('identity', a)).toBe('schedule');
    expect(nextStepId('budgets', a)).toBe('control');
    expect(nextStepId('review', a)).toBeNull();
    expect(previousStepId('identity', a)).toBeNull();
    expect(previousStepId('control', a)).toBe('budgets');
  });
});

describe('notes of the steps', () => {
  it('the name is required, a duplicate is only a warning', () => {
    expect(hasError(stepNotes('identity', v({ name: '  ' }), ctx()))).toBe(true);
    const dup = stepNotes('identity', v({ name: 'warehouse riga' }), ctx());
    expect(hasError(dup)).toBe(false);
    expect(dup.some((n) => n.level === 'warning')).toBe(true);
    expect(stepNotes('identity', v({ name: 'Warehouse Riga - new line' }), ctx())).toEqual([]);
  });
  it('the schedule: a finish before the start is an error, long projects are advised to split', () => {
    expect(hasError(stepNotes('schedule', v({ projectFinishDate: '2026-10-01' }), ctx()))).toBe(true);
    expect(hasError(stepNotes('schedule', v({ projectStartDate: '17.11.2026' }), ctx()))).toBe(true);
    const long = stepNotes('schedule', v({ projectFinishDate: '2029-01-01' }), ctx());
    expect(hasError(long)).toBe(false);
    expect(long.some((n) => n.level === 'warning' && /stages/.test(n.text))).toBe(true);
    const hours = stepNotes('schedule', v({ planUnit: 'hour', projectFinishDate: '2027-06-01' }), ctx());
    expect(hours.some((n) => /by the hour/.test(n.text))).toBe(true);
  });
  it('the currencies of a project are always typed: budget and accounting are obligatory', () => {
    expect(hasError(stepNotes('currencies', v(), ctx()))).toBe(true);
    expect(hasError(stepNotes('currencies', v({ currencyForBudget: 'EUR', currencyForAccounting: 'EUR' }), ctx()))).toBe(false);
    expect(hasError(stepNotes('currencies', v({ currencyForBudget: 'EU', currencyForAccounting: 'EUR' }), ctx({ projectCount: 0 })))).toBe(true);
    expect(hasError(stepNotes('currencies', v({ currencyForBudget: 'EUR', currencyForAccounting: 'EUR', currencyForContract: 'X' }), ctx()))).toBe(true);
    // a saved project: the recalculation warning
    expect(stepNotes('currencies', v({ currencyForBudget: 'EUR', currencyForAccounting: 'EUR' }), ctx({ target: 'some-guid' })).some((n) => /recalculates/.test(n.text))).toBe(true);
  });
  it('the budgets: a cost budget needs a kind of cost; revenue without cost has no ROI', () => {
    expect(hasError(stepNotes('budgets', v({ projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false }), ctx()))).toBe(true);
    const revOnly = stepNotes('budgets', v({ projectRevenueBudgetNeeded: true }), ctx());
    expect(hasError(revOnly)).toBe(false);
    expect(revOnly.some((n) => /ROI/.test(n.text))).toBe(true);
    expect(stepNotes('budgets', v(), ctx()).some((n) => n.level === 'warning')).toBe(true);
  });
  it('the resources: time costs need a kind', () => {
    const none = v({ projectExpenseBudgetNeeded: true, projectTimeOfPersonNeeded: false });
    expect(hasError(stepNotes('resources', none, ctx()))).toBe(true);
    expect(hasError(stepNotes('resources', { ...none, projectTimeOfEquipmentNeeded: true }, ctx()))).toBe(false);
  });
  it('the review lists the first step that blocks', () => {
    expect(firstStepWithError(v(), ctx())).toBe('identity');
    expect(firstStepWithError(v({ name: 'Plant 7 - shutdown' }), ctx())).toBe('currencies');
    expect(firstStepWithError(v({ name: 'Plant 7 - shutdown', currencyForBudget: 'EUR', currencyForAccounting: 'EUR' }), ctx())).toBeNull();
  });
});

describe('values and hand over', () => {
  it('reads a project / draft / organization settings; a missing switch is its default', () => {
    const a = assistantValuesFrom({ name: 'X', projectStartDate: '2026-12-01', planHour: true, projectExpenseBudgetNeeded: true, currencyForBudget: ' usd ' }, TODAY);
    expect(a).toMatchObject({ name: 'X', projectStartDate: '2026-12-01', planUnit: 'hour', projectExpenseBudgetNeeded: true, currencyForBudget: 'USD', projectTimeCostsNeeded: true, projectTimeOfPersonNeeded: true });
    expect(assistantValuesFrom(null, TODAY)).toEqual(defaultAssistantValues(TODAY));
    expect(assistantValuesFrom({ projectStartDate: 'bad', projectFinishDate: 'bad' }, TODAY)).toMatchObject({ projectStartDate: TODAY, projectFinishDate: '' });
  });
  it('the patch for the New project window carries the currencies of the project (contract empty = budget)', () => {
    const a = v({ name: ' Plant 7 ', projectStartDate: '2026-12-01', projectFinishDate: '2027-02-01', planUnit: 'hour', currencyForBudget: 'eur', currencyForAccounting: 'usd' });
    expect(assistantPatchFor(a, ctx())).toMatchObject({ name: 'Plant 7', start: '2026-12-01', projectStartDate: '2026-12-01', projectFinishDate: '2027-02-01', planDay: true, planHour: true, currencyForBudget: 'EUR', currencyForAccounting: 'USD', currencyForContract: 'EUR' });
  });
  it('the review shows the project currencies and the consolidation currency of the organization', () => {
    const lines = reviewLines(v({ name: 'A', currencyForBudget: 'EUR', currencyForAccounting: 'USD', currencyForContract: 'GBP' }), ctx());
    expect(lines.find((l) => l.label.startsWith('Currencies'))?.value).toBe('EUR / USD / GBP');
    expect(lines.find((l) => l.label.startsWith('Consolidation'))?.value).toBe('USD');
    expect(lines.find((l) => l.label === 'Resources')).toBeUndefined();
  });
  it('a run with the defaults only is not worth keeping', () => {
    expect(hasMeaningfulInput(defaultAssistantValues(TODAY), TODAY)).toBe(false);
    expect(hasMeaningfulInput(v({ name: 'A' }), TODAY)).toBe(true);
    expect(hasMeaningfulInput(v({ projectRevenueBudgetNeeded: true }), TODAY)).toBe(true);
  });
});
