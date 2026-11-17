// businessOrderModel - the user's setup of the "Business order" of the PM80 home (pure, tested).
//   settings = the steps in the order the USER wants, each with a check box "show"; a step that is not shown keeps its place in the
//   user's order (hiding is not deleting: the user's order is worth keeping while the step is hidden). The NAMES cannot be changed,
//   steps are never made or deleted: the set of steps is the one of PM80_STAGES.
//
//   where it is stored (rowJSON.businessOrderSettings):
//     ONE project selected          -> that project
//     SOME projects selected        -> each of them
//     ALL projects (no filter)      -> the organization AND each project
//   what the home shows for a selection:
//     ONE project  -> its settings, else the organization's, else the defaults
//     all / some   -> the organization's, else the defaults
import type { PM80MonthSnapshot, PM80SatelliteNode } from '../pm80HomeModel';
import { PM80_STAGES } from '../pm80HomeModel';

/** the key in rowJSON of the organization and of a project */
export const BUSINESS_ORDER_KEY = 'businessOrderSettings';

export interface BusinessOrderItem {
  /** id of a step (PM80_STAGES) */
  id: string;
  /** shown on the home */
  visible: boolean;
}

export interface BusinessOrderSettings {
  items: BusinessOrderItem[];
}

/** the circles take these places in the order they come (reading order of the home) */
const POSITIONS: PM80SatelliteNode['position'][] = [
  'top-left', 'top-right', 'mid-left', 'mid-right', 'lower-left', 'lower-right', 'bottom-left', 'bottom-right',
];

export const STAGE_IDS: string[] = PM80_STAGES.map((s) => s.id);

/** the default setup: all steps, in the business order of the app, all shown */
export function defaultBusinessOrder(): BusinessOrderSettings {
  return { items: PM80_STAGES.map((s) => ({ id: s.id, visible: true })) };
}

/**
 * What was stored, made safe: unknown steps are dropped, a step that is stored twice counts once, a step that is missing (a newer
 * version of the app has more steps) is appended, shown. Anything that is not a settings object = the defaults.
 */
export function normalizeBusinessOrder(stored: unknown): BusinessOrderSettings {
  const raw = (stored as any)?.items;
  if (!Array.isArray(raw)) return defaultBusinessOrder();
  const seen = new Set<string>();
  const items: BusinessOrderItem[] = [];
  raw.forEach((it: any) => {
    const id = typeof it?.id === 'string' ? it.id : '';
    if (!STAGE_IDS.includes(id) || seen.has(id)) return;
    seen.add(id);
    items.push({ id, visible: it?.visible !== false });
  });
  STAGE_IDS.forEach((id) => {
    if (!seen.has(id)) items.push({ id, visible: true });
  });
  return { items };
}

/** the settings stored in a rowJSON (organization or project), null when nothing valid is stored */
export function storedBusinessOrder(rowJSON: unknown): BusinessOrderSettings | null {
  const v = (rowJSON as any)?.[BUSINESS_ORDER_KEY];
  return v && typeof v === 'object' && Array.isArray(v.items) ? normalizeBusinessOrder(v) : null;
}

export const isDefaultBusinessOrder = (s: BusinessOrderSettings): boolean => {
  const d = defaultBusinessOrder();
  const n = normalizeBusinessOrder(s);
  return n.items.every((it, i) => it.id === d.items[i].id && it.visible);
};

export const businessOrderEquals = (a: BusinessOrderSettings, b: BusinessOrderSettings): boolean => {
  const x = normalizeBusinessOrder(a).items;
  const y = normalizeBusinessOrder(b).items;
  return x.length === y.length && x.every((it, i) => it.id === y[i].id && it.visible === y[i].visible);
};

/** a check box of a step */
export const setBusinessOrderVisible = (s: BusinessOrderSettings, id: string, visible: boolean): BusinessOrderSettings => ({
  items: s.items.map((it) => (it.id === id ? { ...it, visible } : it)),
});

