// Work center - a Person, an Equipment or a Partner (a supplier) as a RESOURCE a Time line of a task can book, with its own calendar and variant.
//   workCenterTable  rowGUID · rowOwnerGUID 'workCenterCatalog' · rowParentGUID = the FOLDER = the business unit (businessUnitTable) · orderInList
//                    · rowJSON { workCenterTitle, workCenterKind, workCenterBase, workCenterBaseVariant, workCenterVariant, resourceCalendar, businessUnit, isActive }
//   kind    'person' | 'equipment' | 'partner' - REQUIRED. A Partner needs partnerIsSupplier (checked when the work center is saved with that partner).
//   base    the rowGUID of a Person / Equipment / Partner CATALOG ITEM of the kind (workCenterBase). A catalog item is the base of ONE work center at most; work centers are made by hand.
//   base variant   the descriptorKey of a variant of the BASE (variantTable, owner = the base) - what "Copy Variant settings" copies.
//   variant        the descriptorKey of the work center's OWN variant: a variantTable row owned by the work center, a one-time copy of the base variant (SQL work_center_copy_variant_settings).
//   calendar       rowJSON.resourceCalendar = the workCenterCalendar: a RESOURCE calendar, the full person calendar model (empty = the Standard work week).
//   business unit  rowJSON.businessUnit = rowParentGUID; the folders of the screen are the business units, a folder is shown only while it holds a work center.
// SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 35 · Screen: WorkCenterCRUD · route WORK_CENTER_ROUTES.list · Design: documentation/WORK_CENTER_WBS.html
import type { DefRow, ProductTableDef } from '../product/productModel';
import type { FolderTreeNode } from '../../ui/components/tree/folderTreeModel';
import { equipmentName } from '../equipment/equipmentModel';

export const WORK_CENTER_ROUTES = { list: '/catalog/work/center' } as const;
/** rowParentGUID of a work center that is in no folder (SQL refuses it: a work center always has a business unit) */
export const WORK_CENTER_NO_FOLDER = 'empty';
export const WORK_CENTER_CATALOG_OWNER = 'workCenterCatalog';
/** the RPC of "Copy Variant settings" */
export const RPC_COPY_WORK_CENTER_VARIANT = 'work_center_copy_variant_settings';

export const WORK_CENTER_KINDS = [
  { value: 'person', label: 'Person' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'partner', label: 'Partner' },
] as const;
export type WorkCenterKind = typeof WORK_CENTER_KINDS[number]['value'];

export interface WorkCenterRowJSON {
  workCenterTitle: string | null;
  workCenterKind: WorkCenterKind | null;
  /** personTable | equipmentTable | partnerTable .rowGUID, by the kind */
  workCenterBase: string | null;
  /** descriptorKey of a variant of the base */
  workCenterBaseVariant: string | null;
  /** descriptorKey of the variant the work center owns (made by Copy Variant settings; not typed) */
  workCenterVariant: string | null;
  /** managementCalendarTable.rowGUID of a RESOURCE calendar (the workCenterCalendar) */
  resourceCalendar: string | null;
  /** businessUnitTable.rowGUID = rowParentGUID */
  businessUnit: string | null;
  isActive: boolean;
}

export const emptyWorkCenter = (): WorkCenterRowJSON => ({
  workCenterTitle: null, workCenterKind: null, workCenterBase: null, workCenterBaseVariant: null, workCenterVariant: null, resourceCalendar: null, businessUnit: null, isActive: true,
});

export const WORK_CENTER_TABLE: ProductTableDef = {
  table: 'workCenterTable',
  entity: 'workCenterReusable',
  itemLabel: 'Work center',
  catalogOwner: WORK_CENTER_CATALOG_OWNER,
  purpose: 'A Person, an Equipment or a Partner (a supplier) as a resource with its own calendar and variant. The folders are the business units.',
  emptyRowJSON: () => ({ ...emptyWorkCenter() }),
};
export const WORK_CENTER_ENTITY = WORK_CENTER_TABLE.entity;
export const WORK_CENTER_TABLE_NAME = WORK_CENTER_TABLE.table;

const isSet = (g: unknown): g is string => typeof g === 'string' && g !== '' && g !== 'empty';
const str = (v: unknown) => String(v ?? '').trim();

export const isWorkCenterKind = (k: unknown): k is WorkCenterKind => WORK_CENTER_KINDS.some((x) => x.value === k);
export const workCenterKindLabel = (k: unknown): string => WORK_CENTER_KINDS.find((x) => x.value === k)?.label ?? '';
export const isWorkCenterActive = (r: DefRow<any> | undefined | null): boolean => r?.rowJSON?.isActive !== false;

/** "first name + last name" of a person row (else its title, else its GUID) */
export const personName = (p: DefRow<any> | undefined | null): string => {
  const j = p?.rowJSON || {};
  return [j.personFirstName, j.personLastName].filter(Boolean).join(' ').trim() || str(j.personTitle) || p?.rowGUID || '';
};

