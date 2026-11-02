// monitor01Fields - the NUMERIC fields (the float columns) of the Monitor01 table that the user can show or hide (Settings → Fields), and the settings a saved View keeps.
// The field list is the ONE source of the table columns (Monitor01Table) and of the Fields tab (Monitor01FieldsTab): the order, the group (the 1st header level) and the title are here.
//   hiddenFields   the UNCHECKED fields (not the checked ones): a field added later is shown by default, and "all checked" is the empty list - the default of a new user
//   a View         the settings of the report: hiddenFields · tab · filters (dates, project, task, resource) · projectKind · vatBasis (monitor01ReportViews.ts saves it as rowJSON.settings)
import {
  MONITOR01_CUSTOMER_INVOICE_HEAD, MONITOR01_HEAD, MONITOR01_MEASURE_TITLE, MONITOR01_TABS, MONITOR01_VENDOR_INVOICE_HEAD, EMPTY_MONITOR01_FILTERS, monitor01ProjectOptions, monitor01ResourceOptions, monitor01TaskOptions,
} from './monitor01Model';
import type { Monitor01Filters, Monitor01Measure, Monitor01Row, Monitor01Tab } from './monitor01Model';
import { MONITOR01_PROJECT_KIND_DEFAULT } from '../../subproject/subprojectModel';
import type { Monitor01ProjectKind } from '../../subproject/subprojectModel';
import { VAT_BASIS_DEFAULT, isVatBasis } from '../../vat/vatBasis';
import type { VatBasis } from '../../vat/vatBasis';

/** the report GUID of Monitor01 (project_report_settings.rowParentGUID); the report is registered in reports/common/reportRegistry.ts */
export const MONITOR01_REPORT_GUID = 'Monitor01';

/** the 1st level of the header = the folders of the Fields list */
export type Monitor01FieldGroup = 'Plan' | 'Fact' | 'Vendor Invoice' | 'Customer Invoice';
export type Monitor01MoneyField = 'sumForBudget' | 'sumVendorInvoiced' | 'sumCustomerInvoiced';
export type Monitor01FieldId = Monitor01Measure | Monitor01MoneyField;

export interface Monitor01FieldDef {
  id: Monitor01FieldId;
  group: Monitor01FieldGroup;
  /** a quantity (a button that opens its source transactions) or an amount of money (not a button) */
  kind: 'quantity' | 'amount';
  /** the English header text of the 2nd level (shown in the app language by pmT) */
  title: string;
}

export const MONITOR01_FIELD_GROUPS: readonly Monitor01FieldGroup[] = ['Plan', 'Fact', 'Vendor Invoice', 'Customer Invoice'];

/** in the order of the columns of the sheet */
export const MONITOR01_FIELDS: readonly Monitor01FieldDef[] = [
  { id: 'planned', group: 'Plan', kind: 'quantity', title: MONITOR01_MEASURE_TITLE.planned },
  { id: 'contracted', group: 'Plan', kind: 'quantity', title: MONITOR01_MEASURE_TITLE.contracted },
  { id: 'restToContract', group: 'Plan', kind: 'quantity', title: MONITOR01_MEASURE_TITLE.restToContract },
  { id: 'sumForBudget', group: 'Plan', kind: 'amount', title: MONITOR01_HEAD.sumForBudget },
  { id: 'ordered', group: 'Fact', kind: 'quantity', title: MONITOR01_MEASURE_TITLE.ordered },
  { id: 'received', group: 'Fact', kind: 'quantity', title: MONITOR01_MEASURE_TITLE.received },
  { id: 'used', group: 'Fact', kind: 'quantity', title: MONITOR01_MEASURE_TITLE.used },
  { id: 'onHand', group: 'Fact', kind: 'quantity', title: MONITOR01_MEASURE_TITLE.onHand },
  { id: 'vendorInvoiced', group: 'Vendor Invoice', kind: 'quantity', title: MONITOR01_VENDOR_INVOICE_HEAD.qty },
  { id: 'sumVendorInvoiced', group: 'Vendor Invoice', kind: 'amount', title: MONITOR01_VENDOR_INVOICE_HEAD.sum },
  { id: 'customerInvoiced', group: 'Customer Invoice', kind: 'quantity', title: MONITOR01_CUSTOMER_INVOICE_HEAD.qty },
  { id: 'sumCustomerInvoiced', group: 'Customer Invoice', kind: 'amount', title: MONITOR01_CUSTOMER_INVOICE_HEAD.sum },
];
export const MONITOR01_FIELD_IDS: readonly Monitor01FieldId[] = MONITOR01_FIELDS.map((f) => f.id);
const KNOWN = new Set<string>(MONITOR01_FIELD_IDS);
export const isMonitor01FieldId = (v: unknown): v is Monitor01FieldId => typeof v === 'string' && KNOWN.has(v);

