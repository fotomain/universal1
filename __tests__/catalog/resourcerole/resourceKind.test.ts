// resourceRoleTypeTable.rowJSON.resourceKind: who works as a role of this type on a Time line - a person (default, also when missing) or an equipment.
// The role picker of a task line follows it (kit8/pm/view/task/finances/taskLineResource.ts).
import { RESOURCE_KINDS, RESOURCE_ROLE_OWN_TABLES, resourceKindOfRoleType } from '../../../kit8/catalog/resourcerole/resourceRoleModel';
import { emptyResourceRoleData } from '../../../kit8/catalog/resourcerole/crud/resourceRoleCatalogTools';
import { validateResourceRoleCatalog } from '../../../kit8/catalog/resourcerole/crud/resourceRoleValidation';

const row = (rowGUID: string, rowJSON: any) => ({ rowGUID, rowOwnerGUID: 'resourceRoleTypeCatalog', rowParentGUID: 'empty', orderInList: 0, rowJSON });

describe('the resource kind of a role type', () => {
  it('person | equipment; a type without the field is a person\'s (every type made before equipment)', () => {
    expect(RESOURCE_KINDS.map((k) => k.value)).toEqual(['person', 'equipment']);
    expect(resourceKindOfRoleType(row('a', { title: 'Human' }))).toBe('person');
    expect(resourceKindOfRoleType(row('b', { resourceKind: 'equipment' }))).toBe('equipment');
    expect(resourceKindOfRoleType(row('c', { resourceKind: 'person' }))).toBe('person');
    expect(resourceKindOfRoleType(row('d', { resourceKind: 'robot' }))).toBe('person');
    expect(resourceKindOfRoleType(undefined)).toBe('person');
    expect(resourceKindOfRoleType(null)).toBe('person');
  });
  it('a new role type is a person\'s', () => {
    expect(RESOURCE_ROLE_OWN_TABLES.resourceRoleType.emptyRowJSON()).toMatchObject({ resourceKind: 'person', managementGenus: null, baseUnit: 'unit_hour' });
  });
});

describe('the Checks', () => {
  const dataWith = (kind: unknown) => {
    const d = emptyResourceRoleData();
    d.resourceRoleType = [row('t1', { title: 'Equipment Resources', baseUnit: 'unit_hour', variantMode: 'none', ...(kind === undefined ? {} : { resourceKind: kind }) })] as any;
    d.measureUnit = [{ rowGUID: 'unit_hour', rowOwnerGUID: 'measureUnitCatalog', rowParentGUID: 'empty', orderInList: 0, rowJSON: { title: 'hour' } }] as any;
    return d;
  };
  const kindIssues = (kind: unknown) => validateResourceRoleCatalog(dataWith(kind)).filter((i) => i.message.includes('resource kind'));
  it('person, equipment or nothing: no finding', () => {
    expect(kindIssues('person')).toEqual([]);
    expect(kindIssues('equipment')).toEqual([]);
    expect(kindIssues(undefined)).toEqual([]);
    expect(kindIssues(null)).toEqual([]);
  });
  it('an unknown kind is an error on the role type', () => {
    expect(kindIssues('robot')).toEqual([expect.objectContaining({ rule: 'R1', severity: 'error', table: 'resourceRoleType', rowGUID: 't1', message: 'Role type "Equipment Resources": resource kind "robot" is unknown (person or equipment)' })]);
  });
});