/** the name of a catalog item of the kind (a person's name, an equipment's title, a partner's title) */
export function baseName(kind: WorkCenterKind | null | undefined, row: DefRow<any> | undefined | null): string {
  if (!row) return '';
  if (kind === 'person') return personName(row);
  if (kind === 'equipment') return equipmentName(row) || row.rowGUID;
  return str(row.rowJSON?.partnerTitle) || str(row.rowJSON?.partnerLegalName) || row.rowGUID;
}

/** the name shown for a work center: its title, else the name of its base */
export const workCenterName = (r: DefRow<any> | undefined | null, bases?: { person: DefRow<any>[]; equipment: DefRow<any>[]; partner: DefRow<any>[] }): string => {
  const own = str(r?.rowJSON?.workCenterTitle);
  if (own) return own;
  const kind = r?.rowJSON?.workCenterKind as WorkCenterKind | undefined;
  const base = kind && bases ? bases[kind]?.find((b) => b.rowGUID === r?.rowJSON?.workCenterBase) : undefined;
  return baseName(kind, base) || r?.rowGUID || '';
};

/** the catalogs the work center screen reads */
export interface WorkCenterCatalogData {
  workCenter: DefRow<any>[];
  businessUnit: DefRow<any>[];
  person: DefRow<any>[];
  equipment: DefRow<any>[];
  partner: DefRow<any>[];
  /** variantTable: the variants of the persons / equipment AND of the work centers (the owner tells which) */
  variant: DefRow<any>[];
}
export const emptyWorkCenterData = (): WorkCenterCatalogData => ({ workCenter: [], businessUnit: [], person: [], equipment: [], partner: [], variant: [] });

/** the catalog rows a base of this kind is picked from */
export const baseRowsOf = (data: Pick<WorkCenterCatalogData, 'person' | 'equipment' | 'partner'>, kind: WorkCenterKind | null | undefined): DefRow<any>[] =>
  kind === 'person' ? data.person : kind === 'equipment' ? data.equipment : kind === 'partner' ? data.partner : [];

/** a partner a Partner work center may be made for: a supplier (partnerIsSupplier) that is active */
export const isSupplierPartner = (p: DefRow<any>): boolean => p.rowJSON?.partnerIsSupplier === true && p.rowJSON?.isActive !== false;

/**
 * The bases a work center of this kind can have, as select options: the catalog items of the kind that are not the base of ANOTHER work center (one catalog item, one work center),
 * a Partner only when it is a supplier, an inactive equipment not at all. The base the work center has now stays in the list (an old choice is never hidden).
 */
