// Task lines - WHO a line books (pure): a person, an equipment or a work center on a Time line, a product on the others (P1 of recommendation/EQUIPMENT_TIME.html).
// A WORK CENTER (kit8/catalog/work_center, taskResourceKind = 'workCenter', taskResourceItem = workCenterTable.rowGUID) stands for ONE person / equipment / partner (its base). The line books the
// work center - its calendar and its own variants - but the rules of the person / equipment still decide: `lineWorkerKind` = the kind of the BASE (person -> person; equipment and partner ->
// equipment: no contract, the hour is costed by the rate of the role), `lineBaseItem` = the base, `lineVariantOwner` = who owns the variants the line books (the work center).
// 2026-11-23: a Time line ALWAYS books a work center. rowJSON.taskResourceKind = 'workCenter' and taskResourceItem = workCenterTable.rowGUID; the kinds of work center the line may pick
// are chosen by the column "Resource" (taskWorkCenterKind). Lines made earlier with a person / equipment are migrated by SQL (`work_center_ensure`, trigger `trg_task_line_work_center`).
//   taskResourceItem   workCenterTable.rowGUID (a Time line) | productTable.rowGUID (Material / Expense / Revenue)
//   the role of a Time line must be a role of the same kind: resourceRoleTypeTable.rowJSON.resourceKind ('person' default | 'equipment')
import type { DefRow } from '../../../../catalog/product/productModel';
import { isSet, rowTitle } from '../../../../catalog/product/crud/productCatalogTools';
import { resourceKindOfRoleType } from '../../../../catalog/resourcerole/resourceRoleModel';
import { EQUIPMENT_CATALOG_OWNER, EQUIPMENT_ENTITY, equipmentName } from '../../../../catalog/equipment/equipmentModel';
import { PERSON_ENTITY } from '../../../../catalog/person/personModel';
import { baseName, WORK_CENTER_CATALOG_OWNER, WORK_CENTER_ENTITY, workCenterName } from '../../../../catalog/work_center/workCenterModel';
import type { WorkCenterKind } from '../../../../catalog/work_center/workCenterModel';
import type { TaskLineCatalogData } from './taskLineCatalogs';
import type { TaskLineGenusDef, TaskLineResourceKind, TaskLineRowJSON } from './taskLineModel';

/**
 * the kind a line books: Material / Expense / Revenue = product; a Time line ALWAYS = workCenter (2026-11-23: taskResourceItem of a Time line is a workCenterTable row, nothing else;
 * the SQL trigger `trg_task_line_work_center` makes a line that still holds a person / equipment a work center line). `json` is kept for the callers.
 */
export function lineResourceKind(genus: TaskLineGenusDef, _json?: Partial<TaskLineRowJSON> | Record<string, any> | null | undefined): TaskLineResourceKind {
  return genus.resource === 'product' ? 'product' : 'workCenter';
}

/** the kind of resource a line books is a worker (a person, an equipment or a work center): it has Properties + Variants of its own */
export const isWorkerKind = (kind: TaskLineResourceKind): kind is 'person' | 'equipment' | 'workCenter' => kind === 'person' || kind === 'equipment' || kind === 'workCenter';

/** the work center a line books (null = the line books no work center, or it is not in the catalog) */
export function lineWorkCenter(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON> | Record<string, any> | null | undefined): DefRow<any> | null {
  if (lineResourceKind(genus) !== 'workCenter' || !isSet(json?.taskResourceItem)) return null;
  return (d.workCenter || []).find((w) => w.rowGUID === json!.taskResourceItem) ?? null;
}

/**
 * The kind of the WORKER a line books for the rules that depend on it (which roles fit, whether there is a contract): person | equipment | product. A work center follows its BASE: a Person
 * work center is a person, an Equipment and a Partner work center are an equipment (no contract: the hour is costed by the rate of the role). A work center that is not chosen yet (or not in the
 * catalog) follows the menu "Resource" of the line (`lineMenuKind`: Person = person, Equipment / Partner = equipment), so the roles of the kind are offered before the work center is picked.
 */
export function lineWorkerKind(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON> | Record<string, any> | null | undefined): 'person' | 'equipment' | 'product' {
  const kind = lineResourceKind(genus);
  if (kind !== 'workCenter') return kind;
  const wcKind = lineWorkCenter(d, genus, json)?.rowJSON?.workCenterKind;
  if (wcKind) return wcKind === 'person' ? 'person' : 'equipment';
  return lineMenuKind(d, json) === 'person' ? 'person' : 'equipment';
}

/** the catalog item the resource of the line IS: the person / equipment / partner / product; for a work center its BASE ('' = none) */
export function lineBaseItem(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON> | Record<string, any> | null | undefined): string | null {
  if (lineResourceKind(genus) !== 'workCenter') return isSet(json?.taskResourceItem) ? json!.taskResourceItem : null;
  const base = lineWorkCenter(d, genus, json)?.rowJSON?.workCenterBase;
  return isSet(base) ? base : null;
}

