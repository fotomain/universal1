// A Time line books a PERSON or an EQUIPMENT (recommendation/EQUIPMENT_TIME.html): the kind of the line, the roles of the kind, the cost from the role rate,
// the match of an equipment with what the role asks for, and what happens when the kind changes. Lines made before equipment (no kind) are person lines.
// the columns module draws a tip icon (a button of the design system): a test double keeps this a pure test
jest.mock('../../../../../kit8/pm/inner/buttons', () => ({ PMTipIcon: () => null }));
// ... and the tree selector of the business unit column (a window with a tree): a test double too
jest.mock('../../../../../kit8/catalog/select/from_tree/SelectCatalogItemFromTreeReusable', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../../kit8/catalog/select/with_folders/SelectCatalogItemWithFolders', () => ({ __esModule: true, default: () => null }));

import {
  anyResourceTitle, isWorkerKind, lineResourceKind, lineResourceTitle, resourceBelongsToOtherKind, resourceRowTitle, resourceTitleOfRow, roleResourceKind,
} from '../../../../../kit8/pm/view/task/finances/taskLineResource';
import { emptyTaskLineCatalogs, lineProblems, roleFitsLine, suggestForLine, TaskLineCatalogData } from '../../../../../kit8/pm/view/task/finances/taskLineCatalogs';
import { computeTaskLineRowJSON } from '../../../../../kit8/pm/view/task/finances/taskLineCompute';
import { personMatchProblems, personVariantOptions, effectivePersonVariant, resourceMatchProblems, resourceVariants, unmetRequirements } from '../../../../../kit8/pm/view/task/finances/taskLinePersonMatch';
import { buildTaskLineColumns, taskLineErrors } from '../../../../../kit8/pm/view/task/finances/taskLineColumns';
import { emptyTaskLine, TASK_LINE_GENUS, taskLineGenusDef } from '../../../../../kit8/pm/view/task/finances/taskLineModel';
import { resourceKindOfRoleType } from '../../../../../kit8/catalog/resourcerole/resourceRoleModel';

const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any, orderInList = 0) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });
const TIME = taskLineGenusDef('timeGenus')!;
const MATERIAL = taskLineGenusDef('materialGenus')!;

