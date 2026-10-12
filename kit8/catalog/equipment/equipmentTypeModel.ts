// Equipment types - the twin of personTypeTable / productTypeTable for MACHINES (the descriptor concept of "W1 V3 ER DESCRIPTORS PLAN", rule R12 mirrored):
//   equipmentTypeTable   Heavy machinery · Vehicle    a type decides which descriptor sets (Property / Variant) its equipment uses
//   equipmentTable       the equipment                  rowJSON.equipmentType = the type (the owner of an equipment stays EQUIPMENT_CATALOG_OWNER)
//   Property  = what the equipment IS (Engine power 110 kW, Year 2019)                propertyValueTable  owner = equipment
//   Variant   = what it CAN BE BOOKED AS (Heavy, With operator)                          variantTable        owner = equipment (variantMode 'perProduct')
//   Ownership (own / rented / leased) is a plain field of the equipment, NOT its type: the descriptors depend on the KIND of machine.
// The descriptor rules (sets, plan lines, variant owner R6, descriptorKey + title R9 / R10) are written ONCE for the product catalog; the equipment side feeds
// them through equipmentAsProductData(): equipment type = product type, equipment = product. Same adapter as personAsProductData().
import type { DefRow, ProductTableDef } from '../product/productModel';
import { emptyCatalogData, ProductCatalogData } from '../product/crud/productCatalogTools';
import { EQUIPMENT_ENTITY, equipmentName } from './equipmentModel';

export const EQUIPMENT_TYPE_TABLE: ProductTableDef = {
  table: 'equipmentTypeTable',
  entity: 'equipmentTypeReusable',
  itemLabel: 'Equipment type',
  catalogOwner: 'equipmentTypeCatalog',
  purpose: 'Groups equipment of the same kind (Heavy machinery, Vehicle); decides which descriptor sets (Property / Variant) it uses - like a product type or a person type.',
  emptyRowJSON: () => ({ title: null, description: null, propertySet: null, variantSet: null, variantMode: 'perProduct', uniqueVariants: true, variantTitleTemplate: null, isActive: true }),
};

/** rowGUIDs of the seed types */
export const EQUIPMENT_TYPE = { heavy: 'equipmentTypeHeavy', vehicle: 'equipmentTypeVehicle' } as const;

/** the variants of an equipment belong to the EQUIPMENT (the product catalog's 'perProduct') */
export const EQUIPMENT_VARIANT_MODES = [
  { value: 'none', label: 'No variants', hint: 'the equipment is booked as it is' },
  { value: 'perProduct', label: 'Per equipment', hint: 'every equipment has its own variants (Heavy, With operator)' },
];

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';

/** the type of an equipment: rowJSON.equipmentType */
export const equipmentTypeOf = (equipment: { rowJSON?: { equipmentType?: unknown } } | undefined | null): string | null => {
  const t = equipment?.rowJSON?.equipmentType;
  return isSet(t) ? t : null;
};

/** what the equipment side needs: every list of the catalog data the rules read */
export interface EquipmentCatalogData {
  equipmentType: DefRow<any>[];
  equipment: DefRow<any>[];
  descriptorGenus: DefRow<any>[];
  descriptorValue: DefRow<any>[];
  descriptorDestination: DefRow<any>[];
  descriptorPlan: DefRow<any>[];
  propertyValue: DefRow<any>[];
  variant: DefRow<any>[];
  variantValue: DefRow<any>[];
}
export const emptyEquipmentCatalogData = (): EquipmentCatalogData => ({
  equipmentType: [], equipment: [], descriptorGenus: [], descriptorValue: [], descriptorDestination: [], descriptorPlan: [],
  propertyValue: [], variant: [], variantValue: [],
});

/**
 * The equipment side seen as the product side: equipment type = product type, equipment = product whose OWNER is its type. (An equipment's own owner is
 * EQUIPMENT_CATALOG_OWNER, so the adapter sets rowOwnerGUID = rowJSON.equipmentType.) The descriptor rules, labels and the variant lookup are then the
 * product catalog's.
 */
export function equipmentAsProductData(d: Pick<EquipmentCatalogData, 'equipmentType' | 'equipment' | 'descriptorGenus' | 'descriptorValue' | 'descriptorDestination' | 'descriptorPlan' | 'propertyValue' | 'variant' | 'variantValue'>): ProductCatalogData {
  return {
    ...emptyCatalogData(),
    descriptorGenus: d.descriptorGenus, descriptorValue: d.descriptorValue, descriptorDestination: d.descriptorDestination, descriptorPlan: d.descriptorPlan,
    propertyValue: d.propertyValue, variant: d.variant, variantValue: d.variantValue,
    productType: d.equipmentType,
    // rowJSON.title: the product rules and labels read the name of an item from it
    product: d.equipment.map((e) => ({ ...e, rowOwnerGUID: equipmentTypeOf(e) ?? 'empty', rowJSON: { ...e.rowJSON, title: equipmentName(e) } })),
  };
}

export { EQUIPMENT_ENTITY };