/** the hidden fields as a list of KNOWN ids, in the order of the table (a stale / unknown id of an old View is dropped; doubles too) */
export function normalizeHiddenFields(raw: unknown): Monitor01FieldId[] {
  const hidden = new Set(Array.isArray(raw) ? raw.filter(isMonitor01FieldId) : []);
  return MONITOR01_FIELD_IDS.filter((id) => hidden.has(id));
}
/** the fields the table shows: all but the hidden ones, in the order of the table */
export function monitor01VisibleFields(hidden: readonly string[] | undefined | null): Monitor01FieldDef[] {
  const off = new Set(hidden ?? []);
  return MONITOR01_FIELDS.filter((f) => !off.has(f.id));
}
/** the hidden list after some fields were checked / unchecked (ids not in `changed` keep their state) */
export function monitor01SetFieldsChecked(hidden: readonly string[] | undefined | null, changed: readonly string[], checked: boolean): Monitor01FieldId[] {
  const off = new Set(normalizeHiddenFields(hidden));
  for (const id of changed) {
    if (!isMonitor01FieldId(id)) continue;
    if (checked) off.delete(id); else off.add(id);
  }
  return normalizeHiddenFields([...off]);
}
/** the groups that still have a shown field (the 1st header level shows only these) */
export function monitor01VisibleGroups(fields: readonly Monitor01FieldDef[]): Monitor01FieldGroup[] {
  return MONITOR01_FIELD_GROUPS.filter((g) => fields.some((f) => f.group === g));
}

// ---- what a View keeps ---------------------------------------------------------------------------------------------------------------------------------------
export interface Monitor01ReportSettings {
  /** 1 = this shape; a newer app can add keys, an older one ignores them */
  version: 1;
  hiddenFields: Monitor01FieldId[];
  tab: Monitor01Tab;
  filters: Monitor01Filters;
  projectKind: Monitor01ProjectKind;
  vatBasis: VatBasis;
}
export const DEFAULT_MONITOR01_SETTINGS: Monitor01ReportSettings = {
  version: 1, hiddenFields: [], tab: 'all', filters: EMPTY_MONITOR01_FILTERS, projectKind: MONITOR01_PROJECT_KIND_DEFAULT, vatBasis: VAT_BASIS_DEFAULT,
};

const TAB_IDS = new Set<string>(MONITOR01_TABS.map((t) => t.id));
const KINDS = new Set(['projects', 'subprojects', 'all']);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
/**
 * Any JSON (a View of an older or a newer app, a damaged row) → settings the screen can apply: every key that is missing or unreadable falls back to the default,
 * so restoring a View can never break the report.
 */
export function normalizeMonitor01Settings(raw: unknown): Monitor01ReportSettings {
  const o: Record<string, any> = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, any>) : {};
  const f: Record<string, any> = o.filters && typeof o.filters === 'object' ? o.filters : {};
  return {
    version: 1,
    hiddenFields: normalizeHiddenFields(o.hiddenFields),
    tab: typeof o.tab === 'string' && TAB_IDS.has(o.tab) ? (o.tab as Monitor01Tab) : DEFAULT_MONITOR01_SETTINGS.tab,
    filters: { startDate: str(f.startDate), finishDate: str(f.finishDate), projectGUID: str(f.projectGUID), taskGUID: str(f.taskGUID), resourceGUID: str(f.resourceGUID) },
    projectKind: typeof o.projectKind === 'string' && KINDS.has(o.projectKind) ? (o.projectKind as Monitor01ProjectKind) : DEFAULT_MONITOR01_SETTINGS.projectKind,
    vatBasis: isVatBasis(o.vatBasis) ? o.vatBasis : DEFAULT_MONITOR01_SETTINGS.vatBasis,
  };
}

/**
 * The filters of a View, made safe for the report that restores it: the Project filter exists only in the full data set (standalone); a Project / Task / Resource that is not in the loaded
 * rows any more (deleted, or not shared with this user) would filter the table down to nothing, silently, so it is cleared - `dropped` says that something was cleared.
 * While no row is loaded yet nothing can be checked, so the filters are kept.
 */
export function restoreMonitor01Filters(saved: Monitor01Filters, rows: readonly Monitor01Row[], mode: 'project' | 'standalone'): { filters: Monitor01Filters; dropped: boolean } {
  const f: Monitor01Filters = { ...saved };
  let dropped = false;
  if (mode === 'project' && f.projectGUID) { f.projectGUID = ''; }
  if (rows.length > 0) {
    const all = rows as Monitor01Row[];
    if (f.projectGUID && !monitor01ProjectOptions(all).some((o) => o.value === f.projectGUID)) { f.projectGUID = ''; dropped = true; }
    if (f.taskGUID && !monitor01TaskOptions(all, f.projectGUID || null).some((o) => o.value === f.taskGUID)) { f.taskGUID = ''; dropped = true; }
    if (f.resourceGUID && !monitor01ResourceOptions(all, f.projectGUID || null).some((o) => o.value === f.resourceGUID)) { f.resourceGUID = ''; dropped = true; }
  }
  return { filters: f, dropped };
}
