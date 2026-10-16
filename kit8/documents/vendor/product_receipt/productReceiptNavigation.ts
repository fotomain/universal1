// productReceiptNavigation - where the user goes after a product receipt was made from a purchase order ("Create based on → Product receipt"). The blank-window helpers are the ones of the vendor invoice.
import { Platform } from 'react-native';
import { PRODUCT_RECEIPT_ROUTE, productReceiptRouteParams } from './productReceiptModel';
export { openBlankWindow, sendWindowTo } from '../invoice/vendorInvoiceNavigation';

/** a route with its params as a query string (a link for a browser tab) */
export const productReceiptLink = (route: string, params: Record<string, string>): string => {
  const q = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return q ? `${route}?${q}` : route;
};

/**
 * Show the product receipt just created: on the web in a NEW browser tab (`target` = a tab opened inside the click, pointed at the page now; a blocked tab = this window), on a phone in this app.
 */
export function showCreatedProductReceipt(
  router: { push: (to: any) => void },
  guid: string,
  opts: { newWindow?: boolean; target?: Window | null; sendWindowTo?: (win: Window, path: string) => boolean } = {},
): void {
  if (!guid) return;
  const params = productReceiptRouteParams({ documentGUID: guid });
  if (opts.newWindow && Platform.OS === 'web' && typeof window !== 'undefined') {
    const link = productReceiptLink(PRODUCT_RECEIPT_ROUTE, params);
    let shown = false;
    if (opts.target && opts.sendWindowTo) shown = opts.sendWindowTo(opts.target, link);
    if (!shown) { try { shown = !!window.open(link, '_blank'); } catch { shown = false; } }
    if (shown) return;
  }
  router.push({ pathname: PRODUCT_RECEIPT_ROUTE, params } as any);
}
