// customerInvoiceNavigation - where the user goes after customer invoices were created (the choice window and the context menu share it).
import { Platform } from 'react-native';
import { CUSTOMER_INVOICE_ROUTE, customerInvoiceDocumentPath, customerInvoiceRouteParams } from './customerInvoiceModel';

/** a route with its params as a query string (a link for a browser tab) */
export const customerInvoiceLink = (route: string, params: Record<string, string>): string => {
  const q = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return q ? `${route}?${q}` : route;
};

/**
 * web: a blank browser tab opened NOW - call it synchronously inside the click, so a pop-up blocker allows it - and pointed at the page later (`sendWindowTo`) when the document is known.
 * null on a phone, outside a browser, or when the browser blocked it (the caller then uses the router in the same window).
 */
export function openBlankWindow(): Window | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try { return window.open('', '_blank') || null; } catch { return null; }
}
/** points a tab opened by openBlankWindow at a page */
export function sendWindowTo(win: Window, path: string): boolean {
  try { win.location.href = path; return true; } catch { return false; }
}

/**
 * Show the documents just created: the form (a tab for each document) and, on the web, a browser tab of its own for every document after the first (best effort: a browser may block pop-ups after an
 * async call - the form has a tab for each document anyway). The choice window REPLACES itself, the context menu PUSHES.
 */
export function showCreatedCustomerInvoices(router: { push: (to: any) => void; replace: (to: any) => void }, ctx: { taskGUID: string; projectGUID?: string | null }, guids: string[], how: 'push' | 'replace', opts: { newWindow?: boolean; target?: Window | null } = {}): void {
  if (!guids.length) return;
  const params = customerInvoiceRouteParams({ taskGUID: ctx.taskGUID, projectGUID: ctx.projectGUID, documentGUID: guids[0], documents: guids });
  // the context menu: the first document in a NEW browser tab (the one opened inside the click, or a new one; blocked = this window), the others in tabs of their own
  if (opts.newWindow && Platform.OS === 'web' && typeof window !== 'undefined') {
    const link = customerInvoiceLink(CUSTOMER_INVOICE_ROUTE, params);
    let shown = opts.target ? sendWindowTo(opts.target, link) : false;
    if (!shown) { try { shown = !!window.open(link, '_blank'); } catch { shown = false; } }
    if (shown) {
      guids.slice(1).forEach((g) => { try { window.open(customerInvoiceDocumentPath(g), '_blank'); } catch { /* the tab strip of the form is the fallback */ } });
      return;
    }
  }
  if (Platform.OS === 'web' && guids.length > 1 && typeof window !== 'undefined') guids.slice(1).forEach((g) => { try { window.open(customerInvoiceDocumentPath(g), '_blank'); } catch { /* the tab strip of the form is the fallback */ } });
  router[how]({ pathname: CUSTOMER_INVOICE_ROUTE, params } as any);
}
