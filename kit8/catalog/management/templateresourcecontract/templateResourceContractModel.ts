// Template of the resource contract - the contract a task line ASKS FOR before any partner is known ("for future supplies independent from
// Partner here", sheet "W1 TASK LINES"). It works like a template for FUTURE partner relationships: when a partner is chosen, a real contract
// (contractTable) is made from it.
//   templateResourceContractTable   rowGUID · rowOwnerGUID = managementGenus.rowGUID (a LEAF genus: time / material / expense / revenue)
//                                   · rowParentGUID 'empty' · orderInList · rowJSON = TemplateResourceContractJSON
//   task_line_table.rowJSON.resourceContractTemplateTaskLine = the template; the lines of a genus offer the templates of THAT genus
//   (task_line_table.rowJSON.taskManagementGenusLine)
//   SQL: kit8/sql/init/create_template_resource_contract_table.sql   Screen: TemplateResourceContractCRUD (route TEMPLATE_RESOURCE_CONTRACT_ROUTES.list)
import type { ProductTableDef } from '../../product/productModel';
import { CONTRACT_PERIODS } from '../../contract/contractModel';

export const TEMPLATE_RESOURCE_CONTRACT_ROUTES = { list: '/catalog/management/templateresourcecontract/list' } as const;
/** Supabase table name. */
export const templateResourceContractTable = 'templateResourceContractTable';
/** SystemMetaData / redux entity key. */
export const TEMPLATE_RESOURCE_CONTRACT_ENTITY = 'templateResourceContractReusable';
export const TEMPLATE_RESOURCE_CONTRACT_READ_PARAMS = { paginationSize: 1000, originationCurrentPage: 0 };

export interface TemplateResourceContractJSON {
  title: string | null;
  description: string | null;
  /** the terms asked for (quality, approvals, retention ...) */
  requirements: string | null;
  /** Supply | Service | Sales | Employment ... (free list, as contractType of contractTable) */
  contractType: string | null;
  /** Month | Week | Day | Year | OneTime | Quarter (contractModel CONTRACT_PERIODS) */
  paymentsPeriod: keyof typeof CONTRACT_PERIODS | null;
  paymentTermDays: number | null;
  /** ISO 4217 */
  currency: string | null;
  /** percent, 0..100 */
  vatRate: number | null;
  deliveryTerms: string | null;
  validityDays: number | null;
  isActive: boolean;
}

export const emptyTemplateResourceContract = (): TemplateResourceContractJSON => ({
  title: null, description: null, requirements: null, contractType: null, paymentsPeriod: null, paymentTermDays: null,
  currency: 'EUR', vatRate: null, deliveryTerms: null, validityDays: null, isActive: true,
});

export const TEMPLATE_RESOURCE_CONTRACT_TABLE: ProductTableDef = {
  table: templateResourceContractTable,
  entity: TEMPLATE_RESOURCE_CONTRACT_ENTITY,
  itemLabel: 'Template',
  catalogOwner: null,
  purpose: 'The contract a task line asks for before a partner is known; one list per management genus (time, material, expense, revenue).',
  emptyRowJSON: () => ({ ...emptyTemplateResourceContract() }),
};

export const CONTRACT_TYPE_OPTIONS = ['Supply', 'Service', 'Sales', 'Employment', 'Rent', 'Other'].map((v) => ({ value: v, label: v }));
export const PAYMENT_PERIOD_OPTIONS = Object.values(CONTRACT_PERIODS).map((v) => ({ value: v, label: v }));
