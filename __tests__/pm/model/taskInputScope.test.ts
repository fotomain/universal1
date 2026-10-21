// The inputs a project offers on the task edit screens (kit8/pm/model/taskInputScope.ts): defaults, the "Time needs a kind" rule, the scope table.
import {
  applyTaskInputPatch, genusInScope, tabVisible, taskInputScopeOf, taskInputSwitchesOf, TASK_INPUT_DEFAULTS, timeKindsOffered,
} from '../../../kit8/pm/model/taskInputScope';

const on = (extra: Record<string, boolean> = {}) => ({ projectExpenseBudgetNeeded: true, ...extra });

describe('taskInputSwitchesOf: a switch that was never saved reads as its default, not as false', () => {
  it('missing keys', () => {
    expect(taskInputSwitchesOf(null)).toEqual(TASK_INPUT_DEFAULTS);
    expect(taskInputSwitchesOf({})).toEqual(TASK_INPUT_DEFAULTS);
    expect(TASK_INPUT_DEFAULTS).toMatchObject({
      projectExpenseBudgetNeeded: false, projectTimeCostsNeeded: true, projectTimeOfPersonNeeded: true,
      projectTimeOfEquipmentNeeded: false, projectTimeOfPartnerNeeded: false, projectMaterialCostsNeeded: true, projectExpenseCostsNeeded: true,
    });
  });
  it('saved values win; a value that is not a boolean is ignored', () => {
    const s = taskInputSwitchesOf({ projectTimeCostsNeeded: false, projectMaterialCostsNeeded: 'no' as any, projectTimeOfEquipmentNeeded: true });
    expect(s.projectTimeCostsNeeded).toBe(false);
    expect(s.projectMaterialCostsNeeded).toBe(true);
    expect(s.projectTimeOfEquipmentNeeded).toBe(true);
  });
});

describe('taskInputScopeOf', () => {
  it('master off = legacy: person Time lines, Material, Expenses, Revenues - whatever the other switches say', () => {
    const legacy = { time: { person: true, equipment: false, partner: false }, material: true, expense: true, revenue: true, configured: false, workCenters: false };
    expect(taskInputScopeOf(undefined)).toEqual(legacy);
    expect(taskInputScopeOf({ projectExpenseBudgetNeeded: false, projectTimeCostsNeeded: false, projectTimeOfEquipmentNeeded: true, projectMaterialCostsNeeded: false })).toEqual(legacy);
  });
  it('master on, defaults = the same as before (nothing is lost by switching it on)', () => {
    expect(taskInputScopeOf(on())).toEqual({ time: { person: true, equipment: false, partner: false }, material: true, expense: true, revenue: true, configured: true, workCenters: true });
  });
  it('person only / equipment only / both', () => {
    expect(taskInputScopeOf(on({ projectTimeOfEquipmentNeeded: true })).time).toEqual({ person: true, equipment: true, partner: false });
    expect(taskInputScopeOf(on({ projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true })).time).toEqual({ person: false, equipment: true, partner: false });
    expect(taskInputScopeOf(on({ projectTimeOfEquipmentNeeded: false })).time).toEqual({ person: true, equipment: false, partner: false });
  });
  it('Time off hides both kinds (their values are kept); Material / Expense follow their switch', () => {
    const s = taskInputScopeOf(on({ projectTimeCostsNeeded: false, projectTimeOfEquipmentNeeded: true, projectMaterialCostsNeeded: false }));
    expect(s.time).toEqual({ person: false, equipment: false, partner: false });
    expect(s.material).toBe(false);
    expect(s.expense).toBe(true);
    expect(s.revenue).toBe(true);
  });
});

describe('the three kinds of work center (person, equipment, partner)', () => {
  it('Time on = the Time lines book WORK CENTERS: the kinds switched on are offered; Time off = none', () => {
    expect(taskInputScopeOf(on({ projectTimeOfPartnerNeeded: true })).time).toEqual({ person: true, equipment: false, partner: true });
    expect(taskInputScopeOf(on({ projectTimeOfPersonNeeded: false, projectTimeOfPartnerNeeded: true })).time).toEqual({ person: false, equipment: false, partner: true });
    expect(taskInputScopeOf(on({ projectTimeCostsNeeded: false, projectTimeOfPartnerNeeded: true })).time).toEqual({ person: false, equipment: false, partner: false });
    expect(taskInputScopeOf(on()).workCenters).toBe(true);
  });
  it('a project made before (master off) books a person of the catalog: no work centers, and the Partner switch is ignored', () => {
    const legacy = taskInputScopeOf({ projectTimeOfPartnerNeeded: true });
    expect(legacy.workCenters).toBe(false);
    expect(legacy.time).toEqual({ person: true, equipment: false, partner: false });
  });
  it('Partner alone is a kind: the Time tab and the cost budget stay on', () => {
    const only = taskInputScopeOf(on({ projectTimeOfPersonNeeded: false, projectTimeOfPartnerNeeded: true }));
    expect(genusInScope(only, 'timeGenus')).toBe(true);
    expect(timeKindsOffered(only, [])).toEqual(['partner']);
  });
  it('the menu "Resource" lists person, equipment, partner in this order; a kind that has lines is still offered', () => {
    const all = taskInputScopeOf(on({ projectTimeOfEquipmentNeeded: true, projectTimeOfPartnerNeeded: true }));
    expect(timeKindsOffered(all, [])).toEqual(['person', 'equipment', 'partner']);
    expect(timeKindsOffered(taskInputScopeOf(on()), ['partner'])).toEqual(['person', 'partner']);
  });
  it('Time off and no lines: the Time tab is not shown; Time lines keep it visible (a switch never hides data)', () => {
    const off = taskInputScopeOf(on({ projectTimeCostsNeeded: false }));
    expect(tabVisible(off, 'timeGenus', 0)).toBe(false);
    expect(tabVisible(off, 'timeGenus', 2)).toBe(true);
  });
  it('Time needs a kind: the partner counts as one', () => {
    const base = taskInputSwitchesOf(on({ projectTimeOfPartnerNeeded: true }));
    expect(applyTaskInputPatch(base, { projectTimeOfPersonNeeded: false })).toMatchObject({ projectTimeCostsNeeded: true, projectTimeOfPartnerNeeded: true });
    const none = applyTaskInputPatch(applyTaskInputPatch(base, { projectTimeOfPersonNeeded: false }), { projectTimeOfPartnerNeeded: false });
    expect(none.projectTimeCostsNeeded).toBe(false);
  });
});

