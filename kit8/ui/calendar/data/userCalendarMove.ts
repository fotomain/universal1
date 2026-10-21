// Drag and drop of an entry to another day / time: the new dates (pure functions, local time).
// Only the entries the user typed in (kind event | task) can be moved; project tasks follow the
// project (SQL trigger) and birthdays repeat yearly.

import {
  addDays,
  eventRange,
  UserCalendarEventJSON,
  UserCalendarEventRow,
  UserCalendarKind,
  UserCalendarOccurrence,
  withEventDates,
} from './userCalendarModel';

/** What a drop changes: whole days and minutes (a multiple of DRAG_SNAP_MINUTES). */
export interface MoveDelta {
  dayDelta: number;
  minuteDelta: number;
}

export const DRAG_SNAP_MINUTES = 15;

const MOVABLE_KINDS: UserCalendarKind[] = ['event', 'task'];

export const isMovableRow = (row: UserCalendarEventRow) => MOVABLE_KINDS.includes(row.rowJSON.kind);

/** Entry dates after the move: days first (local calendar days, daylight saving safe), then the minutes. */
export function movedRange(o: Pick<UserCalendarOccurrence, 'startMs' | 'endMs' | 'allDay'>, { dayDelta, minuteDelta }: MoveDelta): { start: Date; end: Date } {
  const start = addDays(o.startMs, dayDelta);
  if (o.allDay) return { start, end: addDays(o.endMs, dayDelta) };
  const shift = minuteDelta * 60 * 1000;
  return { start: new Date(start.getTime() + shift), end: new Date(addDays(o.endMs, dayDelta).getTime() + shift) };
}

/**
 * The JSON of the entry after the move. For a single entry the whole entry moves; for one occurrence of a
 * repeating entry (`detach`) the result is a plain entry (no recurrence, no Google link) that replaces it.
 */
export function moveEventJSON(json: UserCalendarEventJSON, o: UserCalendarOccurrence, delta: MoveDelta, detach = false): UserCalendarEventJSON {
  // a single entry keeps its own range (an occurrence of it is the same range)
  const range = detach ? o : { ...eventRange(json), allDay: !!json.allDay };
  const { start, end } = movedRange(range, delta);
  let next = withEventDates(json, start, end, !!json.allDay);
  if (detach) {
    const { recurrence: _r, exDates: _e, googleEventId: _g, googleCalendarId: _c, googleUpdated: _u, ...rest } = next as UserCalendarEventJSON & { googleHash?: string };
    delete (rest as { googleHash?: string }).googleHash;
    next = rest as UserCalendarEventJSON;
  }
  return next;
}
