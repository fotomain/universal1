// Work center model (kit8/catalog/work_center/workCenterModel.ts): the kinds, the bases (a free catalog item of the kind, a supplier partner), the variants, the folders = business units
// (shown only while they hold a work center), the validation of the New work center window.
import {
  baseName, canCopyVariantSettings, computeWorkCenterRowJSON, emptyWorkCenterData, isSupplierPartner, newWorkCenterJSON, validateWorkCenter, WORK_CENTER_KINDS, WORK_CENTER_TABLE, workCenterBaseOptions,
  workCenterBaseVariantOptions, workCenterFolderNodes, workCenterHasOwnVariant, workCenterKindLabel, workCenterName, workCenterOwnVariantOptions, workCenterUnitOptions,
} from '../../../kit8/catalog/work_center/workCenterModel';
import type { WorkCenterCatalogData } from '../../../kit8/catalog/work_center/workCenterModel';

const row = (rowGUID: string, rowJSON: any = {}, rowParentGUID = 'empty', rowOwnerGUID = 'x', orderInList = 0): any => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON });

const data = (over: Partial<WorkCenterCatalogData> = {}): WorkCenterCatalogData => ({
  ...emptyWorkCenterData(),
  person: [row('p-anna', { personFirstName: 'Anna', personLastName: 'K' }), row('p-boris', { personFirstName: 'Boris', personLastName: 'M' })],
  equipment: [row('e-crane', { equipmentTitle: 'Tower crane' }), row('e-old', { equipmentTitle: 'Old press', isActive: false }), row('e-exc', { equipmentManufacturer: 'Caterpillar', equipmentModel: '320' })],
  partner: [row('pa-sup', { partnerTitle: 'Acme Logistics', partnerIsSupplier: true }), row('pa-cus', { partnerTitle: 'Customer only', partnerIsSupplier: false }), row('pa-off', { partnerTitle: 'Closed supplier', partnerIsSupplier: true, isActive: false })],
  businessUnit: [row('bu-ent', { title: 'Enterprise' }), row('bu-sales', { title: 'Sales' }, 'bu-ent'), row('bu-key', { title: 'Key accounts' }, 'bu-sales'), row('bu-it', { title: 'IT' }, 'bu-ent'), row('bu-off', { title: 'Closed', isActive: false })],
  ...over,
});

describe('the table definition', () => {
  it('is the generic catalog table workCenterTable with its own entity and owner', () => {
    expect(WORK_CENTER_TABLE).toMatchObject({ table: 'workCenterTable', entity: 'workCenterReusable', catalogOwner: 'workCenterCatalog', itemLabel: 'Work center' });
    expect(WORK_CENTER_TABLE.emptyRowJSON()).toMatchObject({ workCenterKind: null, workCenterBase: null, workCenterBaseVariant: null, workCenterVariant: null, resourceCalendar: null, businessUnit: null, isActive: true });
  });
  it('the kinds are Person, Equipment, Partner', () => {
    expect(WORK_CENTER_KINDS.map((k) => k.value)).toEqual(['person', 'equipment', 'partner']);
    expect(workCenterKindLabel('partner')).toBe('Partner');
    expect(workCenterKindLabel('room')).toBe('');
  });
});

describe('names', () => {
  it('a base is named by its catalog: a person by first + last name, an equipment by its title or manufacturer + model, a partner by its title', () => {
    const d = data();
    expect(baseName('person', d.person[0])).toBe('Anna K');
    expect(baseName('equipment', d.equipment[0])).toBe('Tower crane');
    expect(baseName('equipment', d.equipment[2])).toBe('Caterpillar 320');
    expect(baseName('partner', d.partner[0])).toBe('Acme Logistics');
  });
  it('a work center is named by its title, else by its base', () => {
    const d = data();
    expect(workCenterName(row('w1', { workCenterTitle: 'Anna line' }), d)).toBe('Anna line');
    expect(workCenterName(row('w2', { workCenterKind: 'person', workCenterBase: 'p-boris' }), d)).toBe('Boris M');
    expect(workCenterName(row('w3', {}), d)).toBe('w3');
  });
});

