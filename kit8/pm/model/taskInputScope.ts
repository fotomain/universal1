// Task input scope - WHICH inputs the task edit screens (Finances view, task page) offer for a project (pure, unit-tested).
//   Project settings -> "Budgets" (PMProjectBudgetsTab) saves these keys in project_table.rowJSON:
//     projectExpenseBudgetNeeded        the master switch: the project says which cost inputs it needs
//       projectTimeCostsNeeded          the Time tab ("Time input needed"); off = the tab is not shown (a tab that already has lines stays)
//         projectTimeOfPersonNeeded     a Time line may pick a WORK CENTER of a person   (editable only while Time is on)
//         projectTimeOfEquipmentNeeded  a Time line may pick a WORK CENTER of an equipment
//         projectTimeOfPartnerNeeded    a Time line may pick a WORK CENTER of a partner (a supplier)
//       projectMaterialCostsNeeded      the Material tab
//       projectExpenseCostsNeeded       the Expenses tab
//   MASTER ON = the Time lines book WORK CENTERS (kit8/catalog/work_center): the menu "Resource" lists the kinds switched on (one kind = no menu) and the column "Person / Equipment / Partner" the work
//   centers of that kind. MASTER OFF (every project made before these switches) = the screens work exactly as before: person Time lines (a person of the catalog), Material, Expenses, Revenues.
//   A switch that is not saved yet reads as its default: Time / Person / Material / Expense = on, Equipment / Partner = off.
//   Hidden is not deleted: a switch under a parent that is off keeps its value; a tab that already has lines is never hidden (`tabVisible`), a Time line made before work centers keeps its person / equipment.
import { MANAGEMENT_GENUS } from '../../catalog/management/genus/managementGenusModel';

export interface TaskInputSwitches {
  projectExpenseBudgetNeeded: boolean;
  projectTimeCostsNeeded: boolean;
  projectTimeOfPersonNeeded: boolean;
  projectTimeOfEquipmentNeeded: boolean;
  projectTimeOfPartnerNeeded: boolean;
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
  projectTimeOfPartnerNeeded: false,
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
 * A change of one switch in the settings window -> the whole patch to apply. "Time needs a kind": when the last of Person / Equipment / Partner is turned
 * off, Time itself goes off; when Time is turned on with no kind chosen, Person is turned on. The values of hidden children are kept.
 */
export function applyTaskInputPatch(current: TaskInputSwitches, patch: Partial<TaskInputSwitches>): TaskInputSwitches {
  const next: TaskInputSwitches = { ...current, ...patch };
  const timeTurnedOn = patch.projectTimeCostsNeeded === true && !current.projectTimeCostsNeeded;
  if (next.projectTimeCostsNeeded && !next.projectTimeOfPersonNeeded && !next.projectTimeOfEquipmentNeeded && !next.projectTimeOfPartnerNeeded) {
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
  const time = s.projectTimeCostsNeeded && (s.projectTimeOfPersonNeeded || s.projectTimeOfEquipmentNeeded || s.projectTimeOfPartnerNeeded);
  return time || s.projectMaterialCostsNeeded || s.projectExpenseCostsNeeded;
}

/** which kinds of work center (or, in a legacy project, of resource) a Time line may pick */
export interface TimeInputScope { person: boolean; equipment: boolean; partner: boolean }
export interface TaskInputScope {
  time: TimeInputScope;
  material: boolean;
  expense: boolean;
  revenue: boolean;
  /** the project chose its inputs (master on); false = legacy behaviour */
  configured: boolean;
  /** the Time lines book WORK CENTERS (= configured): the menu is the kinds of work center switched on. false = a person of the catalog, as before work centers */
  workCenters: boolean;
}

/** The inputs a project offers. Master off = legacy: person Time lines, Material, Expenses, Revenues. */
export function taskInputScopeOf(json: Partial<Record<TaskInputSwitchKey, unknown>> | null | undefined): TaskInputScope {
  const s = taskInputSwitchesOf(json);
  if (!s.projectExpenseBudgetNeeded) return { time: { person: true, equipment: false, partner: false }, material: true, expense: true, revenue: true, configured: false, workCenters: false };
  const time = s.projectTimeCostsNeeded;
  return {
    time: { person: time && s.projectTimeOfPersonNeeded, equipment: time && s.projectTimeOfEquipmentNeeded, partner: time && s.projectTimeOfPartnerNeeded },
    material: s.projectMaterialCostsNeeded,
    expense: s.projectExpenseCostsNeeded,
    revenue: true,
    configured: true,
    workCenters: true,
  };
}

/** the scope switch of a genus tab (timeGenus ... revenueGenus) */
export function genusInScope(scope: TaskInputScope, genus: string): boolean {
  switch (genus) {
    case MANAGEMENT_GENUS.time: return scope.time.person || scope.time.equipment || scope.time.partner;
    case MANAGEMENT_GENUS.material: return scope.material;
    case MANAGEMENT_GENUS.expense: return scope.expense;
    default: return true;
  }
}

/** A tab is shown when its genus is in scope OR the task already has lines of it - a switch never hides data. */
export const tabVisible = (scope: TaskInputScope, genus: string, lineCount: number): boolean => lineCount > 0 || genusInScope(scope, genus);

/** the kinds the menu "Resource" offers: a person, an equipment or a partner (with work centers: the kind of the work centers) */
export type TimeResourceKind = 'person' | 'equipment' | 'partner';
/**
 * The kinds the Time table offers: the kinds switched on plus a kind the task already has lines of (legacy / switched off later: a switch never hides data). Pass the MENU kind of every Time line
 * (`lineMenuKind`: a work center line = the kind of its work center, a legacy line its own kind). Two or more kinds = the menu "Resource" is shown; one kind = no menu. Never empty.
 */
export function timeKindsOffered(scope: TaskInputScope, existing: Iterable<TimeResourceKind | null | undefined>): TimeResourceKind[] {
  const have = new Set<TimeResourceKind>();
  for (const k of existing) have.add(k === 'equipment' ? 'equipment' : k === 'partner' ? 'partner' : 'person');
  const out: TimeResourceKind[] = [];
  if (scope.time.person || have.has('person')) out.push('person');
  if (scope.time.equipment || have.has('equipment')) out.push('equipment');
  if (scope.time.partner || have.has('partner')) out.push('partner');
  return out.length ? out : ['person'];
}
