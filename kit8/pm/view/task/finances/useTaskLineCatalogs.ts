// The catalog rows a task line needs, from redux (read once when the Finances screen opens; the catalogs change rarely, so no realtime).
import { useEffect, useMemo, useRef } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { PRODUCT_READ_PARAMS } from '../../../../catalog/product/dashboard/useProductCatalogData';
import { PRODUCT_TABLES } from '../../../../catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../../catalog/resourcerole/resourceRoleModel';
import { MANAGEMENT_GENUS_TABLE } from '../../../../catalog/management/genus/managementGenusModel';
import { BUDGET_ITEM_TABLE } from '../../../../catalog/budget/item/budgetItemModel';
import { DISTRIBUTION_TABLE } from '../../../../catalog/distribution/distributionModel';
import { CONTRACT_ENTITY } from '../../../../catalog/contract/contractModel';
import { PERSON_ENTITY } from '../../../../catalog/person/personModel';
import { EQUIPMENT_ENTITY } from '../../../../catalog/equipment/equipmentModel';
import { WORK_CENTER_ENTITY } from '../../../../catalog/work_center/workCenterModel';
import { PARTNER_ENTITY } from '../../../../catalog/partner/partnerModel';
import { TEMPLATE_RESOURCE_CONTRACT_ENTITY } from '../../../../catalog/management/templateresourcecontract/templateResourceContractModel';
import { BUSINESS_UNIT_TABLE } from '../../../../catalog/business_unit/businessUnitModel';
import { CFR_TYPE_TABLE } from '../../../../catalog/business_unit/cfrTypeModel';
import { MANAGEMENT_RACI_GENUS_TABLE } from '../../../../catalog/management/raci_genus/raciGenusModel';
import { emptyTaskLineCatalogs, TaskLineCatalogData } from './taskLineCatalogs';

/** catalog list -> its redux entity */
const ENTITIES: Record<keyof TaskLineCatalogData, string> = {
  managementGenus: MANAGEMENT_GENUS_TABLE.entity,
  budgetItem: BUDGET_ITEM_TABLE.entity,
  distribution: DISTRIBUTION_TABLE.entity,
  resourceRoleType: RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity,
  resourceRole: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity,
  rolePrice: RESOURCE_ROLE_OWN_TABLES.rolePrice.entity,
  variant: PRODUCT_TABLES.variant.entity,
  descriptorGenus: PRODUCT_TABLES.descriptorGenus.entity,
  descriptorValue: PRODUCT_TABLES.descriptorValue.entity,
  descriptorPlan: PRODUCT_TABLES.descriptorPlan.entity,
  descriptorDestination: PRODUCT_TABLES.descriptorDestination.entity,
  propertyValue: PRODUCT_TABLES.propertyValue.entity,
  person: PERSON_ENTITY,
  equipment: EQUIPMENT_ENTITY,
  workCenter: WORK_CENTER_ENTITY,
  partner: PARTNER_ENTITY,
  resourceContractTemplate: TEMPLATE_RESOURCE_CONTRACT_ENTITY,
  valueAddedTax: PRODUCT_TABLES.valueAddedTax.entity,
  measureUnit: PRODUCT_TABLES.measureUnit.entity,
  priceType: PRODUCT_TABLES.priceType.entity,
  productType: PRODUCT_TABLES.productType.entity,
  productFolder: PRODUCT_TABLES.productFolder.entity,
  product: PRODUCT_TABLES.product.entity,
  productPrice: PRODUCT_TABLES.productPrice.entity,
  contract: CONTRACT_ENTITY,
  businessUnit: BUSINESS_UNIT_TABLE.entity,
  cfrType: CFR_TYPE_TABLE.entity,
  raciGenus: MANAGEMENT_RACI_GENUS_TABLE.entity,
};
const KEYS = Object.keys(ENTITIES) as (keyof TaskLineCatalogData)[];

/**
 * The Finances view of a task is mounted AGAIN for every task the user clicks (key = task GUID). The catalogs it needs (28 tables) used to be read again on every mount: 28 requests per click
 * before a single line could be shown. Now a catalog is read ONCE and read again only when it is older than CATALOG_FRESH_MS (they change rarely; the screens that edit them read them themselves).
 * The map is module-level, so it lives as long as the app does; `resetTaskLineCatalogReads` is for tests.
 */
export const CATALOG_FRESH_MS = 5 * 60 * 1000;
const readAt: Record<string, number> = {};
export const resetTaskLineCatalogReads = () => { for (const k of Object.keys(readAt)) delete readAt[k]; };
/** the entities that must be read now (never read, or older than the freshness window) */
export function staleCatalogEntities(now: number, have: (entity: string) => boolean): string[] {
  return KEYS.map((k) => ENTITIES[k]).filter((e) => !(have(e) && readAt[e] !== undefined && now - readAt[e] < CATALOG_FRESH_MS));
}

export function useTaskLineCatalogs(enabled = true): TaskLineCatalogData {
  const dispatch = useDispatch();
  const lists: any[] = useSelector((s: any) => KEYS.map((k) => s?.[ENTITIES[k]]?.entityDataFromServer), shallowEqual);
  // "have" = the whole catalog is in the list (the last read had no scope) or its read failed (a table that does not exist yet is not asked again and again);
  // a list another screen narrowed to one owner (readScope is not 'null') is not the whole catalog: it is read again
  const haveFlags: boolean[] = useSelector((s: any) => KEYS.map((k) => { const st = s?.[ENTITIES[k]]; return !!st && (st.readScope === 'null' || !!st.readErrorData); }), shallowEqual);
  const haveRef = useRef(haveFlags);
  haveRef.current = haveFlags;
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    const have = (e: string) => !!haveRef.current[KEYS.findIndex((k) => ENTITIES[k] === e)];
    for (const e of staleCatalogEntities(now, have)) {
      const actions = SystemMetaData[e]?.actions;
      if (actions?.readData) { readAt[e] = now; dispatch(actions.readData(PRODUCT_READ_PARAMS)); }
    }
  }, [enabled, dispatch]);
  return useMemo(() => {
    const out = emptyTaskLineCatalogs();
    KEYS.forEach((k, i) => { out[k] = Array.isArray(lists[i]) ? lists[i] : []; });
    return out;
  }, [lists]);
}

/** true while a catalog the lines need has not answered its FIRST read yet (the names of persons, products, roles ... are not there): the table shows a spinner over it */
export function useTaskLineCatalogsLoading(enabled = true): boolean {
  const flags: boolean[] = useSelector((s: any) => KEYS.map((k) => {
    const st = s?.[ENTITIES[k]];
    if (!st || !SystemMetaData[ENTITIES[k]]?.actions?.readData) return false;
    return !((st.crudMoment ?? 0) > 0 || !!st.readErrorData);
  }), shallowEqual);
  return enabled && flags.some(Boolean);
}