describe('workCenterBaseOptions: a free catalog item of the kind', () => {
  it('lists the catalog of the kind, by name', () => {
    expect(workCenterBaseOptions(data(), 'person').map((o) => o.label)).toEqual(['Anna K', 'Boris M']);
    expect(workCenterBaseOptions(data(), null)).toEqual([]);
  });
  it('an item that is the base of ANOTHER work center is not offered; the one this work center has stays', () => {
    const d = data({ workCenter: [row('w-anna', { workCenterKind: 'person', workCenterBase: 'p-anna' })] });
    expect(workCenterBaseOptions(d, 'person').map((o) => o.value)).toEqual(['p-boris']);
    expect(workCenterBaseOptions(d, 'person', 'w-anna').map((o) => o.value)).toEqual(['p-anna', 'p-boris']);
  });
  it('one catalog, one work center: the same GUID in another kind is a different item', () => {
    const d = data({ workCenter: [row('w1', { workCenterKind: 'person', workCenterBase: 'e-crane' })] });
    expect(workCenterBaseOptions(d, 'equipment').map((o) => o.value)).toContain('e-crane');
  });
  it('an inactive equipment is not offered', () => {
    expect(workCenterBaseOptions(data(), 'equipment').map((o) => o.label)).toEqual(['Caterpillar 320', 'Tower crane']);
  });
  it('a partner is offered only when it is an active supplier (partnerIsSupplier)', () => {
    expect(workCenterBaseOptions(data(), 'partner').map((o) => o.label)).toEqual(['Acme Logistics']);
    expect(isSupplierPartner(data().partner[1])).toBe(false);
    expect(isSupplierPartner(data().partner[2])).toBe(false);
  });
  it('a work center whose partner lost the flag keeps that partner in its list (nothing happens to it)', () => {
    const d = data({ workCenter: [row('w-cus', { workCenterKind: 'partner', workCenterBase: 'pa-cus' })] });
    expect(workCenterBaseOptions(d, 'partner', 'w-cus').map((o) => o.value)).toEqual(['pa-sup', 'pa-cus']);      // by name; the partner that lost the flag is still there
  });
});

describe('variants: the base variants to copy and the work center variant it makes', () => {
  const variants = [
    row('bv-1', { title: 'Senior, English', descriptorKey: 'k1' }, 'empty', 'p-anna', 2),
    row('bv-2', { title: 'Middle', descriptorKey: 'k2' }, 'empty', 'p-anna', 1),
    row('bv-3', { title: 'Hidden', descriptorKey: 'k3', isActive: false }, 'empty', 'p-anna', 3),
    row('bv-4', { title: 'No key' }, 'empty', 'p-anna', 4),
    row('own-1', { title: 'Senior, English', descriptorKey: 'k1' }, 'empty', 'w-anna', 1),
  ];
  it('the base variants are the active variants of the BASE (value = descriptorKey), by order', () => {
    expect(workCenterBaseVariantOptions(variants, 'p-anna')).toEqual([{ value: 'k2', label: 'Middle' }, { value: 'k1', label: 'Senior, English' }]);
    expect(workCenterBaseVariantOptions(variants, 'pa-sup')).toEqual([]);      // a partner has no descriptor variants
    expect(workCenterBaseVariantOptions(variants, null)).toEqual([]);
  });
  it('the work center variants are the ones the work center owns', () => {
    expect(workCenterOwnVariantOptions(variants, 'w-anna')).toEqual([{ value: 'k1', label: 'Senior, English' }]);
    expect(workCenterOwnVariantOptions(variants, 'w-other')).toEqual([]);
  });
  it('Copy Variant settings asks first when the work center has a variant already', () => {
    expect(workCenterHasOwnVariant(variants, 'w-anna')).toBe(true);
    expect(workCenterHasOwnVariant(variants, 'w-other')).toBe(false);
    expect(workCenterHasOwnVariant(variants, null)).toBe(false);
  });
  it('the button needs a base variant', () => {
    expect(canCopyVariantSettings(row('w', { workCenterBaseVariant: 'k1' }))).toBe(true);
    expect(canCopyVariantSettings(row('w', { workCenterBaseVariant: null }))).toBe(false);
    expect(canCopyVariantSettings(null)).toBe(false);
  });
  it('changing the base clears a base variant that is not a variant of the new base', () => {
    const compute = computeWorkCenterRowJSON(variants);
    expect(compute({ workCenterBase: 'p-anna', workCenterBaseVariant: 'k1' })).toBeNull();
    expect(compute({ workCenterBase: 'p-boris', workCenterBaseVariant: 'k1' })).toEqual({ workCenterBaseVariant: null });
    expect(compute({ workCenterBase: 'p-boris', workCenterBaseVariant: null })).toBeNull();
  });
});

