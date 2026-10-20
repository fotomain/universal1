// Helpers of the reminder tests: calendar rows and a fake OS that records what is scheduled.

import { newEventJSON, UserCalendarEventJSON, UserCalendarEventRow, withEventDates } from '../../../kit8/ui/calendar/data/userCalendarModel';
import type { PlannedReminder, ReminderData, ScheduledReminder } from '../../../kit8/ui/reminder/reminderPlan';
import type { ReminderOs, ReminderPermission } from '../../../kit8/ui/reminder/reminderTypes';

export const OWNER = 'owner-1';

export function row(guid: string, json: Partial<UserCalendarEventJSON> & { start?: Date; end?: Date; title?: string }): UserCalendarEventRow {
  const { start, end, ...rest } = json;
  const kind = rest.kind || 'event';
  const s = start || new Date(2026, 9, 21, 10, 0);
  const base = newEventJSON(kind, s, rest.allDay ?? kind === 'birthday');
  const dated = withEventDates(base, s, end || new Date(s.getTime() + 3600 * 1000), base.allDay);
  return { rowGUID: guid, rowOwnerGUID: OWNER, rowParentGUID: 'empty', orderInList: 0, rowJSON: { ...dated, title: 'Entry ' + guid, ...rest } };
}

export interface FakeOs extends ReminderOs {
  held: Map<string, PlannedReminder>;
  calls: string[];
  permission: ReminderPermission;
  shown: string[];
  tap: ((d: ReminderData) => void) | null;
}

export function fakeOs(permission: ReminderPermission = 'granted', supportsScheduling = true): FakeOs {
  const os: FakeOs = {
    supportsScheduling,
    held: new Map(),
    calls: [],
    permission,
    shown: [],
    tap: null,
    async getPermission() {
      return os.permission;
    },
    async requestPermission() {
      os.calls.push('request');
      os.permission = os.permission === 'undetermined' ? 'granted' : os.permission;
      return os.permission;
    },
    async ensureChannel() {},
    async listScheduled(): Promise<ScheduledReminder[]> {
      return [...os.held.values()].map((r) => ({ identifier: r.identifier, sig: r.data.sig }));
    },
    async schedule(r) {
      os.calls.push('schedule:' + r.key);
      os.held.set(r.identifier, r);
    },
    async cancel(id) {
      os.calls.push('cancel:' + id);
      os.held.delete(id);
    },
    async cancelAll() {
      os.calls.push('cancelAll');
      os.held.clear();
    },
    async showNow(r) {
      os.shown.push(r.identifier);
    },
    async openSettings() {},
    onTap(h) {
      os.tap = h;
      return () => {
        os.tap = null;
      };
    },
  };
  return os;
}
