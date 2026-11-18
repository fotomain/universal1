// The flow (reducer) and the saved run of the Create New Project Assistant (pure).
import { assistantFlowReducer, canGoNext, canJumpTo, initialFlow } from '../../../../kit8/ui/project/assistant/model/assistantFlow';
import { defaultAssistantValues, type AssistantContext } from '../../../../kit8/ui/project/assistant/model/assistantModel';
import { assistantStorageKey, clearSavedRun, loadSavedRun, parseSavedRun, saveRun, type AssistantStorage } from '../../../../kit8/ui/project/assistant/model/assistantStorage';

const TODAY = '2026-11-17';
const ctx: AssistantContext = { target: 'new', projectCount: 2, existingNames: [], consolidationCurrency: 'USD', today: TODAY };
const reduce = assistantFlowReducer(ctx);
const start = () => reduce(initialFlow(defaultAssistantValues(TODAY), 'steps'), { type: 'change', patch: { name: 'Plant 7 - shutdown' } });

describe('flow', () => {
  it('Next is blocked by an error and opens the following step otherwise', () => {
    const empty = initialFlow(defaultAssistantValues(TODAY), 'steps');
    expect(canGoNext(empty, ctx)).toBe(false);
    expect(reduce(empty, { type: 'next' }).stepId).toBe('identity');
    const s = reduce(start(), { type: 'next' });
    expect(s.stepId).toBe('schedule');
    expect(s.reached).toEqual(['identity', 'schedule']);
  });
  it('the user can go back and jump to a step already seen, never ahead', () => {
    let s = reduce(start(), { type: 'next' });
    s = reduce(s, { type: 'next' });
    expect(s.stepId).toBe('currencies');
    expect(canJumpTo(s, 'identity', ctx)).toBe(true);
    expect(canJumpTo(s, 'control', ctx)).toBe(false);
    expect(reduce(s, { type: 'goto', stepId: 'control' }).stepId).toBe('currencies');
    expect(reduce(s, { type: 'goto', stepId: 'identity' }).stepId).toBe('identity');
    expect(reduce(s, { type: 'back' }).stepId).toBe('schedule');
    // the answers of the steps ahead are kept when the user went back
    const back = reduce(s, { type: 'goto', stepId: 'identity' });
    expect(back.values.name).toBe('Plant 7 - shutdown');
    expect(back.reached).toEqual(['identity', 'schedule', 'currencies']);
  });
  it('an answer that hides the current step moves the user to a visible one', () => {
    let s = start();
    s = { ...s, values: { ...s.values, projectExpenseBudgetNeeded: true }, stepId: 'resources', reached: ['identity', 'resources'] };
    const out = reduce(s, { type: 'change', patch: { projectExpenseBudgetNeeded: false } });
    expect(out.stepId).not.toBe('resources');
    expect(out.reached).not.toContain('resources');
  });
  it('restore puts the user where he stopped', () => {
    const vals = { ...defaultAssistantValues(TODAY), name: 'Plant 7 - shutdown' };
    const s = reduce(initialFlow(defaultAssistantValues(TODAY), 'start'), { type: 'restore', values: vals, stepId: 'budgets', reached: ['identity', 'schedule', 'currencies', 'budgets'] });
    expect(s).toMatchObject({ phase: 'steps', stepId: 'budgets' });
    expect(s.values.name).toBe('Plant 7 - shutdown');
  });
});

function fakeStorage(): AssistantStorage & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return { data, getItem: async (k) => (k in data ? data[k] : null), setItem: async (k, v) => { data[k] = v; }, removeItem: async (k) => { delete data[k]; } };
}

describe('saved run', () => {
  const key = assistantStorageKey('user-1', 'new');
  it('saves, loads and clears the last input', async () => {
    const st = fakeStorage();
    expect(await saveRun(key, { target: 'new', values: { ...defaultAssistantValues(TODAY), name: 'Plant 7' }, stepId: 'budgets', reached: ['identity', 'budgets'] }, st, new Date('2026-11-17T10:00:00Z'))).toBe(true);
    const r = await loadSavedRun(key, st, TODAY);
    expect(r).toMatchObject({ stepId: 'budgets', reached: ['identity', 'budgets'], savedAt: '2026-11-17T10:00:00.000Z' });
    expect(r?.values.name).toBe('Plant 7');
    await clearSavedRun(key, st);
    expect(await loadSavedRun(key, st, TODAY)).toBeNull();
  });
  it('one entry per user and target', () => {
    expect(assistantStorageKey('a', 'new')).not.toBe(assistantStorageKey('b', 'new'));
    expect(assistantStorageKey('a', 'new')).not.toBe(assistantStorageKey('a', 'guid-1'));
  });
  it('a damaged or foreign text is no run; wrong values fall back to defaults', () => {
    expect(parseSavedRun('{not json')).toBeNull();
    expect(parseSavedRun(JSON.stringify({ version: 99 }))).toBeNull();
    const r = parseSavedRun(JSON.stringify({ version: 1, target: 'new', values: { name: 7, projectStartDate: 'x', projectRevenueBudgetNeeded: 'yes' }, stepId: 'nope', reached: ['nope'] }), TODAY);
    expect(r?.stepId).toBe('identity');
    expect(r?.values).toMatchObject({ name: '', projectStartDate: TODAY, projectRevenueBudgetNeeded: false });
  });
  it('a storage that fails never breaks the assistant', async () => {
    const bad: AssistantStorage = { getItem: async () => { throw new Error('x'); }, setItem: async () => { throw new Error('x'); }, removeItem: async () => { throw new Error('x'); } };
    expect(await saveRun(key, { target: 'new', values: defaultAssistantValues(TODAY), stepId: 'identity', reached: ['identity'] }, bad)).toBe(false);
    expect(await loadSavedRun(key, bad)).toBeNull();
    await expect(clearSavedRun(key, bad)).resolves.toBeUndefined();
    expect(await saveRun(key, { target: 'new', values: defaultAssistantValues(TODAY), stepId: 'identity', reached: ['identity'] }, null)).toBe(false);
  });
});
