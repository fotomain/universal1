// Task lines - what the catalogs say about a line (pure). The rows come from redux (useTaskLineCatalogs); the rules are the catalogs' own
// (roles: catalog/resourcerole/crud, products: catalog/product/crud), so a line follows the same variants, VAT and prices as the catalogs.
import type { DefRow } from '../../../../catalog/product/productModel';
import { todayISO } from '../../../../catalog/product/productModel';
import {
  currentPriceOfProduct, emptyCatalogData, isSet, ProductCatalogData, rowTitle, variantsOfProduct, vatRateOfProduct,
} from '../../../../catalog/product/crud/productCatalogTools';
import {
  currentRate, emptyResourceRoleData, priceTypeForRoles, ResourceRoleCatalogData, variantsOfRole, vatPercentOfRole,
} from '../../../../catalog/resourcerole/crud/resourceRoleCatalogTools';
import { priceTypeForProducts } from '../../../../catalog/product/crud/productCatalogTools';
import type { LineSuggestion } from './taskLineMoney';
import { contractUnitPrice, CONTRACT_UNIT_HOUR } from './taskLineContractCost';
import { lineNumber } from './taskLineMoney';
import type { TaskLineGenusDef, TaskLineRowJSON } from './taskLineModel';

/** every list a line needs (as read into redux; a missing list = []) */
export interface TaskLineCatalogData {
  managementGenus: DefRow<any>[];
  resourceRoleType: DefRow<any>[];
  resourceRole: DefRow<any>[];
  rolePrice: DefRow<any>[];
  variant: DefRow<any>[];
  /** the descriptors (sets, plan lines, values) of the role types AND the person types; the match of a person with a role is taskLinePersonMatch.ts */
  descriptorGenus: DefRow<any>[];
  descriptorValue: DefRow<any>[];
  descriptorPlan: DefRow<any>[];
  descriptorDestination: DefRow<any>[];
  /** what the roles require (owner = role) and what the persons are (owner = person) */
  propertyValue: DefRow<any>[];
  /** personTable: rowJSON.personType decides the descriptor sets of a person */
  person: DefRow<any>[];
  /** templateResourceContractTable: the contract a Material / Expense / Revenue line asks for (owner = management genus) */
  resourceContractTemplate: DefRow<any>[];
  valueAddedTax: DefRow<any>[];
  measureUnit: DefRow<any>[];
  priceType: DefRow<any>[];
  productType: DefRow<any>[];
  product: DefRow<any>[];
  productPrice: DefRow<any>[];
  /** contractTable (rowJSON.contractCurrency) */
  contract: DefRow<any>[];
}

export const emptyTaskLineCatalogs = (): TaskLineCatalogData => ({
  managementGenus: [], resourceRoleType: [], resourceRole: [], rolePrice: [], variant: [], descriptorGenus: [], descriptorValue: [], descriptorPlan: [],
  descriptorDestination: [], propertyValue: [], person: [], resourceContractTemplate: [], valueAddedTax: [], measureUnit: [],
  priceType: [], productType: [], product: [], productPrice: [], contract: [],
});

/** the role catalog as the rules of catalog/resourcerole/crud expect it */
const roleData = (d: TaskLineCatalogData): ResourceRoleCatalogData => ({
  ...emptyResourceRoleData(),
  managementGenus: d.managementGenus, resourceRoleType: d.resourceRoleType, resourceRole: d.resourceRole, rolePrice: d.rolePrice,
  variant: d.variant, descriptorGenus: d.descriptorGenus, descriptorValue: d.descriptorValue, descriptorPlan: d.descriptorPlan,
  descriptorDestination: d.descriptorDestination, valueAddedTax: d.valueAddedTax, measureUnit: d.measureUnit, priceType: d.priceType,
});
const productData = (d: TaskLineCatalogData): ProductCatalogData => ({
  ...emptyCatalogData(),
  productType: d.productType, product: d.product, productPrice: d.productPrice, variant: d.variant, valueAddedTax: d.valueAddedTax,
  measureUnit: d.measureUnit, priceType: d.priceType,
});

