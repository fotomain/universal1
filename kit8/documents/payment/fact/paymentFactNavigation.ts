// paymentFactNavigation - where the user goes after a payment fact was made (the context menu and the list share it).
import { Platform } from 'react-native';
import { PAYMENT_FACT_ROUTE, paymentFactDocumentPath, paymentFactRouteParams, OpenPaymentFactParams } from './paymentFactModel';

/** a route with its params as a query string (a link for a browser tab) */
export const paymentFactLink = (route: string, params: Record<string, string>): string => {
  const q = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return q ? `${route}?${q}` : route;
};

/** web: a blank browser tab opened NOW (inside the click, so a pop-up blocker allows it), pointed at the page later (`sendWindowTo`); null on a phone or when blocked */
export function openBlankWindow(): Window | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try { return window.open('', '_blank') || null; } catch { return null; }
}
/** points a tab opened by openBlankWindow at a page */
export function sendWindowTo(win: Window, path: string): boolean {
  try { win.location.href = path; return true; } catch { return false; }
}

/** open a document: a NEW browser tab on the web (this window when blocked / on a phone) */
export function showPaymentFact(router: { push: (to: any) => void }, params: OpenPaymentFactParams, opts: { newWindow?: boolean; target?: Window | null } = {}): void {
  const routeParams = paymentFactRouteParams(params);
  if (opts.newWindow && Platform.OS === 'web' && typeof window !== 'undefined' && params.documentGUID) {
    const link = paymentFactLink(PAYMENT_FACT_ROUTE, routeParams);
    let shown = opts.target ? sendWindowTo(opts.target, link) : false;
    if (!shown) { try { shown = !!window.open(paymentFactDocumentPath(params.documentGUID), '_blank'); } catch { shown = false; } }
    if (shown) return;
  }
  router.push({ pathname: PAYMENT_FACT_ROUTE, params: routeParams } as any);
}