/** a new order of the steps (ids from top to bottom); the check boxes stay with their steps */
export function reorderBusinessOrder(s: BusinessOrderSettings, orderedIds: string[]): BusinessOrderSettings {
  const byId = new Map(s.items.map((it) => [it.id, it]));
  const next: BusinessOrderItem[] = [];
  orderedIds.forEach((id) => {
    const it = byId.get(id);
    if (it) {
      next.push(it);
      byId.delete(id);
    }
  });
  byId.forEach((it) => next.push(it)); // an id the list did not carry keeps its place at the end
  return { items: next };
}

/** at least one step must be shown (an empty home makes no sense) */
export const businessOrderShownCount = (s: BusinessOrderSettings): number => s.items.filter((it) => it.visible).length;

/**
 * The home for these settings: the SHOWN steps in the user's order, numbered 1..n, on the places of the home in the order they come.
 * The numbers of the money do not change (they belong to a step, not to a place).
 */
export function applyBusinessOrder(snapshot: PM80MonthSnapshot, settings: BusinessOrderSettings): PM80MonthSnapshot {
  const byId = new Map(snapshot.satellites.map((n) => [n.id, n]));
  const shown = normalizeBusinessOrder(settings).items.filter((it) => it.visible);
  const satellites = shown
    .map((it) => byId.get(it.id))
    .filter((n): n is PM80SatelliteNode => !!n)
    .map((n, i) => ({ ...n, step: i + 1, position: POSITIONS[i] }));
  return { ...snapshot, satellites };
}

// ------------------------------------------------------------------------------------------------------------------------------
// which settings the home shows, where a save goes

/** null = ALL projects, else the ids of the selected ones (same meaning as PM80ProjectSelection) */
export type BusinessOrderSelection = string[] | null;

export interface StoredBusinessOrders {
  /** rowJSON.businessOrderSettings of the organization */
  organization: BusinessOrderSettings | null;
  /** of every project that has them, by project id */
  projects: Record<string, BusinessOrderSettings | undefined>;
}

/** what the home shows for the selection (see the top of the file) */
export function resolveBusinessOrder(selection: BusinessOrderSelection, stored: StoredBusinessOrders): BusinessOrderSettings {
  if (selection && selection.length === 1) {
    return stored.projects[selection[0]] ?? stored.organization ?? defaultBusinessOrder();
  }
  return stored.organization ?? defaultBusinessOrder();
}

export interface BusinessOrderTargets {
  /** the organization row gets it */
  organization: boolean;
  /** the project rows that get it */
  projectIds: string[];
}

/**
 * Where a save goes. ONE project: that project. SOME projects: each of them. ALL projects (selection null): the organization and
 * each project of the list.
 */
export function businessOrderTargets(selection: BusinessOrderSelection, allProjectIds: string[]): BusinessOrderTargets {
  if (selection === null) return { organization: true, projectIds: [...allProjectIds] };
  return { organization: false, projectIds: [...selection] };
}

/** a sentence for the screen: what the save will touch */
export function businessOrderScopeText(selection: BusinessOrderSelection, total: number, oneName?: string): string {
  if (selection === null) return `All projects (${total}): saved in the organization and in each project`;
  if (selection.length === 1) return `One project${oneName ? ` (${oneName})` : ''}: saved in this project`;
  return `${selection.length} of ${total} projects: saved in each of them`;
}

// ------------------------------------------------------------------------------------------------------------------------------
// the selection travels to the settings route as ONE route parameter: projects=all | projects=<id>,<id>

export const selectionParam = (selection: BusinessOrderSelection): string => (selection === null ? 'all' : selection.join(','));

export function parseSelectionParam(v: unknown): BusinessOrderSelection {
  const t = Array.isArray(v) ? v[0] : v;
  if (typeof t !== 'string' || !t.trim() || t.trim() === 'all') return null;
  const ids = t.split(',').map((x) => x.trim()).filter(Boolean);
  return ids.length ? ids : null;
}

/** the route of the settings screen (the app bar's Back goes Home by `returnTo`) */
export const BUSINESS_ORDER_ROUTE = '/pm/business-order';
export const businessOrderRouteParams = (selection: BusinessOrderSelection) => ({
  projects: selectionParam(selection),
  returnTo: '/home',
});
