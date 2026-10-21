// dashboardDeepLink - a link INTO the project dashboard: /pm/project/dashboard?projectGUID=…&taskGUID=…&view=finances&genus=…&lineGUID=…
//   the dashboard selects the project, switches to the Finances view ("Edit"), selects the task (the tree scrolls to it), opens the genus tab and marks the line.
//   view=budgets&tab=TabPlanTimeline&lineGUID=… : the BUDGETS view of the task (the posted days: the tabs Time / Material / Expenses / All / Timeline) on that tab, FILTERED to the task line
//   (menu "Go to > Timeline data" of a line, kit8/pm/view/task/useTaskRelatedMenu.ts).
//   Used by the source windows (SumExplorerListReusable of Monitor01): a click / touch on a transaction opens its task line, on the web in a NEW browser tab.
// Pure (tested): the path, the parsing of the route params, the place the Finances view starts at. `openDashboardLink` is the only function with a side effect.
import { Platform } from 'react-native';

export const DASHBOARD_ROUTE = '/pm/project/dashboard';

/** the tab of the Budgets view that shows the posted days day by day (PLAN_BUDGET_TABS of view/task/plan) */
export const BUDGETS_TIMELINE_TAB = 'TabPlanTimeline';

/** the main view a link opens: Finances ("Edit", the default) or Budgets (the posted days) */
export type DashboardLinkView = 'finances' | 'budgets';

export interface DashboardLink {
  projectGUID: string;
  taskGUID: string;
  /** 'budgets' = the Budgets view (default 'finances') */
  view?: DashboardLinkView;
  /** the Budgets view: the tab (TabPlanTime | TabPlanMaterial | TabPlanExpencies | TabPlanAll | TabPlanTimeline) */
  tab?: string;
  /** the Finances tab = managementGenusTable.rowGUID of the line */
  genus?: string;
  /** task_line_table.rowGUID: marked in its tab (Finances) / the only line shown (Budgets) */
  lineGUID?: string;
}

const clean = (v: unknown, max = 80): string | undefined => {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === 'string' && t.trim() && t.length <= max ? t.trim() : undefined;
};

/** the query of the link (only what is given) */
export function dashboardLinkQuery(link: DashboardLink): string {
  const budgets = link.view === 'budgets';
  const q: [string, string | undefined][] = [['projectGUID', link.projectGUID], ['taskGUID', link.taskGUID], ['view', budgets ? 'budgets' : 'finances'], ['genus', link.genus], ['tab', budgets ? link.tab : undefined], ['lineGUID', link.lineGUID]];
  return q.filter(([, v]) => !!v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
}
export const dashboardLinkPath = (link: DashboardLink): string => `${DASHBOARD_ROUTE}?${dashboardLinkQuery(link)}`;

/** the route params -> a link, or null when they are not a deep link (a plain visit of the dashboard) */
export function parseDashboardLink(params: Record<string, unknown> | null | undefined): (DashboardLink & { key: string }) | null {
  const projectGUID = clean(params?.projectGUID, 64);
  const taskGUID = clean(params?.taskGUID, 64);
  if (!projectGUID || !taskGUID) return null;
  const genus = clean(params?.genus);
  const lineGUID = clean(params?.lineGUID, 64);
  const budgets = clean(params?.view, 16) === 'budgets';
  const tab = budgets ? clean(params?.tab, 40) : undefined;
  return {
    projectGUID, taskGUID, ...(budgets ? { view: 'budgets' as const } : {}), ...(tab ? { tab } : {}), ...(genus ? { genus } : {}), ...(lineGUID ? { lineGUID } : {}),
    key: dashboardLinkQuery({ projectGUID, taskGUID, view: budgets ? 'budgets' : 'finances', tab, genus, lineGUID }),
  };
}

// ---- a link to a PROJECT only (no task): /pm/project/dashboard?projectGUID=… - the dashboard selects the project (menu "Go to → Subproject", "Create based on this → Subproject") ----
export const dashboardProjectPath = (projectGUID: string): string => `${DASHBOARD_ROUTE}?projectGUID=${encodeURIComponent(projectGUID)}`;
/** the project of a link that has NO taskGUID (a link with a task is parseDashboardLink's); null otherwise */
export function parseDashboardProjectLink(params: Record<string, unknown> | null | undefined): string | null {
  if (clean(params?.taskGUID, 64)) return null;
  return clean(params?.projectGUID, 64) ?? null;
}
/** the project's board in a browser tab of its own (web) or in this app (iOS / Android). `target` = a tab opened by the click (openBlankWindow) and pointed at the board now */
export function openProjectBoard(projectGUID: string, router: { push: (to: any) => void }, target?: Window | null): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      if (target) { target.location.href = dashboardProjectPath(projectGUID); return; }
      if (window.open(dashboardProjectPath(projectGUID), '_blank')) return;
    } catch {
      // the browser blocked the new tab: the same window below
    }
  }
  router.push({ pathname: DASHBOARD_ROUTE, params: { projectGUID } } as any);
}

/** web: a browser tab of its own; iOS / Android: the dashboard route in this app (its params are applied by useDashboardDeepLink) */
export function openDashboardLink(link: DashboardLink, router: { push: (to: any) => void }): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const tab = window.open(dashboardLinkPath(link), '_blank');
      if (tab) return;
    } catch {
      // the browser blocked the new tab: the same window below
    }
  }
  router.push({ pathname: DASHBOARD_ROUTE, params: { projectGUID: link.projectGUID, taskGUID: link.taskGUID, view: link.view === 'budgets' ? 'budgets' : 'finances', ...(link.view === 'budgets' && link.tab ? { tab: link.tab } : {}), ...(link.genus ? { genus: link.genus } : {}), ...(link.lineGUID ? { lineGUID: link.lineGUID } : {}) } } as any);
}
