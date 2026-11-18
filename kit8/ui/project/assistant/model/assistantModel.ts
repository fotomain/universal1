// assistantModel - the "expert" of the Create New Project Assistant (pure: no React, no Supabase; unit-tested in __tests__/ui/project/assistant).
//
// The questions are asked in the order a project manager decides things (PMBOK / PRINCE2 habit): WHAT (identity) -> WHEN (schedule) -> IN WHAT MONEY (currencies)
// -> HOW MUCH and what kind of money (budgets) -> WITH WHOM (resources) -> HOW IT IS CONTROLLED (control) -> REVIEW. A step is shown only while it still matters
// (no cost budget = no resources step). Every step has an expert tip (why the question matters), blocking ERRORS and non blocking WARNINGS.
//
// The values are the answers; `assistantPatchFor()` turns them into the keys of the "New project" window (PMRecentProjectsToolbar Draft), which then does the real
// save (business units, validation, permissions): the assistant never writes a project row itself.
import { TASK_INPUT_DEFAULTS } from '../../../../pm/model/taskInputScope';
import { hourModelOf, parseWindowsText, timeZoneIsValid, windowsToJson, windowsToText } from '../../../../pm/hourmodel/hourModelSettings';
import { slotMinutesOf } from '../../../../pm/hourmodel/minutes';
import { resourceLevelingValuesOf, type ResourceGrainUnit, type ResourceLevelingMode, type ResourceOptimizationMode } from '../../../../pm/resourceleveling/resourceLevelingSettings';

export type AssistantStepId = 'identity' | 'schedule' | 'planning' | 'timeOfDay' | 'currencies' | 'budgets' | 'resources' | 'optimization' | 'control' | 'review';
export type AssistantPlanUnit = 'day' | 'hour';

export interface AssistantValues {
  name: string;
  /** YYYY-MM-DD */
  projectStartDate: string;
  /** YYYY-MM-DD, '' = open end */
  projectFinishDate: string;
  planUnit: AssistantPlanUnit;
  skipWeekends: boolean;
  /** Project settings -> Resources: 'dayByDayModel' (the plan counts days) | 'hourByHourModel' (planned to the minute, the calendar has working windows) */
  resourceOptimizationMode: ResourceOptimizationMode;
  /** the unit of the resource load */
  resourceGrainUnit: ResourceGrainUnit;
  /** hour model only: the step of a start time and of a leveling move, minutes (1 5 10 15 30 60) */
  resourceSlotMinutes: number;
  /** hour model only: IANA zone the windows are wall clock of */
  projectTimeZone: string;
  /** hour model only: '09:00-13:00, 14:00-18:00' (the text the user types; a break = the gap between two windows) */
  workWindowsText: string;
  /** Resource optimization (levelling / smoothing) */
  resourceLevelingFunctionalityEnabled: boolean;
  resourceLevelingMode: ResourceLevelingMode;
  /** true = Smoothing (only the slack is used), false = Leveling */
  resourceLevelingWithinSlackOnly: boolean;
  /** ISO 4217, '' = not chosen. EACH PROJECT OWNS its currencies (the organization's are only the start values of a new project) */
  currencyForBudget: string;
  currencyForAccounting: string;
  currencyForContract: string;
  projectRevenueBudgetNeeded: boolean;
  projectExpenseBudgetNeeded: boolean;
  projectTimeCostsNeeded: boolean;
  projectMaterialCostsNeeded: boolean;
  projectExpenseCostsNeeded: boolean;
  projectTimeOfPersonNeeded: boolean;
  projectTimeOfEquipmentNeeded: boolean;
  projectTimeOfPartnerNeeded: boolean;
  roiForTasksFunctionalityEnabled: boolean;
  customerInvoiceFunctionalityEnabled: boolean;
  subprojectsFunctionalityEnabled: boolean;
  chatFunctionalityEnabled: boolean;
}

