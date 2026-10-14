// Business unit - the units of a company (enterprise > department > team ...): ONE table, a tree of any depth.
//   businessUnitTable  rowGUID · rowOwnerGUID 'businessUnitCatalog' · rowParentGUID = the parent unit | 'empty' (a root = an enterprise) · orderInList
//                      rowJSON { title, code, description, cfrAssigned, isActive }
//   rowJSON.cfrAssigned = cfrTypeTable.rowGUID (optional). The EFFECTIVE CFR of a unit = its own, else the nearest ancestor's, else none (`effectiveCfr`).
//   SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 18 · Screen: BusinessUnitCRUD (CatalogTreeReusableCRUD) · route BUSINESS_UNIT_ROUTES.list
//   selectFromTree: true (SystemMetaData entry): a unit of ANY level can be picked, the first level too.
//   Design: documents/BUSINESS_UNIT_CFR_STRUCTURE.html
import type { DefRow, ProductTableDef } from '../product/productModel';
import type { FolderTreeNode } from '../../ui/components/tree/folderTreeModel';
import { cfrAccepts, type BudgetKind } from './cfrTypeModel';

export const BUSINESS_UNIT_ROUTES = { list: '/catalog/business/unit' } as const;

export const BUSINESS_UNIT_TABLE: ProductTableDef = {
  table: 'businessUnitTable',
  entity: 'businessUnitReusable',
  itemLabel: 'Business unit',
  catalogOwner: 'businessUnitCatalog',
  purpose: 'The business units of the company (a tree of any depth). A unit may be a cost, revenue, profit or investment center (its CFR); units without one inherit it.',
  emptyRowJSON: () => ({ title: null, code: null, description: null, cfrAssigned: null, isActive: true }),
};

/** a unit of any level can be picked (the SystemMetaData flag `selectFromTree` of the entity) */
export const BUSINESS_UNIT_SELECT_FROM_TREE = true;

export interface BusinessUnitJSON { title: string; code?: string | null; description?: string | null; cfrAssigned?: string | null; isActive?: boolean }

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';

export const businessUnitTitle = (r: DefRow<any> | undefined | null): string => String(r?.rowJSON?.title ?? '').trim() || r?.rowGUID || '';
export const isBusinessUnitActive = (r: DefRow<any>): boolean => r.rowJSON?.isActive !== false;

/** every unit as a tree node (title, order) */
export function businessUnitNodes(rows: DefRow<any>[]): FolderTreeNode[] {
  const ids = new Set((rows || []).map((r) => r.rowGUID));
  return (rows || []).map((r) => ({
    id: r.rowGUID,
    parentId: isSet(r.rowParentGUID) && ids.has(r.rowParentGUID) ? r.rowParentGUID : null,
    title: businessUnitTitle(r) || '(no title)',
    order: Number(r.orderInList) || 0,
  }));
}

/** 'Enterprise #1 › Sales › Key Accounts Department' */
export function businessUnitPath(rows: DefRow<any>[], guid: string | null | undefined): string {
  const byId = new Map((rows || []).map((r) => [r.rowGUID, r]));
  const parts: string[] = [];
  const seen = new Set<string>();
  let g = guid;
  while (isSet(g) && !seen.has(g)) {
    seen.add(g);
    const r = byId.get(g);
    if (!r) { parts.unshift(g); break; }
    parts.unshift(businessUnitTitle(r));
    g = r.rowParentGUID;
  }
  return parts.join(' › ');
}

/** the unit and every unit below it */
export function businessUnitDescendants(rows: DefRow<any>[], guid: string): Set<string> {
  const out = new Set<string>([guid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows || []) if (!out.has(r.rowGUID) && out.has(r.rowParentGUID)) { out.add(r.rowGUID); grew = true; }
  }
  return out;
}

/** units that have no sub-unit */
export function businessUnitLeaves(rows: DefRow<any>[]): DefRow<any>[] {
  const parents = new Set((rows || []).map((r) => r.rowParentGUID));
  return (rows || []).filter((r) => !parents.has(r.rowGUID));
}

