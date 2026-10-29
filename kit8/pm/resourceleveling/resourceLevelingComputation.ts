// resourceLevelingComputation - the two ways to calculate a run of Resource optimization and what each means for the user (the radio set of the section "Resource optimization",
// project setting resourceLevelingComputationSide). Pure apart from pmT: the words are looked up when called, so they follow a language change.
//
//   resourceLevelingClientSideComputations   the run is calculated on THIS device by the scheduler of the screen (resourceLevelingRun.ts)             - the default, the way the feature was built
//   resourceLevelingServerSideComputations   the run is calculated by the DATABASE (SQL PART 42: project_resource_leveling_server_plan); this device
//                                            reads the proposal, checks it with the scheduler of the screen and shows the same preview. A plan the database cannot calculate
//                                            exactly (the supported plans: README, section "Server side") is calculated on this device and the app SAYS so: a choice is never ignored silently.
import { pmT } from '../i18n/pmT';
import type { ResourceLevelingComputation } from './resourceLevelingSettings';

export interface ComputationInfo {
  value: ResourceLevelingComputation;
  title: string;
  /** one sentence: where the run is calculated */
  summary: string;
  /** what the user gains */
  plus: string[];
  /** what the user pays for it */
  minus: string[];
}

export const COMPUTATION_ICON: Record<ResourceLevelingComputation, string> = {
  resourceLevelingClientSideComputations: 'devices',
  resourceLevelingServerSideComputations: 'dns',
};

/** the two variants, in the order of the radio set */
export function computationInfos(): ComputationInfo[] {
  return [
    {
      value: 'resourceLevelingClientSideComputations',
      title: pmT('Client side computations'),
      summary: pmT('The run is calculated on this device by the same scheduler that draws the Gantt chart.'),
      plus: [
        pmT('The preview is exact: it is the plan of your screen, calculated by the very same scheduler.'),
        pmT('Works with every project setting: task calendars, constraints, splits, schedule from the finish, manual tasks.'),
        pmT('Nothing to install in the database, and no load on it.'),
        pmT('Ready for Fast mode: instant answers while you drag a bar or type hours.'),
      ],
      minus: [
        pmT('A big plan (thousands of tasks) can make a phone or an old browser slow while the run is going.'),
        pmT('The whole project must be open and calculated on this device.'),
        pmT('The speed of a run depends on the device that starts it.'),
      ],
    },
    {
      value: 'resourceLevelingServerSideComputations',
      title: pmT('Server side computations'),
      summary: pmT('The run is calculated by the database; this device only checks the proposal, shows it and applies it.'),
      plus: [
        pmT('A big plan does not slow your screen: the work is done next to the data.'),
        pmT('The same speed on a phone and on a computer.'),
        pmT('The proposal is checked by the scheduler of your screen before you can apply it.'),
      ],
      minus: [
        pmT('Needs the SQL update of the database (PART 42); without it the run is calculated on this device and the app says so.'),
        pmT('Calculates only plans of one calendar (Monday to Friday, or every day) with the four kinds of links between tasks and stages, without splits, constraints, task calendars, manual or elapsed tasks, subprojects or schedule from the finish; any other plan is calculated on this device and the app says so.'),
        pmT('The database has a time limit (5 seconds): a very big plan may need more, then it is calculated on this device and the app says so.'),
        pmT('One more round trip to the database: a small plan is faster on the client side.'),
        pmT('No Fast mode: it needs instant answers from this device.'),
      ],
    },
  ];
}

/** why a run that was asked for on the server side was calculated on this device */
export type ComputationFallbackCode = 'serverUnavailable' | 'planNotSupported' | 'serverError';
export interface ComputationOutcome {
  asked: ResourceLevelingComputation;
  /** where it was calculated */
  used: 'client' | 'server';
  fallback?: ComputationFallbackCode;
  /** the reasons the database gave (planNotSupported), in words of the database */
  reasons?: string[];
}

/** the reason codes of ServerUnsupported (and of the database) in words */
export function reasonText(code: string): string {
  switch (code) {
    case 'direction': return pmT('the plan is planned from the finish date');
    case 'calendar': return pmT('the calendar of the project has a work week of its own or exceptions');
    case 'taskCalendar': return pmT('a task has a calendar of its own');
    case 'constraint': return pmT('a task has a constraint');
    case 'manual': return pmT('a task is scheduled manually');
    case 'splits': return pmT('a task is split');
    case 'elapsed': return pmT('a task has an elapsed duration');
    case 'external': return pmT('a task has a predecessor in another project');
    case 'inactive': return pmT('a task is inactive');
    case 'subproject': return pmT('the plan has a subproject task');
    case 'distribution': return pmT('a Time line uses another distribution than uniform');
    case 'cycle': return pmT('the links make a loop');
    case 'size': return pmT('the plan is too big for the function of the database');
    case 'timeout': return pmT('the plan needs more time than the database allows');
    default: return pmT('the database does not know this request');
  }
}

export function fallbackText(o: ComputationOutcome): string {
  switch (o.fallback) {
    case 'serverUnavailable': return pmT('The database cannot calculate a run yet (run start2_sql_code.sql, PART 42): calculated on this device.');
    case 'planNotSupported': return pmT('The database does not calculate this plan: calculated on this device.');
    case 'serverError': return pmT('The database could not calculate the run: calculated on this device.');
    default: return '';
  }
}

/** the line under the title of the preview: where the run was calculated (empty for the plain client side run) */
export function outcomeText(o: ComputationOutcome | null | undefined): string {
  if (!o) return '';
  if (o.fallback) {
    const why = [...new Set(o.reasons || [])].map(reasonText);
    return why.length ? `${fallbackText(o)} ${pmT('Why')}: ${why.join('; ')}.` : fallbackText(o);
  }
  if (o.used === 'server') {
    return o.adjusted && o.adjusted > 0
      ? pmT('Calculated by the database and checked on this device: {{n}} task(s) were adjusted.', { n: o.adjusted })
      : pmT('Calculated by the database and checked on this device.');
  }
  return '';
}
