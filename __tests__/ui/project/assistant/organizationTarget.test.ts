// The project assistant for the DEFAULT PROJECT SETTINGS of an organization (target = 'organization', called by the Create Organization Assistant): no name, no dates, no project.
import { ASSISTANT_ORGANIZATION_TARGET, defaultAssistantValues, firstStepWithError, nextStepId, reviewLines, stepNotes, stepVisible, visibleSteps, type AssistantContext } from '../../../../kit8/ui/project/assistant/model/assistantModel';
import { assistantFlowReducer, initialFlow } from '../../../../kit8/ui/project/assistant/model/assistantFlow';

const TODAY = '2026-11-20';
const orgCtx: AssistantContext = { target: ASSISTANT_ORGANIZATION_TARGET, projectCount: 0, existingNames: [], consolidationCurrency: 'USD', today: TODAY };
const newCtx: AssistantContext = { ...orgCtx, target: 'new' };
const v = () => ({ ...defaultAssistantValues(TODAY), currencyForBudget: 'USD', currencyForAccounting: 'EUR' });

describe('the steps of the organization defaults', () => {
  it('the name and the schedule are NOT asked; every other step is', () => {
    expect(ASSISTANT_ORGANIZATION_TARGET).toBe('organization');
    expect(visibleSteps(v(), orgCtx)).toEqual(['planning', 'currencies', 'budgets', 'control', 'review']);
    expect(stepVisible('identity', v(), orgCtx)).toBe(false);
    expect(stepVisible('schedule', v(), orgCtx)).toBe(false);
  });
  it('a new project still asks them (nothing changed for the other targets)', () => {
    expect(visibleSteps(v(), newCtx)).toEqual(['identity', 'schedule', 'planning', 'currencies', 'budgets', 'control', 'review']);
    expect(visibleSteps(v(), { ...newCtx, target: 'some-project-guid' })[0]).toBe('identity');
  });
  it('an empty name does not block: the steps that ask for it are not visited', () => {
    expect(v().name).toBe('');
    expect(firstStepWithError(v(), orgCtx)).toBeNull();
    expect(firstStepWithError(v(), newCtx)).toBe('identity');
  });
  it('the currencies step does not warn that "a saved project is recalculated" (no project is changed)', () => {
    expect(stepNotes('currencies', v(), orgCtx).some((n) => n.level === 'warning')).toBe(false);
    expect(stepNotes('currencies', v(), { ...newCtx, target: 'some-project-guid' }).some((n) => n.level === 'warning')).toBe(true);
  });
  it('the hour model still adds its step, the cost budget its resource steps', () => {
    const hour = { ...v(), resourceOptimizationMode: 'hourByHourModel' as const };
    expect(visibleSteps(hour, orgCtx)).toContain('timeOfDay');
    expect(nextStepId('planning', hour, orgCtx)).toBe('timeOfDay');
  });
});

describe('the review of the organization defaults', () => {
  it('has no line for the name or the dates', () => {
    const lines = reviewLines(v(), orgCtx);
    expect(lines.map((l) => l.label)).not.toEqual(expect.arrayContaining(['Name']));
    expect(lines.some((l) => l.id === 'identity' || l.id === 'schedule')).toBe(false);
    expect(lines.find((l) => l.label.startsWith('Currencies'))?.value).toBe('USD / EUR / USD');
    // a new project keeps them
    expect(reviewLines(v(), newCtx).some((l) => l.id === 'identity')).toBe(true);
  });
});

describe('the flow of the organization defaults', () => {
  it('starts at the planning model (the first step that is asked) and Back from it is the first question', () => {
    const reducer = assistantFlowReducer(orgCtx);
    const s0 = initialFlow(v(), 'steps', 'planning');
    expect(s0.stepId).toBe('planning');
    expect(s0.reached).toEqual(['planning']);
    const started = reducer(initialFlow(v(), 'start'), { type: 'start', values: v() });
    expect(started).toMatchObject({ phase: 'steps', stepId: 'planning', reached: ['planning'] });
    const next = reducer(started, { type: 'next' });
    expect(next.stepId).toBe('currencies');
    expect(reducer(next, { type: 'back' }).stepId).toBe('planning');
    expect(reducer(started, { type: 'back' }).stepId).toBe('planning');
  });
  it('a new project starts at the name as before', () => {
    const reducer = assistantFlowReducer(newCtx);
    expect(reducer(initialFlow(v(), 'start'), { type: 'start', values: v() })).toMatchObject({ stepId: 'identity', reached: ['identity'] });
    expect(initialFlow(v(), 'steps').stepId).toBe('identity');
  });
});
