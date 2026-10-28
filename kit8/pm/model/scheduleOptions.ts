// The scheduler inputs that come from the PROJECT row (pure): which of the Extended scheduling functions the project uses and their options.
// Read by store/storeDerive.ts derive() and version/model/versionCompare.ts scheduleVersion(), so the live plan and a version are scheduled by the same rules.
// With the Extended master off (or every function off) the result is the default object: the scheduler then works exactly as before.
import { extendedOf } from '../extended/extendedModel';
import { extendedOptionsOf } from '../extended/extendedOptions';
import { projectFinishDayOf, scheduleFromEffective } from './scheduleFrom';
import { calendarOfDef, calendarsOf } from '../view/project/ganttCalendar';
import type { PMPlanDateInputFormat } from './planDateFormats';
import type { PMCalendar } from '../view/project/scheduling';

export interface PMScheduleOptions {
  manualEnabled: boolean;
  constraintsEnabled: boolean;
  constraintsAlwaysHonored: boolean;
  scheduleFrom: 'start' | 'finish';
  projectFinishDayMs: number | null;
  splitEnabled: boolean;
  inactiveEnabled: boolean;
  elapsedEnabled: boolean;
  deadlineEnabled: boolean;
  lagPercentEnabled: boolean;
  externalEnabled: boolean;
  /** Resource optimization: the leveling delay of a task is honored (project switch resourceLevelingFunctionalityEnabled); manual tasks too only with resourceLevelingManualTasks */
  levelingEnabled: boolean;
  levelingManualTasks: boolean;
  /** task calendars by id (A10); empty while the function is off */
  calendars: Record<string, PMCalendar>;
  /** the calendar of the whole project (A11), null = the Mon-Fri / 7-day week of the project settings */
  projectCalendar: PMCalendar | null;
}

type ProjectJSONLike = Record<string, any> | null | undefined;

export function scheduleOptionsOf(projectJSON: ProjectJSONLike): PMScheduleOptions {
  const ext = extendedOf(projectJSON);
  const o = extendedOptionsOf(projectJSON);
  const format = (projectJSON?.planDateInputFormat as PMPlanDateInputFormat | undefined) ?? undefined;
  const scheduleFrom = ext.ganttScheduleFromFinishEnabled ? scheduleFromEffective(projectJSON, format) : 'start';
  const projectDef = ext.ganttCalendarExceptionsEnabled && o.projectCalendarId ? o.calendars.find((c) => c.id === o.projectCalendarId) : undefined;
  return {
    manualEnabled: ext.ganttManualSchedulingEnabled === true,
    constraintsEnabled: ext.ganttConstraintsEnabled === true,
    constraintsAlwaysHonored: o.constraintsAlwaysHonored,
    scheduleFrom,
    projectFinishDayMs: scheduleFrom === 'finish' ? projectFinishDayOf(projectJSON, format) : null,
    splitEnabled: ext.ganttSplitTasksEnabled === true,
    inactiveEnabled: ext.ganttInactiveTasksEnabled === true,
    elapsedEnabled: ext.ganttDurationUnitsEnabled === true,
    deadlineEnabled: ext.ganttDeadlineEnabled === true,
    lagPercentEnabled: ext.ganttLagPercentEnabled === true,
    externalEnabled: ext.ganttCrossProjectLinksEnabled === true,
    levelingEnabled: projectJSON?.resourceLevelingFunctionalityEnabled === true,
    levelingManualTasks: projectJSON?.resourceLevelingFunctionalityEnabled === true && projectJSON?.resourceLevelingManualTasks === true && ext.ganttManualSchedulingEnabled === true,
    calendars: ext.ganttTaskCalendarEnabled || ext.ganttCalendarExceptionsEnabled ? calendarsOf(o.calendars, ext.ganttCalendarExceptionsEnabled === true) : {},
    projectCalendar: projectDef ? calendarOfDef(projectDef, true) : null,
  };
}

/** is the project in MANUAL calculation (A2)? */
export const calculationManualOf = (projectJSON: ProjectJSONLike): boolean => extendedOf(projectJSON).ganttCalculationModeEnabled === true && extendedOptionsOf(projectJSON).calculationManual;
