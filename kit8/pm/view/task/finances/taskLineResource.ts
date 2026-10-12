// Task lines - WHO a line books (pure): a person or an equipment on a Time line, a product on the others (P1 of recommendation/EQUIPMENT_TIME.html).
// Before equipment, every place asked `genus.resource === 'person'`; now a Time line says it itself: rowJSON.taskResourceKind = 'person' | 'equipment'
// (empty = person: every Time line made before equipment stays valid with no migration) and ONE helper answers the question for all of them.
//   taskResourceItem   personTable.rowGUID | equipmentTable.rowGUID | productTable.rowGUID, by the kind
//   the role of a Time line must be a role of the same kind: resourceRoleTypeTable.rowJSON.resourceKind ('person' default | 'equipment')
import type { DefRow } from '../../../../catalog/product/productModel';
import { isSet, rowTitle } from '../../../../catalog/product/crud/productCatalogTools';
import { resourceKindOfRoleType } from '../../../../catalog/resourcerole/resourceRoleModel';
import { EQUIPMENT_CATALOG_OWNER, equipmentName } from '../../../../catalog/equipment/equipmentModel';
import type { TaskLineCatalogData } from './taskLineCatalogs';
import type { TaskLineGenusDef, TaskLineResourceKind, TaskLineRowJSON } from './taskLineModel';

/** the kind a line books: Material / Expense / Revenue = product; Time = the line's own kind, a missing one = person */
export function lineResourceKind(genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON> | Record<string, any> | null | undefined): TaskLineResourceKind {
  if (genus.resource === 'product') return 'product';
  return json?.taskResourceKind === 'equipment' ? 'equipment' : 'person';
}

/** the kind of resource a line books is a worker (a person or an equipment): it has Properties + Variants of its own */
export const isWorkerKind = (kind: TaskLineResourceKind): kind is 'person' | 'equipment' => kind === 'person' || kind === 'equipment';

/** the catalog rows a resource of this kind is picked from */
export function resourceRowsOf(d: TaskLineCatalogData, kind: TaskLineResourceKind): DefRow<any>[] {
  return kind === 'person' ? d.person : kind === 'equipment' ? d.equipment : d.product;
}

/** rowJSON field of the resource row that holds its type (decides the descriptor sets) */
export const RESOURCE_TYPE_FIELD: Record<'person' | 'equipment', string> = { person: 'personType', equipment: 'equipmentType' };

/** words for the messages and the labels of the columns */
export const RESOURCE_WORDS: Record<'person' | 'equipment', { title: string; lower: string; variant: string }> = {
  person: { title: 'Person', lower: 'person', variant: 'Person variant' },
  equipment: { title: 'Equipment', lower: 'equipment', variant: 'Equipment variant' },
};

/** person.rowJSON -> "first name + last name" */
export const personFullName = (person: any): string => {
  const j = person?.rowJSON || {};
  return [j.personFirstName, j.personLastName].filter(Boolean).join(' ').trim() || j.personTitle || person?.rowGUID || '';
};

/** the title of a person / equipment / product row, for the cell of the resource column and the Plan view */
export function resourceRowTitle(kind: TaskLineResourceKind, row: DefRow<any> | undefined | null): string {
  if (!row) return '';
  if (kind === 'person') return personFullName(row);
  if (kind === 'equipment') return equipmentName(row) || row.rowGUID;
  return rowTitle(row);
}

/**
 * the title of a row of EITHER worker catalog (the cell of a column that shows persons and equipment): an equipment row is told by its owner
 * (EQUIPMENT_CATALOG_OWNER), everything else is a person
 */
export const resourceTitleOfRow = (row: any): string => (row?.rowOwnerGUID === EQUIPMENT_CATALOG_OWNER ? resourceRowTitle('equipment', row) : personFullName(row));

/** the title of the resource a line books ('' = none chosen / not found) */
export function lineResourceTitle(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>): string {
  if (!isSet(json.taskResourceItem)) return '';
  const kind = lineResourceKind(genus, json);
  return resourceRowTitle(kind, resourceRowsOf(d, kind).find((r) => r.rowGUID === json.taskResourceItem));
}

/** the title of ANY resource GUID of a line row (kind unknown, e.g. a posted plan row): person, else equipment, else product */
export function anyResourceTitle(d: TaskLineCatalogData, guid: string | null | undefined): string {
  if (!isSet(guid)) return '';
  const person = d.person.find((p) => p.rowGUID === guid);
  if (person) return personFullName(person);
  const equipment = d.equipment.find((e) => e.rowGUID === guid);
  if (equipment) return resourceRowTitle('equipment', equipment);
  return rowTitle(d.product.find((p) => p.rowGUID === guid));
}

/** the kind a RESOURCE ROLE is meant for: the resourceKind of its role type (missing = person) */
export function roleResourceKind(d: TaskLineCatalogData, role: DefRow<any> | undefined | null): 'person' | 'equipment' {
  const type = role ? d.resourceRoleType.find((t) => t.rowGUID === role.rowOwnerGUID) : undefined;
  return resourceKindOfRoleType(type);
}

/** the resource of the line exists in the catalog of ANOTHER kind (a person GUID on an equipment line): the kind changed and the resource must go */
export function resourceBelongsToOtherKind(d: TaskLineCatalogData, kind: TaskLineResourceKind, guid: string | null | undefined): boolean {
  if (!isSet(guid) || !isWorkerKind(kind)) return false;
  const other = kind === 'person' ? 'equipment' : 'person';
  const here = resourceRowsOf(d, kind).some((r) => r.rowGUID === guid);
  return !here && resourceRowsOf(d, other).some((r) => r.rowGUID === guid);
}
