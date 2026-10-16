// Pure part of ApplicationBottomTabsApp: the tab item, the route of a tab, the active tab, the look of every design system.
// No React here: tested in __tests__/ui/appBottomTabs.test.ts.
import type { DesignSystemType } from '../../../redux/uxuiSlice';

export interface TabItem {
  tabIcon: string;
  tabTitle: string;
  /** expo-router path, with or without the leading slash: 'posts/mediapostcrud' = app/posts/mediapostcrud/index.tsx */
  tabRoute: string;
  params?: Record<string, any>;
}

/** the path to give to router.push: leading slash + query string of the params (empty values are left out) */
export function tabHref(tab: TabItem, extraParams?: Record<string, any>): string {
  const path = '/' + tab.tabRoute.replace(/^\/+/, '').replace(/\/+$/, '');
  const all: Record<string, any> = { ...(extraParams ?? {}), ...(tab.params ?? {}) };
  const entries = Object.entries(all).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return path;
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
  return `${path}?${qs}`;
}

/** the tab is active when the current path IS its route or lies inside it ('/pm/project' is active on '/pm/project/dashboard') */
export function isTabActive(pathname: string | null | undefined, tabRoute: string): boolean {
  const cur = '/' + (pathname ?? '').replace(/^\/+/, '').replace(/\/+$/, '');
  const route = '/' + tabRoute.replace(/^\/+/, '').replace(/\/+$/, '');
  if (route === '/') return cur === '/';
  return cur === route || cur.startsWith(route + '/');
}

/** how the bar looks in a design system: the shape of the active mark, the label size, the bar background */
export interface AppBottomTabsLook {
  /** 'pill' = MD3 indicator behind the icon; 'topLine' = a line on the top edge of the tab; 'none' = only the color */
  indicator: 'pill' | 'topLine' | 'none';
  labelSize: number;
  labelWeight: '400' | '500' | '600';
  /** the bar background: 'surface' = themeColors.surface, 'card' = themeColors.card, 'translucent' = the surface at 92 % */
  background: 'surface' | 'card' | 'translucent';
  /** elevation (shadow) of the bar; 0 = a hairline only */
  elevation: number;
  iconSize: number;
}

export function appBottomTabsLook(system: DesignSystemType | string): AppBottomTabsLook {
  switch (system) {
    case 'applemacui':
      return { indicator: 'none', labelSize: 10, labelWeight: '500', background: 'translucent', elevation: 0, iconSize: 25 };
    case 'googlemd3web':
    case 'paper':
    case 'expo':
      return { indicator: 'pill', labelSize: 12, labelWeight: '500', background: 'surface', elevation: 2, iconSize: 24 };
    case 'ant':
      return { indicator: 'topLine', labelSize: 12, labelWeight: '400', background: 'card', elevation: 0, iconSize: 22 };
    case 'tamagui':
      return { indicator: 'topLine', labelSize: 11, labelWeight: '600', background: 'card', elevation: 1, iconSize: 22 };
    case 'native':
    default:
      return { indicator: 'none', labelSize: 11, labelWeight: '500', background: 'surface', elevation: 0, iconSize: 24 };
  }
}

/** '#rrggbb' + alpha 0..1 -> '#rrggbbaa'; anything else is returned as it is */
export function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0');
  return color + a;
}
