// customerInvoiceColumns - the columns of the ReusableTable of the lines of a customer invoice (CustomerInvoiceLines): #, [Genus on the All tab], Role, Resource, Unit, Qty, Price, VAT %,
// Sum before VAT, VAT, Sum with VAT, Sum for budget, Sum for accounting.
// Qty / Price / VAT % are the root columns qtyInvoiced / priceInvoiced / vatRatioInvoiced (EDITABLE in a draft only); the sums are root columns computed by the database; the description of the line
// (role, resource, unit) is read only: it is the task line the line came from - except an INDEPENDENT line (no task line, project switch customerInvoiceFunctionalityEnabled), which the user describes.
import React from 'react';
import { EQUIPMENT_ENTITY } from '../../../catalog/equipment/equipmentModel';
import { WORK_CENTER_ENTITY } from '../../../catalog/work_center/workCenterModel';
import { PERSON_CATALOG_OWNER, PERSON_ENTITY } from '../../../catalog/person/personModel';
import { PRODUCT_TABLES } from '../../../catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../catalog/resourcerole/resourceRoleModel';
import { rowTitle } from '../../../catalog/product/crud/productCatalogTools';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../../pm/i18n/pmT';
import type { TaskLineCatalogData } from '../../../pm/view/task/finances/taskLineCatalogs';
import { resourceEntityOfKind, resourceTitleOfRow } from '../../../pm/view/task/finances/taskLineResource';
import { CUSTOMER_INVOICE_ALL_TAB, CUSTOMER_INVOICE_LINES_TABLE } from './customerInvoiceModel';
import { accountingColumns, vatRateColumn } from '../../vat/documentVatColumns';
import { pmNumberColumn } from '../../../pm/components/pmNumberColumn';

export interface CustomerInvoiceColumnsContext {
  data: TaskLineCatalogData;
  /** the tab: All or a genus */
  tab: string;
  /** the document is a draft: quantity, price and VAT % can be changed */
  editable: boolean;
  /** independent input is on (draft + the project switch): the role, resource and unit of an INDEPENDENT line (no task line) can be filled in */
  independent?: boolean;
}

const genusTitle: Record<string, string> = { [MANAGEMENT_GENUS.time]: 'Time', [MANAGEMENT_GENUS.material]: 'Material', [MANAGEMENT_GENUS.expense]: 'Expenses', [MANAGEMENT_GENUS.revenue]: 'Deliverable' };
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };

export function buildCustomerInvoiceColumns({ data, tab, editable, independent = false }: CustomerInvoiceColumnsContext): VisualColumn[] {
  // a line that came from a task line is described by it: only an independent line (no taskLineGUID) takes a role, resource and unit
  const describe = { editable: independent, validate: (_v: any, row: ReusableTableRow) => (row.taskLineGUID ? pmT('This line comes from a task line: only the quantity, the price and the VAT % change.') : null) };
  const unitOptions = data.measureUnit.map((u) => ({ value: u.rowGUID, label: rowTitle(u) || u.rowGUID }));
  const root = (key: string, title: string, width: number, total = true): VisualColumn =>
    ({ key, title: pmT(title), type: 'number', target: key as any, width, editable: false, total, stepper: false } as VisualColumn);
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    ...(tab === CUSTOMER_INVOICE_ALL_TAB
      ? [{ key: 'genus', title: pmT('Kind'), type: 'text', width: 100, editable: false, fromStored: (_s: any, row: ReusableTableRow) => pmT(genusTitle[String(row.genusGUID)] ?? String(row.genusGUID ?? '')) } as VisualColumn]
      : []),
    {
      key: 'role', title: pmT('Role'), type: 'catalog', field: 'resourceRoleItem', width: 210, ...describe,
      catalogEntityName: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity, placeholder: '',
    } as VisualColumn,
    {
      // Time: person / equipment · Material: the product · Expense: nothing
      key: 'resource', title: pmT('Resource'), type: 'catalog', field: 'taskResourceItem', width: 230, ...describe,
      catalogEntityName: PRODUCT_TABLES.product.entity, catalogRowOwnerGUID: PERSON_CATALOG_OWNER, catalogEntityNames: [PERSON_ENTITY, EQUIPMENT_ENTITY, WORK_CENTER_ENTITY, PRODUCT_TABLES.product.entity],
      catalogEntityNameOf: (row: ReusableTableRow) => (row.genusGUID === MANAGEMENT_GENUS.time ? resourceEntityOfKind(row.rowJSON?.taskResourceKind) : PRODUCT_TABLES.product.entity),
      titleExtractor: resourceTitleOfRow, placeholder: '',
    } as VisualColumn,
    { key: 'unit', title: pmT('Unit'), type: 'select', field: 'measureUnitTaskLine', width: 100, options: unitOptions, allowEmpty: true, ...describe } as VisualColumn,
    { key: 'qty', title: pmT('Qty'), type: 'number', target: 'qtyInvoiced', width: 120, min: 0, max: 1000000000, total: false, stepper: false, editable, ...pmNumberColumn(CUSTOMER_INVOICE_LINES_TABLE, 'qtyInvoiced') } as VisualColumn,
    { key: 'price', title: pmT('Price'), type: 'number', target: 'priceInvoiced', width: 120, min: 0, max: 1000000000, total: false, stepper: false, editable, ...pmNumberColumn(CUSTOMER_INVOICE_LINES_TABLE, 'priceInvoiced') } as VisualColumn,
    vatRateColumn({ data, editable, ratioKey: 'vatRatioInvoiced' }),
    root('sumForContract', 'Sum before VAT', 150),
    root('vatForContract', 'VAT', 120),
    { key: 'sumWithVAT', title: pmT('Sum with VAT'), type: 'number', width: 150, editable: false, stepper: false, fromStored: (_s: any, row: ReusableTableRow) => Math.round((num(row.sumForContract) + num(row.vatForContract)) * 100) / 100 } as VisualColumn,
    ...accountingColumns({ editable, tableName: CUSTOMER_INVOICE_LINES_TABLE }),
  ];
}