describe('tabs: a switch never hides data', () => {
  const scope = taskInputScopeOf(on({ projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false }));
  it('genusInScope', () => {
    expect(genusInScope(scope, 'timeGenus')).toBe(false);
    expect(genusInScope(scope, 'materialGenus')).toBe(false);
    expect(genusInScope(scope, 'expenseGenus')).toBe(true);
    expect(genusInScope(scope, 'revenueGenus')).toBe(true);
  });
  it('an empty tab out of scope is hidden, a tab with lines stays', () => {
    expect(tabVisible(scope, 'timeGenus', 0)).toBe(false);
    expect(tabVisible(scope, 'timeGenus', 3)).toBe(true);
    expect(tabVisible(scope, 'expenseGenus', 0)).toBe(true);
  });
});

describe('timeKindsOffered: the menu "Resource: Person | Equipment" exists only with two kinds', () => {
  it('follows the scope', () => {
    expect(timeKindsOffered(taskInputScopeOf(undefined), [])).toEqual(['person']);
    expect(timeKindsOffered(taskInputScopeOf(on({ projectTimeOfEquipmentNeeded: true })), [])).toEqual(['person', 'equipment']);
    expect(timeKindsOffered(taskInputScopeOf(on({ projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true })), [])).toEqual(['equipment']);
  });
  it('a kind that already has lines is still offered; a line without a kind is a person', () => {
    const equipmentOnly = taskInputScopeOf(on({ projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true }));
    expect(timeKindsOffered(equipmentOnly, [null, undefined])).toEqual(['person', 'equipment']);
    const personOnly = taskInputScopeOf(on());
    expect(timeKindsOffered(personOnly, ['equipment'])).toEqual(['person', 'equipment']);
  });
  it('never empty', () => {
    expect(timeKindsOffered(taskInputScopeOf(on({ projectTimeCostsNeeded: false })), [])).toEqual(['person']);
  });
});

describe('applyTaskInputPatch: Time needs a kind', () => {
  const base = taskInputSwitchesOf(on());
  it('turning off the last kind turns Time off', () => {
    const next = applyTaskInputPatch(base, { projectTimeOfPersonNeeded: false });
    expect(next.projectTimeCostsNeeded).toBe(false);
    expect(next.projectTimeOfPersonNeeded).toBe(false);
  });
  it('turning off one of two kinds keeps Time', () => {
    const both = applyTaskInputPatch(base, { projectTimeOfEquipmentNeeded: true });
    const next = applyTaskInputPatch(both, { projectTimeOfPersonNeeded: false });
    expect(next).toMatchObject({ projectTimeCostsNeeded: true, projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true });
  });
  it('turning Time on with no kind chosen turns Person on', () => {
    const off = applyTaskInputPatch(base, { projectTimeOfPersonNeeded: false });
    const next = applyTaskInputPatch(off, { projectTimeCostsNeeded: true });
    expect(next).toMatchObject({ projectTimeCostsNeeded: true, projectTimeOfPersonNeeded: true, projectTimeOfEquipmentNeeded: false });
  });
  it('turning Time on keeps the kinds that were chosen', () => {
    const eq = applyTaskInputPatch(applyTaskInputPatch(base, { projectTimeOfEquipmentNeeded: true }), { projectTimeOfPersonNeeded: false });
    const off = applyTaskInputPatch(eq, { projectTimeCostsNeeded: false });
    expect(off).toMatchObject({ projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true });
    expect(applyTaskInputPatch(off, { projectTimeCostsNeeded: true })).toMatchObject({ projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true });
  });
  it('other switches pass through', () => {
    expect(applyTaskInputPatch(base, { projectMaterialCostsNeeded: false }).projectMaterialCostsNeeded).toBe(false);
  });
});
