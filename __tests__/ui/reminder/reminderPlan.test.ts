import { diffPlan, planReminders, REMINDER_ID_PREFIX, REMINDER_PLAN_LIMIT } from '../../../kit8/ui/reminder/reminderPlan';
import { OWNER, row } from './reminderTestKit';

const NOW = new Date(2026, 9, 20, 8, 0).getTime();

describe('planReminders', () => {
  it('plans the reminder of an event at its own time with the key of dueReminders', () => {
    const plan = planReminders([row('e1', { start: new Date(2026, 9, 21, 10, 0) })], OWNER, NOW);
    expect(plan).toHaveLength(1); // default: 30 minutes before
    expect(plan[0].fireMs).toBe(new Date(2026, 9, 21, 9, 30).getTime());
    expect(plan[0].key).toBe('e1:2026-10-21:0');
    expect(plan[0].identifier).toBe(`${REMINDER_ID_PREFIX}${OWNER}:e1:2026-10-21:0`);
    expect(plan[0].title).toBe('Entry e1');
    expect(plan[0].body).toContain('30 minutes before');
    expect(plan[0].data).toMatchObject({ ownerGUID: OWNER, eventGUID: 'e1', date: '2026-10-21' });
  });

  it('all-day entries remind at the time of day', () => {
    const plan = planReminders([row('a1', { allDay: true, start: new Date(2026, 9, 22, 0, 0), notifications: [{ amount: 1, unit: 'days', atTime: '17:00' }] })], OWNER, NOW);
    expect(plan[0].fireMs).toBe(new Date(2026, 9, 21, 17, 0).getTime());
  });

  it('several reminders per entry, nearest first', () => {
    const plan = planReminders(
      [row('e1', { start: new Date(2026, 9, 25, 10, 0), notifications: [{ amount: 1, unit: 'days' }, { amount: 10, unit: 'minutes' }] })],
      OWNER,
      NOW,
    );
    expect(plan.map((p) => p.key)).toEqual(['e1:2026-10-25:0', 'e1:2026-10-25:1']);
    expect(plan[0].fireMs).toBeLessThan(plan[1].fireMs);
  });

  it('skips past reminders, done tasks, entries without reminders and a missing owner', () => {
    const rows = [
      row('past', { start: new Date(2026, 9, 20, 8, 10) }), // 30 min before = 07:40 < now
      row('done', { kind: 'task', done: true, start: new Date(2026, 9, 23, 10, 0), notifications: [{ amount: 5, unit: 'minutes' }] }),
      row('none', { start: new Date(2026, 9, 23, 10, 0), notifications: [] }),
      row('ok', { kind: 'task', done: false, start: new Date(2026, 9, 23, 10, 0), notifications: [{ amount: 5, unit: 'minutes' }] }),
    ];
    expect(planReminders(rows, OWNER, NOW).map((p) => p.data.eventGUID)).toEqual(['ok']);
    expect(planReminders(rows, '', NOW)).toEqual([]);
  });

  it('a done EVENT still reminds (events have no done state)', () => {
    expect(planReminders([row('e', { done: true, start: new Date(2026, 9, 23, 10, 0) })], OWNER, NOW)).toHaveLength(1);
  });

  it('expands a repeating entry and keeps only the nearest 60', () => {
    const daily = row('d', { start: new Date(2026, 9, 21, 9, 0), recurrence: { freq: 'day', interval: 1, end: { type: 'never' } } });
    const plan = planReminders([daily], OWNER, NOW);
    expect(plan).toHaveLength(REMINDER_PLAN_LIMIT);
    expect(plan[0].data.date).toBe('2026-10-21');
    // the wall clock stays the same across a summer-time change (the OS fires at local 08:30 every day)
    expect(plan.every((p) => new Date(p.fireMs).getHours() === 8 && new Date(p.fireMs).getMinutes() === 30)).toBe(true);
    expect(plan[59].data.date).toBe('2026-12-19');
    expect(new Set(plan.map((p) => p.identifier)).size).toBe(60);
  });

  it('a removed occurrence (exDates) does not remind', () => {
    const r = row('x', { start: new Date(2026, 9, 21, 9, 0), recurrence: { freq: 'day', interval: 1, end: { type: 'after', count: 3 } }, exDates: ['2026-10-22'] });
    expect(planReminders([r], OWNER, NOW).map((p) => p.data.date)).toEqual(['2026-10-21', '2026-10-23']);
  });

  it('reminds nothing beyond the horizon', () => {
    expect(planReminders([row('far', { start: new Date(2027, 5, 1, 10, 0) })], OWNER, NOW)).toEqual([]);
  });
});

describe('diffPlan', () => {
  const plan = planReminders([row('e1', { start: new Date(2026, 9, 21, 10, 0) }), row('e2', { start: new Date(2026, 9, 22, 10, 0) })], OWNER, NOW);

  it('nothing changed = no work', () => {
    expect(diffPlan(plan, plan.map((p) => ({ identifier: p.identifier, sig: p.data.sig })))).toEqual({ cancel: [], schedule: [] });
  });

  it('new reminders are scheduled, gone ones cancelled', () => {
    const d = diffPlan(plan, [{ identifier: plan[0].identifier, sig: plan[0].data.sig }, { identifier: `${REMINDER_ID_PREFIX}${OWNER}:old`, sig: 'x' }]);
    expect(d.cancel).toEqual([`${REMINDER_ID_PREFIX}${OWNER}:old`]);
    expect(d.schedule.map((p) => p.key)).toEqual([plan[1].key]);
  });

  it('a moved entry (new fire time) is cancelled and scheduled again', () => {
    const d = diffPlan(plan, plan.map((p) => ({ identifier: p.identifier, sig: 'old' })));
    expect(d.cancel).toHaveLength(2);
    expect(d.schedule).toHaveLength(2);
  });

  it("another user's reminders and unmanaged notifications are handled correctly", () => {
    const d = diffPlan(plan, [{ identifier: `${REMINDER_ID_PREFIX}other-user:e9:2026-10-21:0` }, { identifier: 'reminder-test' }, { identifier: 'something-else' }]);
    expect(d.cancel).toEqual([`${REMINDER_ID_PREFIX}other-user:e9:2026-10-21:0`]); // the test and foreign notifications stay
  });
});