export function workCenterBaseOptions(data: WorkCenterCatalogData, kind: WorkCenterKind | null | undefined, keepWorkCenterGUID?: string | null): { value: string; label: string }[] {
  if (!isWorkCenterKind(kind)) return [];
  const taken = new Set(data.workCenter.filter((w) => w.rowJSON?.workCenterKind === kind && w.rowGUID !== keepWorkCenterGUID).map((w) => str(w.rowJSON?.workCenterBase)));
  const mine = keepWorkCenterGUID ? str(data.workCenter.find((w) => w.rowGUID === keepWorkCenterGUID)?.rowJSON?.workCenterBase) : '';
  return baseRowsOf(data, kind)
    .filter((b) => b.rowGUID === mine || (!taken.has(b.rowGUID) && (kind === 'partner' ? isSupplierPartner(b) : kind === 'equipment' ? b.rowJSON?.isActive !== false : true)))
    .map((b) => ({ value: b.rowGUID, label: baseName(kind, b) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const variantTitle = (v: DefRow<any>): string => str(v.rowJSON?.title) || str(v.rowJSON?.variantTitle) || str(v.rowJSON?.descriptorKey);
const variantsOwnedBy = (variants: DefRow<any>[], owner: string | null | undefined): DefRow<any>[] =>
  !isSet(owner) ? [] : variants.filter((v) => v.rowOwnerGUID === owner && v.rowJSON?.isActive !== false && isSet(v.rowJSON?.descriptorKey)).sort((a, b) => Number(a.orderInList ?? 0) - Number(b.orderInList ?? 0));

/** the variants of the BASE as select options (value = descriptorKey): nothing for a partner - a partner has no descriptor variants */
export const workCenterBaseVariantOptions = (variants: DefRow<any>[], baseGUID: string | null | undefined): { value: string; label: string }[] =>
  variantsOwnedBy(variants, baseGUID).map((v) => ({ value: String(v.rowJSON.descriptorKey), label: variantTitle(v) }));

/** the variants the WORK CENTER owns (made by Copy Variant settings) as select options */
export const workCenterOwnVariantOptions = (variants: DefRow<any>[], workCenterGUID: string | null | undefined): { value: string; label: string }[] =>
  variantsOwnedBy(variants, workCenterGUID).map((v) => ({ value: String(v.rowJSON.descriptorKey), label: variantTitle(v) }));

/** the work center owns a variant already: Copy Variant settings must ask before it overwrites it */
export const workCenterHasOwnVariant = (variants: DefRow<any>[], workCenterGUID: string | null | undefined): boolean =>
  isSet(workCenterGUID) && variants.some((v) => v.rowOwnerGUID === workCenterGUID);

/** Copy Variant settings needs a work center with a base variant chosen */
export const canCopyVariantSettings = (row: { rowJSON?: Record<string, any> } | undefined | null): boolean => isSet(row?.rowJSON?.workCenterBaseVariant);

/**
 * The folders of the tree = the business units that hold a work center (and the units above them, so the path is there). A folder appears with the first work center entered
 * in it and is hidden again when the last one is removed. No folder table: the units are the catalog of the business units.
 */
export function workCenterFolderNodes(units: DefRow<any>[], workCenters: DefRow<any>[]): FolderTreeNode[] {
  const byId = new Map((units || []).map((u) => [u.rowGUID, u]));
  const keep = new Set<string>();
  for (const w of workCenters || []) {
    let g: string | null | undefined = w.rowParentGUID;
    const seen = new Set<string>();
    while (isSet(g) && byId.has(g) && !seen.has(g)) {
      seen.add(g);
      keep.add(g);
      g = byId.get(g)!.rowParentGUID;
    }
  }
  return (units || []).filter((u) => keep.has(u.rowGUID)).map((u) => ({
    id: u.rowGUID,
    parentId: isSet(u.rowParentGUID) && keep.has(u.rowParentGUID) ? u.rowParentGUID : null,
    title: str(u.rowJSON?.title) || u.rowGUID,
    order: Number(u.orderInList) || 0,
  }));
}

/** the business units a work center can be put in, as select options (path as the label) */
export function workCenterUnitOptions(units: DefRow<any>[]): { value: string; label: string }[] {
  const byId = new Map((units || []).map((u) => [u.rowGUID, u]));
  const path = (g: string): string => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let cur: string | null | undefined = g;
    while (isSet(cur) && byId.has(cur) && !seen.has(cur)) { seen.add(cur); parts.unshift(str(byId.get(cur)!.rowJSON?.title) || cur); cur = byId.get(cur)!.rowParentGUID; }
    return parts.join(' › ');
  };
  return (units || []).filter((u) => u.rowJSON?.isActive !== false).map((u) => ({ value: u.rowGUID, label: path(u.rowGUID) })).sort((a, b) => a.label.localeCompare(b.label));
}

export type WorkCenterErrors = { workCenterKind?: string; workCenterBase?: string; businessUnit?: string };

/** the rules the SQL trigger enforces, for the form that makes a work center: a kind, a free base of that kind, a business unit */
export function validateWorkCenter(v: Partial<WorkCenterRowJSON>, data: WorkCenterCatalogData, keepWorkCenterGUID?: string | null): WorkCenterErrors {
  const e: WorkCenterErrors = {};
  if (!isWorkCenterKind(v.workCenterKind)) e.workCenterKind = 'Choose a kind: Person, Equipment or Partner.';
  else if (!isSet(v.workCenterBase)) e.workCenterBase = `Choose the ${workCenterKindLabel(v.workCenterKind).toLowerCase()} this work center stands for.`;
  else if (!workCenterBaseOptions(data, v.workCenterKind, keepWorkCenterGUID).some((o) => o.value === v.workCenterBase)) {
    e.workCenterBase = v.workCenterKind === 'partner'
      ? 'This partner is not a supplier, or it already has a work center.'
      : `This ${workCenterKindLabel(v.workCenterKind).toLowerCase()} already has a work center.`;
  }
  if (!isSet(v.businessUnit) || !(data.businessUnit || []).some((u) => u.rowGUID === v.businessUnit)) e.businessUnit = 'Choose a business unit (the folder of the work center).';
  return e;
}

/** the rowJSON of a new work center (the title stays empty: SQL takes the name of the base) */
export function newWorkCenterJSON(v: { kind: WorkCenterKind; base: string; businessUnit: string; title?: string | null; resourceCalendar?: string | null }): WorkCenterRowJSON {
  return {
    ...emptyWorkCenter(),
    workCenterTitle: str(v.title) || null, workCenterKind: v.kind, workCenterBase: v.base, businessUnit: v.businessUnit,
    resourceCalendar: isSet(v.resourceCalendar) ? v.resourceCalendar : null,
  };
}

/**
 * The derived fields of a work center row after a cell changed (the table's computeRowJSON): a base variant that is not a variant of the (new) base is cleared. The kind never changes in the
 * table (it is chosen when the work center is made); null = nothing to change.
 */
export function computeWorkCenterRowJSON(variants: DefRow<any>[]): (json: Record<string, any>) => Record<string, any> | null {
  return (json) => {
    const key = str(json.workCenterBaseVariant);
    if (key && !workCenterBaseVariantOptions(variants, json.workCenterBase).some((o) => o.value === key)) return { workCenterBaseVariant: null };
    return null;
  };
}
