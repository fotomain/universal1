// Drag and drop of calendar entries: new dates, gesture state machine, tap / double tap.

import { createDragGesture, DRAG_LONG_PRESS_MS, monthDelta, snapMinutes, timeGridDelta } from '../../../kit8/ui/calendar/calendarDrag';
import { createDoubleTap, DOUBLE_TAP_MS } from '../../../kit8/ui/calendar/doubleTap';
import { expandEvent } from '../../../kit8/ui/calendar/data/userCalendarRecurrence';
import { isMovableRow, moveEventJSON } from '../../../kit8/ui/calendar/data/userCalendarMove';
import { newEventJSON, UserCalendarEventRow } from '../../../kit8/ui/calendar/data/userCalendarModel';

const row = (json: any): UserCalendarEventRow => ({ rowGUID: 'r1', rowOwnerGUID: 'u', rowParentGUID: 'empty', orderInList: 0, rowJSON: json });
const occOf = (r: UserCalendarEventRow) => expandEvent(r, 0, Date.now() * 2)[0];

describe('which entries can be moved', () => {
  it('events and calendar tasks only', () => {
    const start = new Date(2026, 9, 21, 12, 30);
    expect(isMovableRow(row(newEventJSON('event', start)))).toBe(true);
    expect(isMovableRow(row(newEventJSON('task', start)))).toBe(true);
    expect(isMovableRow(row(newEventJSON('birthday', start)))).toBe(false);
    expect(isMovableRow(row({ ...newEventJSON('event', start), kind: 'projectTask' }))).toBe(false);
  });
});

describe('moveEventJSON', () => {
  it('moves a timed entry by days and minutes, keeping the length', () => {
    const r = row({ ...newEventJSON('event', new Date(2026, 9, 21, 12, 30)), title: 'EV1' });
    const next = moveEventJSON(r.rowJSON, occOf(r), { dayDelta: -2, minuteDelta: 90 });
    expect(new Date(next.startAt)).toEqual(new Date(2026, 9, 19, 14, 0));
    expect(new Date(next.endAt)).toEqual(new Date(2026, 9, 19, 15, 0));
    expect(next.startDate).toBe('2026-10-19');
  });

  it('moves an all-day entry by whole days', () => {
    const r = row({ ...newEventJSON('event', new Date(2026, 9, 21, 9), true), startDate: '2026-10-21', endDate: '2026-10-22' });
    const next = moveEventJSON(r.rowJSON, occOf(r), { dayDelta: 3, minuteDelta: 0 });
    expect(next.allDay).toBe(true);
    expect(next.startDate).toBe('2026-10-24');
    expect(next.endDate).toBe('2026-10-25');
  });

  it('one occurrence of a repeating entry becomes a plain entry without the Google link', () => {
    const base = { ...newEventJSON('event', new Date(2026, 9, 21, 10)), googleEventId: 'g1', exDates: ['2026-10-01'], recurrence: { freq: 'day' as const, interval: 1, end: { type: 'never' as const } } };
    const r = row(base);
    const second = expandEvent(r, new Date(2026, 9, 22).getTime(), new Date(2026, 9, 23).getTime())[0];
    const next = moveEventJSON(r.rowJSON, second, { dayDelta: 1, minuteDelta: 0 }, true);
    expect(next.recurrence).toBeUndefined();
    expect(next.exDates).toBeUndefined();
    expect(next.googleEventId).toBeUndefined();
    expect(new Date(next.startAt)).toEqual(new Date(2026, 9, 23, 10));
  });
});

describe('drag geometry', () => {
  it('snaps minutes to 15', () => {
    expect(snapMinutes(7)).toBe(0);
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(-40)).toBe(-45);
  });
  it('time grid: columns are days, an hour is hourH pixels', () => {
    expect(timeGridDelta(205, 48, 100, 48)).toEqual({ dayDelta: 2, minuteDelta: 60 });
    expect(timeGridDelta(-60, -12, 100, 48)).toEqual({ dayDelta: -1, minuteDelta: -15 });
  });
  it('month: a row is a week', () => {
    expect(monthDelta(130, 0, 60, 90)).toEqual({ dayDelta: 2, minuteDelta: 0 });
    expect(monthDelta(-60, 95, 60, 90)).toEqual({ dayDelta: 6, minuteDelta: 0 });
  });
});

