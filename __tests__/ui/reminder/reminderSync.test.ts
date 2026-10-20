import { sendTestReminder, syncReminders, wipeReminders } from '../../../kit8/ui/reminder/reminderSync';
import { fakeOs, OWNER, row } from './reminderTestKit';

const NOW = new Date(2026, 9, 20, 8, 0).getTime();
const rows = [row('e1', { start: new Date(2026, 9, 21, 10, 0) }), row('e2', { start: new Date(2026, 9, 22, 10, 0) })];

describe('syncReminders', () => {
  it('schedules the plan once and a second run does nothing (idempotent)', async () => {
    const os = fakeOs();
    const s = await syncReminders(os, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    expect(s).toMatchObject({ permission: 'granted', scheduled: 2, error: null });
    expect(s.nextFireMs).toBe(new Date(2026, 9, 21, 9, 30).getTime());
    expect(os.held.size).toBe(2);
    os.calls.length = 0;
    await syncReminders(os, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    expect(os.calls).toEqual([]);
  });

  it('a deleted entry is cancelled, a moved one replaced', async () => {
    const os = fakeOs();
    await syncReminders(os, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    os.calls.length = 0;
    await syncReminders(os, { rows: [row('e1', { start: new Date(2026, 9, 21, 11, 0) })], ownerGUID: OWNER, enabled: true, nowMs: NOW });
    expect(os.calls.sort()).toEqual([expect.stringMatching(/^cancel:.*e1/), expect.stringMatching(/^cancel:.*e2/), 'schedule:e1:2026-10-21:0'].sort());
    expect([...os.held.values()].map((r) => r.data.eventGUID)).toEqual(['e1']);
  });

  it('the switch off cancels everything', async () => {
    const os = fakeOs();
    await syncReminders(os, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    const s = await syncReminders(os, { rows, ownerGUID: OWNER, enabled: false, nowMs: NOW });
    expect(os.held.size).toBe(0);
    expect(s.scheduled).toBe(0);
  });

  it('asks the OS for permission once when there is a reminder; denied = nothing scheduled', async () => {
    const os = fakeOs('undetermined');
    await syncReminders(os, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    expect(os.calls.filter((c) => c === 'request')).toHaveLength(1);
    const denied = fakeOs('denied');
    const s = await syncReminders(denied, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    expect(s.permission).toBe('denied');
    expect(denied.held.size).toBe(0);
    expect(denied.calls).not.toContain('request');
  });

  it('does not ask for permission when no reminder is planned', async () => {
    const os = fakeOs('undetermined');
    await syncReminders(os, { rows: [], ownerGUID: OWNER, enabled: true, nowMs: NOW });
    expect(os.calls).toEqual([]);
  });

  it('logged in only: nobody signed in = nothing planned; another user replaces the plan', async () => {
    const os = fakeOs();
    await syncReminders(os, { rows, ownerGUID: '', enabled: true, nowMs: NOW });
    expect(os.held.size).toBe(0);
    await syncReminders(os, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    expect(os.held.size).toBe(2);
    await syncReminders(os, { rows: [], ownerGUID: 'owner-2', enabled: true, nowMs: NOW }); // user B signs in on the same phone
    expect(os.held.size).toBe(0);
  });

  it('wipeReminders (sign out) cancels all, also the test notification', async () => {
    const os = fakeOs();
    await syncReminders(os, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    await sendTestReminder(os, OWNER, NOW);
    expect(os.held.has('reminder-test')).toBe(true);
    await wipeReminders(os);
    expect(os.held.size).toBe(0);
  });

  it('web: no scheduling, only the permission is reported', async () => {
    const os = fakeOs('granted', false);
    const s = await syncReminders(os, { rows, ownerGUID: OWNER, enabled: true, nowMs: NOW });
    expect(s).toMatchObject({ permission: 'granted', scheduled: 0 });
    expect(os.calls).toEqual([]);
  });
});

describe('sendTestReminder', () => {
  it('phone: the OS holds a test notification 10 seconds ahead', async () => {
    const os = fakeOs();
    await sendTestReminder(os, OWNER, NOW);
    expect(os.held.get('reminder-test')?.fireMs).toBe(NOW + 10000);
  });

  it('web: shown after the delay', async () => {
    jest.useFakeTimers();
    const os = fakeOs('granted', false);
    await sendTestReminder(os, OWNER, NOW, 10);
    expect(os.shown).toEqual([]);
    jest.advanceTimersByTime(10000);
    expect(os.shown).toEqual(['reminder-test']);
    jest.useRealTimers();
  });
});