const byOrder = (a: DefRow<any>, b: DefRow<any>) => Number(a.orderInList ?? 0) - Number(b.orderInList ?? 0);

/** the genus a role belongs to: the managementGenus of its role type (null = none chosen) */
export function genusOfRole(d: TaskLineCatalogData, role: DefRow<any> | undefined | null): string | null {
  if (!role) return null;
  const g = d.resourceRoleType.find((t) => t.rowGUID === role.rowOwnerGUID)?.rowJSON?.managementGenus;
  return isSet(g) ? g : null;
}

/** the roles a line of this genus can book (Time: the roles of the time genus ...) */
export const rolesOfGenus = (d: TaskLineCatalogData, genus: string): DefRow<any>[] =>
  d.resourceRole.filter((r) => genusOfRole(d, r) === genus);

/** the variants of a role as picker options: the descriptorKey is stored, the title shown */
export function roleVariantOptions(d: TaskLineCatalogData, roleGUID: string | null | undefined): { value: string; label: string }[] {
  const role = d.resourceRole.find((r) => r.rowGUID === roleGUID);
  if (!role) return [];
  return variantsOfRole(roleData(d), role)
    .filter((v) => isSet(v.rowJSON?.descriptorKey))
    .map((v) => ({ value: String(v.rowJSON.descriptorKey), label: rowTitle(v) || String(v.rowJSON.descriptorKey) }));
}

/** the variants of a product as picker options */
export function productVariantOptions(d: TaskLineCatalogData, productGUID: string | null | undefined): { value: string; label: string }[] {
  const product = d.product.find((p) => p.rowGUID === productGUID);
  if (!product) return [];
  return variantsOfProduct(productData(d), product)
    .filter((v) => isSet(v.rowJSON?.descriptorKey))
    .map((v) => ({ value: String(v.rowJSON.descriptorKey), label: rowTitle(v) || String(v.rowJSON.descriptorKey) }));
}

const variantGUIDOfKey = (variants: DefRow<any>[], key: string | null | undefined): string | null =>
  isSet(key) ? variants.find((v) => v.rowJSON?.descriptorKey === key)?.rowGUID ?? null : null;

/** the first price list that fits (the order of the Price lists catalog); null = none */
export function defaultPriceType(d: TaskLineCatalogData, forRole: boolean): DefRow<any> | null {
  return [...d.priceType].sort(byOrder).find((pt) => (forRole ? priceTypeForRoles(pt) : priceTypeForProducts(pt))) ?? null;
}

/**
 * What the catalogs suggest for a line:
 *  - a product (Material / Expense / Revenue): its price now, its default unit, its VAT
 *  - else the role: its rate now (per the role type's base unit), that unit, its VAT
 * null = nothing chosen yet. Prices come from the first fitting price list.
 */