/** persons + equipment, a person role type (no resourceKind: the old data) and an equipment role type */
function data(): TaskLineCatalogData {
  const d = emptyTaskLineCatalogs();
  d.managementGenus = [row('timeGenus', 'managementGenusCatalog', 'costsGenus', { title: 'Time' })];
  d.measureUnit = [row('unit_hour', 'measureUnitCatalog', 'empty', { title: 'hour' })];
  d.valueAddedTax = [row('vat_0', 'valueAddedTaxCatalog', 'empty', { vatTablePercent: 0 })];
  d.priceType = [row('pt_cost', 'priceTypeCatalog', 'empty', { title: 'Cost', appliesTo: ['resourceRoleType'] })];
  d.resourceRoleType = [
    row('type_hr', 'resourceRoleTypeCatalog', 'empty', { title: 'Human', managementGenus: 'timeGenus', baseUnit: 'unit_hour', roleVATDefaultRate: 'vat_0', variantMode: 'perType' }),
    row('type_eq', 'resourceRoleTypeCatalog', 'empty', { title: 'Equipment resources', managementGenus: 'timeGenus', resourceKind: 'equipment', baseUnit: 'unit_hour', roleVATDefaultRate: 'vat_0', variantMode: 'perType', variantSet: 'ds_eq_rvar' }),
  ];
  d.resourceRole = [row('role_da', 'type_hr', 'empty', { title: 'Data analyst' }), row('role_exc', 'type_eq', 'empty', { title: 'Excavator 20 t' })];
  d.rolePrice = [
    row('rp_da', 'role_da', 'empty', { priceTypeGUID: 'pt_cost', price: 40, measureUnit: 'unit_hour', validFrom: '2020-01-01' }),
    row('rp_exc', 'role_exc', 'empty', { priceTypeGUID: 'pt_cost', price: 95, measureUnit: 'unit_hour', validFrom: '2020-01-01' }),
  ];
  d.descriptorGenus = [
    row('equipmentClass', 'descriptorGenusCatalog', 'empty', { title: 'Class', valueType: 'ref' }),
    row('hireMode', 'descriptorGenusCatalog', 'empty', { title: 'Hire mode', valueType: 'ref' }),
    row('minEnginePowerKw', 'descriptorGenusCatalog', 'empty', { title: 'Min. engine power, kW', valueType: 'number' }),
    row('enginePowerKw', 'descriptorGenusCatalog', 'empty', { title: 'Engine power, kW', valueType: 'number', unit: 'kW', satisfies: 'minEnginePowerKw' }),
  ];
  d.descriptorValue = [
    row('dv_light', 'equipmentClass', 'empty', { title: 'Light' }), row('dv_heavy', 'equipmentClass', 'empty', { title: 'Heavy' }),
    row('dv_dry', 'hireMode', 'empty', { title: 'Dry hire' }), row('dv_op', 'hireMode', 'empty', { title: 'With operator' }),
  ];
  d.descriptorDestination = [
    row('ds_eq_rprop', 'type_eq', 'property', {}), row('ds_eq_rvar', 'type_eq', 'variant', {}),
    row('ds_heavy_prop', 'equipmentTypeHeavy', 'property', {}), row('ds_heavy_var', 'equipmentTypeHeavy', 'variant', {}),
  ];
  d.descriptorPlan = [
    // the ROLE side: needs min 100 kW and a Heavy, With operator variant
    row('dp_r_pow', 'ds_eq_rprop', 'minEnginePowerKw', { required: true }),
    row('dp_r_cls', 'ds_eq_rvar', 'equipmentClass', { required: true }), row('dp_r_hire', 'ds_eq_rvar', 'hireMode', { required: true }),
    // the EQUIPMENT side - other plan lines, same descriptors
    row('dp_h_pow', 'ds_heavy_prop', 'enginePowerKw', { required: true }),
    row('dp_h_cls', 'ds_heavy_var', 'equipmentClass', { required: true }), row('dp_h_hire', 'ds_heavy_var', 'hireMode', { required: true }),
  ];
  d.propertyValue = [
    row('pp_role_pow', 'role_exc', 'dp_r_pow', { value: 100 }),
    row('pp_cat', 'eq_cat', 'dp_h_pow', { value: 110 }),
    row('pp_small', 'eq_small', 'dp_h_pow', { value: 60 }),
  ];
  d.variant = [
    row('rv_heavy_op', 'type_eq', 'empty', { title: 'Heavy, With operator', descriptorKey: 'dp_r_cls=dv_heavy|dp_r_hire=dv_op' }),
    row('cat_v1', 'eq_cat', 'empty', { title: 'Heavy, With operator', descriptorKey: 'dp_h_cls=dv_heavy|dp_h_hire=dv_op', isActive: true }, 1),
    row('cat_v2', 'eq_cat', 'empty', { title: 'Heavy, Dry hire', descriptorKey: 'dp_h_cls=dv_heavy|dp_h_hire=dv_dry', isActive: true }, 2),
    row('small_v1', 'eq_small', 'empty', { title: 'Light, Dry hire', descriptorKey: 'dp_h_cls=dv_light|dp_h_hire=dv_dry', isActive: true }, 1),
  ];
  d.person = [row('p_anna', 'personCatalog', 'empty', { personFirstName: 'Anna', personLastName: 'Berg', personType: 'personTypeEmployee' })];
  d.equipment = [
    row('eq_cat', 'equipmentCatalog', 'empty', { equipmentTitle: 'Excavator CAT 320', equipmentType: 'equipmentTypeHeavy', isActive: true }),
    row('eq_small', 'equipmentCatalog', 'empty', { equipmentTitle: 'Mini excavator', equipmentType: 'equipmentTypeHeavy', isActive: true }),
    row('eq_old', 'equipmentCatalog', 'empty', { equipmentTitle: 'Old crane', equipmentType: 'equipmentTypeHeavy', isActive: false }),
  ];
  return d;
}

