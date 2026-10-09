// The catalog rows a task line needs, from redux (read once when the Finances screen opens; the catalogs change rarely, so no realtime).
import { useEffect, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { PRODUCT_READ_PARAMS } from '../../../../catalog/product/dashboard/useProductCatalogData';
import { PRODUCT_TABLES } from '../../../../catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../../catalog/resourcerole/resourceRoleModel';
import { MANAGEMENT_GENUS_TABLE } from '../../../../catalog/management/genus/managementGenusModel';
import { CONTRACT_ENTITY } from '../../../../catalog/contract/contractModel';
import { PERSON_ENTITY } from '../../../../catalog/person/personModel';
import { TEMPLATE_RESOURCE_CONTRACT_ENTITY } from '../../../../catalog/management/templateresourcecontract/templateResourceContractModel';
import { emptyTaskLineCatalogs, TaskLineCatalogData } from './taskLineCatalogs';

/** catalog list -> its redux entity */
const ENTITIES: Record<keyof TaskLineCatalogData, string> = {
  managementGenus: MANAGEMENT_GENUS_TABLE.entity,
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
  resourceContractTemplate: TEMPLATE_RESOURCE_CONTRACT_ENTITY,
  valueAddedTax: PRODUCT_TABLES.valueAddedTax.entity,
  measureUnit: PRODUCT_TABLES.measureUnit.entity,
  priceType: PRODUCT_TABLES.priceType.entity,
  productType: PRODUCT_TABLES.productType.entity,
  product: PRODUCT_TABLES.product.entity,
  productPrice: PRODUCT_TABLES.productPrice.entity,
  contract: CONTRACT_ENTITY,
};
const KEYS = Object.keys(ENTITIES) as (keyof TaskLineCatalogData)[];

export function useTaskLineCatalogs(enabled = true): TaskLineCatalogData {
  const dispatch = useDispatch();
  const lists: any[] = useSelector((s: any) => KEYS.map((k) => s?.[ENTITIES[k]]?.entityDataFromServer), shallowEqual);
  useEffect(() => {
    if (!enabled) return;
    for (const k of KEYS) {
      const actions = SystemMetaData[ENTITIES[k]]?.actions;
      if (actions?.readData) dispatch(actions.readData(PRODUCT_READ_PARAMS));
    }
  }, [enabled, dispatch]);
  return useMemo(() => {
    const out = emptyTaskLineCatalogs();
    KEYS.forEach((k, i) => { out[k] = Array.isArray(lists[i]) ? lists[i] : []; });
    return out;
  }, [lists]);
}
