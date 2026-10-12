// Equipment catalog: the row shape, the normalizing, the validation, the adapter that shows it to the descriptor rules as a product catalog,
// and the Checks (rules R1-R12 on the equipment side + E1).
import {
  computeEquipmentRowJSON, emptyEquipment, EQUIPMENT_CATALOG_OWNER, EQUIPMENT_ENTITY, EQUIPMENT_OWNERSHIPS, equipmentAutoTitle, equipmentExample, equipmentName,
  equipmentTable, normalizeEquipment, validateEquipment,
} from '../../../kit8/catalog/equipment/equipmentModel';
import { EQUIPMENT_TYPE, EQUIPMENT_TYPE_TABLE, equipmentAsProductData, equipmentTypeOf } from '../../../kit8/catalog/equipment/equipmentTypeModel';
import { EQUIPMENT_KIND, EQUIPMENT_RULES, validateEquipmentCatalog } from '../../../kit8/catalog/equipment/equipmentValidation';
import { equipmentSystemMetaData } from '../../../kit8/catalog/equipment/equipmentMetaData';
import { sideOwnedRows } from '../../../kit8/catalog/product/crud/catalogSides';
import { variantsOfProduct, propertyLinesOfProduct } from '../../../kit8/catalog/product/crud/productCatalogTools';
import { seedEquipmentCatalog } from './equipmentTestKit';

describe('the table', () => {
  it('names: table, redux entity, catalog owner', () => {
    expect(equipmentTable).toBe('equipmentTable');
    expect(EQUIPMENT_ENTITY).toBe('equipmentReusable');
    expect(EQUIPMENT_CATALOG_OWNER).toBe('equipmentCatalog');
    expect(EQUIPMENT_TYPE_TABLE).toMatchObject({ table: 'equipmentTypeTable', entity: 'equipmentTypeReusable', catalogOwner: 'equipmentTypeCatalog' });
    expect(EQUIPMENT_TYPE).toEqual({ heavy: 'equipmentTypeHeavy', vehicle: 'equipmentTypeVehicle' });
  });
  it('both tables are in SystemMetaData: the same shape as the person types (one reusable entity + saga each)', () => {
    const m = equipmentSystemMetaData();
    expect(Object.keys(m).sort()).toEqual(['equipmentReusable', 'equipmentTypeReusable']);
    expect(m.equipmentReusable).toMatchObject({ tableName: 'equipmentTable', itemLabel: 'Equipment' });
    expect(m.equipmentTypeReusable).toMatchObject({ tableName: 'equipmentTypeTable', itemLabel: 'Equipment type' });
    expect(m.equipmentTypeReusable.defaultData).toMatchObject({ variantMode: 'perProduct', isActive: true });
  });
  it('an empty equipment: own, active, no type; the ownership list', () => {
    expect(emptyEquipment()).toMatchObject({ equipmentTitle: '', equipmentType: null, equipmentOwnership: 'own', isActive: true });
    expect(EQUIPMENT_OWNERSHIPS.map((o) => o.value)).toEqual(['own', 'rented', 'leased']);
    expect(equipmentExample.equipmentType).toBe('equipmentTypeHeavy');
  });
});

describe('title and normalize', () => {
  it('the title is manufacturer + model when empty; a typed title wins; the code is the last resort', () => {
    expect(equipmentAutoTitle({ equipmentManufacturer: 'Caterpillar', equipmentModel: '320' })).toBe('Caterpillar 320');
    expect(equipmentAutoTitle({ equipmentManufacturer: '', equipmentModel: '' })).toBe('');
    expect(equipmentName({ rowJSON: { equipmentTitle: 'My crane', equipmentManufacturer: 'X' } })).toBe('My crane');
    expect(equipmentName({ rowJSON: { equipmentManufacturer: 'JCB', equipmentModel: '3CX' } })).toBe('JCB 3CX');
    expect(equipmentName({ rowJSON: { equipmentCode: 'EQ-9' } })).toBe('EQ-9');
    expect(equipmentName(undefined)).toBe('');
  });
  it('normalizeEquipment trims, builds the title, knows the ownership, keeps the type', () => {
    expect(normalizeEquipment({ equipmentTitle: '  ', equipmentManufacturer: ' Liebherr ', equipmentModel: 'LTM ', equipmentCode: ' EQ-3 ', equipmentOwnership: 'bogus' as any, equipmentType: 'equipmentTypeHeavy' })).toMatchObject({
      equipmentTitle: 'Liebherr LTM', equipmentCode: 'EQ-3', equipmentOwnership: 'own', equipmentType: 'equipmentTypeHeavy', equipmentManufacturer: 'Liebherr', isActive: true,
    });
    expect(normalizeEquipment({ equipmentTitle: 'A', equipmentOwnership: 'leased', isActive: false, equipmentType: 'empty' })).toMatchObject({ equipmentOwnership: 'leased', isActive: false, equipmentType: null });
  });
  it('computeEquipmentRowJSON (the table): fills the empty title from manufacturer + model, nothing else', () => {
    expect(computeEquipmentRowJSON({ equipmentTitle: '', equipmentManufacturer: 'JCB', equipmentModel: '3CX' })).toEqual({ equipmentTitle: 'JCB 3CX' });
    expect(computeEquipmentRowJSON({ equipmentTitle: 'Mine', equipmentManufacturer: 'JCB' })).toBeNull();
    expect(computeEquipmentRowJSON({ equipmentTitle: '' })).toBeNull();
  });
});

