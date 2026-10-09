// Product side / role side of the SHARED descriptor tables (pure, unit-tested: __tests__/catalog/resourcerole).
// descriptorDestinationTable, descriptorPlanTable, propertyValueTable, variantTable and variantValueTable hold the rows of
// product types / products AND of resource role types / resource roles (the owner is polymorphic, as in the sheet). Each
// dashboard hides the rows of the OTHER side (their owner chain ends in a type / item of that side) and shows the rest - so a row
// that has no owner yet (just added) stays visible, and an orphan is reported by both dashboards.
import type { DefRow } from '../productModel';

/** the shared tables whose rows belong to one side (their owner is a type / product / role ...) */
export const SIDE_OWNED_KEYS = ['descriptorDestination', 'descriptorPlan', 'propertyValue', 'variant', 'variantValue'] as const;
export type SideOwnedKey = typeof SIDE_OWNED_KEYS[number];
export type SideOwnedRows = Record<SideOwnedKey, DefRow<any>[]>;

export const isSideOwnedKey = (key: string): key is SideOwnedKey => (SIDE_OWNED_KEYS as readonly string[]).includes(key);

const ids = (rows: DefRow<any>[]) => new Set(rows.map((r) => r.rowGUID));

/**
 * The rowGUIDs of the shared rows owned by one side (`typeGUIDs` = its types, `itemGUIDs` = its products / roles):
 *   destination  owner = type               plan line  owner = such a destination
 *   property     owner = product / role     variant    owner = type or product / role
 *   variant value  owner = such a variant
 */
export function sideOwnedRows(shared: SideOwnedRows, typeGUIDs: Iterable<string>, itemGUIDs: Iterable<string>): Record<SideOwnedKey, Set<string>> {
  const types = new Set(typeGUIDs);
  const items = new Set(itemGUIDs);
  const descriptorDestination = ids(shared.descriptorDestination.filter((d) => types.has(d.rowOwnerGUID)));
  const descriptorPlan = ids(shared.descriptorPlan.filter((p) => descriptorDestination.has(p.rowOwnerGUID)));
  const propertyValue = ids(shared.propertyValue.filter((p) => items.has(p.rowOwnerGUID)));
  const variant = ids(shared.variant.filter((v) => types.has(v.rowOwnerGUID) || items.has(v.rowOwnerGUID)));
  const variantValue = ids(shared.variantValue.filter((v) => variant.has(v.rowOwnerGUID)));
  return { descriptorDestination, descriptorPlan, propertyValue, variant, variantValue };
}

/** `data` without the rows of the other side (`owned` = sideOwnedRows of that side) */
export function withoutRows<T extends Partial<SideOwnedRows>>(data: T, owned: Record<SideOwnedKey, Set<string>>): T {
  const out: any = { ...data };
  for (const k of SIDE_OWNED_KEYS) if (data[k]) out[k] = data[k]!.filter((r) => !owned[k].has(r.rowGUID));
  return out;
}

/**
 * One side of the shared tables: `data` without the rows owned by the OTHER side (given as that side's types and products / roles),
 * and the rowGUIDs that were left out (`otherOwned`, for ReusableTables that read the whole entity).
 */
export function sideOf<T extends SideOwnedRows>(all: T, otherTypes: { rowGUID: string }[] = [], otherItems: { rowGUID: string }[] = []): { data: T; otherOwned: Record<SideOwnedKey, Set<string>> } {
  const otherOwned = sideOwnedRows(all, otherTypes.map((r) => r.rowGUID), otherItems.map((r) => r.rowGUID));
  return { data: withoutRows(all, otherOwned), otherOwned };
}