describe('the kind of a line', () => {
  it('Time: the line says it; no kind = person (every line made before equipment). The other genus book products', () => {
    expect(lineResourceKind(TIME, {})).toBe('person');
    expect(lineResourceKind(TIME, { taskResourceKind: null })).toBe('person');
    expect(lineResourceKind(TIME, { taskResourceKind: 'person' })).toBe('person');
    expect(lineResourceKind(TIME, { taskResourceKind: 'equipment' })).toBe('equipment');
    expect(lineResourceKind(MATERIAL, { taskResourceKind: 'equipment' })).toBe('product');
    expect(lineResourceKind(TIME, undefined)).toBe('person');
  });
  it('the genus defs: Time can book a person or an equipment, the others a product', () => {
    expect(TASK_LINE_GENUS.map((g) => [g.genus, g.resources])).toEqual([
      ['timeGenus', ['person', 'equipment']], ['materialGenus', ['product']], ['expenseGenus', ['product']], ['revenueGenus', ['product']],
    ]);
    expect(isWorkerKind('person')).toBe(true);
    expect(isWorkerKind('equipment')).toBe(true);
    expect(isWorkerKind('product')).toBe(false);
  });
  it('a new line has no kind (null = person)', () => {
    expect(emptyTaskLine().taskResourceKind).toBeNull();
  });
});

