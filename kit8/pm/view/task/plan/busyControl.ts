// Time genus control - the pure side (documentation/TIME_GENUS_CONTROL_WBS.html): what Post answers when a resource is busy, the sentence the user reads and the text of the
// Share button. The arithmetic is the twin of the SQL function organization_resource_busy_check (the database decides; this is for the tests and the sentence).
//
// busy = the hours booked of ONE resource on ONE day (the lines of the posted task + the posted tasks of the others in the organization) > the capacity of its calendar that day.
// Equal is not busy. A day the calendar does not have (capacity null) is a conflict too: it is never guessed.
import { pmT } from '../../../i18n/pmT';

/** organizationTable.rowJSON.resourceCapacityStrongMode */
export type CapacityMode = 'capacityModeOff' | 'capacityModeWarn' | 'capacityModeBlock';
export const DEFAULT_CAPACITY_MODE: CapacityMode = 'capacityModeOff';
export const CAPACITY_MODES: { mode: CapacityMode; label: string; hint: string }[] = [
  { mode: 'capacityModeOff', label: 'Off', hint: 'Post does not check the capacity of the resources (as before).' },
  { mode: 'capacityModeWarn', label: 'Warn', hint: 'Post posts everything and tells which resources are busy.' },
  { mode: 'capacityModeBlock', label: 'Block', hint: 'A line whose resource is busy is not posted; the other lines are.' },
];
export const isCapacityMode = (v: unknown): v is CapacityMode => v === 'capacityModeOff' || v === 'capacityModeWarn' || v === 'capacityModeBlock';
/** the mode of an organization row (a missing or unknown value = off) */
export const capacityModeOf = (organizationRowJSON: { resourceCapacityStrongMode?: unknown } | null | undefined): CapacityMode =>
  isCapacityMode(organizationRowJSON?.resourceCapacityStrongMode) ? organizationRowJSON!.resourceCapacityStrongMode as CapacityMode : DEFAULT_CAPACITY_MODE;

/** another task that already holds the resource that day (projectGUID / taskGUID: no titles - a colleague's plan is not exposed) */
export interface BusyOtherBooking {
  projectGUID: string;
  taskGUID: string;
  hours: number;
  /** e-mail of the project manager of THAT project (project setting projectManagerPerson), '' = none set */
  managerEmail: string;
}

export interface ResourceBusyConflict {
  resourceKind: 'person' | 'equipment' | 'workCenter';
  resourceGUID: string;
  resourceTitle: string;
  /** YYYY-MM-DD */
  day: string;
  /** hours of the calendar that day; null = the calendar has no row for the day (not filled) */
  capacityHours: number | null;
  bookedHere: number;
  bookedOthers: number;
  overHours: number;
  notFilled: boolean;
  /** the lines of the posted task that book the resource that day */
  lines: string[];
  others: BusyOtherBooking[];
  /** e-mail of the manager of the project being posted ('' = none): the Share copy */
  postingManagerEmail: string;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** the `busy` array of the answer of create_task_line_plan -> typed conflicts (anything else = none) */
export function parseBusy(raw: unknown): ResourceBusyConflict[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c) => c && typeof c === 'object').map((c: any) => ({
    resourceKind: c.resourceKind === 'equipment' ? 'equipment' : c.resourceKind === 'workCenter' ? 'workCenter' : 'person',
    resourceGUID: str(c.resourceGUID),
    resourceTitle: str(c.resourceTitle) || str(c.resourceGUID),
    day: str(c.day).slice(0, 10),
    capacityHours: c.capacityHours == null ? null : num(c.capacityHours),
    bookedHere: num(c.bookedHere),
    bookedOthers: num(c.bookedOthers),
    overHours: num(c.overHours),
    notFilled: !!c.notFilled || c.capacityHours == null,
    lines: Array.isArray(c.lines) ? c.lines.map(str) : [],
    others: Array.isArray(c.others)
      ? c.others.map((o: any) => ({ projectGUID: str(o?.projectGUID), taskGUID: str(o?.taskGUID), hours: num(o?.hours), managerEmail: str(o?.managerEmail) }))
      : [],
    postingManagerEmail: str(c.postingManagerEmail),
  }));
}

/** the rule: is `here + others` more than the capacity? (null capacity = the calendar is not filled = a conflict as soon as something is booked) */
export function isBusy(capacityHours: number | null, bookedHere: number, bookedOthers: number): boolean {
  if (bookedHere <= 0) return false;
  if (capacityHours == null) return true;
  return bookedHere + bookedOthers > capacityHours;
}

