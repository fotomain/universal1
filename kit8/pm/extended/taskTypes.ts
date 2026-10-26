// A6 Task types and effort-driven (MS Project: Task Information > Advanced > Task type) - pure.
//   Work (hours) = Duration (working days) x hours per day x Units (% of one full-time resource)
// The TYPE says which of the three stays fixed when one of the others is edited:
//   fixedUnits     edit duration -> work moves  | edit work -> duration moves | edit units -> duration moves (effort driven) or work moves (not effort driven)
//   fixedDuration  edit duration -> work moves  | edit work -> units move    | edit units -> work moves
//   fixedWork      edit duration -> units move  | edit work -> duration moves | edit units -> duration moves
// "Effort driven": adding units keeps the work and shortens the task. Stored in the rowJSON of a task: taskType, taskWorkHours, taskUnits, taskEffortDriven, durationDays.
export type PMTaskType = 'fixedUnits' | 'fixedDuration' | 'fixedWork';
export type PMTriangleEdit = 'duration' | 'work' | 'units';

export const PM_TASK_TYPES: { value: PMTaskType; label: string }[] = [
  { value: 'fixedUnits', label: 'Fixed Units' },
  { value: 'fixedDuration', label: 'Fixed Duration' },
  { value: 'fixedWork', label: 'Fixed Work' },
];

export const PM_HOURS_PER_DAY = 8;

export interface PMTaskTriangle {
  type: PMTaskType;
  effortDriven: boolean;
  /** working days */
  durationDays: number;
  /** hours */
  workHours: number;
  /** percent: 100 = one full-time resource */
  units: number;
}

export const taskTypeOf = (v: unknown): PMTaskType => (v === 'fixedDuration' || v === 'fixedWork' ? v : 'fixedUnits');

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** the triangle of a task row (a missing value = 100% units, work from the duration) */
export function triangleOf(json: { taskType?: unknown; taskEffortDriven?: unknown; durationDays?: unknown; taskWorkHours?: unknown; taskUnits?: unknown } | null | undefined, hoursPerDay = PM_HOURS_PER_DAY): PMTaskTriangle {
  const durationDays = Math.max(0, Math.round(Number(json?.durationDays ?? 1)) || 0);
  const units = Number.isFinite(Number(json?.taskUnits)) && Number(json?.taskUnits) > 0 ? Number(json?.taskUnits) : 100;
  const workHours = Number.isFinite(Number(json?.taskWorkHours)) && Number(json?.taskWorkHours) >= 0 && json?.taskWorkHours !== null && json?.taskWorkHours !== undefined ? Number(json?.taskWorkHours) : r2(durationDays * hoursPerDay * (units / 100));
  return { type: taskTypeOf(json?.taskType), effortDriven: json?.taskEffortDriven === true, durationDays, workHours, units };
}

/** the new triangle after the user edited ONE of duration / work / units (the edited value is already in `t`) */
export function recalcTriangle(t: PMTaskTriangle, edited: PMTriangleEdit, hoursPerDay = PM_HOURS_PER_DAY): PMTaskTriangle {
  const out = { ...t };
  const perDay = (u: number) => hoursPerDay * (u / 100);
  const fromWork = () => (perDay(out.units) > 0 ? Math.max(1, Math.round(out.workHours / perDay(out.units))) : out.durationDays);
  const unitsFrom = () => (out.durationDays > 0 ? r1((out.workHours / (out.durationDays * hoursPerDay)) * 100) : out.units);
  const workFrom = () => r2(out.durationDays * perDay(out.units));
  switch (t.type) {
    case 'fixedUnits':
      if (edited === 'duration') out.workHours = workFrom();
      else if (edited === 'work') out.durationDays = fromWork();
      else if (t.effortDriven) out.durationDays = fromWork();
      else out.workHours = workFrom();
      break;
    case 'fixedDuration':
      if (edited === 'work') out.units = unitsFrom();
      else out.workHours = workFrom();
      break;
    case 'fixedWork':
      if (edited === 'duration') out.units = unitsFrom();
      else out.durationDays = fromWork();
      break;
  }
  if (out.units <= 0) out.units = 100;
  return out;
}

/** the rowJSON patch of a triangle */
export const trianglePatch = (t: PMTaskTriangle): { taskType: PMTaskType; taskEffortDriven: boolean; durationDays: number; taskWorkHours: number; taskUnits: number } => ({
  taskType: t.type,
  taskEffortDriven: t.effortDriven,
  durationDays: t.durationDays,
  taskWorkHours: t.workHours,
  taskUnits: t.units,
});