export interface AssistantContext {
  /** the project this run works on: 'new' or a project GUID */
  target: string;
  /** number of projects of the user's organization; null = not known yet */
  projectCount: number | null;
  /** names of the projects of the organization (a duplicate name is a warning) */
  existingNames: string[];
  /** currencyForConsolidation of the organization (read only here: the money of ALL projects is added in it; '' = not read yet) */
  consolidationCurrency: string;
  /** today, YYYY-MM-DD */
  today: string;
}

export interface AssistantNote {
  level: 'error' | 'warning' | 'info';
  text: string;
}

export interface AssistantStepDef {
  id: AssistantStepId;
  /** English; the screen translates it (pmT) */
  title: string;
  /** English; why a project manager asks it now */
  tip: string;
}

export const ASSISTANT_STEPS: AssistantStepDef[] = [
  {
    id: 'identity',
    title: 'Name',
    tip: 'A clear name is the first control of a project: who it is for and what it delivers, e.g. "Warehouse Riga - new line - 2027". People find and report the project by this name.',
  },
  {
    id: 'schedule',
    title: 'Schedule',
    tip: 'Fix the start first: every task date, resource booking and payment date hangs on it. The finish is the target the plan is checked against; leave it open if the plan will decide it.',
  },
  {
    id: 'planning',
    title: 'Planning model',
    tip: 'Decide how fine the plan is. Day by day counts working days (right for most projects). Hour by hour plans to the minute with the working windows of a day: use it for shift work, machines, production and anything that is booked by the clock. It makes the plan heavier, so choose it only when hours really matter.',
  },
  {
    id: 'timeOfDay',
    title: 'Time of day',
    tip: 'The clock of the hour by hour plan: the working windows of a day (a break is the gap between two windows), the smallest step of a start time and of a leveling move, and the time zone the windows are read in. Resources can have calendars of their own on top of these windows.',
  },
  {
    id: 'currencies',
    title: 'Currencies',
    tip: 'Budget currency = the one management reads the project in; accounting currency = the legal books; contract currency = the default of new contracts. Each project has its own currencies (a new project starts from the ones of the organization); the money of all projects is added in the consolidation currency of the organization, shown read only.',
  },
  {
    id: 'budgets',
    title: 'Budgets',
    tip: 'Decide what the project controls in money: the revenue it earns and the costs it spends (time, material, expenses). Revenue AND cost together give the ROI; a project with neither has only a schedule.',
  },
  {
    id: 'resources',
    title: 'Resources',
    tip: 'Say who can be booked on time lines: people, equipment, or partners (suppliers). Each kind uses its own calendar and capacity check, so switch on only what the project really books.',
  },
  {
    id: 'optimization',
    title: 'Resource optimization',
    tip: 'A resource booked for more hours than its calendar allows is over-allocated. Leveling delays tasks until nobody is overloaded (the finish may move); smoothing uses only the slack (the finish stays). Start with Manual: you see a preview before anything moves.',
  },
  {
    id: 'control',
    title: 'Control',
    tip: 'Choose how the project is followed: ROI per task, customer invoices from the revenue lines, subprojects for big work packages, and a chat per task. Fewer switches = a simpler project; you can add more later.',
  },
  {
    id: 'review',
    title: 'Review',
    tip: 'Check the answers once. Create the project now, or open the project window to fine tune anything the assistant did not ask (business units, calendar, vendors ...).',
  },
];

export const ASSISTANT_STEP_IDS: AssistantStepId[] = ASSISTANT_STEPS.map((s) => s.id);
export const assistantStepDef = (id: AssistantStepId): AssistantStepDef => ASSISTANT_STEPS.find((s) => s.id === id) as AssistantStepDef;

// ---------------------------------------------------------------------------------------------------------------- dates

export const isISODate = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const dayNumber = (s: string): number => Math.floor(new Date(`${s}T00:00:00Z`).getTime() / 86_400_000);
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

