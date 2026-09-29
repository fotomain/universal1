// kit8/pm/taskShare: "Copy task info" text, deep link, and Share (web: Web Share API or copy the link).
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
jest.mock('expo-linking', () => ({
  createURL: (path: string, opts: any) => `https://app.test${path}?${new URLSearchParams(opts?.queryParams || {}).toString()}`,
}));

import * as Clipboard from 'expo-clipboard';
import { usePMStore } from '../../kit8/pm/store';
import { buildDemoData } from '../../kit8/pm/seedDemo';
import { buildTaskInfoText, copyTaskInfo, shareTask, taskShareURL } from '../../kit8/pm/taskShare';

const setClip = Clipboard.setStringAsync as any;
let byName: (n: string) => any;

beforeEach(() => {
  setClip.mockClear();
  let n = 0;
  const guid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const demo = buildDemoData('owner-1', Date.UTC(2026, 8, 28), guid, null);
  const P1 = demo.projects[0].rowGUID;
  const s = usePMStore.getState();
  s.selectProject(null);
  s.setProjects(demo.projects);
  usePMStore.getState().selectProject(P1);
  usePMStore.getState().hydrate(P1, demo.tasks.filter((t: any) => t.projectGUID === P1), demo.deps.filter((d: any) => d.projectGUID === P1));
  byName = (n) => usePMStore.getState().tasks.find((t) => t.rowJSON.name === n);
  delete (navigator as any).share;
});

describe('taskShare', () => {
  it('deep link to the task page carries taskGUID + projectGUID', () => {
    expect(taskShareURL('t1', 'p1')).toBe('https://app.test/pm/project/task?taskGUID=t1&projectGUID=p1');
  });

  it('task info: project, parent path, dates, progress, links, deep link', () => {
    const t = byName('Task 113');
    const text = buildTaskInfoText(t.rowGUID)!;
    expect(text).toContain('Project: ');
    expect(text).toContain('In: Stage 1');
    expect(text).toContain('Task: Task 113');
    expect(text).toMatch(/Start: \d{4}-\d{2}-\d{2}/);
    expect(text).toMatch(/Finish: \d{4}-\d{2}-\d{2}/);
    expect(text).toContain('Predecessors: Task 111 (FS)');
    expect(text).toContain(`Link: https://app.test/pm/project/task?taskGUID=${t.rowGUID}&projectGUID=${t.projectGUID}`);
    expect(buildTaskInfoText('missing')).toBeNull();
  });

  it('copyTaskInfo puts the summary on the clipboard', async () => {
    const t = byName('Task 111');
    expect(await copyTaskInfo(t.rowGUID)).toBe('copied');
    expect(setClip).toHaveBeenCalledWith(buildTaskInfoText(t.rowGUID));
    expect(await copyTaskInfo('missing')).toBe('failed');
  });

  it('shareTask on web: Web Share API when present, otherwise the link is copied', async () => {
    const t = byName('Task 111');
    expect(await shareTask(t.rowGUID)).toBe('copied');
    expect(setClip).toHaveBeenCalledWith(`Task 111\n${taskShareURL(t.rowGUID, t.projectGUID)}`);

    const share = jest.fn(() => Promise.resolve());
    (navigator as any).share = share;
    expect(await shareTask(t.rowGUID)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'Task 111', text: 'Task 111', url: taskShareURL(t.rowGUID, t.projectGUID) });

    (navigator as any).share = jest.fn(() => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })));
    expect(await shareTask(t.rowGUID)).toBe('dismissed');
  });
});
