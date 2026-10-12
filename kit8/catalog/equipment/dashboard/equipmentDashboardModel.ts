// Equipment dashboard - the tables of the screen (the ReusableTable approach, no folders): the two equipment tables and the shared descriptor tables
// of the equipment side. The twin of person/dashboard/personDashboardModel.ts.
import type { ProductTableDef } from '../../product/productModel';
import { PRODUCT_TABLES } from '../../product/productModel';
import { emptyEquipment, EQUIPMENT_CATALOG_OWNER, EQUIPMENT_ENTITY, equipmentTable } from '../equipmentModel';
import { EQUIPMENT_TYPE_TABLE } from '../equipmentTypeModel';
import type { EquipmentTableKey } from '../equipmentValidation';

export const EQUIPMENT_TABLE_KEYS: EquipmentTableKey[] = [
  'equipment', 'equipmentType', 'descriptorGenus', 'descriptorValue', 'descriptorDestination', 'descriptorPlan', 'propertyValue', 'variant', 'variantValue',
];

export const EQUIPMENT_TABLES: Record<EquipmentTableKey, ProductTableDef> = {
  equipment: {
    table: equipmentTable, entity: EQUIPMENT_ENTITY, itemLabel: 'Equipment', catalogOwner: EQUIPMENT_CATALOG_OWNER,
    purpose: 'The machines and tools that work on tasks and are booked by the hour. An equipment has its own Properties (what it is) and Variants (what it can be booked as).',
    emptyRowJSON: () => ({ ...emptyEquipment() }),
  },
  equipmentType: EQUIPMENT_TYPE_TABLE,
  descriptorGenus: PRODUCT_TABLES.descriptorGenus,
  descriptorValue: PRODUCT_TABLES.descriptorValue,
  descriptorDestination: { ...PRODUCT_TABLES.descriptorDestination, purpose: 'The descriptor set of an equipment type per description mode (one Property set and one Variant set per type).' },
  descriptorPlan: PRODUCT_TABLES.descriptorPlan,
  propertyValue: { ...PRODUCT_TABLES.propertyValue, purpose: 'What an equipment IS (Engine power 110 kW, Year 2019).' },
  variant: { ...PRODUCT_TABLES.variant, purpose: 'What an equipment CAN BE BOOKED AS (Heavy, With operator): a Time line of a task picks one of them.' },
  variantValue: PRODUCT_TABLES.variantValue,
};

export const EQUIPMENT_DASHBOARD_GROUPS = ['Catalog', 'Descriptors', 'Equipment data'] as const;
export const EQUIPMENT_DASHBOARD_TABLE_ORDER: EquipmentTableKey[] = [
  'equipment', 'equipmentType', 'descriptorGenus', 'descriptorValue', 'descriptorDestination', 'descriptorPlan', 'propertyValue', 'variant', 'variantValue',
];