describe('validateEquipment', () => {
  const rows = [{ rowGUID: 'a', rowJSON: { ...emptyEquipment(), equipmentTitle: 'A', equipmentCode: 'EQ-1' } }];
  it('a title (or manufacturer + model) is required', () => {
    expect(validateEquipment(emptyEquipment()).equipmentTitle).toBe('Title is required.');
    expect(validateEquipment({ ...emptyEquipment(), equipmentManufacturer: 'JCB' }).equipmentTitle).toBeUndefined();
  });
  it('the inventory number is unique (case-insensitive), the row itself is not a duplicate of itself', () => {
    expect(validateEquipment({ ...emptyEquipment(), equipmentTitle: 'B', equipmentCode: 'eq-1' }, rows).equipmentCode).toBe('This inventory number is already used.');
    expect(validateEquipment({ ...emptyEquipment(), equipmentTitle: 'A', equipmentCode: 'EQ-1' }, rows, 'a')).toEqual({});
    expect(validateEquipment({ ...emptyEquipment(), equipmentTitle: 'B', equipmentCode: '' }, rows)).toEqual({});
  });
});

describe('the adapter: an equipment is a product to the descriptor rules', () => {
  const d = seedEquipmentCatalog();
  const adapted = equipmentAsProductData(d);
  it('equipment type = product type; an equipment is owned by its TYPE; the title is read from the row', () => {
    expect(adapted.productType.map((t) => t.rowGUID)).toEqual(['equipmentTypeHeavy', 'equipmentTypeVehicle']);
    const cat = adapted.product.find((p) => p.rowGUID === 'eq_cat320')!;
    expect(cat.rowOwnerGUID).toBe('equipmentTypeHeavy');
    expect(cat.rowJSON.title).toBe('Excavator CAT 320');
    expect(equipmentTypeOf(d.equipment[0])).toBe('equipmentTypeHeavy');
    expect(equipmentTypeOf({ rowJSON: { equipmentType: 'empty' } })).toBeNull();
    expect(equipmentTypeOf(null)).toBeNull();
  });
  it('an equipment without a type is owned by "empty"', () => {
    const a = equipmentAsProductData({ ...d, equipment: [{ rowGUID: 'x', rowOwnerGUID: 'equipmentCatalog', rowParentGUID: 'empty', orderInList: 0, rowJSON: { equipmentTitle: 'X' } }] });
    expect(a.product[0].rowOwnerGUID).toBe('empty');
  });
  it('the product rules find the property lines and the variants of an equipment (rule R4, R6)', () => {
    const cat = adapted.product.find((p) => p.rowGUID === 'eq_cat320')!;
    expect(propertyLinesOfProduct(adapted, cat).map((p) => p.rowParentGUID)).toEqual(['enginePowerKw', 'yearOfManufacture']);
    expect(variantsOfProduct(adapted, cat).map((v) => v.rowJSON.title)).toEqual(['Heavy, With operator', 'Heavy, Dry hire']);
  });
  it('the rows that belong to the equipment side of the shared tables', () => {
    const owned = sideOwnedRows(
      { descriptorDestination: d.descriptorDestination, descriptorPlan: d.descriptorPlan, propertyValue: d.propertyValue, variant: d.variant, variantValue: d.variantValue },
      d.equipmentType.map((t) => t.rowGUID), d.equipment.map((e) => e.rowGUID),
    );
    expect(owned.descriptorDestination.size).toBe(4);
    expect(owned.descriptorPlan.size).toBe(8);
    expect(owned.propertyValue.size).toBe(4);
    expect(owned.variant.size).toBe(4);
    expect(owned.variantValue.size).toBe(8);
  });
});

describe('Checks (the product rules on the equipment side + E1)', () => {
  it('the seed is clean', () => {
    expect(validateEquipmentCatalog(seedEquipmentCatalog())).toEqual([]);
  });
  it('the words and the descriptor target of the equipment side', () => {
    expect(EQUIPMENT_KIND.kind).toBe('equipmentType');
    expect(EQUIPMENT_KIND.words).toMatchObject({ item: 'Equipment', type: 'Equipment type' });
    expect(Object.keys(EQUIPMENT_RULES)).toEqual(expect.arrayContaining(['R3', 'R8', 'R11', 'R12', 'E1']));
    expect(EQUIPMENT_RULES).not.toHaveProperty('GTIN');
    expect(EQUIPMENT_RULES).not.toHaveProperty('R13');
  });
  it('E1: an equipment of a type that is not there', () => {
    const d = seedEquipmentCatalog();
    d.equipment.push({ rowGUID: 'eq_x', rowOwnerGUID: 'equipmentCatalog', rowParentGUID: 'empty', orderInList: 0, rowJSON: { equipmentTitle: 'Ghost', equipmentType: 'equipmentTypeGone' } } as any);
    const issues = validateEquipmentCatalog(d);
    expect(issues.some((i) => i.rule === 'E1' && i.table === 'equipment' && i.rowGUID === 'eq_x' && i.message.includes('"equipmentTypeGone"'))).toBe(true);
  });
  it('R8: a second value of a single-value descriptor (two engine powers) is an error on the equipment side', () => {
    const d = seedEquipmentCatalog();
    d.propertyValue.push({ rowGUID: 'pp_dup', rowOwnerGUID: 'eq_cat320', rowParentGUID: 'dp_eqh_p1', orderInList: 0, rowJSON: { value: 999 } } as any);
    expect(validateEquipmentCatalog(d).some((i) => i.rule === 'R8' && i.rowGUID === 'pp_dup')).toBe(true);
  });
  it('R11: a plan line of a descriptor that is not meant for equipment types', () => {
    const d = seedEquipmentCatalog();
    d.descriptorGenus = d.descriptorGenus.map((g) => (g.rowGUID === 'hireMode' ? { ...g, rowJSON: { ...g.rowJSON, targetKinds: ['personType'] } } : g));
    expect(validateEquipmentCatalog(d).some((i) => i.rule === 'R11')).toBe(true);
  });
});
