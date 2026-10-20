// Logged in only: the hook plans only with a Supabase session and wipes the OS schedule at sign out.

import { act, cleanup, renderHook } from '@testing-library/react-native';
import { fakeOs, OWNER, row } from './reminderTestKit';

const mockOs = fakeOs();
let mockAuthListener: ((event: string, session: unknown) => void) | null = null;
let mockSession: unknown = { user: { id: OWNER } };
let mockRows: any[] = [];
let mockOwner = OWNER;

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../../../kit8/ui/reminder/reminderOs', () => ({ get reminderOs() { return mockOs; } }));
const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: mockSession } }),
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      mockAuthListener = cb;
      return { data: { subscription: { unsubscribe: () => (mockAuthListener = null) } } };
    },
  },
};
jest.mock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockSupabase }) }));
jest.mock('../../../kit8/ui/calendar/data', () => ({
  useUserCalendarOwnerGUID: () => mockOwner,
  useUserCalendarEventsQuery: () => ({ data: mockRows }),
}));

import { useReminderSync } from '../../../kit8/ui/reminder/useReminderSync';
import { useReminderStore } from '../../../kit8/ui/reminder/reminderStore';

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 600));
  });
};

afterEach(async () => {
  await cleanup();
});

beforeEach(() => {
  mockOs.held.clear();
  mockOs.calls.length = 0;
  mockSession = { user: { id: OWNER } };
  mockOwner = OWNER;
  const soon = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  mockRows = [row('e1', { start: soon })];
  useReminderStore.setState({ enabled: true, loaded: true });
});

// Keep the SIGNED_OUT test last: after an act() that fires the auth listener, a later renderHook of this file mounts without its effects.
describe('useReminderSync', () => {
  it('a cold start without a mockSession wipes what an earlier mockSession left', async () => {
    mockOs.held.set('reminder:old:e:1', { identifier: 'reminder:old:e:1' } as any);
    mockSession = null;
    await renderHook(() => useReminderSync());
    await flush();
    expect(mockOs.calls).toContain('cancelAll');
    expect(mockOs.held.size).toBe(0);
  });

  it('schedules the reminders of the signed-in user', async () => {
    await renderHook(() => useReminderSync());
    await flush();
    expect(mockOs.held.size).toBe(1);
    expect(useReminderStore.getState().scheduled).toBe(1);
  });

  it('SIGNED_OUT cancels everything the OS holds, and nothing is scheduled afterwards', async () => {
    const { rerender } = await renderHook(() => useReminderSync());
    await flush();
    expect(mockOs.held.size).toBe(1);
    await act(async () => {
      mockAuthListener?.('SIGNED_OUT', null);
    });
    await flush();
    expect(mockOs.held.size).toBe(0);
    mockRows = [row('e1', { start: new Date(Date.now() + 3 * 24 * 3600 * 1000) })]; // the cache may still hold mockRows: no mockSession = no plan
    rerender({});
    await flush();
    expect(mockOs.held.size).toBe(0);
  });
});
