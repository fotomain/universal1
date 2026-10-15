// dashboardDeepLink - a link INTO the project dashboard: /pm/project/dashboard?projectGUID=…&taskGUID=…&view=finances&genus=…&lineGUID=…
//   the dashboard selects the project, switches to the Finances view ("Edit"), selects the task (the tree scrolls to it), opens the genus tab and marks the line.
//   Used by the source windows (SumExplorerListReusable of Monitor01): a click / touch on a transaction opens its task line, on the web in a NEW browser tab.
// Pure (tested): the path, the parsing of the route params, the place the Finances view starts at. `openDashboardLink` is the only function with a side effect.
import { Platform } from 'react-native';

export const DASHBOARD_ROUTE = '/pm/project/dashboard';

export interface DashboardLink {
  projectGUID: string;
  taskGUID: string;
  /** the Finances tab = managementGenusTable.rowGUID of the line */
  genus?: string;
  /** task_line_table.rowGUID: marked in its tab */
  lineGUID?: string;
}

const clean = (v: unknown, max = 80): string | undefined => {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === 'string' && t.trim() && t.length <= max ? t.trim() : undefined;
};

/** the query of the link (only what is given) */
export function dashboardLinkQuery(link: DashboardLink): string {
  const q: [string, string | undefined][] = [['projectGUID', link.projectGUID], ['taskGUID', link.taskGUID], ['view', 'finances'], ['genus', link.genus], ['lineGUID', link.lineGUID]];
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
  return { projectGUID, taskGUID, ...(genus ? { genus } : {}), ...(lineGUID ? { lineGUID } : {}), key: dashboardLinkQuery({ projectGUID, taskGUID, genus, lineGUID }) };
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
  router.push({ pathname: DASHBOARD_ROUTE, params: { projectGUID: link.projectGUID, taskGUID: link.taskGUID, view: 'finances', ...(link.genus ? { genus: link.genus } : {}), ...(link.lineGUID ? { lineGUID: link.lineGUID } : {}) } } as any);
}