/** hours without a trailing .00 */
export const hoursText = (h: number): string => String(Math.round(h * 100) / 100);

/** "Anna K. is busy on 2026-10-14: 12 h of 8 h (another project of your organization holds 4 h)" */
export function busySentence(c: ResourceBusyConflict): string {
  if (c.notFilled) {
    return pmT('{{resource}}: the calendar has no day {{day}} (not filled for that year), so the {{hours}} h cannot be checked', { resource: c.resourceTitle, day: c.day, hours: hoursText(c.bookedHere) });
  }
  const total = c.bookedHere + c.bookedOthers;
  return c.bookedOthers > 0
    ? pmT('{{resource}} is busy on {{day}}: {{total}} h of {{capacity}} h ({{others}} h are booked by other tasks of your organization)',
        { resource: c.resourceTitle, day: c.day, total: hoursText(total), capacity: hoursText(c.capacityHours as number), others: hoursText(c.bookedOthers) })
    : pmT('{{resource}} is busy on {{day}}: {{total}} h of {{capacity}} h (the calendar allows {{capacity}} h)',
        { resource: c.resourceTitle, day: c.day, total: hoursText(total), capacity: hoursText(c.capacityHours as number) });
}

/** the managers a Share goes to (the projects that hold the booking) and the copy (the project being posted), without doubles, lower case */
export function shareRecipients(c: ResourceBusyConflict): { to: string[]; cc: string[] } {
  const clean = (list: string[]) => Array.from(new Set(list.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  const to = clean(c.others.map((o) => o.managerEmail));
  const cc = clean([c.postingManagerEmail]).filter((e) => !to.includes(e));
  return { to, cc };
}

/** the text the Share button prepares (it is opened in the mail program or copied - the application never sends it) */
export function shareText(c: ResourceBusyConflict): string {
  const held = c.others.map((o) => pmT('project {{project}}, task {{task}} ({{hours}} h)', { project: o.projectGUID, task: o.taskGUID, hours: hoursText(o.hours) })).join('; ');
  if (!c.others.length) {
    return pmT('{{resource}} is needed {{hours}} h on {{day}}, but the calendar of the resource allows {{capacity}} h that day. Can the task be moved or the calendar changed?',
      { resource: c.resourceTitle, hours: hoursText(c.bookedHere), day: c.day, capacity: hoursText(c.capacityHours ?? 0) });
  }
  return pmT('{{resource}} is needed {{hours}} h on {{day}}, but is already booked {{booked}} h of {{capacity}} h in: {{held}}. Can the task be moved or the hours reduced?',
    { resource: c.resourceTitle, hours: hoursText(c.bookedHere), day: c.day, booked: hoursText(c.bookedOthers), capacity: hoursText(c.capacityHours ?? 0), held });
}

export const shareSubject = (c: ResourceBusyConflict): string =>
  pmT('{{resource}} is booked twice on {{day}}', { resource: c.resourceTitle, day: c.day });

/** mailto: link of a Share (To = the managers that hold the booking, Cc = the manager of the project being posted); null when nobody has an e-mail yet */
export function shareMailto(c: ResourceBusyConflict): string | null {
  const { to, cc } = shareRecipients(c);
  if (!to.length && !cc.length) return null;
  const enc = encodeURIComponent;
  const params = [`subject=${enc(shareSubject(c))}`, `body=${enc(shareText(c))}`];
  if (cc.length && to.length) params.unshift(`cc=${enc(cc.join(','))}`);
  return `mailto:${(to.length ? to : cc).join(',')}?${params.join('&')}`;
}

/** "Share" can be pressed when somebody has an e-mail (a project manager is set); the tooltip says what is missing otherwise */
export function shareState(c: ResourceBusyConflict): { enabled: boolean; hint: string } {
  const { to, cc } = shareRecipients(c);
  if (to.length || cc.length) return { enabled: true, hint: '' };
  return { enabled: false, hint: pmT('Set the project manager in the project settings (a person with an e-mail)') };
}

/** the lines of a task that Post left out (capacityModeBlock) */
export const busyLineGUIDs = (conflicts: ResourceBusyConflict[]): string[] => Array.from(new Set(conflicts.flatMap((c) => c.lines)));