export function addDaysISO(s: string, days: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** the same day of the month n months later (the 31st becomes the last day of a short month) */
export function addMonthsISO(s: string, months: number): string {
  const d = new Date(`${s}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------------------------------------------- values

const CURRENCY_RE = /^[A-Z]{3}$/;
export const normalizeCurrency = (v: unknown): string => (typeof v === 'string' ? v.trim().toUpperCase() : '');
export const isCurrencyCode = (v: unknown): boolean => CURRENCY_RE.test(normalizeCurrency(v));

/** the answers of a run that has been asked nothing yet */
export function defaultAssistantValues(today: string = todayISO()): AssistantValues {
  return {
    name: '',
    projectStartDate: today,
    projectFinishDate: '',
    planUnit: 'day',
    skipWeekends: false,
    resourceOptimizationMode: 'dayByDayModel',
    resourceGrainUnit: 'hour',
    resourceSlotMinutes: 15,
    projectTimeZone: 'UTC',
    workWindowsText: windowsToText(hourModelOf(null).windows),
    resourceLevelingFunctionalityEnabled: false,
    resourceLevelingMode: 'manual',
    resourceLevelingWithinSlackOnly: false,
    currencyForBudget: '',
    currencyForAccounting: '',
    currencyForContract: '',
    projectRevenueBudgetNeeded: false,
    projectExpenseBudgetNeeded: false,
    projectTimeCostsNeeded: TASK_INPUT_DEFAULTS.projectTimeCostsNeeded,
    projectMaterialCostsNeeded: TASK_INPUT_DEFAULTS.projectMaterialCostsNeeded,
    projectExpenseCostsNeeded: TASK_INPUT_DEFAULTS.projectExpenseCostsNeeded,
    projectTimeOfPersonNeeded: TASK_INPUT_DEFAULTS.projectTimeOfPersonNeeded,
    projectTimeOfEquipmentNeeded: TASK_INPUT_DEFAULTS.projectTimeOfEquipmentNeeded,
    projectTimeOfPartnerNeeded: TASK_INPUT_DEFAULTS.projectTimeOfPartnerNeeded,
    roiForTasksFunctionalityEnabled: false,
    customerInvoiceFunctionalityEnabled: true,
    subprojectsFunctionalityEnabled: false,
    chatFunctionalityEnabled: true,
  };
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/**
 * A project row's rowJSON, a Project settings draft or the organization's defaultProjectSettings -> the answers (a missing key = the default of the setting).
 * `name` and the dates come from the source too when it has them (a draft / a project); the defaults of a NEW project are the organization's settings.
 */
export function assistantValuesFrom(source: Record<string, any> | null | undefined, today: string = todayISO()): AssistantValues {
  const d = defaultAssistantValues(today);
  const j = source || {};
  const start = str(j.projectStartDate) || str(j.start);
  const rl = resourceLevelingValuesOf(j);
  const hm = hourModelOf(j);
  return {
    name: str(j.name),
    projectStartDate: isISODate(start) ? start : d.projectStartDate,
    projectFinishDate: isISODate(j.projectFinishDate) ? j.projectFinishDate : '',
    planUnit: j.planHour === true ? 'hour' : 'day',
    skipWeekends: bool(j.skipWeekends, d.skipWeekends),
    resourceOptimizationMode: rl.resourceOptimizationMode,
    resourceGrainUnit: rl.resourceGrainUnit,
    resourceSlotMinutes: hm.slotMinutes,
    projectTimeZone: hm.timeZone,
    // a draft of the assistant already has the text; a project row has the stored windows
    workWindowsText: typeof j.workWindowsText === 'string' && j.workWindowsText.trim() ? j.workWindowsText : windowsToText(hm.windows),
    resourceLevelingFunctionalityEnabled: rl.resourceLevelingFunctionalityEnabled,
    resourceLevelingMode: rl.resourceLevelingMode,
    resourceLevelingWithinSlackOnly: rl.resourceLevelingWithinSlackOnly,
    currencyForBudget: normalizeCurrency(j.currencyForBudget),
    currencyForAccounting: normalizeCurrency(j.currencyForAccounting),
    currencyForContract: normalizeCurrency(j.currencyForContract),
    projectRevenueBudgetNeeded: bool(j.projectRevenueBudgetNeeded, d.projectRevenueBudgetNeeded),
    projectExpenseBudgetNeeded: bool(j.projectExpenseBudgetNeeded, d.projectExpenseBudgetNeeded),
    projectTimeCostsNeeded: bool(j.projectTimeCostsNeeded, d.projectTimeCostsNeeded),
    projectMaterialCostsNeeded: bool(j.projectMaterialCostsNeeded, d.projectMaterialCostsNeeded),
    projectExpenseCostsNeeded: bool(j.projectExpenseCostsNeeded, d.projectExpenseCostsNeeded),
    projectTimeOfPersonNeeded: bool(j.projectTimeOfPersonNeeded, d.projectTimeOfPersonNeeded),
    projectTimeOfEquipmentNeeded: bool(j.projectTimeOfEquipmentNeeded, d.projectTimeOfEquipmentNeeded),
    projectTimeOfPartnerNeeded: bool(j.projectTimeOfPartnerNeeded, d.projectTimeOfPartnerNeeded),
    roiForTasksFunctionalityEnabled: bool(j.roiForTasksFunctionalityEnabled, d.roiForTasksFunctionalityEnabled),
    customerInvoiceFunctionalityEnabled: bool(j.customerInvoiceFunctionalityEnabled, d.customerInvoiceFunctionalityEnabled),
    subprojectsFunctionalityEnabled: bool(j.subprojectsFunctionalityEnabled, d.subprojectsFunctionalityEnabled),
    chatFunctionalityEnabled: bool(j.chatFunctionalityEnabled, d.chatFunctionalityEnabled),
  };
}

/** a saved / foreign object -> valid values (an unknown or wrongly typed key falls back to the default) */
export const sanitizeAssistantValues = (raw: unknown, today: string = todayISO()): AssistantValues =>
  assistantValuesFrom(raw && typeof raw === 'object' ? (raw as Record<string, any>) : null, today);

// ---------------------------------------------------------------------------------------------------------------- the rules


/** the money inputs the project asks (the master switch of the cost inputs is `projectExpenseBudgetNeeded`) */
export const costBudgetOn = (v: AssistantValues): boolean => v.projectExpenseBudgetNeeded;
export const timeInputOn = (v: AssistantValues): boolean => v.projectExpenseBudgetNeeded && v.projectTimeCostsNeeded;
export const hourModelOn = (v: AssistantValues): boolean => v.resourceOptimizationMode === 'hourByHourModel';

/** is the step asked at all with these answers? */
export function stepVisible(id: AssistantStepId, v: AssistantValues, _ctx?: AssistantContext): boolean {
  if (id === 'resources' || id === 'optimization') return timeInputOn(v);
  if (id === 'timeOfDay') return hourModelOn(v);
  return true;
}

export const visibleSteps = (v: AssistantValues, ctx?: AssistantContext): AssistantStepId[] => ASSISTANT_STEP_IDS.filter((id) => stepVisible(id, v, ctx));

export function nextStepId(current: AssistantStepId, v: AssistantValues, ctx?: AssistantContext): AssistantStepId | null {
  const list = visibleSteps(v, ctx);
  const i = list.indexOf(current);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : null;
}

export function previousStepId(current: AssistantStepId, v: AssistantValues, ctx?: AssistantContext): AssistantStepId | null {
  const list = visibleSteps(v, ctx);
  const i = list.indexOf(current);
  return i > 0 ? list[i - 1] : null;
}

/** the notes of ONE step: errors block "Next", warnings and infos do not */
export function stepNotes(id: AssistantStepId, v: AssistantValues, ctx: AssistantContext): AssistantNote[] {
  const notes: AssistantNote[] = [];
  const add = (level: AssistantNote['level'], text: string) => notes.push({ level, text });

  if (id === 'identity') {
    const name = v.name.trim();
    if (!name) add('error', 'The name is required.');
    else {
      if (name.length > 120) add('error', 'The name is too long (120 characters at most).');
      if (name.length < 4) add('warning', 'A very short name is hard to tell from the others: add the client or the result.');
      if (ctx.existingNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) add('warning', 'A project with this name already exists in your organization.');
    }
  }

  if (id === 'schedule') {
    const start = v.projectStartDate;
    const finish = v.projectFinishDate;
    if (!isISODate(start)) add('error', 'The start must be a date: YYYY-MM-DD.');
    if (finish && !isISODate(finish)) add('error', 'The finish must be a date: YYYY-MM-DD (or empty).');
    if (isISODate(start) && isISODate(finish)) {
      const days = daysBetween(start, finish);
      if (days < 0) add('error', 'The finish is before the start.');
      else {
        if (days > 730) add('warning', 'More than two years: split the project into stages (or subprojects) so that each can be controlled.');
        if (v.planUnit === 'hour' && days > 90) add('warning', 'Planning by the hour over more than three months makes a heavy plan: day accuracy is usually enough.');
        if (days === 0) add('info', 'Start and finish are the same day: a one-day project.');
      }
      if (days >= 0 && isISODate(ctx.today) && daysBetween(ctx.today, finish) < 0) add('warning', 'The finish is already in the past.');
    }
    if (isISODate(start) && isISODate(ctx.today) && daysBetween(start, ctx.today) > 365) add('warning', 'The start is more than a year ago: is it a project that is already running?');
    if (!finish) add('info', 'No finish date: the plan will decide it. Add one later when the target is known.');
  }

  if (id === 'planning') {
    if (hourModelOn(v)) {
      add('info', 'Hour by hour: start times, durations and delays are whole minutes. The plan is made from the project start (a plan from the finish date is not used).');
      if (isISODate(v.projectStartDate) && isISODate(v.projectFinishDate) && daysBetween(v.projectStartDate, v.projectFinishDate) > 90) {
        add('warning', 'Hour by hour over more than three months makes a heavy plan: day by day is usually enough, or split the project into stages.');
      }
      if (!timeInputOn(v)) add('info', 'Without time costs nothing is booked by the hour, so the hour model changes little: switch the cost budget and time costs on, or stay day by day.');
    } else {
      add('info', 'Day by day: the plan counts working days. You can change to hour by hour later in Project settings -> Resources.');
    }
  }

  if (id === 'timeOfDay') {
    const zone = v.projectTimeZone.trim();
    if (!zone) add('error', 'The time zone is required, for example Europe/Berlin or UTC.');
    else if (!timeZoneIsValid(zone)) add('error', 'This is not a time zone name, for example Europe/Berlin.');
    const windows = parseWindowsText(v.workWindowsText);
    if (!windows) add('error', 'The working windows must be from-to times, from the earliest, not overlapping: for example 09:00-13:00, 14:00-18:00.');
    else {
      const minutes = windows.reduce((sum, w) => sum + (w.to - w.from), 0);
      add('info', `Working time of a day: ${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}${windows.length > 1 ? ` in ${windows.length} windows` : ''}.`);
      if (minutes > 16 * 60) add('info', 'Round the clock: who really works when is decided by the calendar of each person or machine.');
      if (minutes < 4 * 60) add('warning', 'Less than four working hours a day: a task of a few days will stretch over many weeks.');
      const step = slotMinutesOf(v.resourceSlotMinutes);
      if (windows.some((w) => (w.to - w.from) % step !== 0)) add('warning', 'A window is not a whole number of steps: a leveling move lands on the step grid, so the end of that window cannot be used exactly. Use a smaller step.');
    }
  }

  if (id === 'optimization') {
    if (!v.resourceLevelingFunctionalityEnabled) add('info', 'Off: nothing is moved, over-allocated resources are only visible in the plan.');
    else {
      if (v.resourceLevelingMode === 'automatic') add('warning', 'Automatic optimizes after every change: it is heavy for a big project. Manual with a preview is the safe start.');
      add('info', v.resourceLevelingWithinSlackOnly ? 'Smoothing: only the slack is used, the project finish does not change.' : 'Leveling: dates may move beyond the slack, the project finish may change.');
    }
  }

  if (id === 'currencies') {
    if (!isCurrencyCode(v.currencyForBudget)) add('error', 'The budget currency is required (3 letters, e.g. EUR).');
    if (!isCurrencyCode(v.currencyForAccounting)) add('error', 'The accounting currency is required (3 letters, e.g. EUR).');
    if (v.currencyForContract && !isCurrencyCode(v.currencyForContract)) add('error', 'The currency for contracts must be 3 letters (or empty: the budget currency is used).');
    if (ctx.target !== 'new') add('warning', 'A change of the budget or accounting currency of a saved project recalculates it and is refused while it has posted documents.');
    const consolidation = normalizeCurrency(ctx.consolidationCurrency);
    if (consolidation && isCurrencyCode(v.currencyForBudget) && normalizeCurrency(v.currencyForBudget) !== consolidation) {
      add('info', 'The money of this project is converted into the consolidation currency of the organization when all projects are added.');
    }
  }

  if (id === 'budgets') {
    if (v.projectExpenseBudgetNeeded && !v.projectTimeCostsNeeded && !v.projectMaterialCostsNeeded && !v.projectExpenseCostsNeeded) {
      add('error', 'A cost budget needs at least one kind of cost: time, material or expenses.');
    }
    if (!v.projectRevenueBudgetNeeded && !v.projectExpenseBudgetNeeded) add('warning', 'No budget at all: the project will have a schedule but no money reports (Monitor, ROI).');
    if (v.projectRevenueBudgetNeeded && !v.projectExpenseBudgetNeeded) add('warning', 'Revenue without costs: ROI cannot be calculated. Switch the cost budget on too.');
    if (!v.projectRevenueBudgetNeeded && v.projectExpenseBudgetNeeded) add('info', 'Costs only: right for an internal project. Without revenue there is no ROI.');
  }

  if (id === 'resources') {
    if (timeInputOn(v) && !v.projectTimeOfPersonNeeded && !v.projectTimeOfEquipmentNeeded && !v.projectTimeOfPartnerNeeded) {
      add('error', 'Time costs need at least one kind of resource: people, equipment or partners.');
    }
    if (v.projectTimeOfEquipmentNeeded) add('info', 'Equipment is booked as a work center with its own calendar: create the work centers in the catalog before planning.');
    if (v.projectTimeOfPartnerNeeded) add('info', 'A partner work center is a supplier: its time lines are paid through vendor invoices.');
  }

  if (id === 'control') {
    if (v.roiForTasksFunctionalityEnabled && !(v.projectRevenueBudgetNeeded && v.projectExpenseBudgetNeeded)) {
      add('warning', 'ROI per task needs both a revenue budget and a cost budget.');
    }
    if (v.customerInvoiceFunctionalityEnabled && !v.projectRevenueBudgetNeeded) add('info', 'Customer invoices are made from revenue lines: they will be empty without a revenue budget.');
    if (v.subprojectsFunctionalityEnabled) add('info', 'A task can then stand for another project; its dates follow the subproject.');
  }

  return notes;
}

export const hasError = (notes: AssistantNote[]): boolean => notes.some((n) => n.level === 'error');

/** the first visible step that has an error (null = the answers can create a project) */
export function firstStepWithError(v: AssistantValues, ctx: AssistantContext): AssistantStepId | null {
  for (const id of visibleSteps(v, ctx)) {
    if (id === 'review') continue;
    if (hasError(stepNotes(id, v, ctx))) return id;
  }
  return null;
}

/** all notes of all steps for the review screen */
export function reviewNotes(v: AssistantValues, ctx: AssistantContext): { id: AssistantStepId; notes: AssistantNote[] }[] {
  return visibleSteps(v, ctx)
    .filter((id) => id !== 'review')
    .map((id) => ({ id, notes: stepNotes(id, v, ctx) }))
    .filter((x) => x.notes.length > 0);
}

// ---------------------------------------------------------------------------------------------------------------- hand over

/**
 * The answers -> the keys of the "New project" window (Draft of PMRecentProjectsToolbar). Only what the assistant asked:
 * the currencies of the project; a switch under a master that is off keeps its value
 * (the model of taskInputScope: hidden is not deleted).
 */
export function assistantPatchFor(v: AssistantValues, _ctx?: Pick<AssistantContext, 'projectCount' | 'target'>): Record<string, any> {
  const patch: Record<string, any> = {
    name: v.name.trim(),
    start: v.projectStartDate,
    projectStartDate: v.projectStartDate,
    projectFinishDate: v.projectFinishDate || '',
    skipWeekends: v.skipWeekends,
    planDay: true,
    // the hour model needs hours in the inputs of the plan
    planHour: v.planUnit === 'hour' || hourModelOn(v),
    resourceOptimizationMode: v.resourceOptimizationMode,
    resourceGrainUnit: v.resourceGrainUnit,
    resourceLevelingFunctionalityEnabled: v.resourceLevelingFunctionalityEnabled,
    resourceLevelingMode: v.resourceLevelingMode,
    resourceLevelingWithinSlackOnly: v.resourceLevelingWithinSlackOnly,
    projectRevenueBudgetNeeded: v.projectRevenueBudgetNeeded,
    projectExpenseBudgetNeeded: v.projectExpenseBudgetNeeded,
    projectTimeCostsNeeded: v.projectTimeCostsNeeded,
    projectMaterialCostsNeeded: v.projectMaterialCostsNeeded,
    projectExpenseCostsNeeded: v.projectExpenseCostsNeeded,
    projectTimeOfPersonNeeded: v.projectTimeOfPersonNeeded,
    projectTimeOfEquipmentNeeded: v.projectTimeOfEquipmentNeeded,
    projectTimeOfPartnerNeeded: v.projectTimeOfPartnerNeeded,
    roiForTasksFunctionalityEnabled: v.roiForTasksFunctionalityEnabled,
    customerInvoiceFunctionalityEnabled: v.customerInvoiceFunctionalityEnabled,
    subprojectsFunctionalityEnabled: v.subprojectsFunctionalityEnabled,
    chatFunctionalityEnabled: v.chatFunctionalityEnabled,
  };
  // the time of day is written only for the hour model (the day model never reads it); an invalid text keeps the stored value
  if (hourModelOn(v)) {
    patch.resourceSlotMinutes = slotMinutesOf(v.resourceSlotMinutes);
    if (v.projectTimeZone.trim() && timeZoneIsValid(v.projectTimeZone.trim())) patch.projectTimeZone = v.projectTimeZone.trim();
    const windows = parseWindowsText(v.workWindowsText);
    if (windows) patch.projectWorkWindows = windowsToJson(windows);
  }
  const budget = normalizeCurrency(v.currencyForBudget);
  patch.currencyForBudget = budget;
  patch.currencyForAccounting = normalizeCurrency(v.currencyForAccounting);
  patch.currencyForContract = normalizeCurrency(v.currencyForContract) || budget;
  return patch;
}

/** the lines of the review screen: [label, value] */
export function reviewLines(v: AssistantValues, ctx: AssistantContext): { id: AssistantStepId; label: string; value: string }[] {
  const yes = (b: boolean) => (b ? 'Yes' : 'No');
  const cur = [v.currencyForBudget, v.currencyForAccounting, v.currencyForContract || v.currencyForBudget].map((c) => c || '-').join(' / ');
  const lines: { id: AssistantStepId; label: string; value: string }[] = [
    { id: 'identity', label: 'Name', value: v.name.trim() || '-' },
    { id: 'schedule', label: 'Start', value: v.projectStartDate || '-' },
    { id: 'schedule', label: 'Finish', value: v.projectFinishDate || 'open' },
    { id: 'schedule', label: 'Plan accuracy', value: v.planUnit === 'hour' ? 'Hours' : 'Days' },
    { id: 'schedule', label: 'Skip weekends', value: yes(v.skipWeekends) },
    { id: 'planning', label: 'Planning model', value: hourModelOn(v) ? 'Hour by hour' : 'Day by day' },
    ...(hourModelOn(v)
      ? [
          { id: 'timeOfDay' as const, label: 'Working windows', value: v.workWindowsText.trim() || '-' },
          { id: 'timeOfDay' as const, label: 'Step (minutes)', value: String(slotMinutesOf(v.resourceSlotMinutes)) },
          { id: 'timeOfDay' as const, label: 'Time zone', value: v.projectTimeZone.trim() || '-' },
        ]
      : []),
    { id: 'currencies', label: 'Currencies (budget / accounting / contracts)', value: cur },
    { id: 'currencies', label: 'Consolidation currency (organization)', value: normalizeCurrency(ctx.consolidationCurrency) || '-' },
    { id: 'budgets', label: 'Revenue budget', value: yes(v.projectRevenueBudgetNeeded) },
    { id: 'budgets', label: 'Cost budget', value: yes(v.projectExpenseBudgetNeeded) },
  ];
  if (v.projectExpenseBudgetNeeded) {
    const kinds = [v.projectTimeCostsNeeded && 'Time', v.projectMaterialCostsNeeded && 'Material', v.projectExpenseCostsNeeded && 'Expenses'].filter(Boolean).join(', ');
    lines.push({ id: 'budgets', label: 'Costs of', value: kinds || '-' });
  }
  if (timeInputOn(v)) {
    const kinds = [v.projectTimeOfPersonNeeded && 'People', v.projectTimeOfEquipmentNeeded && 'Equipment', v.projectTimeOfPartnerNeeded && 'Partners'].filter(Boolean).join(', ');
    lines.push({ id: 'resources', label: 'Resources', value: kinds || '-' });
    lines.push({
      id: 'optimization',
      label: 'Resource optimization',
      value: v.resourceLevelingFunctionalityEnabled ? `${v.resourceLevelingMode === 'automatic' ? 'Automatic' : 'Manual'}, ${v.resourceLevelingWithinSlackOnly ? 'smoothing' : 'leveling'}` : 'Off',
    });
  }
  lines.push(
    { id: 'control', label: 'ROI per task', value: yes(v.roiForTasksFunctionalityEnabled) },
    { id: 'control', label: 'Customer invoices', value: yes(v.customerInvoiceFunctionalityEnabled) },
    { id: 'control', label: 'Subprojects', value: yes(v.subprojectsFunctionalityEnabled) },
    { id: 'control', label: 'Chat of the tasks', value: yes(v.chatFunctionalityEnabled) },
  );
  return lines;
}

/** has the user typed anything worth keeping? (a run with the defaults only is not offered for "continue") */
export function hasMeaningfulInput(v: AssistantValues, today: string = todayISO()): boolean {
  const d = defaultAssistantValues(today);
  return (Object.keys(d) as (keyof AssistantValues)[]).some((k) => k !== 'projectStartDate' && v[k] !== d[k]) || (!!v.projectStartDate && v.projectStartDate !== d.projectStartDate);
}
