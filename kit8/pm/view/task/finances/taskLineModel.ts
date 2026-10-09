// Task lines - the finance lines of ONE task: Time (a role + a person), Material, Expense, Revenue (a role + a product + a partner).
//   SQL: kit8/sql/init/create_pm_task_line_table.sql  ·  table task_line_table  ·  redux entity TASK_LINE_ENTITY
//   rowGUID · rowProjectGUID (set by SQL from the task) · rowOwnerGUID = the task · rowParentGUID = the LEAF management genus
//   · orderInList (order inside the genus of the task) · rowJSON = TaskLineRowJSON
// The sheet "W1 TASK LINES": task_line_table is the same table for every management genus; the genus (rowParentGUID) decides who the
// resource is (Time: a Person; the others: a Product) and which columns are shown.
import { MANAGEMENT_GENUS } from '../../../../catalog/management/genus/managementGenusModel';

/** Supabase table name. */
export const taskLineTable = 'task_line_table';
/** SystemMetaData / redux entity key. */
export const TASK_LINE_ENTITY = 'taskLineReusable';

/** who the resource of a line is: Time = a person (personTable), everything else = a product (productTable) */
export type TaskLineResourceKind = 'person' | 'product';

export interface TaskLineGenusDef {
  /** managementGenusTable.rowGUID (a leaf genus) = task_line_table.rowParentGUID */
  genus: string;
  title: string;
  icon: string;
  resource: TaskLineResourceKind;
  /** the line is a partner's (a supplier for Material / Expense, a customer for Revenue) */
  hasPartner: boolean;
}

/** the genus tabs, in this order (payments are no task lines) */
export const TASK_LINE_GENUS: TaskLineGenusDef[] = [
  { genus: MANAGEMENT_GENUS.time, title: 'Time', icon: 'schedule', resource: 'person', hasPartner: false },
  { genus: MANAGEMENT_GENUS.material, title: 'Material', icon: 'inventory_2', resource: 'product', hasPartner: true },
  { genus: MANAGEMENT_GENUS.expense, title: 'Expenses', icon: 'receipt_long', resource: 'product', hasPartner: true },
  { genus: MANAGEMENT_GENUS.revenue, title: 'Revenues', icon: 'payments', resource: 'product', hasPartner: true },
];
export const TASK_LINE_DEFAULT_GENUS = TASK_LINE_GENUS[0].genus;
export const taskLineGenusDef = (genus: string | null | undefined): TaskLineGenusDef | undefined => TASK_LINE_GENUS.find((g) => g.genus === genus);
/** a genus a line can have; anything else falls back to the first tab */
export const taskLineGenusOf = (genus: string | null | undefined): string => (taskLineGenusDef(genus) ? (genus as string) : TASK_LINE_DEFAULT_GENUS);

/** where the price came from: the contract of the person (Time), the rate of the role, the price of the product, or typed by the user */
export type TaskLinePriceSource = 'contract' | 'role' | 'product' | 'manual';

export interface TaskLineRowJSON {
  /** managementGenusTable.rowGUID of the line = its rowParentGUID, kept in step by the app: the contract templates offered depend on it */
  taskManagementGenusLine: string | null;
  /** resourceRoleTable.rowGUID */
  resourceRoleItem: string | null;
  /** descriptorKey of the variant the role needs (variantTable.rowJSON.descriptorKey of the role's variants) */
  resourceRoleAttributeSetKey: string | null;
  /** personTable.rowGUID (Time) | productTable.rowGUID */
  taskResourceItem: string | null;
  /**
   * Time: the descriptorKey of the VARIANT OF THE PERSON the line books (variantTable, owner = person: "Senior, English"); empty = automatic,
   * the variant that covers what the role requires | others: descriptorKey of the product variant
   */
  taskResourceAttributesKey: string | null;
  /** Time lines: contractTable.rowGUID of THAT person (contract.rowOwnerGUID = personGUID); the cost of the line comes from it */
  taskResourceContract: string | null;
  /** Material / Expense / Revenue: templateResourceContractTable.rowGUID of the line's genus - the contract asked for, before a partner is known */
  resourceContractTemplateTaskLine: string | null;
  /** partnerTable.rowGUID (Material / Expense / Revenue) */
  taskLinePartnerItem: string | null;
  /** contractTable.rowGUID of that partner */
  taskLinePartnerContract: string | null;
  qtyTaskLine: number | null;
  priceTaskLine: number | null;
  /** measureUnitTable.rowGUID */
  measureUnitTaskLine: string | null;
  /** percent, 0..100 */
  vatRatioTaskLine: number | null;
  priceSourceTaskLine: TaskLinePriceSource | null;
  /** the last price the app suggested; while priceTaskLine equals it, the price follows the role / product */
  priceAutoTaskLine: number | null;
  /** qty * price (in the currency of the contract) */
  sumForContract: number | null;
  /** sumForContract * vat / 100 */
  sumVATForContract: number | null;
  /**
   * The same sums in the ACCOUNTING and in the BUDGET currency of the project (project settings → Finances), converted with the exchange rates (D365 style,
   * kit8/catalog/currency/exchange/currencyConvert.ts, taskLineFx.ts). A SNAPSHOT: saved with the rate and its date (fxSnapshotTaskLine), so they never
   * change when a rate changes; "Recalculate" makes them again. null = the project has no such currency, or there is no rate.
   */
  sumForAccounting: number | null;
  sumVATForAccounting: number | null;
  sumForBudget: number | null;
  sumVATForBudget: number | null;
  fxSnapshotTaskLine: LineFxSnapshot | null;
}

/** the rate a line used to convert its sums: the pair rate (units of `to` for 1 unit of `from`), its type, and the day it was taken for */
export interface LineFxRate { to: string; rateType: string; rate: number }
export interface LineFxSnapshot {
  /** the currency of sumForContract (ISO code) */
  from: string;
  /** the day the rates were taken for, and where the day came from: the date of the contract of the line, the start of the task, or today */
  day: string;
  dayFrom: 'contract' | 'task' | 'today';
  /** what the day was chosen from ("<contract date>|<task start>"): when it changes, the snapshot is made again */
  inputs: string;
  accounting?: LineFxRate;
  budget?: LineFxRate;
}

export const emptyTaskLine = (): TaskLineRowJSON => ({
  taskManagementGenusLine: null,
  resourceRoleItem: null, resourceRoleAttributeSetKey: null, taskResourceItem: null, taskResourceAttributesKey: null,
  taskResourceContract: null, resourceContractTemplateTaskLine: null, taskLinePartnerItem: null, taskLinePartnerContract: null,
  qtyTaskLine: null, priceTaskLine: null, measureUnitTaskLine: null, vatRatioTaskLine: null,
  priceSourceTaskLine: null, priceAutoTaskLine: null, sumForContract: null, sumVATForContract: null,
  sumForAccounting: null, sumVATForAccounting: null, sumForBudget: null, sumVATForBudget: null, fxSnapshotTaskLine: null,
});

/** a row of task_line_table as read into redux */
export interface TaskLineRow {
  rowGUID: string;
  rowProjectGUID?: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: Partial<TaskLineRowJSON>;
}
