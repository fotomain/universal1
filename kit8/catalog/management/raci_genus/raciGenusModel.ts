// RACI genus - the four PMBOK items a person can have on a task: Responsible, Accountable, Consulted, Informed (documentation/PERMISSIONS_WBS.html, section 3).
//   managementRACIGenusTable   rowGUID = the code (raciResponsibleGUID ...) · rowOwnerGUID 'managementRACIGenusCatalog' · rowParentGUID 'empty' · orderInList · rowJSON { title, description }
//   READ ONLY and seeded (start4 / start5, SQL PART 44): no screen, no menu item, nobody adds a row. The catalog is read for the select of the Time tab and for the reports of later rounds.
//   A Time line keeps one of the four rowGUIDs in task_line_table.rowJSON.raciItem (never empty: the database fills a missing one with raciResponsibleGUID).
import type { DefRow, ProductTableDef } from '../../product/productModel';

export const MANAGEMENT_RACI_GENUS_TABLE: ProductTableDef = {
  table: 'managementRACIGenusTable',
  entity: 'managementRACIGenusReusable',
  itemLabel: 'RACI item',
  catalogOwner: 'managementRACIGenusCatalog',
  purpose: 'The four RACI items of PMBOK (Responsible, Accountable, Consulted, Informed) a person has on a task; read only.',
  emptyRowJSON: () => ({ title: null, description: null }),
};

/** rowGUIDs of the seed rows */
export const RACI_RESPONSIBLE_GUID = 'raciResponsibleGUID';
export const RACI_ACCOUNTABLE_GUID = 'raciAccountableGUID';
export const RACI_CONSULTED_GUID = 'raciConsultedGUID';
export const RACI_INFORMED_GUID = 'raciInformedGUID';

/** the four items in the order of the letters R · A · C · I */
export const RACI_GUIDS = [RACI_RESPONSIBLE_GUID, RACI_ACCOUNTABLE_GUID, RACI_CONSULTED_GUID, RACI_INFORMED_GUID] as const;
export type RaciGuid = (typeof RACI_GUIDS)[number];

/** a new Time line is Responsible (the database fills a missing item with it too) */
export const RACI_DEFAULT_GUID: RaciGuid = RACI_RESPONSIBLE_GUID;

/** English titles of the seed rows: the fallback while the catalog is not read yet (pmT translates them) */
export const RACI_TITLES: Record<RaciGuid, string> = {
  raciResponsibleGUID: 'Responsible',
  raciAccountableGUID: 'Accountable',
  raciConsultedGUID: 'Consulted',
  raciInformedGUID: 'Informed',
};

export const isRaciGuid = (v: unknown): v is RaciGuid => typeof v === 'string' && (RACI_GUIDS as readonly string[]).includes(v);

/** the English title of an item: the catalog row when it is read, else the seed title; an unknown GUID shows as it is */
export function raciTitle(rows: DefRow<any>[] | undefined | null, guid: string | null | undefined): string {
  if (!guid) return '';
  const row = (rows || []).find((r) => r.rowGUID === guid);
  const title = String(row?.rowJSON?.title ?? '').trim();
  return title || (isRaciGuid(guid) ? RACI_TITLES[guid] : guid);
}

/**
 * The options of the RACI select: the catalog rows by orderInList, or - while the catalog is not read yet - the four seed items, so the column is never empty.
 * `translate` = pmT: the label is the translated title, the value is the rowGUID.
 */
export function raciOptions(rows: DefRow<any>[] | undefined | null, translate: (text: string) => string = (t) => t): { value: string; label: string }[] {
  const list = (rows || []).filter((r) => isRaciGuid(r.rowGUID)).slice().sort((a, b) => (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0));
  if (list.length === 0) return RACI_GUIDS.map((g) => ({ value: g, label: translate(RACI_TITLES[g]) }));
  return list.map((r) => ({ value: r.rowGUID, label: translate(raciTitle(list, r.rowGUID)) }));
}

/** the item of a Time line row: its own, else Responsible (an old line read before the backfill reached the client) */
export const raciItemOf = (rowJSON: Record<string, any> | null | undefined): string => (isRaciGuid(rowJSON?.raciItem) ? (rowJSON!.raciItem as string) : RACI_DEFAULT_GUID);

/**
 * PMBOK: exactly one Accountable per task. The rows are the lines of ONE task (Time lines only); more than one Accountable = a warning text (never an error: Q3 "warn").
 * Returns '' when there is nothing to warn about.
 */
export function raciWarning(timeLines: { rowJSON?: Record<string, any> | null }[]): string {
  const n = (timeLines || []).filter((l) => l?.rowJSON?.raciItem === RACI_ACCOUNTABLE_GUID).length;
  return n > 1 ? 'More than one Accountable on this task' : '';
}