export function suggestForLine(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>, day: string = todayISO()): LineSuggestion | null {
  const role = d.resourceRole.find((r) => r.rowGUID === json.resourceRoleItem);
  const product = genus.resource === 'product' ? d.product.find((p) => p.rowGUID === json.taskResourceItem) : undefined;
  const roleType = role ? d.resourceRoleType.find((t) => t.rowGUID === role.rowOwnerGUID) : undefined;

  // the cost of a PERSON comes from his contract (per hour); without a contract on the line it is the rate of the role
  let price: number | null = null;
  let priceSource: LineSuggestion['priceSource'] = null;
  let measureUnit: string | null = null;
  let vatPercent: number | null = null;
  if (genus.resource === 'person' && isSet(json.taskResourceContract)) {
    const contract = d.contract.find((c) => c.rowGUID === json.taskResourceContract);
    const unit = isSet(json.measureUnitTaskLine) ? json.measureUnitTaskLine : isSet(roleType?.rowJSON?.baseUnit) ? roleType!.rowJSON.baseUnit : CONTRACT_UNIT_HOUR;
    const cp = contractUnitPrice(contract?.rowJSON, unit);
    if (cp !== null) { price = cp; priceSource = 'contract'; measureUnit = unit; }
  }
  if (!role && !product && price === null) return null;

  if (product) {
    const pt = defaultPriceType(d, false);
    const variantGUID = variantGUIDOfKey(variantsOfProduct(productData(d), product), json.taskResourceAttributesKey);
    const p = pt ? currentPriceOfProduct(d.productPrice, product, variantGUID, pt.rowGUID, day) : null;
    price = lineNumber(p?.rowJSON?.price);
    if (price !== null) priceSource = 'product';
    const unit = p?.rowJSON?.measureUnit ?? product.rowJSON?.measureUnitDefault ?? product.rowJSON?.measureUnitForInventory;
    measureUnit = isSet(unit) ? unit : null;
    const vat = vatRateOfProduct(productData(d), product);
    vatPercent = vat ? lineNumber(vat.rowJSON?.vatTablePercent) : null;
  }
  if (role) {
    if (price === null) {
      const pt = defaultPriceType(d, true);
      // the rate of the role: the variant the ROLE asks for (a person's variant never changes the price of the role)
      const variantGUID = variantGUIDOfKey(variantsOfRole(roleData(d), role), json.resourceRoleAttributeSetKey);
      const rate = pt ? currentRate(d.rolePrice, role, roleType, variantGUID, pt.rowGUID, day) : null;
      price = lineNumber(rate?.rowJSON?.price);
      if (price !== null) priceSource = 'role';
      if (!measureUnit) { const u = rate?.rowJSON?.measureUnit ?? roleType?.rowJSON?.baseUnit; measureUnit = isSet(u) ? u : null; }
    }
    if (!measureUnit) { const u = roleType?.rowJSON?.baseUnit; measureUnit = isSet(u) ? u : null; }
    if (vatPercent === null) vatPercent = vatPercentOfRole(roleData(d), role);
  }
  return { price, priceSource, measureUnit, vatPercent };
}

/** the currency of the line (the currency of sumForContract): the partner contract, else the contract of the person, else the contract template asked for, else the project's */
export function lineContractCurrency(d: TaskLineCatalogData, json: Partial<TaskLineRowJSON>, projectDefault?: string | null): string {
  for (const guid of [json.taskLinePartnerContract, json.taskResourceContract]) {
    const c = isSet(guid) ? d.contract.find((x) => x.rowGUID === guid) : undefined;
    const cur = c?.rowJSON?.contractCurrency;
    if (isSet(cur)) return cur;
  }
  const tpl = isSet(json.resourceContractTemplateTaskLine) ? d.resourceContractTemplate.find((t) => t.rowGUID === json.resourceContractTemplateTaskLine) : undefined;
  if (isSet(tpl?.rowJSON?.currency)) return tpl!.rowJSON.currency;
  return projectDefault || '';
}

/** what is wrong with a line (shown as a mark; the data is never refused) */
export function lineProblems(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>): string[] {
  const out: string[] = [];
  const role = d.resourceRole.find((r) => r.rowGUID === json.resourceRoleItem);
  if (isSet(json.resourceRoleItem) && !role) out.push('The role does not exist any more');
  else if (role && genusOfRole(d, role) !== genus.genus) out.push(`The role is not a ${genus.title} role`);
  if (isSet(json.taskResourceItem) && genus.resource === 'product' && !d.product.some((p) => p.rowGUID === json.taskResourceItem)) out.push('The product does not exist any more');
  if (lineNumber(json.priceTaskLine) !== null && lineNumber(json.qtyTaskLine) === null) out.push('Quantity is empty');
  // the contract template asked for: it must exist and belong to the genus of the line
  if (isSet(json.resourceContractTemplateTaskLine)) {
    const tpl = d.resourceContractTemplate.find((t) => t.rowGUID === json.resourceContractTemplateTaskLine);
    if (!tpl) out.push('The contract template does not exist any more');
    else if (tpl.rowOwnerGUID !== (json.taskManagementGenusLine || genus.genus)) out.push(`The contract template is not a ${genus.title} template`);
  }
  return out;
}