describe('folders = business units, shown only while a work center is in them', () => {
  it('no work center = no folder', () => {
    expect(workCenterFolderNodes(data().businessUnit, [])).toEqual([]);
  });
  it('a unit with a work center is a folder, with the units above it (the path)', () => {
    const nodes = workCenterFolderNodes(data().businessUnit, [row('w1', {}, 'bu-key')]);
    expect(nodes.map((n) => n.id).sort()).toEqual(['bu-ent', 'bu-key', 'bu-sales']);
    expect(nodes.find((n) => n.id === 'bu-key')).toMatchObject({ parentId: 'bu-sales', title: 'Key accounts' });
    expect(nodes.find((n) => n.id === 'bu-ent')).toMatchObject({ parentId: null });
  });
  it('a sibling unit without a work center stays hidden; entering one in it shows it; removing the last one hides it again', () => {
    const units = data().businessUnit;
    const one = workCenterFolderNodes(units, [row('w1', {}, 'bu-key')]);
    expect(one.some((n) => n.id === 'bu-it')).toBe(false);
    const two = workCenterFolderNodes(units, [row('w1', {}, 'bu-key'), row('w2', {}, 'bu-it')]);
    expect(two.some((n) => n.id === 'bu-it')).toBe(true);
    const back = workCenterFolderNodes(units, [row('w1', {}, 'bu-key')]);
    expect(back.some((n) => n.id === 'bu-it')).toBe(false);
  });
  it('a work center in no known unit adds no folder', () => {
    expect(workCenterFolderNodes(data().businessUnit, [row('w1', {}, 'empty'), row('w2', {}, 'nope')])).toEqual([]);
  });
  it('the units a work center can be put in are the active ones, with their path', () => {
    const options = workCenterUnitOptions(data().businessUnit);
    expect(options.map((o) => o.label)).toEqual(['Enterprise', 'Enterprise › IT', 'Enterprise › Sales', 'Enterprise › Sales › Key accounts']);
  });
});

describe('validateWorkCenter: the rules of the SQL trigger, before the server says them', () => {
  const good = { workCenterKind: 'person' as const, workCenterBase: 'p-boris', businessUnit: 'bu-it' };
  it('a kind, a free base of that kind and a business unit make a valid work center', () => {
    expect(validateWorkCenter(good, data())).toEqual({});
  });
  it('the kind is required', () => {
    expect(validateWorkCenter({ ...good, workCenterKind: null }, data()).workCenterKind).toMatch(/Person, Equipment or Partner/);
  });
  it('the base is required, and it must be of the kind', () => {
    expect(validateWorkCenter({ ...good, workCenterBase: null }, data()).workCenterBase).toMatch(/person/);
    expect(validateWorkCenter({ ...good, workCenterBase: 'e-crane' }, data()).workCenterBase).toMatch(/already has a work center/);
  });
  it('a catalog item is the base of one work center only', () => {
    const d = data({ workCenter: [row('w1', { workCenterKind: 'person', workCenterBase: 'p-boris' })] });
    expect(validateWorkCenter(good, d).workCenterBase).toMatch(/already has a work center/);
  });
  it('a Partner must be a supplier', () => {
    expect(validateWorkCenter({ workCenterKind: 'partner', workCenterBase: 'pa-cus', businessUnit: 'bu-it' }, data()).workCenterBase).toMatch(/not a supplier/);
    expect(validateWorkCenter({ workCenterKind: 'partner', workCenterBase: 'pa-sup', businessUnit: 'bu-it' }, data())).toEqual({});
  });
  it('the business unit is required and must exist', () => {
    expect(validateWorkCenter({ ...good, businessUnit: null }, data()).businessUnit).toMatch(/business unit/);
    expect(validateWorkCenter({ ...good, businessUnit: 'nope' }, data()).businessUnit).toMatch(/business unit/);
  });
});

describe('newWorkCenterJSON', () => {
  it('the rowJSON of a new work center: the kind, the base, the unit; the title stays empty (SQL takes the name of the base)', () => {
    expect(newWorkCenterJSON({ kind: 'equipment', base: 'e-crane', businessUnit: 'bu-it' })).toMatchObject({
      workCenterKind: 'equipment', workCenterBase: 'e-crane', businessUnit: 'bu-it', workCenterTitle: null, workCenterBaseVariant: null, workCenterVariant: null, resourceCalendar: null, isActive: true,
    });
  });
  it('a typed title and a calendar are kept; an empty calendar is none', () => {
    expect(newWorkCenterJSON({ kind: 'person', base: 'p-anna', businessUnit: 'bu-it', title: '  Anna line ', resourceCalendar: 'cal1' })).toMatchObject({ workCenterTitle: 'Anna line', resourceCalendar: 'cal1' });
    expect(newWorkCenterJSON({ kind: 'person', base: 'p-anna', businessUnit: 'bu-it', resourceCalendar: '' }).resourceCalendar).toBeNull();
  });
});
