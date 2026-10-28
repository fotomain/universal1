// resourceLevelingEnv - the LevelingEnv of a real project (documentation/RESOURCE_LEVELING_WBS.html 7.2): the scheduler with the leveling delays, the calendars of the tasks, the capacity and the
// foreign load that project_resource_leveling_inputs returned. Pure: no React / Supabase.
import { DAY_MS } from '../model/constants';
import type { PMTaskDependencyRow, PMTaskJSON, PMTaskRow } from '../model/types';
import { scheduleOptionsOf } from '../model/scheduleOptions';
import { resourceLevelingOf } from './resourceLevelingSettings';
import { isWorkDay, scheduleProject, splitsOf } from '../view/project/scheduling';
import type { PMCalendar } from '../view/project/scheduling';
import { activeDaysBetween, placeAway } from './resourceLevelingPlace';
import type { LevelingDirection, LevelingEnv } from './resourceLevelingModel';

/** a row of the answer of project_resource_leveling_inputs: k = resource kind, g = its GUID, d = 'YYYY-MM-DD', h = hours */
export interface InputRow { k: string; g: string; d: string; h: number }

export interface LevelingEnvArgs {
  tasks: PMTaskRow[];
  deps: PMTaskDependencyRow[];
  projectJSON: Record<string, any> | undefined | null;
  projectStartMs: number;
  externalDates?: Record<string, { startMs: number; finishMs: number }>;
  capacityRows: InputRow[];
  foreignRows: InputRow[];
}

const dayOfIso = (d: string): number => Date.parse(d.slice(0, 10) + 'T00:00:00Z');

/** the direction of the plan: planned from the project finish date (Extended A4) the tasks move EARLIER (documentation 7.8) */
export const directionOf = (projectJSON: Record<string, any> | undefined | null): LevelingDirection => (scheduleOptionsOf(projectJSON).scheduleFrom === 'finish' ? 'backward' : 'forward');

export function buildLevelingEnv(a: LevelingEnvArgs): LevelingEnv {
  const options = scheduleOptionsOf(a.projectJSON);
  const eff = resourceLevelingOf(a.projectJSON);
  const baseCal: PMCalendar = options.projectCalendar ?? { skipWeekends: !!a.projectJSON?.skipWeekends };
  const forward = directionOf(a.projectJSON) === 'forward';
  const byGuid = new Map(a.tasks.map((t) => [t.rowGUID, t]));
  const calOf = (guid: string): PMCalendar => {
    const id = (byGuid.get(guid)?.rowJSON as PMTaskJSON | undefined)?.taskCalendarId;
    return (id && options.calendars[id]) || baseCal;
  };

  const capacity = new Map<string, number>();
  let first = Infinity;
  let last = -Infinity;
  for (const r of a.capacityRows) {
    const d = dayOfIso(r.d);
    capacity.set(`${r.k}:${r.g}|${d}`, Number(r.h));
    if (d < first) first = d;
    if (d > last) last = d;
  }
  const foreign = new Map<string, number>();
  for (const r of a.foreignRows) foreign.set(`${r.k}:${r.g}|${dayOfIso(r.d)}`, Number(r.h));

  return {
    schedule: (delays) => {
      const r = scheduleProject({
        tasks: a.tasks, deps: a.deps, projectStartMs: a.projectStartMs, calendar: baseCal, ...options,
        levelingEnabled: true, levelingManualTasks: eff.manualTasks, levelingDelays: delays, externalDates: a.externalDates,
      });
      return { rows: r.rows, projectStartMs: r.projectStartMs, projectFinishMs: r.projectFinishMs };
    },
    activeDays: (task, startMs, finishMs) => {
      const cal = calOf(task);
      return activeDaysBetween(startMs, finishMs, (d) => isWorkDay(d, cal));
    },
    place: (task, row, extra) => {
      const json = (byGuid.get(task)?.rowJSON || {}) as PMTaskJSON;
      const elapsed = options.elapsedEnabled && json.durationElapsed === true;
      const gaps = options.splitEnabled ? splitsOf(json, row.durationDays).reduce((s, x) => s + x.gap, 0) : 0;
      return placeAway(row, extra, calOf(task), forward, elapsed, gaps);
    },
    capacity: (resource, dayMs) => capacity.get(`${resource}|${Math.floor(dayMs / DAY_MS) * DAY_MS}`),
    foreign: (resource, dayMs) => foreign.get(`${resource}|${Math.floor(dayMs / DAY_MS) * DAY_MS}`) || 0,
    horizon: { firstDayMs: first === Infinity ? a.projectStartMs : first, lastDayMs: last === -Infinity ? a.projectStartMs : last },
  };
}

/** the resources the Time lines of the tasks book, as the RPC wants them: [{k, g}] */
export function resourcesOfLines(tasksLines: Record<string, { rowParentGUID: string; rowJSON?: any }[]>): { k: string; g: string }[] {
  const seen = new Map<string, { k: string; g: string }>();
  for (const lines of Object.values(tasksLines)) {
    for (const l of lines) {
      if (l.rowParentGUID !== 'timeGenus') continue;
      const g = l.rowJSON?.taskResourceItem;
      if (!g) continue;
      const k = l.rowJSON?.taskResourceKind || 'person';
      seen.set(`${k}:${g}`, { k, g: String(g) });
    }
  }
  return [...seen.values()];
}
