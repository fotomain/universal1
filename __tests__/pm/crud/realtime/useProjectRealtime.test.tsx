/** @jest-environment jsdom */
// useProjectRealtime: Supabase postgres_changes events -> debounced React Query invalidation
// (-> refetch -> hydrate Zustand). A recording fake channel stands in for supabase-js.
import React, { act } from 'react';

type Handler = (payload: any) => void;
type Listener = { event: string; table: string; filter?: string; handler: Handler };

export const mockRt: { listeners: Listener[]; status?: (s: string) => void; removed: number } = { listeners: [], removed: 0 };
const fakeSupabase = {
  channel: () => {
    const ch: any = {
      on: (_type: string, opts: any, handler: Handler) => {
        mockRt.listeners.push({ event: opts.event, table: opts.table, filter: opts.filter, handler });
        return ch;
      },
      subscribe: (cb: (s: string) => void) => {
        mockRt.status = cb;
        return ch;
      },
    };
    return ch;
  },
  removeChannel: () => {
    mockRt.removed += 1;
  },
};
jest.mock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fakeSupabase }) }));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjectRealtime } from '../../../../kit8/pm/crud/realtime/useProjectRealtime';
import { pmKeys } from '../../../../kit8/pm/crud/shared/queryShared';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

const OWNER = '11111111-1111-1111-1111-111111111111';
const P1 = '22222222-2222-2222-2222-222222222222';

let qc: QueryClient;
let root: any;
let spy: jest.SpyInstance;

function Probe({ projectGUID }: { projectGUID: string | null }) {
  useProjectRealtime(OWNER, projectGUID);
  return null;
}

const invalidated = () => spy.mock.calls.map((c) => JSON.stringify(c[0].queryKey));
const fire = (table: string, event: string, payload: any = {}) =>
  mockRt.listeners.filter((l) => l.table === table && l.event === event).forEach((l) => l.handler(payload));
const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(async () => {
  jest.useFakeTimers();
  mockRt.listeners = [];
  mockRt.removed = 0;
  qc = new QueryClient();
  qc.setQueryData(pmKeys.projects(OWNER), [{ rowGUID: P1 }]);
  qc.setQueryData(pmKeys.projectData(P1), { tasks: [{ rowGUID: 't1' }], deps: [] });
  qc.setQueryData(pmKeys.userSettings(OWNER), { rows: [{ rowGUID: 's1' }], missing: false });
  spy = jest.spyOn(qc, 'invalidateQueries');
  root = createRoot(document.createElement('div'));
  await act(async () => {
    root.render(
      <QueryClientProvider client={qc}>
        <Probe projectGUID={P1} />
      </QueryClientProvider>
    );
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  jest.useRealTimers();
});

it('subscribes INSERT / UPDATE with server filters and DELETE unfiltered on the 4 PM tables', () => {
  const byTable = (t: string) => mockRt.listeners.filter((l) => l.table === t).map((l) => `${l.event}:${l.filter ?? '-'}`);
  expect(byTable('project_table')).toEqual([`INSERT:rowOwnerGUID=eq.${OWNER}`, `UPDATE:rowOwnerGUID=eq.${OWNER}`, 'DELETE:-']);
  expect(byTable('project_task_table')).toEqual([`INSERT:projectGUID=eq.${P1}`, `UPDATE:projectGUID=eq.${P1}`, 'DELETE:-']);
  expect(byTable('project_task_dependencies_table')).toEqual([`INSERT:projectGUID=eq.${P1}`, `UPDATE:projectGUID=eq.${P1}`, 'DELETE:-']);
  expect(byTable('project_user_settings_table')).toEqual([`INSERT:rowParentGUID=eq.${OWNER}`, `UPDATE:rowParentGUID=eq.${OWNER}`, 'DELETE:-']);
});

it('a task edit in another browser refetches project data, projects and closure (debounced, once)', async () => {
  fire('project_task_table', 'UPDATE');
  fire('project_task_table', 'UPDATE');
  fire('project_task_dependencies_table', 'INSERT');
  expect(spy).not.toHaveBeenCalled();
  await tick(400);
  const keys = invalidated();
  expect(keys).toContain(JSON.stringify(pmKeys.projectData(P1)));
  expect(keys).toContain(JSON.stringify(pmKeys.projects(OWNER)));
  expect(keys).toContain(JSON.stringify(['pm', 'closure']));
  expect(keys).not.toContain(JSON.stringify(pmKeys.userSettings(OWNER)));
  expect(keys.filter((k) => k === JSON.stringify(pmKeys.projectData(P1)))).toHaveLength(1);
});

it('a settings change refetches only the user settings', async () => {
  fire('project_user_settings_table', 'UPDATE');
  await tick(400);
  expect(invalidated()).toEqual([JSON.stringify(pmKeys.userSettings(OWNER))]);
});

it('DELETE: only rows this client shows trigger a refetch', async () => {
  fire('project_task_table', 'DELETE', { old: { rowGUID: 'other-project-task' } });
  await tick(400);
  expect(spy).not.toHaveBeenCalled();
  fire('project_task_table', 'DELETE', { old: { rowGUID: 't1' } });
  await tick(400);
  expect(invalidated()).toContain(JSON.stringify(pmKeys.projectData(P1)));
});

it('waits while one of our own mutations is in flight', async () => {
  const busy = jest.spyOn(qc, 'isMutating').mockReturnValue(1);
  fire('project_task_table', 'UPDATE');
  await tick(2000);
  expect(spy).not.toHaveBeenCalled();
  busy.mockReturnValue(0);
  await tick(500);
  expect(invalidated()).toContain(JSON.stringify(pmKeys.projectData(P1)));
});

it('refetches everything after a reconnect, not on the first subscribe', async () => {
  mockRt.status!('SUBSCRIBED');
  await tick(400);
  expect(spy).not.toHaveBeenCalled();
  mockRt.status!('CHANNEL_ERROR');
  mockRt.status!('SUBSCRIBED');
  await tick(400);
  const keys = invalidated();
  expect(keys).toContain(JSON.stringify(pmKeys.projectData(P1)));
  expect(keys).toContain(JSON.stringify(pmKeys.userSettings(OWNER)));
});

it('removes the channel on unmount', async () => {
  await act(async () => root.unmount());
  root = { unmount: () => undefined };
  expect(mockRt.removed).toBe(1);
});
