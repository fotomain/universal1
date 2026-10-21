// Task lines - the BUSINESS UNIT of a line (pure). Design: documents/BUSINESS_UNIT_CFR_STRUCTURE.html
//   businessUnitTaskLine          businessUnitTable.rowGUID (null = none: the line is posted as before business units existed)
//   businessUnitSourceTaskLine    where it came from: 'line' (the user typed it) | 'resource' | 'role' | 'budget' | 'contract' | 'project'
//   businessUnitAutoTaskLine      the last unit the app suggested; while the line's unit equals it (or is empty) the line FOLLOWS the sources
// The default comes from the first of these sources whose unit TAKES the kind of the line (a cost line skips a revenue center, a revenue line a cost center):
//   1. the line itself (the user's choice - never replaced)       4. the budget item   (budgetItemTable.rowJSON.businessUnitAssigned)
//   2. the resource: person / equipment / product                 5. the contract      (contractTable.rowJSON.businessUnitAssigned: the person's, else the partner's)
//   3. the resource role (resourceRoleTable)                       6. the project      (project_table.rowJSON: projectCostCenter for a cost line / projectRevenueCenter
//                                                                                        for a revenue line, then projectProfitCenter, then projectInvestmentCenter)
// The KIND of a line = the budget item's genus folder (costsGenus -> cost, revenuesGenus -> revenue), else the genus of the line.
// The check at Post: a unit that does not take the kind is refused (lineUnitPostProblem; the same rule in create_task_line_plan).
import type { DefRow } from '../../../../catalog/product/productModel';
import { isSet } from '../../../../catalog/product/crud/productCatalogTools';
import { businessUnitProblem, effectiveCfr, businessUnitAccepts, isBusinessUnitActive } from '../../../../catalog/business_unit/businessUnitModel';
import type { BudgetKind } from '../../../../catalog/business_unit/cfrTypeModel';
import { MANAGEMENT_GENUS } from '../../../../catalog/management/genus/managementGenusModel';
import type { TaskLineGenusDef, TaskLineRowJSON } from './taskLineModel';
import { lineResourceKind } from './taskLineResource';

export type BusinessUnitSource = 'line' | 'resource' | 'role' | 'budget' | 'contract' | 'project';

export const BUSINESS_UNIT_SOURCE_TEXT: Record<BusinessUnitSource, string> = {
  line: 'chosen on the line', resource: 'from the resource', role: 'from the role', budget: 'from the budget item', contract: 'from the contract', project: 'from the project',
};

/** the lists the unit of a line needs (a subset of TaskLineCatalogData) */
export interface BusinessUnitLists {
  businessUnit: DefRow<any>[];
  cfrType: DefRow<any>[];
  budgetItem: DefRow<any>[];
  managementGenus: DefRow<any>[];
  resourceRole: DefRow<any>[];
  person: DefRow<any>[];
  equipment: DefRow<any>[];
  /** workCenterTable (optional: a work center line takes the business unit of its work center) */
  workCenter?: DefRow<any>[];
  product: DefRow<any>[];
  contract: DefRow<any>[];
}

/** the four centers of the project (project_table.rowJSON) */
export interface ProjectCenters {
  projectCostCenter?: string | null;
  projectRevenueCenter?: string | null;
  projectProfitCenter?: string | null;
  projectInvestmentCenter?: string | null;
}

/** the default unit a catalog row names: businessUnitAssigned; a WORK CENTER is in a business unit (its folder), which is the default unit of the lines that book it */
const unitOf = (r: DefRow<any> | undefined | null): string | null => (isSet(r?.rowJSON?.businessUnitAssigned) ? String(r!.rowJSON.businessUnitAssigned) : isSet(r?.rowJSON?.workCenterKind) && isSet(r?.rowJSON?.businessUnit) ? String(r!.rowJSON.businessUnit) : null);

/** 'cost' | 'revenue' of a genus (a level 2 row of managementGenusTable: its folder is costsGenus / revenuesGenus); null = payments / unknown */
export function kindOfGenus(genusRows: DefRow<any>[], genus: string | null | undefined): BudgetKind | null {
  const g = (genusRows || []).find((r) => r.rowGUID === genus);
  const folder = g?.rowParentGUID;
  if (folder === MANAGEMENT_GENUS.costs) return 'cost';
  if (folder === MANAGEMENT_GENUS.revenues) return 'revenue';
  // the genus tab itself (before the genus rows are read): time / material / expense = cost, revenue = revenue
  if (genus === MANAGEMENT_GENUS.time || genus === MANAGEMENT_GENUS.material || genus === MANAGEMENT_GENUS.expense) return 'cost';
  if (genus === MANAGEMENT_GENUS.revenue) return 'revenue';
  return null;
}

/** the kind of a line: its budget item's genus, else the genus of the line (rowParentGUID / the tab) */
export function lineBudgetKind(d: Pick<BusinessUnitLists, 'budgetItem' | 'managementGenus'>, lineGenus: string | null | undefined, json: Partial<TaskLineRowJSON>): BudgetKind | null {
  const item = isSet(json.budgetItemTaskLine) ? (d.budgetItem || []).find((b) => b.rowGUID === json.budgetItemTaskLine) : undefined;
  const fromItem = item ? kindOfGenus(d.managementGenus, item.rowJSON?.managementGenusItem) : null;
  return fromItem ?? kindOfGenus(d.managementGenus, lineGenus);
}