/** the effective CFR of a unit: its own cfrAssigned, else the nearest ancestor's, else null */
export function effectiveCfr(rows: DefRow<any>[], guid: string | null | undefined): string | null {
  const byId = new Map((rows || []).map((r) => [r.rowGUID, r]));
  const seen = new Set<string>();
  let g = guid;
  while (isSet(g) && !seen.has(g)) {
    seen.add(g);
    const r = byId.get(g);
    if (!r) return null;
    const own = r.rowJSON?.cfrAssigned;
    if (isSet(own)) return own;
    g = r.rowParentGUID;
  }
  return null;
}

/** does this unit take a line of this kind? (effective CFR; none = yes) */
export const businessUnitAccepts = (rows: DefRow<any>[], cfrRows: DefRow<any>[] | null | undefined, guid: string | null | undefined, kind: BudgetKind | null | undefined): boolean =>
  cfrAccepts(effectiveCfr(rows, guid), kind, cfrRows);

/** why a unit cannot be chosen for a line of this kind ('' = it can) */
export function businessUnitProblem(rows: DefRow<any>[], cfrRows: DefRow<any>[] | null | undefined, guid: string | null | undefined, kind: BudgetKind | null | undefined): string {
  if (!isSet(guid)) return '';
  const r = (rows || []).find((x) => x.rowGUID === guid);
  if (!r) return `Business unit "${guid}" does not exist`;
  if (!businessUnitAccepts(rows, cfrRows, guid, kind)) {
    const cfr = effectiveCfr(rows, guid);
    const title = cfr ? (cfrRows || []).find((c) => c.rowGUID === cfr)?.rowJSON?.title || cfr : '';
    return `${kind === 'cost' ? 'A cost' : 'A revenue'} line cannot be posted to the ${title} "${businessUnitTitle(r)}"`;
  }
  return '';
}

/**
 * The units a picker / select offers: every ACTIVE unit when `selectFromTree` (any level, the first too), else the leaves only.
 * `kind` + `cfrRows` leave out units that do not take that kind. `keep` = the value already set stays in the list even when it no longer qualifies.
 */
export function selectableBusinessUnits(
  rows: DefRow<any>[],
  opts: { selectFromTree?: boolean; kind?: BudgetKind | null; cfrRows?: DefRow<any>[] | null; keep?: string | null } = {},
): DefRow<any>[] {
  const base = (opts.selectFromTree ?? BUSINESS_UNIT_SELECT_FROM_TREE) ? rows || [] : businessUnitLeaves(rows);
  return base.filter((r) => r.rowGUID === opts.keep || (isBusinessUnitActive(r) && (!opts.kind || businessUnitAccepts(rows, opts.cfrRows, r.rowGUID, opts.kind))));
}

/** select options (value = rowGUID, label = the path) for a column / field; sorted by the path so the tree order reads top to bottom */
export function businessUnitOptions(
  rows: DefRow<any>[],
  opts: { selectFromTree?: boolean; kind?: BudgetKind | null; cfrRows?: DefRow<any>[] | null; keep?: string | null } = {},
): { value: string; label: string }[] {
  return selectableBusinessUnits(rows, opts).map((r) => ({ value: r.rowGUID, label: businessUnitPath(rows, r.rowGUID) })).sort((a, b) => a.label.localeCompare(b.label));
}

/** the project's four centers (project_table.rowJSON): the fields, the CFR each must have, the kind it serves */
export const PROJECT_CENTER_FIELDS = [
  { key: 'projectCostCenter', title: 'Cost center', kind: 'cost' as BudgetKind, must: 'takes costs' },
  { key: 'projectRevenueCenter', title: 'Revenue center', kind: 'revenue' as BudgetKind, must: 'takes revenues' },
  { key: 'projectProfitCenter', title: 'Profit center', kind: null, must: 'profitCenter' },
  { key: 'projectInvestmentCenter', title: 'Investment center', kind: null, must: 'investmentCenter' },
] as const;
export type ProjectCenterKey = (typeof PROJECT_CENTER_FIELDS)[number]['key'];

