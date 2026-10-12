// The sides of the shared descriptor tables are listed ONCE (descriptorSides.ts): every dashboard hides the other sides without naming them.
// This is the test that did not exist before the equipment: a side that one dashboard forgets would show its descriptors inside the others.
import { DESCRIPTOR_SIDES, otherSideEntities, otherSideRows, otherSides, DescriptorSideKey } from '../../../kit8/catalog/product/crud/descriptorSides';
import { sideOf } from '../../../kit8/catalog/product/crud/catalogSides';
import { PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../kit8/catalog/resourcerole/resourceRoleModel';
import { PERSON_ENTITY } from '../../../kit8/catalog/person/personModel';
import { PERSON_TYPE_TABLE } from '../../../kit8/catalog/person/personTypeModel';
import { EQUIPMENT_ENTITY } from '../../../kit8/catalog/equipment/equipmentModel';
import { EQUIPMENT_TYPE_TABLE } from '../../../kit8/catalog/equipment/equipmentTypeModel';

const KEYS: DescriptorSideKey[] = ['product', 'role', 'person', 'equipment'];

describe('the registry', () => {
  it('four sides, each with its type entity and its item entity', () => {
    expect(DESCRIPTOR_SIDES.map((s) => s.key)).toEqual(KEYS);
    expect(DESCRIPTOR_SIDES.find((s) => s.key === 'product')).toMatchObject({ typeEntity: PRODUCT_TABLES.productType.entity, itemEntity: PRODUCT_TABLES.product.entity });
    expect(DESCRIPTOR_SIDES.find((s) => s.key === 'role')).toMatchObject({ typeEntity: RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity, itemEntity: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity });
    expect(DESCRIPTOR_SIDES.find((s) => s.key === 'person')).toMatchObject({ typeEntity: PERSON_TYPE_TABLE.entity, itemEntity: PERSON_ENTITY });
    expect(DESCRIPTOR_SIDES.find((s) => s.key === 'equipment')).toMatchObject({ typeEntity: EQUIPMENT_TYPE_TABLE.entity, itemEntity: EQUIPMENT_ENTITY });
  });
  it('every entity is a different one', () => {
    const all = DESCRIPTOR_SIDES.flatMap((s) => [s.typeEntity, s.itemEntity]);
    expect(new Set(all).size).toBe(all.length);
  });
  it.each(KEYS)('%s hides EVERY other side and never itself', (own) => {
    const others = otherSides(own).map((s) => s.key);
    expect(others).toHaveLength(3);
    expect(others).not.toContain(own);
    expect(new Set([own, ...others])).toEqual(new Set(KEYS));
    const e = otherSideEntities(own);
    expect(e.types).toHaveLength(3);
    expect(e.items).toHaveLength(3);
    expect(e.all).toEqual([...e.types, ...e.items]);
    const mine = DESCRIPTOR_SIDES.find((s) => s.key === own)!;
    expect(e.all).not.toContain(mine.typeEntity);
    expect(e.all).not.toContain(mine.itemEntity);
  });
});

describe('otherSideRows + sideOf: one side shows only its own rows', () => {
  const row = (rowGUID: string, rowOwnerGUID: string) => ({ rowGUID, rowOwnerGUID, rowParentGUID: 'empty', orderInList: 0, rowJSON: {} });
  /** the shared tables hold the rows of the four sides: a set of the TYPE of each side, a property value of an ITEM of each side */
  const types: Record<DescriptorSideKey, string> = { product: 'tProduct', role: 'tRole', person: 'tPerson', equipment: 'tEquipment' };
  const items: Record<DescriptorSideKey, string> = { product: 'iProduct', role: 'iRole', person: 'iPerson', equipment: 'iEquipment' };
  const shared = {
    descriptorDestination: KEYS.map((k) => row(`ds_${k}`, types[k])),
    descriptorPlan: KEYS.map((k) => row(`dp_${k}`, `ds_${k}`)),
    propertyValue: KEYS.map((k) => row(`pp_${k}`, items[k])),
    variant: KEYS.map((k) => row(`pv_${k}`, items[k])),
    variantValue: KEYS.map((k) => row(`pvv_${k}`, `pv_${k}`)),
  };
  /** what the redux lists of the OTHER sides hold, in the order of otherSideEntities(own).all */
  const listsFor = (own: DescriptorSideKey) => {
    const o = otherSides(own).map((s) => s.key);
    return [...o.map((k) => [row(types[k], 'cat')]), ...o.map((k) => [row(items[k], types[k])])];
  };
  it.each(KEYS)('%s: its own rows stay, the rows of the other three sides are left out', (own) => {
    const other = otherSideRows(own, listsFor(own));
    expect(other.types.map((r) => r.rowGUID).sort()).toEqual(KEYS.filter((k) => k !== own).map((k) => types[k]).sort());
    expect(other.items.map((r) => r.rowGUID).sort()).toEqual(KEYS.filter((k) => k !== own).map((k) => items[k]).sort());
    const { data } = sideOf(shared, other.types, other.items);
    for (const table of Object.keys(shared) as (keyof typeof shared)[]) {
      const prefix = { descriptorDestination: 'ds', descriptorPlan: 'dp', propertyValue: 'pp', variant: 'pv', variantValue: 'pvv' }[table];
      expect(data[table].map((r) => r.rowGUID)).toEqual([`${prefix}_${own}`]);
    }
  });
  it('otherSideRows tolerates a list that is not read yet', () => {
    expect(otherSideRows('person', [undefined, null, undefined, undefined, undefined, undefined])).toEqual({ types: [], items: [] });
  });
});