describe('the role of a line is a role of its kind', () => {
  const d = data();
  it('the role type says: no resourceKind = person (old data), equipment only when it says so', () => {
    expect(resourceKindOfRoleType(undefined)).toBe('person');
    expect(resourceKindOfRoleType({ rowJSON: {} })).toBe('person');
    expect(resourceKindOfRoleType({ rowJSON: { resourceKind: 'equipment' } })).toBe('equipment');
    expect(resourceKindOfRoleType({ rowJSON: { resourceKind: 'x' } })).toBe('person');
    expect(roleResourceKind(d, d.resourceRole[0])).toBe('person');
    expect(roleResourceKind(d, d.resourceRole[1])).toBe('equipment');
  });
  it('roleFitsLine: the roles of the genus AND of the kind of the line', () => {
    const [da, exc] = d.resourceRole;
    expect(roleFitsLine(d, TIME, {}, da)).toBe(true);
    expect(roleFitsLine(d, TIME, {}, exc)).toBe(false);
    expect(roleFitsLine(d, TIME, { taskResourceKind: 'equipment' }, exc)).toBe(true);
    expect(roleFitsLine(d, TIME, { taskResourceKind: 'equipment' }, da)).toBe(false);
    expect(roleFitsLine(d, MATERIAL, {}, da)).toBe(false);
    expect(roleFitsLine(d, TIME, {}, undefined)).toBe(false);
  });
  it('a role of the other kind is marked (never refused)', () => {
    expect(lineProblems(d, TIME, { taskResourceKind: 'equipment', resourceRoleItem: 'role_da' })).toEqual(['The role is not an equipment role']);
    expect(lineProblems(d, TIME, { taskResourceKind: 'person', resourceRoleItem: 'role_exc' })).toEqual(['The role is not a person role']);
    expect(lineProblems(d, TIME, { resourceRoleItem: 'role_da' })).toEqual([]);
    expect(lineProblems(d, TIME, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc' })).toEqual([]);
  });
});

describe('the equipment of a line', () => {
  const d = data();
  it('an equipment that is gone or inactive is marked', () => {
    expect(lineProblems(d, TIME, { taskResourceKind: 'equipment', taskResourceItem: 'nope' })).toEqual(['The equipment does not exist any more']);
    expect(lineProblems(d, TIME, { taskResourceKind: 'equipment', taskResourceItem: 'eq_old' })).toEqual(['The equipment is not active']);
    expect(lineProblems(d, TIME, { taskResourceKind: 'equipment', taskResourceItem: 'eq_cat' })).toEqual([]);
  });
  it('the same GUID on a person line is not checked against the equipment catalog', () => {
    expect(lineProblems(d, TIME, { taskResourceItem: 'nope' })).toEqual([]);
  });
  it('titles: person, equipment, product - by kind, by owner, by GUID', () => {
    expect(resourceRowTitle('person', d.person[0])).toBe('Anna Berg');
    expect(resourceRowTitle('equipment', d.equipment[0])).toBe('Excavator CAT 320');
    expect(resourceTitleOfRow(d.person[0])).toBe('Anna Berg');
    expect(resourceTitleOfRow(d.equipment[0])).toBe('Excavator CAT 320');
    expect(lineResourceTitle(d, TIME, { taskResourceKind: 'equipment', taskResourceItem: 'eq_cat' })).toBe('Excavator CAT 320');
    expect(lineResourceTitle(d, TIME, { taskResourceItem: 'p_anna' })).toBe('Anna Berg');
    expect(lineResourceTitle(d, TIME, { taskResourceKind: 'equipment', taskResourceItem: 'p_anna' })).toBe('');
    expect(anyResourceTitle(d, 'eq_small')).toBe('Mini excavator');
    expect(anyResourceTitle(d, 'p_anna')).toBe('Anna Berg');
    expect(anyResourceTitle(d, null)).toBe('');
  });
  it('a resource of the OTHER kind: found in the other catalog only', () => {
    expect(resourceBelongsToOtherKind(d, 'equipment', 'p_anna')).toBe(true);
    expect(resourceBelongsToOtherKind(d, 'person', 'eq_cat')).toBe(true);
    expect(resourceBelongsToOtherKind(d, 'person', 'p_anna')).toBe(false);
    expect(resourceBelongsToOtherKind(d, 'equipment', 'eq_cat')).toBe(false);
    expect(resourceBelongsToOtherKind(d, 'equipment', 'unknown')).toBe(false);
    expect(resourceBelongsToOtherKind(d, 'product', 'p_anna')).toBe(false);
  });
});

describe('the cost of an hour of equipment = the rate of the role (it has no contract)', () => {
  const d = data();
  it('suggestForLine: the role rate and the unit hour', () => {
    const s = suggestForLine(d, TIME, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc', taskResourceItem: 'eq_cat' }, '2026-10-09');
    expect(s).toMatchObject({ price: 95, priceSource: 'role', measureUnit: 'unit_hour' });
  });
  it('a contract left on an equipment line is not used', () => {
    const withContract = { ...d, contract: [row('c1', 'eq_cat', 'person', { contractSumBeforeVAT: 100, contractPaymentsPeriod: 'Day' })] };
    const s = suggestForLine(withContract, TIME, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc', taskResourceItem: 'eq_cat', taskResourceContract: 'c1' }, '2026-10-09');
    expect(s?.priceSource).toBe('role');
    expect(s?.price).toBe(95);
  });
  it('computeTaskLineRowJSON prices the line: qty x price', () => {
    const patch = computeTaskLineRowJSON(d, TIME, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc', taskResourceItem: 'eq_cat', qtyTaskLine: 8 }, '2026-10-09');
    expect(patch).toMatchObject({ priceTaskLine: 95, priceSourceTaskLine: 'role', sumForContract: 760, taskIsPosted: false });
  });
});

describe('changing the kind of a line clears what depended on it', () => {
  const d = data();
  it('a person line switched to Equipment: the person, his variant and his contract go; the person role goes', () => {
    const patch = computeTaskLineRowJSON(d, TIME, {
      taskResourceKind: 'equipment', resourceRoleItem: 'role_da', resourceRoleAttributeSetKey: 'x', taskResourceItem: 'p_anna', taskResourceAttributesKey: 'dp1=v', taskResourceContract: 'c_anna',
    });
    expect(patch).toMatchObject({ taskResourceItem: null, taskResourceAttributesKey: null, taskResourceContract: null, resourceRoleItem: null, resourceRoleAttributeSetKey: null });
  });
  it('an equipment line switched to Person: the equipment and the equipment role go', () => {
    const patch = computeTaskLineRowJSON(d, TIME, { taskResourceKind: 'person', resourceRoleItem: 'role_exc', taskResourceItem: 'eq_cat', taskResourceAttributesKey: 'dp_h_cls=dv_heavy|dp_h_hire=dv_op' });
    expect(patch).toMatchObject({ taskResourceItem: null, taskResourceAttributesKey: null, resourceRoleItem: null });
  });
  it('a consistent line is left alone (a person line without a kind; an equipment line)', () => {
    const person = computeTaskLineRowJSON(d, TIME, { resourceRoleItem: 'role_da', taskResourceItem: 'p_anna' });
    expect(person.taskResourceItem).toBeUndefined();
    expect(person.resourceRoleItem).toBeUndefined();
    const eq = computeTaskLineRowJSON(d, TIME, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc', taskResourceItem: 'eq_cat', taskResourceAttributesKey: 'dp_h_cls=dv_heavy|dp_h_hire=dv_op' });
    expect(eq.taskResourceItem).toBeUndefined();
    expect(eq.taskResourceAttributesKey).toBeUndefined();
    expect(eq.resourceRoleItem).toBeUndefined();
  });
  it('an equipment line carrying a contract: the contract goes', () => {
    const patch = computeTaskLineRowJSON(d, TIME, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc', taskResourceItem: 'eq_cat', taskResourceContract: 'c1' });
    expect(patch.taskResourceContract).toBeNull();
  });
  it('the variant of an equipment must be one of ITS variants', () => {
    const patch = computeTaskLineRowJSON(d, TIME, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc', taskResourceItem: 'eq_small', taskResourceAttributesKey: 'dp_h_cls=dv_heavy|dp_h_hire=dv_op' });
    expect(patch.taskResourceAttributesKey).toBeNull();
  });
});

describe('an equipment matches what the role asks for - on the descriptor, as a person does', () => {
  const d = data();
  const base = { taskResourceKind: 'equipment' as const, resourceRoleItem: 'role_exc', resourceRoleAttributeSetKey: 'dp_r_cls=dv_heavy|dp_r_hire=dv_op' };
  it('the variants of an equipment, found by its GUID (the same function serves persons)', () => {
    expect(resourceVariants(d, 'eq_cat').map((v) => v.title)).toEqual(['Heavy, With operator', 'Heavy, Dry hire']);
    expect(resourceVariants(d, 'eq_small')).toHaveLength(1);
  });
  it('automatic = the first variant that covers the role; the picker marks which cover', () => {
    expect(effectivePersonVariant(d, { ...base, taskResourceItem: 'eq_cat' })?.title).toBe('Heavy, With operator');
    const opts = personVariantOptions(d, { ...base, taskResourceItem: 'eq_cat' });
    expect(opts.map((o) => [o.label, o.hint])).toEqual([['Heavy, With operator', 'covers the role'], ['Heavy, Dry hire', 'does not cover the role']]);
  });
  it('no variant covers the role: the message names the equipment, not a person', () => {
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'eq_small' })).toEqual(
      expect.arrayContaining(['The equipment has no variant that covers the role: needs Class = Heavy, Hire mode = With operator']),
    );
    expect(resourceMatchProblems).toBe(personMatchProblems);
  });
  it('a chosen variant that does not cover the role; a variant of another equipment', () => {
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'eq_cat', taskResourceAttributesKey: 'dp_h_cls=dv_heavy|dp_h_hire=dv_dry' })[0])
      .toBe('The variant "Heavy, Dry hire" does not cover the role: needs Hire mode = With operator');
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'eq_cat', taskResourceAttributesKey: 'dp_h_cls=dv_light|dp_h_hire=dv_dry' })[0])
      .toBe('The variant is not a variant of this equipment');
  });
  it('a property: "needs at least 100 kW" - the equipment answers with Engine power (satisfies Min. engine power)', () => {
    expect(unmetRequirements(d, 'role_exc', 'eq_cat', 'equipment')).toEqual([]);
    expect(unmetRequirements(d, 'role_exc', 'eq_small', 'equipment')).toEqual(['Engine power, kW: needs at least 100, has 60 kW']);
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'eq_small', taskResourceAttributesKey: 'dp_h_cls=dv_heavy|dp_h_hire=dv_op' }).join(' | '))
      .toContain('Engine power, kW: needs at least 100, has 60 kW');
  });
  it('a covering equipment has no problem at all; a Material line is never matched', () => {
    expect(personMatchProblems(d, TIME, { ...base, taskResourceItem: 'eq_cat' })).toEqual([]);
    expect(personMatchProblems(d, MATERIAL, { ...base, taskResourceItem: 'eq_small' })).toEqual([]);
    expect(taskLineErrors(d, TIME, { ...base, taskResourceItem: 'eq_cat' })).toEqual([]);
  });
});

