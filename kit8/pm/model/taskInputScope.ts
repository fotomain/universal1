// Task input scope - WHICH inputs the task edit screens (Finances view, task page) offer for a project (pure, unit-tested).
//   Project settings -> "Budgets" (PMProjectBudgetsTab) saves these keys in project_table.rowJSON:
//     projectExpenseBudgetNeeded        the master switch: the project says which cost inputs it needs
//       projectTimeCostsNeeded          the Time tab ("Time input needed")
//         projectTimeOfPersonNeeded     Time lines of a person
//         projectTimeOfEquipmentNeeded  Time lines of an equipment (the menu "Resource: Person | Equipment" appears when both are on)
//         projectTimeOfWorkCenterNeeded Time lines of a work center (kit8/catalog/work_center; a third entry of the menu "Resource")
//       projectMaterialCostsNeeded      the Material tab
//       projectExpenseCostsNeeded       the Expenses tab
//   MASTER OFF (every project made before these switches) = the screens work exactly as before: person Time lines, Material, Expenses, Revenues.
//   A switch that is not saved yet reads as its default: Time / Person / Material / Expense = on, Equipment / Work center = off.
//   Hidden is not deleted: a switch under a parent that is off keeps its value; a tab that already has lines is never hidden (`tabVisible`).
import { MANAGEMENT_GENUS } from '../../catalog/management/genus/managementGenusModel';

export interface TaskInputSwitches {
  projectExpenseBudgetNeeded: boolean;
  projectTimeCostsNeeded: boolean;
  projectTimeOfPersonNeeded: boolean;
  projectTimeOfEquipmentNeeded: boolean;
  projectTimeOfWorkCenterNeeded: boolean;
  projectMaterialCostsNeeded: boolean;
  projectExpenseCostsNeeded: boolean;
}
export type TaskInputSwitchKey = keyof TaskInputSwitches;

/** the value of a switch that was never saved */
export const TASK_INPUT_DEFAULTS: TaskInputSwitches = {
  projectExpenseBudgetNeeded: false,
  projectTimeCostsNeeded: true,
  projectTimeOfPersonNeeded: true,
  projectTimeOfEquipmentNeeded: false,
  projectTimeOfWorkCenterNeeded: false,
  projectMaterialCostsNeeded: true,
  projectExpenseCostsNeeded: true,
};
export const TASK_INPUT_KEYS = Object.keys(TASK_INPUT_DEFAULTS) as TaskInputSwitchKey[];

/** project rowJSON -> the seven switches (a missing key = its default, NOT false) */
export function taskInputSwitchesOf(json: Partial<Record<TaskInputSwitchKey, unknown>> | null | undefined): TaskInputSwitches {
  const out = { ...TASK_INPUT_DEFAULTS };
  for (const k of TASK_INPUT_KEYS) {
    const v = json?.[k];
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/**
 * A change of one switch in the settings window -> the whole patch to apply. "Time needs a kind": when the last of Person / Equipment / Work center is turned
 * off, Time itself goes off; when Time is turned on with no kind chosen, Person is turned on. The values of hidden children are kept.
 */
export function applyTaskInputPatch(current: TaskInputSwitches, patch: Partial<TaskInputSwitches>): TaskInputSwitches {
  const next: TaskInputSwitches = { ...current, ...patch };
  const timeTurnedOn = patch.projectTimeCostsNeeded === true && !current.projectTimeCostsNeeded;
  if (next.projectTimeCostsNeeded && !next.projectTimeOfPersonNeeded && !next.projectTimeOfEquipmentNeeded && !next.projectTimeOfWorkCenterNeeded) {
    if (timeTurnedOn) next.projectTimeOfPersonNeeded = true;
    else next.projectTimeCostsNeeded = false;
  }
  return next;
}

/**
 * Is a cost budget on? (the project cost total, kit8/pm/cost + documentation/UPDATE_PROJECT_COST.html)
 * The master projectExpenseBudgetNeeded AND one of Time (with a kind, person or equipment) / Material / Expense. The same rule as project_cost_budget_on() of start2_sql_code.sql (PART 27);
 * __tests__/pm/cost keeps both equal. The master off = a legacy project (no cost budget chosen) = false.
 */
export function projectCostBudgetOn(json: Partial<Record<TaskInputSwitchKey, unknown>> | null | undefined): boolean {
  const s = taskInputSwitchesOf(json);
  if (!s.projectExpenseBudgetNeeded) return false;
  const time = s.projectTimeCostsNeeded && (s.projectTimeOfPersonNeeded || s.projectTimeOfEquipmentNeeded || s.projectTimeOfWorkCenterNeeded);
  return time || s.projectMaterialCostsNeeded || s.projectExpenseCostsNeeded;
}

/** which resource kinds a Time line may have */
export interface TimeInputScope { person: boolean; equipment: boolean; workCenter: boolean }
export interface TaskInputScope {
  time: TimeInputScope;
  material: boolean;
  expense: boolean;
  revenue: boolean;
  /** the project chose its inputs (master on); false = legacy behaviour */
  configured: boolean;
}

/** The inputs a project offers. Master off = legacy: person Time lines, Material, Expenses, Revenues. */
export function taskInputScopeOf(json: Partial<Record<TaskInputSwitchKey, unknown>> | null | undefined): TaskInputScope {
  const s = taskInputSwitchesOf(json);
  if (!s.projectExpenseBudgetNeeded) return { time: { person: true, equipment: false, workCenter: false }, material: true, expense: true, revenue: true, configured: false };
  const time = s.projectTimeCostsNeeded;
  return {
    time: { person: time && s.projectTimeOfPersonNeeded, equipment: time && s.projectTimeOfEquipmentNeeded, workCenter: time && s.projectTimeOfWorkCenterNeeded },
    material: s.projectMaterialCostsNeeded,
    expense: s.projectExpenseCostsNeeded,
    revenue: true,
    configured: true,
  };
}

/** the scope switch of a genus tab (timeGenus ... revenueGenus) */
export function genusInScope(scope: TaskInputScope, genus: string): boolean {
  switch (genus) {
    case MANAGEMENT_GENUS.time: return scope.time.person || scope.time.equipment || scope.time.workCenter;
    case MANAGEMENT_GENUS.material: return scope.material;
    case MANAGEMENT_GENUS.expense: return scope.expense;
    default: return true;
  }
}

/** A tab is shown when its genus is in scope OR the task already has lines of it - a switch never hides data. */
export const tabVisible = (scope: TaskInputScope, genus: string, lineCount: number): boolean => lineCount > 0 || genusInScope(scope, genus);

export type TimeResourceKind = 'person' | 'equipment' | 'workCenter';
/**
 * The resource kinds the Time table offers: the kinds in scope plus a kind the task already has lines of (legacy / switched off later).
 * Two or three kinds = the menu "Resource: Person | Equipment | Work center" is shown; one kind = no menu.
 */
export function timeKindsOffered(scope: TaskInputScope, existing: Iterable<TimeResourceKind | null | undefined>): TimeResourceKind[] {
  const have = new Set<TimeResourceKind>();
  for (const k of existing) have.add(k === 'equipment' ? 'equipment' : k === 'workCenter' ? 'workCenter' : 'person');
  const out: TimeResourceKind[] = [];
  if (scope.time.person || have.has('person')) out.push('person');
  if (scope.time.equipment || have.has('equipment')) out.push('equipment');
  if (scope.time.workCenter || have.has('workCenter')) out.push('workCenter');
  return out.length ? out : ['person'];
}
