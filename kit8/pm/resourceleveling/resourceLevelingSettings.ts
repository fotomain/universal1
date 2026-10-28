// resourceLevelingSettings - the keys of Resource optimization (leveling and smoothing) in a project: documentation/RESOURCE_LEVELING_WBS.html section 7.1, README next to this file.
// Pure TypeScript, no React / Supabase imports: unit-testable.
//   project_table.rowJSON  (Project settings -> "Resources" -> section "Resource optimization"; also Organization edit -> Projects -> Settings = the defaults of a new project).
//   EVERY key is OFF / at its default while never saved; the sub switches work only while the MASTER is on (resourceLevelingValuesOf applies this, the SQL reads the same keys).
//
//   part "Resources" (always editable, they are not optimization switches)
//     resourceOptimizationMode     'dayByDayModel' (default: the plan has days, as it is today) | 'hourByHourModel' (the time-of-day model, phase 2: not selectable yet)
//     resourceGrainUnit            'hour' (default) | 'day' | 'week': the unit shown and the period in which load is compared with capacity (section 7.9)
//   section "Resource optimization"
//     resourceLevelingFunctionalityEnabled                MASTER
//     resourceLevelingMode                                'manual' (default) | 'automatic'
//     resourceLevelingWithinSlackOnly                     false = Leveling (the finish may move) | true = Smoothing (only the slack is used); MS Project: "Level only within available slack"
//     resourceLevelingFunctionalityFastModeEnabled        in-place data options on the screen (7.6)
//     resourceLevelingPostedTasksMovementEnabled          true (default): posted tasks are candidates for moving (the user is ASKED first, 7.7); false = they are frozen
//     resourceLevelingPostedTasksAction                   'ask' (default) | 'unpostAndMove' | 'moveAndPostAgain' | 'keep'
//     resourceLevelingOrder                               'standard' (default) | 'idOnly' | 'priorityStandard'
//     resourceLevelingClearBeforeLeveling                 true (default); always true in Automatic
//     resourceLevelingCanSplit                            false; needs Extended A12 (ganttSplitTasksEnabled)
//     resourceLevelingManualTasks                         false; needs Extended A1 (ganttManualSchedulingEnabled)
//     resourceLevelingIncludeOtherProjects                true: the posted hours of the other projects of the organization are obstacles
//     resourceLevelingShowDelayBar / ShowOverallocation   true
//     resourceLevelingKeepHistory                         true: the run tables are written (Undo of a run)
import { extendedOf } from '../extended/extendedModel';

export type ResourceOptimizationMode = 'dayByDayModel' | 'hourByHourModel';
export type ResourceGrainUnit = 'hour' | 'day' | 'week';
export type ResourceLevelingMode = 'manual' | 'automatic';
export type ResourceLevelingOrder = 'idOnly' | 'standard' | 'priorityStandard';
export type ResourceLevelingPostedAction = 'ask' | 'unpostAndMove' | 'moveAndPostAgain' | 'keep';
/** the PMBOK name of the method; it is the presentation of resourceLevelingWithinSlackOnly */
export type ResourceOptimizationMethod = 'leveling' | 'smoothing';

export const RESOURCE_OPTIMIZATION_MODES: readonly ResourceOptimizationMode[] = ['dayByDayModel', 'hourByHourModel'];
export const RESOURCE_GRAIN_UNITS: readonly ResourceGrainUnit[] = ['hour', 'day', 'week'];
export const RESOURCE_LEVELING_MODES: readonly ResourceLevelingMode[] = ['manual', 'automatic'];
export const RESOURCE_LEVELING_ORDERS: readonly ResourceLevelingOrder[] = ['idOnly', 'standard', 'priorityStandard'];
export const RESOURCE_LEVELING_POSTED_ACTIONS: readonly ResourceLevelingPostedAction[] = ['ask', 'unpostAndMove', 'moveAndPostAgain', 'keep'];

/** the hour-by-hour model is built in phase 2 (WP15): the choice is shown but cannot be made yet */
export const HOUR_BY_HOUR_MODEL_AVAILABLE = false;

export interface PMResourceLevelingValues {
  resourceOptimizationMode?: ResourceOptimizationMode;
  resourceGrainUnit?: ResourceGrainUnit;
  resourceLevelingFunctionalityEnabled?: boolean;
  resourceLevelingMode?: ResourceLevelingMode;
  resourceLevelingWithinSlackOnly?: boolean;
  resourceLevelingFunctionalityFastModeEnabled?: boolean;
  resourceLevelingPostedTasksMovementEnabled?: boolean;
  resourceLevelingPostedTasksAction?: ResourceLevelingPostedAction;
  resourceLevelingOrder?: ResourceLevelingOrder;
  resourceLevelingClearBeforeLeveling?: boolean;
  resourceLevelingCanSplit?: boolean;
  resourceLevelingManualTasks?: boolean;
  resourceLevelingIncludeOtherProjects?: boolean;
  resourceLevelingShowDelayBar?: boolean;
  resourceLevelingShowOverallocation?: boolean;
  resourceLevelingKeepHistory?: boolean;
}

type Json = (PMResourceLevelingValues & Record<string, any>) | undefined | null;

const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list as readonly string[]).includes(v as string) ? (v as T) : fallback;
/** a switch that is ON unless stored false */
const onUnlessFalse = (v: unknown): boolean => v !== false;

