// The extra items of the main FAB (FABAppComponent) that an app adds - see providers/AppCustomizationProvider. Pure: no React.
import type { AppFabAction } from '../../../providers/AppCustomizationProvider';

/** '/home', '/home/', '/home?x=1' -> '/home' */
export function normalizeRoute(pathname: string | null | undefined): string {
  return String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
}

export function routeMatches(routes: string[] | '*', pathname: string | null | undefined): boolean {
  if (routes === '*') return true;
  const p = normalizeRoute(pathname);
  return routes.some((r) => normalizeRoute(r) === p);
}

/** the extra items that belong to this route */
export function fabExtrasForRoute(extras: AppFabAction[] | undefined, pathname: string | null | undefined): AppFabAction[] {
  return (extras || []).filter((e) => routeMatches(e.routes, pathname));
}

/**
 * The list of the FAB: the items it has anyway (`base`: its own commands of the open screen, else its defaults) and the app's extras.
 * The extras stand NEAREST the button, under the base items:
 *   default animation (a column, the first item on top, the last next to the button)  ->  [...base, ...extras]
 *   reanimated animation (stacked upward, the first item next to the button)          ->  [...extras reversed, ...base]
 * `extras` are written top to bottom as the user sees them. An extra whose label is already in the base is not added twice.
 */
export function mergeFabActions<T extends { label: string }>(base: T[], extras: T[], reanimated: boolean): T[] {
  const have = new Set(base.map((b) => b.label));
  const add = extras.filter((e) => !have.has(e.label));
  if (add.length === 0) return base;
  return reanimated ? [...[...add].reverse(), ...base] : [...base, ...add];
}