/** does this unit qualify for that project field? (the same rule as the SQL trigger) */
export function unitFitsProjectCenter(rows: DefRow<any>[], cfrRows: DefRow<any>[] | null | undefined, key: ProjectCenterKey, guid: string): boolean {
  const cfr = effectiveCfr(rows, guid);
  if (key === 'projectCostCenter') return cfrAccepts(cfr, 'cost', cfrRows);
  if (key === 'projectRevenueCenter') return cfrAccepts(cfr, 'revenue', cfrRows);
  if (key === 'projectProfitCenter') return cfr === 'profitCenter';
  return cfr === 'investmentCenter';
}

/** the units a project field offers */
export const projectCenterOptions = (rows: DefRow<any>[], cfrRows: DefRow<any>[] | null | undefined, key: ProjectCenterKey, keep?: string | null) =>
  (rows || [])
    .filter((r) => r.rowGUID === keep || (isBusinessUnitActive(r) && unitFitsProjectCenter(rows, cfrRows, key, r.rowGUID)))
    .map((r) => ({ value: r.rowGUID, label: businessUnitPath(rows, r.rowGUID) }))
    .sort((a, b) => a.label.localeCompare(b.label));

/** the four project centers of a project row, filled with the first unit that fits each (the default of a NEW project); null = no unit fits that field */
export function defaultProjectCenters(rows: DefRow<any>[], cfrRows: DefRow<any>[] | null | undefined): Record<ProjectCenterKey, string | null> {
  const pick = (key: ProjectCenterKey): string | null => {
    // the nearest to the CFR named: an exact CFR first (costCenter for a cost center ...), then any unit that fits
    const exact = { projectCostCenter: 'costCenter', projectRevenueCenter: 'revenueCenter', projectProfitCenter: 'profitCenter', projectInvestmentCenter: 'investmentCenter' }[key];
    const sorted = (rows || []).filter(isBusinessUnitActive).slice().sort((a, b) => businessUnitPath(rows, a.rowGUID).localeCompare(businessUnitPath(rows, b.rowGUID)));
    return (sorted.find((r) => unitFitsProjectCenter(rows, cfrRows, key, r.rowGUID) && r.rowJSON?.cfrAssigned === exact) ?? sorted.find((r) => unitFitsProjectCenter(rows, cfrRows, key, r.rowGUID)))?.rowGUID ?? null;
  };
  return { projectCostCenter: pick('projectCostCenter'), projectRevenueCenter: pick('projectRevenueCenter'), projectProfitCenter: pick('projectProfitCenter'), projectInvestmentCenter: pick('projectInvestmentCenter') };
}

/**
 * The four project centers must be set on a project made with business units (`projectBusinessUnitsRequired`: every NEW project; a project made before the
 * feature has no such flag and keeps working with the four empty). null = ok, else the message. Same rules as the SQL trigger of project_table:
 * the unit exists, a cost center takes costs, a revenue center takes revenues, a profit center is a profitCenter, an investment center an investmentCenter.
 * Nothing is checked while the units are not loaded (a slow read never refuses a valid project) - but a catalog that is loaded and empty cannot satisfy it.
 */
export function projectCentersError(
  values: Partial<Record<ProjectCenterKey, string | null>> & { projectBusinessUnitsRequired?: boolean },
  rows: DefRow<any>[],
  cfrRows: DefRow<any>[] | null | undefined,
  loaded = true,
): string | null {
  if (!values.projectBusinessUnitsRequired) return null;
  if (!loaded) return null;
  if (!rows || rows.length === 0) return 'The project needs its business units: create them first (Catalogs > Business units)';
  for (const f of PROJECT_CENTER_FIELDS) {
    const g = values[f.key];
    if (!isSet(g)) return `The project needs its ${f.title.toLowerCase()} (Finances tab)`;
    const r = rows.find((x) => x.rowGUID === g);
    if (!r) return `The ${f.title.toLowerCase()} "${g}" does not exist`;
    if (!unitFitsProjectCenter(rows, cfrRows, f.key, g)) return `"${businessUnitTitle(r)}" cannot be the project's ${f.title.toLowerCase()} (it must be ${f.must})`;
  }
  return null;
}
