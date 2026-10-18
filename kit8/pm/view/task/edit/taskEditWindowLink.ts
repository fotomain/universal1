// taskEditWindowLink - a link to the task window: /pm/project/task/edit?taskGUID=…&projectGUID=…&tab=TabTaskEditMain | TabTaskEditPlan
//   The window (PMTaskEditWindow) has two 1st level tabs: TabTaskEditMain (the task form of PMTaskEditModal) and TabTaskEditPlan (PMTaskEditView: the lines of the task).
//   A double click on a task of the Gantt chart opens it in a NEW browser window (web) or in this app (iOS / Android).
// Pure (tested) except `openTaskEditWindow`.
import { Platform } from 'react-native';

export const TASK_EDIT_ROUTE = '/pm/project/task/edit';

export const TASK_EDIT_WINDOW_TABS = ['TabTaskEditMain', 'TabTaskEditPlan'] as const;
export type TaskEditWindowTab = (typeof TASK_EDIT_WINDOW_TABS)[number];
export const DEFAULT_TASK_EDIT_WINDOW_TAB: TaskEditWindowTab = 'TabTaskEditMain';

export interface TaskEditWindowLink {
  taskGUID: string;
  projectGUID?: string | null;
  tab?: TaskEditWindowTab;
}

const clean = (v: unknown, max = 64): string | undefined => {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === 'string' && t.trim() && t.length <= max ? t.trim() : undefined;
};

export const isTaskEditWindowTab = (v: unknown): v is TaskEditWindowTab => (TASK_EDIT_WINDOW_TABS as readonly unknown[]).includes(v);

/** the route params of a link (only what is given; the Main tab is the default and is not written) */
export function taskEditWindowParams(link: TaskEditWindowLink): Record<string, string> {
  return {
    taskGUID: link.taskGUID,
    ...(link.projectGUID ? { projectGUID: link.projectGUID } : {}),
    ...(link.tab && link.tab !== DEFAULT_TASK_EDIT_WINDOW_TAB ? { tab: link.tab } : {}),
  };
}

export function taskEditWindowPath(link: TaskEditWindowLink): string {
  const q = Object.entries(taskEditWindowParams(link)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `${TASK_EDIT_ROUTE}?${q}`;
}

/** the route params -> the window's input; taskGUID '' when the link has none; an unknown tab = the Main tab */
export function parseTaskEditWindowParams(params: Record<string, unknown> | null | undefined): { taskGUID: string; projectGUID?: string; tab: TaskEditWindowTab } {
  const projectGUID = clean(params?.projectGUID);
  const tab = Array.isArray(params?.tab) ? params?.tab[0] : params?.tab;
  return { taskGUID: clean(params?.taskGUID) ?? '', ...(projectGUID ? { projectGUID } : {}), tab: isTaskEditWindowTab(tab) ? tab : DEFAULT_TASK_EDIT_WINDOW_TAB };
}

/** web: a new browser window (a blocked pop-up = this window); iOS / Android: the route in this app */
export function openTaskEditWindow(link: TaskEditWindowLink, router: { push: (to: any) => void }): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      if (window.open(taskEditWindowPath(link), '_blank')) return;
    } catch {
      // the browser blocked the new window: the same window below
    }
  }
  router.push({ pathname: TASK_EDIT_ROUTE, params: taskEditWindowParams(link) } as any);
}
