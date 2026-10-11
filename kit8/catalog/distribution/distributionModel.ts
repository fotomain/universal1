// Distribution - HOW an amount (a budget) is spread over the days of a task line: front-loaded, back-loaded, uniform, normal, logarithmic, epidemic, manual.
// Two levels in ONE table (as the management genus):
//   folders (level 1)  simpleDistributionGroup · curvesDistributionGroup · customDistributionGroup        rowParentGUID 'empty'
//   items   (level 2)  the 8 distribution types, rowParentGUID = its group
//   distributionGenericTable   rowGUID = the code · rowOwnerGUID 'distributionGenericCatalog' · rowParentGUID = group | 'empty'
//                              rowJSON { title, description, shape, params: [{ key, title, default }], editable }
//   Only the ITEMS are distributions a task line can have; the groups only gather them.
//   task_line_table.rowJSON.distributionForBudgetTaskLine = the rowGUID of the distribution of the line (kit8/pm/view/task/finances)
//   The first seven are fixed; only manualDistribution (editable) takes the share of every period from the user.
//   SQL: kit8/sql/init/create_distribution_generic_table.sql · Screen: DistributionTypeCRUD (read-only by default) · route DISTRIBUTION_ROUTES.list
import type { FolderTreeNode } from '../../ui/components/tree/folderTreeModel';
import type { DefRow, ProductTableDef } from '../product/productModel';

export const DISTRIBUTION_ROUTES = { list: '/catalog/distribution/list' } as const;

export const DISTRIBUTION_TABLE: ProductTableDef = {
  table: 'distributionGenericTable',
  entity: 'distributionGenericReusable',
  itemLabel: 'Distribution',
  catalogOwner: 'distributionGenericCatalog',
  purpose: 'How a budget is spread over the days of a task line: simple (front, back, uniform), curves (normal, logarithmic, epidemic) or typed by hand (manual).',
  emptyRowJSON: () => ({ title: null, description: null, shape: null, params: [], editable: false }),
};

/** rowGUIDs of the seed rows */
export const DISTRIBUTION_GROUPS = {
  simple: 'simpleDistributionGroup',
  curves: 'curvesDistributionGroup',
  custom: 'customDistributionGroup',
} as const;

export const DISTRIBUTION = {
  frontLoaded: 'frontLoadedDistribution',
  backLoaded: 'backLoadedDistribution',
  uniform: 'uniformDistribution',
  normal: 'normalDistribution',
  logarithmicFront: 'logarithmicFrontDistribution',
  logarithmicBack: 'logarithmicBackDistribution',
  epidemic: 'epidemicDistribution',
  manual: 'manualDistribution',
} as const;
export type DistributionCode = typeof DISTRIBUTION[keyof typeof DISTRIBUTION];

/** a parameter of a curve; `default` is used when the line gives none. Positions and spreads are a share of the timeline (0..1). */
export interface DistributionParamDef { key: string; title: string; default: number }
export interface DistributionJSON {
  title: string;
  description?: string | null;
  /** the shape, in words */
  shape?: string | null;
  params?: DistributionParamDef[];
  /** true = the user types the value of every period (manual) */
  editable?: boolean;
}

/** the parameters of every curve and their defaults (the document gives the shapes, not the numbers) */
export const DISTRIBUTION_PARAMS: Record<DistributionCode, DistributionParamDef[]> = {
  frontLoadedDistribution: [],
  backLoadedDistribution: [],
  uniformDistribution: [],
  normalDistribution: [{ key: 'peak', title: 'Peak position', default: 0.5 }, { key: 'spread', title: 'Spread', default: 0.2 }],
  logarithmicFrontDistribution: [{ key: 'steepness', title: 'Steepness', default: 9 }],
  logarithmicBackDistribution: [{ key: 'steepness', title: 'Steepness', default: 9 }],
  epidemicDistribution: [{ key: 'peak', title: 'Peak position', default: 0.35 }, { key: 'spread', title: 'Spread', default: 0.2 }],
  manualDistribution: [],
};

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';

/** a group = a top level row (level 1); everything below is a distribution */
export const isDistributionGroup = (r: DefRow<any>) => !isSet(r.rowParentGUID);
export const distributionGroups = (rows: DefRow<any>[]) => (rows || []).filter(isDistributionGroup);
/** the distributions a line can have (level 2) */
export const distributionItems = (rows: DefRow<any>[]) => (rows || []).filter((r) => !isDistributionGroup(r));

/** the GROUPS as tree nodes (title, order); the distributions are the rows of the table */
export function distributionNodes(rows: DefRow<any>[]): FolderTreeNode[] {
  return distributionGroups(rows).map((r) => ({
    id: r.rowGUID,
    parentId: null,
    title: String(r.rowJSON?.title ?? '').trim() || '(no title)',
    order: Number(r.orderInList) || 0,
  }));
}

