// kit8/pm/view/task/taskGoogleCalendar: "Add to Google Calendar" URL of a task.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-linking', () => ({
  createURL: (path: string, opts: any) => `https://app.test${path}?${new URLSearchParams(opts?.queryParams || {}).toString()}`,
}));

import { usePMStore } from '../../../../kit8/pm/store/store_pm';
import { buildDemoData } from '../../../../kit8/pm/model/seedDemo';
import { taskGoogleCalendarURL } from '../../../../kit8/pm/view/task/taskGoogleCalendar';

let byName: (n: string) => any;
beforeEach(() => {
  let n = 0;
  const guid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const demo = buildDemoData('owner-1', Date.UTC(2026, 8, 28), guid, null);
  const P1 = demo.projects[0].rowGUID;
  usePMStore.getState().selectProject(null);
  usePMStore.getState().setProjects(demo.projects);
  usePMStore.getState().selectProject(P1);
  usePMStore.getState().hydrate(P1, demo.tasks.filter((t: any) => t.projectGUID === P1), demo.deps.filter((d: any) => d.projectGUID === P1));
  byName = (name) => usePMStore.getState().tasks.find((t) => t.rowJSON.name === name);
});

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

describe('taskGoogleCalendarURL', () => {
  it('all-day event: task name, start / exclusive end day, details with the deep link', () => {
    const t = byName('Task 113');
    const r = usePMStore.getState().schedule[t.rowGUID];
    const url = new URL(taskGoogleCalendarURL(t.rowGUID)!);
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toContain('Task 113');
    expect(url.searchParams.get('dates')).toBe(`${day(r.startMs)}/${day(r.finishMs)}`);
    expect(url.searchParams.get('details')).toContain('/pm/project/task?taskGUID=');
  });

  it('a milestone is one day; sub-day plans give a timed event; unknown rows give null', () => {
    const s = usePMStore.getState();
    const ms = s.tasks.find((t) => s.schedule[t.rowGUID]?.isMilestone);
    if (ms) {
      const r = s.schedule[ms.rowGUID];
      expect(new URL(taskGoogleCalendarURL(ms.rowGUID)!).searchParams.get('dates')).toBe(`${day(r.startMs)}/${day(r.startMs + 86400000)}`);
    }
    const t = byName('Task 113');
    const timed = new URL(taskGoogleCalendarURL(t.rowGUID, { ...s, planHour: true })!).searchParams.get('dates')!;
    expect(timed).toMatch(/^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/);
    expect(taskGoogleCalendarURL('nope')).toBeNull();
  });
});