describe('createDragGesture', () => {
  const make = (needsLongPress: boolean) => {
    const calls: string[] = [];
    const g = createDragGesture({
      needsLongPress,
      onStart: () => calls.push('start'),
      onMove: (dx, dy) => calls.push(`move ${dx},${dy}`),
      onDrop: (dx, dy) => calls.push(`drop ${dx},${dy}`),
      onCancel: () => calls.push('cancel'),
      onTap: () => calls.push('tap'),
    });
    return { g, calls };
  };
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('mouse: a click is a tap', () => {
    const { g, calls } = make(false);
    g.grant(10, 10);
    g.move(12, 11);
    g.release(12, 11);
    expect(calls).toEqual(['tap']);
  });
  it('mouse: moving further than the threshold drags and drops', () => {
    const { g, calls } = make(false);
    g.grant(10, 10);
    g.move(40, 10);
    expect(g.canTerminate()).toBe(false);
    g.release(70, 30);
    expect(calls).toEqual(['start', 'move 30,0', 'drop 60,20']);
  });
  it('touch: a swipe before the long press is a scroll, not a tap or a drag', () => {
    const { g, calls } = make(true);
    g.grant(0, 0);
    g.move(0, 30);
    jest.advanceTimersByTime(DRAG_LONG_PRESS_MS + 10);
    g.release(0, 30);
    expect(calls).toEqual([]);
  });
  it('touch: hold, then drag', () => {
    const { g, calls } = make(true);
    g.grant(0, 0);
    jest.advanceTimersByTime(DRAG_LONG_PRESS_MS + 10);
    g.move(0, 48);
    g.release(0, 48);
    expect(calls).toEqual(['start', 'move 0,48', 'drop 0,48']);
  });
  it('touch: a short touch is a tap', () => {
    const { g, calls } = make(true);
    g.grant(5, 5);
    g.release(5, 5);
    expect(calls).toEqual(['tap']);
  });
  it('terminate cancels a held entry', () => {
    const { g, calls } = make(false);
    g.grant(0, 0);
    g.move(30, 0);
    g.terminate();
    expect(calls).toEqual(['start', 'move 30,0', 'cancel']);
  });
});

describe('createDoubleTap', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const make = () => {
    const calls: string[] = [];
    const t = createDoubleTap<string>((v) => calls.push(`single ${v}`), (v) => calls.push(`double ${v}`), (a, b) => a === b);
    return { t, calls };
  };
  it('one tap is a single tap after the wait', () => {
    const { t, calls } = make();
    t.tap('a');
    expect(calls).toEqual([]);
    jest.advanceTimersByTime(DOUBLE_TAP_MS + 1);
    expect(calls).toEqual(['single a']);
  });
  it('two taps on the same thing are a double tap, no single tap', () => {
    const { t, calls } = make();
    t.tap('a');
    jest.advanceTimersByTime(100);
    t.tap('a');
    jest.advanceTimersByTime(1000);
    expect(calls).toEqual(['double a']);
  });
  it('a tap on another thing flushes the first as a single tap', () => {
    const { t, calls } = make();
    t.tap('a');
    t.tap('b');
    jest.advanceTimersByTime(DOUBLE_TAP_MS + 1);
    expect(calls).toEqual(['single a', 'single b']);
  });
  it('two slow taps are two single taps', () => {
    const { t, calls } = make();
    t.tap('a');
    jest.advanceTimersByTime(DOUBLE_TAP_MS + 1);
    t.tap('a');
    jest.advanceTimersByTime(DOUBLE_TAP_MS + 1);
    expect(calls).toEqual(['single a', 'single a']);
  });
});

describe('openProjectTaskInDashboard', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { openProjectTaskInDashboard } = require('../../../kit8/ui/calendar/projectTaskLink');
  it('goes to the dashboard with the task (Finances / Edit view)', () => {
    const push = jest.fn();
    expect(openProjectTaskInDashboard({ projectGUID: 'p1', projectTaskGUID: 't1' }, { push })).toBe(true);
    expect(push).toHaveBeenCalledWith({ pathname: '/pm/project/dashboard', params: { projectGUID: 'p1', taskGUID: 't1', view: 'finances' } });
  });
  it('does nothing without a project task', () => {
    const push = jest.fn();
    expect(openProjectTaskInDashboard({}, { push })).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
