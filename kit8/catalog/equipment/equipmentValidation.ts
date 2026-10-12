// Equipment catalog - the validation rules (pure, unit-tested). The descriptor rules R1-R11 are the product ones (product/crud/productValidation.ts, run on
// equipmentAsProductData with EQUIPMENT_KIND): sets and variants belong to the equipment TYPE / the EQUIPMENT, property values to the equipment.
// This file adds what only equipment has (E1).
import { byGUID, isSet } from '../product/crud/productCatalogTools';
import { CatalogKind, ProductIssue, RULES, validateProductCatalog } from '../product/crud/productValidation';
import { equipmentAsProductData, EquipmentCatalogData } from './equipmentTypeModel';
import { equipmentName } from './equipmentModel';

export { issuesByTable } from '../product/crud/productValidation';
export type EquipmentTableKey = 'equipmentType' | 'equipment' | 'descriptorDestination' | 'descriptorPlan' | 'propertyValue' | 'variant' | 'variantValue' | 'descriptorGenus' | 'descriptorValue';
export type EquipmentIssue = ProductIssue<EquipmentTableKey>;

export const EQUIPMENT_KIND: CatalogKind = {
  kind: 'equipmentType',
  tables: { type: 'equipmentType', item: 'equipment', folder: 'equipment', price: 'equipment' },
  vat: { type: 'equipmentVATDefaultRate', item: 'equipmentVATRate' },
  words: { item: 'Equipment', itemLower: 'equipment', type: 'Equipment type', typeLower: 'equipment type' },
  priceFor: () => false,
  productLogistics: false,
};

const { GTIN: _gtin, R7: _r7, R13: _r13, ...PRODUCT_RULES } = RULES;
export const EQUIPMENT_RULES: Record<string, string> = {
  ...PRODUCT_RULES,
  R3: 'A descriptor appears only once per equipment type (Property OR Variant)',
  R8: 'Required plan lines have a value; one value per equipment and plan line',
  R11: 'A plan line descriptor is meant for equipment types',
  R12: 'Equipment side mirrors the person side: sets are owned by the equipment TYPE, property values and variants by the EQUIPMENT',
  E1: 'Every equipment has an equipment type',
};

export function validateEquipmentCatalog(data: EquipmentCatalogData): EquipmentIssue[] {
  const issues = validateProductCatalog(equipmentAsProductData(data), EQUIPMENT_KIND) as EquipmentIssue[];
  const types = byGUID(data.equipmentType);
  for (const e of data.equipment) {
    const t = e.rowJSON?.equipmentType;
    // "choose its equipment type" for an empty type is already reported by R1; an unknown type is named here
    if (isSet(t) && !types.has(t)) issues.push({ rule: 'E1', severity: 'error', table: 'equipment', rowGUID: e.rowGUID, message: `Equipment "${equipmentName(e) || e.rowGUID}": equipment type "${t}" is missing` });
  }
  return issues;
}
