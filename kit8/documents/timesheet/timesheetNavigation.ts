// timesheetNavigation - where the user goes after "Create based on → Time sheet": on the web a NEW browser tab (opened inside the click), on a phone this app. The blank-window helpers are the ones of the vendor invoice.
import { Platform } from 'react-native';
import { TIMESHEET_ROUTE, timesheetRouteParams } from './timesheetModel';
export { openBlankWindow, sendWindowTo } from '../vendor/invoice/vendorInvoiceNavigation';

/** a route with its params as a query string (a link for a browser tab) */
export const timesheetLink = (route: string, params: Record<string, string>): string => {
  const q = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return q ? `${route}?${q}` : route;
};

/** Show the time sheet just created: `target` = a tab opened inside the click, pointed at the page now; a blocked tab = this window */
export function showCreatedTimesheet(
  router: { push: (to: any) => void },
  guid: string,
  opts: { newWindow?: boolean; target?: Window | null; sendWindowTo?: (win: Window, path: string) => boolean } = {},
): void {
  if (!guid) return;
  const params = timesheetRouteParams(guid);
  if (opts.newWindow && Platform.OS === 'web' && typeof window !== 'undefined') {
    const link = timesheetLink(TIMESHEET_ROUTE, params);
    let shown = false;
    if (opts.target && opts.sendWindowTo) shown = opts.sendWindowTo(opts.target, link);
    if (!shown) { try { shown = !!window.open(link, '_blank'); } catch { shown = false; } }
    if (shown) return;
  }
  router.push({ pathname: TIMESHEET_ROUTE, params } as any);
}
