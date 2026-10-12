// The SIDES of the shared descriptor tables (pure data). descriptorDestinationTable, descriptorPlanTable, propertyValueTable, variantTable and variantValueTable
// hold the rows of FOUR sides: products, resource roles, persons and equipment (the owner of a row is a type / an item of one of them). Every dashboard
// shows its own side and hides the rows of the OTHER sides (catalogSides.ts `sideOf`). The list of sides lives HERE, once: a dashboard asks
// `otherSideEntities(its side)` instead of naming the other sides by hand, so a new side (equipment) cannot be forgotten in one of the dashboards.
import { PRODUCT_TABLES } from '../productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../resourcerole/resourceRoleModel';
import { PERSON_ENTITY } from '../../person/personModel';
import { PERSON_TYPE_TABLE } from '../../person/personTypeModel';
import { EQUIPMENT_ENTITY } from '../../equipment/equipmentModel';
import { EQUIPMENT_TYPE_TABLE } from '../../equipment/equipmentTypeModel';

export type DescriptorSideKey = 'product' | 'role' | 'person' | 'equipment';
export interface DescriptorSide {
  key: DescriptorSideKey;
  /** the redux entity of the TYPES of the side (product type, role type, person type, equipment type) */
  typeEntity: string;
  /** the redux entity of its ITEMS (product, role, person, equipment) */
  itemEntity: string;
}

export const DESCRIPTOR_SIDES: DescriptorSide[] = [
  { key: 'product', typeEntity: PRODUCT_TABLES.productType.entity, itemEntity: PRODUCT_TABLES.product.entity },
  { key: 'role', typeEntity: RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity, itemEntity: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity },
  { key: 'person', typeEntity: PERSON_TYPE_TABLE.entity, itemEntity: PERSON_ENTITY },
  { key: 'equipment', typeEntity: EQUIPMENT_TYPE_TABLE.entity, itemEntity: EQUIPMENT_ENTITY },
];

/** the sides a dashboard must hide: every side except its own */
export const otherSides = (own: DescriptorSideKey): DescriptorSide[] => DESCRIPTOR_SIDES.filter((s) => s.key !== own);

/** the redux entities (types first, then items) of every side except `own` - what a dashboard reads (read only) to leave their rows out */
export function otherSideEntities(own: DescriptorSideKey): { types: string[]; items: string[]; all: string[] } {
  const others = otherSides(own);
  const types = others.map((s) => s.typeEntity);
  const items = others.map((s) => s.itemEntity);
  return { types, items, all: [...types, ...items] };
}

/** the rows read from `otherSideEntities(own).all` (in that order) split into the types and the items of the other sides, each list flattened */
export function otherSideRows(own: DescriptorSideKey, lists: unknown[]): { types: any[]; items: any[] } {
  const n = otherSides(own).length;
  const flat = (ls: unknown[]) => ls.flatMap((l) => (Array.isArray(l) ? l : []));
  return { types: flat(lists.slice(0, n)), items: flat(lists.slice(n)) };
}