/**
 * The stored values with the defaults filled in (a missing key reads as its default). The sub switches are NOT cleared when the master is off here (the form shows what is stored);
 * resourceLevelingOf() is the effective result.
 */
export const resourceLevelingValuesOf = (j: Json): Required<PMResourceLevelingValues> => ({
  resourceOptimizationMode: oneOf(j?.resourceOptimizationMode, RESOURCE_OPTIMIZATION_MODES, 'dayByDayModel'),
  resourceGrainUnit: oneOf(j?.resourceGrainUnit, RESOURCE_GRAIN_UNITS, 'hour'),
  resourceLevelingFunctionalityEnabled: j?.resourceLevelingFunctionalityEnabled === true,
  resourceLevelingMode: oneOf(j?.resourceLevelingMode, RESOURCE_LEVELING_MODES, 'manual'),
  resourceLevelingWithinSlackOnly: j?.resourceLevelingWithinSlackOnly === true,
  resourceLevelingFunctionalityFastModeEnabled: j?.resourceLevelingFunctionalityFastModeEnabled === true,
  resourceLevelingPostedTasksMovementEnabled: onUnlessFalse(j?.resourceLevelingPostedTasksMovementEnabled),
  resourceLevelingPostedTasksAction: oneOf(j?.resourceLevelingPostedTasksAction, RESOURCE_LEVELING_POSTED_ACTIONS, 'ask'),
  resourceLevelingOrder: oneOf(j?.resourceLevelingOrder, RESOURCE_LEVELING_ORDERS, 'standard'),
  resourceLevelingClearBeforeLeveling: onUnlessFalse(j?.resourceLevelingClearBeforeLeveling),
  resourceLevelingCanSplit: j?.resourceLevelingCanSplit === true,
  resourceLevelingManualTasks: j?.resourceLevelingManualTasks === true,
  resourceLevelingIncludeOtherProjects: onUnlessFalse(j?.resourceLevelingIncludeOtherProjects),
  resourceLevelingShowDelayBar: onUnlessFalse(j?.resourceLevelingShowDelayBar),
  resourceLevelingShowOverallocation: onUnlessFalse(j?.resourceLevelingShowOverallocation),
  resourceLevelingKeepHistory: onUnlessFalse(j?.resourceLevelingKeepHistory),
});

/** the settings that really work (the master off = the feature does not exist; a sub switch whose Extended function is off is off) */
export interface ResourceLevelingEffective {
  enabled: boolean;
  mode: ResourceLevelingMode;
  method: ResourceOptimizationMethod;
  fastMode: boolean;
  postedTasksMovement: boolean;
  postedTasksAction: ResourceLevelingPostedAction;
  order: ResourceLevelingOrder;
  clearBefore: boolean;
  canSplit: boolean;
  manualTasks: boolean;
  includeOtherProjects: boolean;
  showDelayBar: boolean;
  showOverallocation: boolean;
  keepHistory: boolean;
  grainUnit: ResourceGrainUnit;
  optimizationMode: ResourceOptimizationMode;
}

export function resourceLevelingOf(j: Json): ResourceLevelingEffective {
  const v = resourceLevelingValuesOf(j);
  const ext = extendedOf(j as any);
  const on = v.resourceLevelingFunctionalityEnabled;
  const automatic = on && v.resourceLevelingMode === 'automatic';
  return {
    enabled: on,
    mode: on ? v.resourceLevelingMode : 'manual',
    method: v.resourceLevelingWithinSlackOnly ? 'smoothing' : 'leveling',
    fastMode: on && v.resourceLevelingFunctionalityFastModeEnabled,
    postedTasksMovement: on && v.resourceLevelingPostedTasksMovementEnabled,
    // movement off = keep; the action is only asked/remembered while movement is allowed
    postedTasksAction: on && v.resourceLevelingPostedTasksMovementEnabled ? v.resourceLevelingPostedTasksAction : 'keep',
    order: v.resourceLevelingOrder,
    clearBefore: automatic ? true : v.resourceLevelingClearBeforeLeveling,
    canSplit: on && v.resourceLevelingCanSplit && ext.ganttSplitTasksEnabled === true,
    manualTasks: on && v.resourceLevelingManualTasks && ext.ganttManualSchedulingEnabled === true,
    includeOtherProjects: v.resourceLevelingIncludeOtherProjects,
    showDelayBar: on && v.resourceLevelingShowDelayBar,
    showOverallocation: on && v.resourceLevelingShowOverallocation,
    keepHistory: v.resourceLevelingKeepHistory,
    grainUnit: v.resourceGrainUnit,
    // until the time-of-day model exists the project plans by day whatever is stored
    optimizationMode: HOUR_BY_HOUR_MODEL_AVAILABLE ? v.resourceOptimizationMode : 'dayByDayModel',
  };
}

/** is Resource optimization on for this project (the master) */
export const resourceLevelingEnabledOf = (j: Json): boolean => j?.resourceLevelingFunctionalityEnabled === true;

/** the PMBOK method is the presentation of resourceLevelingWithinSlackOnly */
export const methodOf = (j: Json): ResourceOptimizationMethod => (j?.resourceLevelingWithinSlackOnly === true ? 'smoothing' : 'leveling');
export const methodPatch = (m: ResourceOptimizationMethod): PMResourceLevelingValues => ({ resourceLevelingWithinSlackOnly: m === 'smoothing' });