/** who owns the variants the line books: the person / equipment / product itself; for a work center the WORK CENTER (its own variant, a copy of the base variant) */
export const lineVariantOwner = (json: Partial<TaskLineRowJSON> | Record<string, any> | null | undefined): string | null => (isSet(json?.taskResourceItem) ? json!.taskResourceItem : null);

/**
 * The menu "Resource: Person | Equipment | Partner" of a line: the kind of the work centers the line picks from (taskWorkCenterKind), else the kind of the work center it books, else Person.
 */
export function lineMenuKind(d: Pick<TaskLineCatalogData, 'workCenter'>, json: Partial<TaskLineRowJSON> | Record<string, any> | null | undefined): WorkCenterKind {
  const chosen = json?.taskWorkCenterKind;
  if (chosen === 'person' || chosen === 'equipment' || chosen === 'partner') return chosen;
  const kind = (d.workCenter || []).find((w) => w.rowGUID === json?.taskResourceItem)?.rowJSON?.workCenterKind;
  return kind === 'equipment' || kind === 'partner' ? kind : 'person';
}

/** the catalog (redux entity) a resource of this kind is picked from; a row without a kind is a person's */
export const resourceEntityOfKind = (kind: unknown): string => (kind === 'equipment' ? EQUIPMENT_ENTITY : kind === 'workCenter' ? WORK_CENTER_ENTITY : PERSON_ENTITY);

/** the catalog rows a resource of this kind is picked from */
export function resourceRowsOf(d: TaskLineCatalogData, kind: TaskLineResourceKind): DefRow<any>[] {
  return kind === 'person' ? d.person : kind === 'equipment' ? d.equipment : kind === 'workCenter' ? d.workCenter : d.product;
}

/** rowJSON field of the resource row that holds its type (decides the descriptor sets) */
export const RESOURCE_TYPE_FIELD: Record<'person' | 'equipment', string> = { person: 'personType', equipment: 'equipmentType' };

/** words for the messages and the labels of the columns */
export const RESOURCE_WORDS: Record<'person' | 'equipment' | 'workCenter' | 'partner', { title: string; lower: string; variant: string }> = {
  person: { title: 'Person', lower: 'person', variant: 'Person variant' },
  equipment: { title: 'Equipment', lower: 'equipment', variant: 'Equipment variant' },
  workCenter: { title: 'Work center', lower: 'work center', variant: 'Work center variant' },
  /** the Partner entry of the menu: the kind of a work center (a supplier) */
  partner: { title: 'Partner', lower: 'partner', variant: 'Partner variant' },
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
  if (kind === 'workCenter') return workCenterName(row) || row.rowGUID;
  return rowTitle(row);
}

/**
 * the title of a row of ANY worker catalog (the cell of a column that shows persons, equipment and work centers): an equipment row is told by its owner
 * (EQUIPMENT_CATALOG_OWNER), a work center by its (WORK_CENTER_CATALOG_OWNER), everything else is a person
 */
export const resourceTitleOfRow = (row: any): string => (row?.rowOwnerGUID === EQUIPMENT_CATALOG_OWNER ? resourceRowTitle('equipment', row)
  : row?.rowOwnerGUID === WORK_CENTER_CATALOG_OWNER ? resourceRowTitle('workCenter', row) : personFullName(row));

/** the title of the resource a line books ('' = none chosen / not found) */
export function lineResourceTitle(d: TaskLineCatalogData, genus: TaskLineGenusDef, json: Partial<TaskLineRowJSON>): string {
  if (!isSet(json.taskResourceItem)) return '';
  const kind = lineResourceKind(genus, json);
  return resourceRowTitle(kind, resourceRowsOf(d, kind).find((r) => r.rowGUID === json.taskResourceItem));
}

/** the title of ANY resource GUID of a line row (kind unknown, e.g. a posted plan row): person, else equipment, else product */
export function anyResourceTitle(d: TaskLineCatalogData, guid: string | null | undefined): string {
  if (!isSet(guid)) return '';
  const workCenter = (d.workCenter || []).find((w) => w.rowGUID === guid);
  if (workCenter) return resourceRowTitle('workCenter', workCenter);
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
  const here = resourceRowsOf(d, kind).some((r) => r.rowGUID === guid);
  const others = (['person', 'equipment', 'workCenter'] as const).filter((k) => k !== kind);
  return !here && others.some((k) => resourceRowsOf(d, k).some((r) => r.rowGUID === guid));
}

/** the kind of a work center row (person | equipment | partner), '' when the row is not one */
export const workCenterKindOf = (row: DefRow<any> | undefined | null): WorkCenterKind | '' => (row?.rowJSON?.workCenterKind as WorkCenterKind) || '';

/** the name of the base of a work center (the person / equipment / partner it stands for) */
export function workCenterBaseTitle(d: TaskLineCatalogData, workCenter: DefRow<any> | undefined | null): string {
  const kind = workCenterKindOf(workCenter);
  if (!kind) return '';
  const rows = kind === 'person' ? d.person : kind === 'equipment' ? d.equipment : (d.partner || []);
  return baseName(kind, rows.find((r) => r.rowGUID === workCenter?.rowJSON?.workCenterBase));
}