describe('the columns of the Time table follow the kinds the project offers', () => {
  const d = data();
  const keys = (timeKinds?: ('person' | 'equipment')[]) => buildTaskLineColumns({ data: d, genus: TIME, textColor: '#000', errorColor: '#f00', showErrors: false, timeKinds }).map((c) => c.key);
  it('person only (and the default) = the columns as before equipment', () => {
    expect(keys()).toEqual(['budgetItem', 'n', 'role', 'roleAttributes', 'person', 'personVariant', 'contract', 'qty', 'unit', 'price', 'vat', 'distribution', 'sum', 'sumVAT', 'currency']);
    expect(keys(['person'])).toEqual(keys());
  });
  it('equipment only: Equipment and its variant, no Contract', () => {
    expect(keys(['equipment'])).toEqual(['budgetItem', 'n', 'role', 'roleAttributes', 'equipment', 'equipmentVariant', 'qty', 'unit', 'price', 'vat', 'distribution', 'sum', 'sumVAT', 'currency']);
  });
  it('both: the menu Resource comes BEFORE the role and the resource; ONE resource column and ONE variant column', () => {
    const k = keys(['person', 'equipment']);
    expect(k).toEqual(['budgetItem', 'n', 'resourceKind', 'role', 'roleAttributes', 'resource', 'resourceVariant', 'contract', 'qty', 'unit', 'price', 'vat', 'distribution', 'sum', 'sumVAT', 'currency']);
    expect(k.indexOf('resourceKind')).toBeLessThan(k.indexOf('role'));
    expect(k.indexOf('resourceKind')).toBeLessThan(k.indexOf('resource'));
  });
  it('the menu stores taskResourceKind and offers the two kinds', () => {
    const col: any = buildTaskLineColumns({ data: d, genus: TIME, textColor: '#000', errorColor: '#f00', showErrors: false, timeKinds: ['person', 'equipment'] }).find((c) => c.key === 'resourceKind');
    expect(col).toMatchObject({ type: 'select', field: 'taskResourceKind', allowEmpty: false });
    expect(col.options.map((o: any) => o.value)).toEqual(['person', 'equipment']);
  });
  it('the resource column: the catalog follows the Resource of the row; titles from both catalogs; an inactive equipment is not offered', () => {
    const col: any = buildTaskLineColumns({ data: d, genus: TIME, textColor: '#000', errorColor: '#f00', showErrors: false, timeKinds: ['person', 'equipment'] }).find((c) => c.key === 'resource');
    expect(col).toMatchObject({ type: 'catalog', field: 'taskResourceItem', catalogEntityName: 'personReusable', catalogEntityNames: ['personReusable', 'equipmentReusable'] });
    expect(col.catalogEntityNameOf({ rowJSON: {} })).toBe('personReusable');
    expect(col.catalogEntityNameOf({ rowJSON: { taskResourceKind: 'person' } })).toBe('personReusable');
    expect(col.catalogEntityNameOf({ rowJSON: { taskResourceKind: 'equipment' } })).toBe('equipmentReusable');
    expect(col.titleExtractor(d.person[0])).toBe('Anna Berg');
    expect(col.titleExtractor(d.equipment[0])).toBe('Excavator CAT 320');
    expect(col.filterItem(d.equipment[2], { rowJSON: {} })).toBe(false);
    expect(col.filterItem(d.equipment[2], { rowJSON: { taskResourceItem: 'eq_old' } })).toBe(true);
    expect(col.filterItem(d.person[0], { rowJSON: {} })).toBe(true);
  });
  it('the role picker follows the kind of the line', () => {
    const col: any = buildTaskLineColumns({ data: d, genus: TIME, textColor: '#000', errorColor: '#f00', showErrors: false, timeKinds: ['person', 'equipment'] }).find((c) => c.key === 'role');
    const [da, exc] = d.resourceRole;
    expect(col.filterItem(da, { rowJSON: {} })).toBe(true);
    expect(col.filterItem(exc, { rowJSON: {} })).toBe(false);
    expect(col.filterItem(exc, { rowJSON: { taskResourceKind: 'equipment' } })).toBe(true);
    expect(col.filterItem(da, { rowJSON: { taskResourceKind: 'equipment' } })).toBe(false);
  });
  it('the Material table is not touched by any of it', () => {
    const k = buildTaskLineColumns({ data: d, genus: MATERIAL, textColor: '#000', errorColor: '#f00', showErrors: false, timeKinds: ['person', 'equipment'] }).map((c) => c.key);
    expect(k).toContain('product');
    expect(k).not.toContain('resourceKind');
    expect(k).not.toContain('resource');
  });
});

