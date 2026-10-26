// Route visits - how often the signed-in user opened each screen. SQL: PART 41 of kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql.
//   app_route_visits_turnover  rowGUID · rowOwnerGUID = the GUID of the USER · rowParentGUID = the ROUTE ('/catalog/money/account'; a GUID inside the path is written ':id')
//                              · rowJSON { number_of_route_visits, last_visit_at } · ONE row per user and route
//   Written only by the RPC route_visit_register (+1), emptied by route_visits_clear; a user reads and deletes his own rows.
//   Organization switch: organizationTable.rowJSON.numberOfVisitsFunctionalityEnabled - TRUE unless it is stored false (SQL route_visits_enabled).
// Pure (no React, no Supabase): the rules are tested without a screen.
import type { DefRow, ProductTableDef } from '../../product/productModel';

export const ROUTE_VISITS_ROUTE = '/user/visits';
export const NUMBER_OF_VISITS_KEY = 'numberOfVisitsFunctionalityEnabled';
/** how many routes the hamburger menu shows */
export const ROUTE_VISITS_TOP = 5;

export interface RouteVisitJSON {
  number_of_route_visits: number;
  last_visit_at?: string | null;
}

export const ROUTE_VISIT_TABLE: ProductTableDef = {
  table: 'app_route_visits_turnover',
  entity: 'routeVisitReusable',
  itemLabel: 'Route visit',
  catalogOwner: null,
  purpose: 'How often you opened each screen of the app (counted while the organization switch "Number of visits" is on).',
  emptyRowJSON: () => ({ number_of_route_visits: 0 }),
};
export const ROUTE_VISIT_ENTITY = ROUTE_VISIT_TABLE.entity;

/** the switch of the Organization: on unless it is stored false */
export const numberOfVisitsEnabledOf = (organizationJSON?: Record<string, any> | null): boolean => organizationJSON?.[NUMBER_OF_VISITS_KEY] !== false;

const GUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * The route that is counted: no query / hash, no trailing slash, a GUID segment written ':id' (one row per screen, not per record). '' = not counted (the root).
 */
export function normalizeRoute(pathname: string | null | undefined): string {
  const path = String(pathname ?? '').split(/[?#]/)[0].trim();
  const segments = path.split('/').filter(Boolean).map((s) => (GUID_SEGMENT.test(s) ? ':id' : s));
  return segments.length ? `/${segments.join('/')}` : '';
}

/** the number of visits of a row (anything that is not a positive number = 0) */
export const visitCountOf = (r: DefRow<any> | undefined | null): number => {
  const n = Number(r?.rowJSON?.number_of_route_visits);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
export const routeOf = (r: DefRow<any> | undefined | null): string => String(r?.rowParentGUID ?? '');

export interface RouteVisitTopItem { rowGUID: string; route: string; count: number }

/** the `limit` most visited routes: by visits, the bigger first; same visits -> by route */
export function topRouteVisits(rows: DefRow<any>[] | null | undefined, limit: number = ROUTE_VISITS_TOP): RouteVisitTopItem[] {
  return (rows || [])
    .map((r) => ({ rowGUID: r.rowGUID, route: routeOf(r), count: visitCountOf(r) }))
    .filter((x) => x.route && x.count > 0)
    .sort((a, b) => b.count - a.count || a.route.localeCompare(b.route))
    .slice(0, Math.max(0, limit));
}

/** a route that can be opened again (a route with ':id' needs a record) */
export const isOpenableRoute = (route: string): boolean => !!route && !route.includes(':');

/** "2026-10-26 14:05" - the last visit in the local time (anything unreadable is shown as it is) */
export function formatLastVisit(iso: unknown): string {
  const s = String(iso ?? '');
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
