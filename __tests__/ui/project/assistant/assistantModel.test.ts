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
  it('asks identity -> schedule -> planning -> (time of day) -> currencies -> budgets -> (resources, optimization) -> control -> review', () => {
    expect(visibleSteps(v())).toEqual(['identity', 'schedule', 'planning', 'currencies', 'budgets', 'control', 'review']);
    expect(visibleSteps(v({ projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true }))).toEqual(['identity', 'schedule', 'planning', 'currencies', 'budgets', 'resources', 'optimization', 'control', 'review']);
    expect(visibleSteps(v({ resourceOptimizationMode: 'hourByHourModel' }))).toEqual(['identity', 'schedule', 'planning', 'timeOfDay', 'currencies', 'budgets', 'control', 'review']);
    // a cost budget without time costs has nothing to book
    expect(visibleSteps(v({ projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: false }))).not.toContain('resources');
  });
  it('walks forward and back over the visible steps', () => {
    const a = v();
    expect(nextStepId('identity', a)).toBe('schedule');
    expect(nextStepId('schedule', a)).toBe('planning');
    expect(nextStepId('planning', a)).toBe('currencies');
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

describe('the planning model, the time of day and the resource optimization (Project settings -> Resources)', () => {
  const hour = (over: Record<string, any> = {}) => v({ resourceOptimizationMode: 'hourByHourModel', ...over });

  it('the defaults are those of the settings tab: day by day, 15 min, UTC, 08:00-16:00, optimization off', () => {
    expect(defaultAssistantValues(TODAY)).toMatchObject({ resourceOptimizationMode: 'dayByDayModel', resourceGrainUnit: 'hour', resourceSlotMinutes: 15, projectTimeZone: 'UTC', workWindowsText: '08:00-16:00', resourceLevelingFunctionalityEnabled: false, resourceLevelingMode: 'manual', resourceLevelingWithinSlackOnly: false, resourceLevelingOrder: 'standard', resourceLevelingComputationSide: 'resourceLevelingClientSideComputations', resourceLevelingPostedTasksAction: 'ask' });
  });

  it('a project row gives its stored model, step, zone and windows', () => {
    const a = assistantValuesFrom({ resourceOptimizationMode: 'hourByHourModel', resourceSlotMinutes: 5, projectTimeZone: 'Europe/Berlin', projectWorkWindows: [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }], resourceLevelingFunctionalityEnabled: true, resourceLevelingMode: 'automatic', resourceLevelingWithinSlackOnly: true }, TODAY);
    expect(a).toMatchObject({ resourceOptimizationMode: 'hourByHourModel', resourceSlotMinutes: 5, projectTimeZone: 'Europe/Berlin', workWindowsText: '09:00-13:00, 14:00-18:00', resourceLevelingFunctionalityEnabled: true, resourceLevelingMode: 'automatic', resourceLevelingWithinSlackOnly: true });
    // a draft of the assistant keeps the text the user typed
    expect(assistantValuesFrom({ workWindowsText: '10:00-12:00' }, TODAY).workWindowsText).toBe('10:00-12:00');
  });

  it('planning: advises, warns about a long project by the hour, no error', () => {
    expect(stepNotes('planning', v(), ctx())).toEqual([expect.objectContaining({ level: 'info' })]);
    const long = stepNotes('planning', hour({ projectFinishDate: '2027-06-01' }), ctx());
    expect(long.some((n) => n.level === 'warning' && /heavy plan/.test(n.text))).toBe(true);
    expect(hasError(long)).toBe(false);
    expect(stepNotes('planning', hour(), ctx()).some((n) => /hour model changes little/.test(n.text))).toBe(true);
  });

  it('time of day: a bad zone or bad windows block Next; the working time is told', () => {
    expect(hasError(stepNotes('timeOfDay', hour(), ctx()))).toBe(false);
    expect(hasError(stepNotes('timeOfDay', hour({ projectTimeZone: 'Mars/Base' }), ctx()))).toBe(true);
    expect(hasError(stepNotes('timeOfDay', hour({ projectTimeZone: ' ' }), ctx()))).toBe(true);
    expect(hasError(stepNotes('timeOfDay', hour({ workWindowsText: '16:00-08:00' }), ctx()))).toBe(true);
    expect(hasError(stepNotes('timeOfDay', hour({ workWindowsText: '09:00-13:00, 12:00-18:00' }), ctx()))).toBe(true);
    expect(hasError(stepNotes('timeOfDay', hour({ workWindowsText: 'all day' }), ctx()))).toBe(true);
    const lunch = stepNotes('timeOfDay', hour({ workWindowsText: '09:00-13:00, 14:00-18:00' }), ctx());
    expect(lunch.find((n) => n.level === 'info')!.text).toBe('Working time of a day: 8 h in 2 windows.');
    expect(stepNotes('timeOfDay', hour({ workWindowsText: '00:00-24:00' }), ctx()).some((n) => /Round the clock/.test(n.text))).toBe(true);
    expect(stepNotes('timeOfDay', hour({ workWindowsText: '08:00-10:00' }), ctx()).some((n) => n.level === 'warning')).toBe(true);
    expect(stepNotes('timeOfDay', hour({ workWindowsText: '08:00-16:10', resourceSlotMinutes: 15 }), ctx()).some((n) => /whole number of steps/.test(n.text))).toBe(true);
  });

  it('the first step with an error is the time of day (the error is not hidden by another step)', () => {
    const a = hour({ name: 'Plant', currencyForBudget: 'EUR', currencyForAccounting: 'EUR', workWindowsText: 'x' });
    expect(firstStepWithError(a, ctx())).toBe('timeOfDay');
    // the day model does not read the time of day: the same wrong text is no error
    expect(firstStepWithError({ ...a, resourceOptimizationMode: 'dayByDayModel' }, ctx())).toBeNull();
  });

  it('optimization: automatic is a warning, smoothing / leveling are told', () => {
    const base = { projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true, resourceLevelingFunctionalityEnabled: true };
    expect(stepNotes('optimization', v({ ...base, resourceLevelingMode: 'automatic' }), ctx()).some((n) => n.level === 'warning')).toBe(true);
    expect(stepNotes('optimization', v({ ...base, resourceLevelingWithinSlackOnly: true }), ctx()).some((n) => /Smoothing/.test(n.text))).toBe(true);
    expect(stepNotes('optimization', v({ ...base }), ctx()).some((n) => /Leveling/.test(n.text))).toBe(true);
    expect(stepNotes('optimization', v({ ...base, resourceLevelingFunctionalityEnabled: false }), ctx())[0].text).toMatch(/^Off/);
    expect(stepNotes('optimization', v({ ...base, resourceLevelingComputationSide: 'resourceLevelingServerSideComputations' }), ctx()).some((n) => /Fast mode is not available/.test(n.text))).toBe(true);
    expect(stepNotes('optimization', v({ ...base, resourceLevelingPostedTasksAction: 'keep' }), ctx()).some((n) => /Posted tasks/.test(n.text))).toBe(true);
    // the three rules reach the window, a stored project gives them back
    expect(assistantPatchFor(v({ ...base, resourceLevelingOrder: 'idOnly', resourceLevelingComputationSide: 'resourceLevelingServerSideComputations', resourceLevelingPostedTasksAction: 'moveAndPostAgain' }), ctx()))
      .toMatchObject({ resourceLevelingOrder: 'idOnly', resourceLevelingComputationSide: 'resourceLevelingServerSideComputations', resourceLevelingPostedTasksAction: 'moveAndPostAgain' });
    expect(assistantValuesFrom({ resourceLevelingOrder: 'priorityStandard', resourceLevelingPostedTasksAction: 'keep' }, TODAY)).toMatchObject({ resourceLevelingOrder: 'priorityStandard', resourceLevelingPostedTasksAction: 'keep' });
  });

  it('the patch: the day model writes only the mode, the hour model also the zone, step and windows', () => {
    const day = assistantPatchFor(v({ resourceSlotMinutes: 5, projectTimeZone: 'Europe/Berlin' }), ctx());
    expect(day).toMatchObject({ resourceOptimizationMode: 'dayByDayModel', resourceGrainUnit: 'hour', resourceLevelingFunctionalityEnabled: false, planHour: false });
    expect(day).not.toHaveProperty('projectTimeZone');
    expect(day).not.toHaveProperty('resourceSlotMinutes');
    expect(day).not.toHaveProperty('projectWorkWindows');
    const h = assistantPatchFor(hour({ resourceSlotMinutes: 30, projectTimeZone: ' Europe/Berlin ', workWindowsText: '14:00-18:00, 09:00-13:00', resourceLevelingFunctionalityEnabled: true, resourceLevelingMode: 'automatic', resourceLevelingWithinSlackOnly: true }), ctx());
    expect(h).toMatchObject({
      resourceOptimizationMode: 'hourByHourModel', resourceSlotMinutes: 30, projectTimeZone: 'Europe/Berlin',
      projectWorkWindows: [{ from: '09:00', to: '13:00' }, { from: '14:00', to: '18:00' }],
      resourceLevelingFunctionalityEnabled: true, resourceLevelingMode: 'automatic', resourceLevelingWithinSlackOnly: true,
      // the hour model needs hours in the inputs of the plan
      planHour: true,
    });
    // an invalid text never overwrites the stored windows / zone
    const bad = assistantPatchFor(hour({ workWindowsText: 'x', projectTimeZone: 'Mars/Base' }), ctx());
    expect(bad).not.toHaveProperty('projectWorkWindows');
    expect(bad).not.toHaveProperty('projectTimeZone');
  });

  it('the review shows the model, the windows and the optimization', () => {
    const day = reviewLines(v({ projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true }), ctx());
    expect(day.find((l) => l.label === 'Planning model')!.value).toBe('Day by day');
    expect(day.find((l) => l.label === 'Working windows')).toBeUndefined();
    expect(day.find((l) => l.label === 'Resource optimization')!.value).toBe('Off');
    const h = reviewLines(hour({ projectExpenseBudgetNeeded: true, projectTimeCostsNeeded: true, resourceLevelingFunctionalityEnabled: true }), ctx());
    expect(h.find((l) => l.label === 'Planning model')!.value).toBe('Hour by hour');
    expect(h.find((l) => l.label === 'Working windows')).toMatchObject({ id: 'timeOfDay', value: '08:00-16:00' });
    expect(h.find((l) => l.label === 'Resource optimization')!.value).toBe('Manual, leveling, client side');
  });
});