/** the sources of the line in priority order (after the line itself): [source, unit] */
export function businessUnitCandidates(d: BusinessUnitLists, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>, kind: BudgetKind | null, project?: ProjectCenters | null): [BusinessUnitSource, string | null][] {
  const resKind = lineResourceKind(genus, json);
  const resRows = resKind === 'person' ? d.person : resKind === 'equipment' ? d.equipment : resKind === 'workCenter' ? (d.workCenter || []) : d.product;
  const resource = isSet(json.taskResourceItem) ? (resRows || []).find((r) => r.rowGUID === json.taskResourceItem) : undefined;
  const role = isSet(json.resourceRoleItem) ? (d.resourceRole || []).find((r) => r.rowGUID === json.resourceRoleItem) : undefined;
  const item = isSet(json.budgetItemTaskLine) ? (d.budgetItem || []).find((r) => r.rowGUID === json.budgetItemTaskLine) : undefined;
  const contractGUID = isSet(json.taskResourceContract) ? json.taskResourceContract : isSet(json.taskLinePartnerContract) ? json.taskLinePartnerContract : null;
  const contract = contractGUID ? (d.contract || []).find((r) => r.rowGUID === contractGUID) : undefined;
  const p = project || {};
  // a cost line: the cost center first; a revenue line: the revenue center first; then the two centers that take both
  const projectChain = (kind === 'revenue' ? [p.projectRevenueCenter, p.projectProfitCenter, p.projectInvestmentCenter] : [p.projectCostCenter, p.projectProfitCenter, p.projectInvestmentCenter]);
  return [
    ['resource', unitOf(resource)],
    ['role', unitOf(role)],
    ['budget', unitOf(item)],
    ['contract', unitOf(contract)],
    ...projectChain.map((u): [BusinessUnitSource, string | null] => ['project', isSet(u) ? u : null]),
  ];
}

/** the unit the sources suggest: the first ACTIVE, existing unit that takes the kind of the line; null = none */
export function resolveLineBusinessUnit(d: BusinessUnitLists, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>, project?: ProjectCenters | null): { unit: string | null; source: BusinessUnitSource | null } {
  const kind = lineBudgetKind(d, genus.genus, json);
  for (const [source, unit] of businessUnitCandidates(d, genus, json, kind, project)) {
    if (!unit) continue;
    const row = (d.businessUnit || []).find((r) => r.rowGUID === unit);
    if (!row || !isBusinessUnitActive(row)) continue;
    if (!businessUnitAccepts(d.businessUnit, d.cfrType, unit, kind)) continue;
    return { unit, source };
  }
  return { unit: null, source: null };
}

/**
 * The patch of the unit after a cell of the line changed (the table's computeRowJSON): while the line follows the sources (its unit is empty or equals the last
 * suggestion) it takes the new suggestion; a unit the user chose stays (source 'line'). {} = nothing to change. Nothing is ever written to a line of a project that
 * has no units at all (the lists are empty): an old project keeps its lines exactly as they are.
 */
export function businessUnitPatch(d: BusinessUnitLists, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>, project?: ProjectCenters | null): Partial<TaskLineRowJSON> {
  if (!d.businessUnit || d.businessUnit.length === 0) return {};
  const current = isSet(json.businessUnitTaskLine) ? json.businessUnitTaskLine : null;
  const auto = isSet(json.businessUnitAutoTaskLine) ? json.businessUnitAutoTaskLine : null;
  const follows = current === null || current === auto;
  if (!follows) return json.businessUnitSourceTaskLine === 'line' ? {} : { businessUnitSourceTaskLine: 'line' };
  const { unit, source } = resolveLineBusinessUnit(d, genus, json, project);
  if (unit === current && unit === auto && source === (json.businessUnitSourceTaskLine ?? null)) return {};
  if (unit === null && current === null && auto === null && !json.businessUnitSourceTaskLine) return {};
  return { businessUnitTaskLine: unit, businessUnitAutoTaskLine: unit, businessUnitSourceTaskLine: source };
}

/** the problem of the unit on a line ('' = none): a unit that does not exist, or that does not take the kind of the line */
export function lineBusinessUnitProblem(d: BusinessUnitLists, genus: TaskLineGenusDef | { genus: string }, json: Partial<TaskLineRowJSON>): string {
  if (!isSet(json.businessUnitTaskLine) || !d.businessUnit || d.businessUnit.length === 0) return '';
  return businessUnitProblem(d.businessUnit, d.cfrType, json.businessUnitTaskLine, lineBudgetKind(d, genus.genus, json));
}

/** Post: the message of a line that cannot be posted because of its unit (null = fine). `line` = a task_line_table row */
export function lineUnitPostProblem(d: BusinessUnitLists, line: { rowParentGUID: string; rowJSON?: Partial<TaskLineRowJSON> | null }): string | null {
  const msg = lineBusinessUnitProblem(d, { genus: line.rowParentGUID }, line.rowJSON || {});
  return msg || null;
}

/** the title of the effective CFR of the unit of a line (for the tip), '' = none */
export const lineUnitCfr = (d: BusinessUnitLists, json: Partial<TaskLineRowJSON>): string | null => (isSet(json.businessUnitTaskLine) ? effectiveCfr(d.businessUnit, json.businessUnitTaskLine) : null);