/** 'Curves › Normal (Gaussian)' */
export function distributionPath(rows: DefRow<any>[], guid: string | null | undefined): string {
  const byId = new Map((rows || []).map((r) => [r.rowGUID, r]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let g = guid;
  while (isSet(g) && !seen.has(g)) {
    seen.add(g);
    const r = byId.get(g);
    if (!r) { parts.unshift(g); break; }
    parts.unshift(String(r.rowJSON?.title ?? '').trim() || r.rowGUID);
    g = r.rowParentGUID;
  }
  return parts.join(' › ');
}

/** the options of the "Distribution" picker of a task line: the distributions (level 2), in the order of the catalog */
export function distributionOptions(rows: DefRow<any>[]): { value: string; label: string }[] {
  return distributionItems(rows)
    .slice()
    .sort((a, b) => Number(a.orderInList ?? 0) - Number(b.orderInList ?? 0))
    .map((r) => ({ value: r.rowGUID, label: String(r.rowJSON?.title ?? '').trim() || r.rowGUID }));
}

/** 'Peak position 0.5, Spread 0.2' (or 'none') */
export function distributionParamsText(json: Partial<DistributionJSON> | null | undefined): string {
  const params = Array.isArray(json?.params) ? json!.params! : [];
  if (json?.editable) return 'Per-period values';
  return params.length ? params.map((p) => `${p.title} ${p.default}`).join(', ') : 'None';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The shares: how much of the total falls on each period. The minimum period is ONE DAY, so a line of `periods` days gets `periods` shares.
// Every function returns shares that sum to 1 (or all 0 for a manual distribution with no values).
// ---------------------------------------------------------------------------------------------------------------------------------

export interface DistributionParams { peak?: number; spread?: number; steepness?: number; /** manual: the value of every period */ values?: number[] }

const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** weights -> shares that sum to 1 (a total of 0 stays 0) */
function normalise(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  return total > 0 ? weights.map((w) => w / total) : weights.map(() => 0);
}

/** share of period i from a weight function of the position t (0..1) taken in the MIDDLE of the period */
const sampled = (n: number, weight: (t: number) => number): number[] => normalise(Array.from({ length: n }, (_, i) => Math.max(0, weight((i + 0.5) / n))));

/** the share of a curve given by its cumulative function C (C(0) = 0, C(1) = 1): the exact area of every period */
const cumulative = (n: number, C: (t: number) => number): number[] => Array.from({ length: n }, (_, i) => C((i + 1) / n) - C(i / n));

/**
 * The share of the total of every one of `periods` periods (a period is a day, at least one).
 *   frontLoaded   heaviest at the start, falling to nothing at the end (a linear fall)
 *   backLoaded    the mirror: nothing at the start, heaviest at the end
 *   uniform       the same share every day
 *   normal        a symmetric bell: params.peak (position, 0..1, default 0.5) and params.spread (sigma, share of the timeline, default 0.2)
 *   logarithmicFront  a fast start that flattens into a long thin tail: params.steepness (default 9; bigger = faster start)
 *   logarithmicBack   the mirror of logarithmicFront
 *   epidemic      slow start, steep rise to a peak, long decline (right-skewed): params.peak (default 0.35), params.spread (default 0.2)
 *   manual        params.values, one per period, taken as they are and scaled to sum 1
 */
export function distributionShares(code: string, periods: number, params: DistributionParams = {}): number[] {
  const n = Math.max(1, Math.floor(Number(periods) || 1));
  switch (code) {
    case DISTRIBUTION.frontLoaded: return sampled(n, (t) => 1 - t);
    case DISTRIBUTION.backLoaded: return sampled(n, (t) => t);
    case DISTRIBUTION.uniform: return Array.from({ length: n }, () => 1 / n);
    case DISTRIBUTION.normal: {
      const peak = clamp(num(params.peak, 0.5), 0, 1);
      const spread = clamp(num(params.spread, 0.2), 0.01, 1);
      return sampled(n, (t) => Math.exp(-0.5 * ((t - peak) / spread) ** 2));
    }
    case DISTRIBUTION.logarithmicFront:
    case DISTRIBUTION.logarithmicBack: {
      const k = Math.max(0.01, num(params.steepness, 9));
      const front = cumulative(n, (t) => Math.log(1 + k * t) / Math.log(1 + k));
      return code === DISTRIBUTION.logarithmicFront ? front : front.slice().reverse();
    }
    case DISTRIBUTION.epidemic: {
      const peak = clamp(num(params.peak, 0.35), 0.01, 0.99);
      const spread = clamp(num(params.spread, 0.2), 0.01, 1);
      // a gamma shaped wave with its top at `peak`: w(t) = (t/peak)^k * exp(k (1 - t/peak)), k = (peak/spread)^2 (the narrower, the bigger k)
      const k = (peak / spread) ** 2;
      return sampled(n, (t) => Math.exp(k * (Math.log(Math.max(t, 1e-9) / peak) + 1 - t / peak)));
    }
    case DISTRIBUTION.manual: {
      const values = Array.isArray(params.values) ? params.values : [];
      return normalise(Array.from({ length: n }, (_, i) => Math.max(0, num(values[i], 0))));
    }
    default:
      throw new Error(`Unknown distribution: ${code}`);
  }
}

/** `amount` spread over `periods` days; the rounding rest goes to the last day so the parts add up to the amount */
export function distributeAmount(code: string, amount: number, periods: number, params: DistributionParams = {}, decimals = 2): number[] {
  const shares = distributionShares(code, periods, params);
  const f = 10 ** decimals;
  const parts = shares.map((s) => Math.round(amount * s * f) / f);
  if (shares.some((s) => s > 0)) {
    const rest = Math.round((amount - parts.reduce((a, b) => a + b, 0)) * f) / f;
    const last = shares.length - 1 - [...shares].reverse().findIndex((s) => s > 0);
    parts[last] = Math.round((parts[last] + rest) * f) / f;
  }
  return parts;
}