describe('Item number / Search name columns of the Material table (project settings "Visible in projects")', () => {
  const d = data();
  d.product = [{ rowGUID: 'p1', rowOwnerGUID: 'type', rowParentGUID: 'empty', orderInList: 0, rowJSON: { title: 'Bolt', itemNumber: '100-0245', searchName: 'screw' } } as any];
  const field = (shown: boolean) => ({ enabled: shown, shown });
  const keys = (productFields?: any, genus = MATERIAL) => buildTaskLineColumns({ data: d, genus, textColor: '#000', errorColor: '#f00', showErrors: false, productFields }).map((c) => c.key);
  it('no switch = no column (as before)', () => {
    expect(keys()).not.toContain('productItemNumber');
    expect(keys()).not.toContain('productSearchName');
    expect(keys({ itemNumber: { enabled: true, shown: false }, searchName: { enabled: true, shown: false } })).not.toContain('productItemNumber');
  });
  it('both shown: Item number, Search name, then Product', () => {
    const k = keys({ itemNumber: field(true), searchName: field(true) });
    expect(k.indexOf('productItemNumber')).toBe(k.indexOf('productSearchName') - 1);
    expect(k.indexOf('productSearchName')).toBe(k.indexOf('product') - 1);
  });
  it('each one alone, right before Product; the Time table has none', () => {
    const a = keys({ itemNumber: field(true), searchName: field(false) });
    expect(a.indexOf('productItemNumber')).toBe(a.indexOf('product') - 1);
    expect(a).not.toContain('productSearchName');
    const b = keys({ itemNumber: field(false), searchName: field(true) });
    expect(b.indexOf('productSearchName')).toBe(b.indexOf('product') - 1);
    expect(keys({ itemNumber: field(true), searchName: field(true) }, TIME)).not.toContain('productItemNumber');
  });
  it('the cells show the field of the chosen product (and are inputs for a fast choice)', () => {
    const cols: any[] = buildTaskLineColumns({ data: d, genus: MATERIAL, textColor: '#000', errorColor: '#f00', showErrors: false, productFields: { itemNumber: field(true), searchName: field(true) } });
    const item = cols.find((c) => c.key === 'productItemNumber');
    const name = cols.find((c) => c.key === 'productSearchName');
    expect(item.editable).not.toBe(false);
    expect(item.searchText({ rowJSON: { taskResourceItem: 'p1' } })).toBe('100-0245');
    expect(name.searchText({ rowJSON: { taskResourceItem: 'p1' } })).toBe('screw');
    expect(item.searchText({ rowJSON: { taskResourceItem: 'none' } })).toBe('');
  });
});
