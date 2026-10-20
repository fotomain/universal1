// Management activity genus - the three activities of the cash flow statement (IAS 7): operating, investing, financing. ONE level (a linear catalog, no folders).
//   managementActivityGenusTable   rowGUID = the code (operatingActivity ...) · rowOwnerGUID 'managementActivityGenusCatalog' · rowParentGUID 'empty' always · orderInList
//                                  · rowJSON { title, description, webIfrsName, d365foName, sapName }
//   The activity of a budget item is the activity of its KEY: budgetItemTable.rowJSON.budgetItemGenericKey = '<activity>.<management genus>' (see kit8/catalog/budget/item/budgetItemKeyModel.ts).
//   webIfrsName / d365foName / sapName = how the same class is named on the web / in IFRS (IAS 7 paragraph), in Dynamics 365 Finance and Operations and in SAP (indicative texts of
//   documentation/ACTIVITY_GENUS.html; only a few terms of them are confirmed by a vendor source).
//   SQL: kit8/sql/start/start1_sql_tables.sql + start2_sql_code.sql PART 32 (seed rows: start4_sql_insert_missing.sql) · Screen: ManagementActivityGenusCRUD · route MANAGEMENT_ACTIVITY_GENUS_ROUTES.list
import type { DefRow, ProductTableDef } from '../../product/productModel';

export const MANAGEMENT_ACTIVITY_GENUS_ROUTES = { list: '/catalog/management/activity_genus/list' } as const;

export const MANAGEMENT_ACTIVITY_GENUS_TABLE: ProductTableDef = {
  table: 'managementActivityGenusTable',
  entity: 'managementActivityGenusReusable',
  itemLabel: 'Activity genus',
  catalogOwner: 'managementActivityGenusCatalog',
  purpose: 'The three activities of the cash flow statement (IAS 7): operating, investing, financing. A budget item belongs to one of them through its key (activity x management genus).',
  emptyRowJSON: () => ({ title: null, description: null, webIfrsName: null, d365foName: null, sapName: null }),
};

/** rowGUIDs of the seed rows */
export const MANAGEMENT_ACTIVITY_GENUS = {
  operating: 'operatingActivity',
  investing: 'investingActivity',
  financing: 'financingActivity',
} as const;

export type ManagementActivityGenusCode = (typeof MANAGEMENT_ACTIVITY_GENUS)[keyof typeof MANAGEMENT_ACTIVITY_GENUS];

/** the activities in the order of the cash flow statement */
export const MANAGEMENT_ACTIVITY_GENUS_CODES: ManagementActivityGenusCode[] = ['operatingActivity', 'investingActivity', 'financingActivity'];

export interface ManagementActivityGenusJSON {
  title: string;
  description?: string | null;
  /** the Web + IFRS name (IAS 7 paragraph) */
  webIfrsName?: string | null;
  /** the matching object in Dynamics 365 Finance and Operations */
  d365foName?: string | null;
  /** the matching object in SAP */
  sapName?: string | null;
}

export const managementActivityGenusTitle = (r: DefRow<any> | undefined | null): string => String(r?.rowJSON?.title ?? '').trim() || r?.rowGUID || '';

/** 'Operating activity' -> 'Operating' (the short name of the activity in the lists of a budget item) */
export const managementActivityGenusShortTitle = (r: DefRow<any> | undefined | null): string => managementActivityGenusTitle(r).replace(/\s+activity$/i, '');

/** the activities sorted by orderInList */
export const managementActivityGenusRows = (rows: DefRow<any>[]): DefRow<any>[] =>
  (rows || []).slice().sort((a, b) => (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0));
