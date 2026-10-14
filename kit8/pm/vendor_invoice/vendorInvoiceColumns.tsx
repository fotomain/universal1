// vendorInvoiceColumns - the columns of the ReusableTable of the lines of a vendor invoice (VendorInvoiceLines): #, [Genus on the All tab], Role, Resource, Unit, Qty, Price, VAT %,
// Sum before VAT, VAT, Sum with VAT, Sum for budget, Sum for accounting.
// Qty / Price / VAT % are the root columns qtyInvoiced / priceInvoiced / vatRatioInvoiced (EDITABLE in a draft only); the sums are root columns computed by the database; the description of the line
// (role, resource, unit) is read only: it is the task line the line came from.
import { EQUIPMENT_ENTITY } from '../../catalog/equipment/equipmentModel';
import { PERSON_CATALOG_OWNER, PERSON_ENTITY } from '../../catalog/person/personModel';
import { PRODUCT_TABLES } from '../../catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../catalog/resourcerole/resourceRoleModel';
import { rowTitle } from '../../catalog/product/crud/productCatalogTools';
import { MANAGEMENT_GENUS } from '../../catalog/management/genus/managementGenusModel';
import type { ReusableTableRow, VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../i18n/pmT';
import type { TaskLineCatalogData } from '../view/task/finances/taskLineCatalogs';
import { resourceTitleOfRow } from '../view/task/finances/taskLineResource';
import { VENDOR_INVOICE_ALL_TAB } from './vendorInvoiceModel';

export interface VendorInvoiceColumnsContext {
  data: TaskLineCatalogData;
  /** the tab: All or a genus */
  tab: string;
  /** the document is a draft: quantity, price and VAT % can be changed */
  editable: boolean;
}

const genusTitle: Record<string, string> = { [MANAGEMENT_GENUS.time]: 'Time', [MANAGEMENT_GENUS.material]: 'Material', [MANAGEMENT_GENUS.expense]: 'Expenses' };
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };

export function buildVendorInvoiceColumns({ data, tab, editable }: VendorInvoiceColumnsContext): VisualColumn[] {
  const unitOptions = data.measureUnit.map((u) => ({ value: u.rowGUID, label: rowTitle(u) || u.rowGUID }));
  const root = (key: string, title: string, width: number, total = true): VisualColumn =>
    ({ key, title: pmT(title), type: 'number', target: key as any, width, editable: false, total, stepper: false } as VisualColumn);
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    ...(tab === VENDOR_INVOICE_ALL_TAB
      ? [{ key: 'genus', title: pmT('Kind'), type: 'text', width: 100, editable: false, fromStored: (_s: any, row: ReusableTableRow) => pmT(genusTitle[String(row.genusGUID)] ?? String(row.genusGUID ?? '')) } as VisualColumn]
      : []),
    {
      key: 'role', title: pmT('Role'), type: 'catalog', field: 'resourceRoleItem', width: 210, editable: false,
      catalogEntityName: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity, placeholder: '',
    } as VisualColumn,
    {
      // Time: person / equipment · Material: the product · Expense: nothing
      key: 'resource', title: pmT('Resource'), type: 'catalog', field: 'taskResourceItem', width: 230, editable: false,
      catalogEntityName: PRODUCT_TABLES.product.entity, catalogRowOwnerGUID: PERSON_CATALOG_OWNER, catalogEntityNames: [PERSON_ENTITY, EQUIPMENT_ENTITY, PRODUCT_TABLES.product.entity],
      catalogEntityNameOf: (row: ReusableTableRow) => (row.genusGUID === MANAGEMENT_GENUS.time ? (row.rowJSON?.taskResourceKind === 'equipment' ? EQUIPMENT_ENTITY : PERSON_ENTITY) : PRODUCT_TABLES.product.entity),
      titleExtractor: resourceTitleOfRow, placeholder: '',
    } as VisualColumn,
    { key: 'unit', title: pmT('Unit'), type: 'select', field: 'measureUnitTaskLine', width: 100, options: unitOptions, allowEmpty: true, editable: false } as VisualColumn,
    { key: 'qty', title: pmT('Qty'), type: 'number', target: 'qtyInvoiced', width: 120, min: 0, max: 1000000000, total: false, stepper: false, editable } as VisualColumn,
    { key: 'price', title: pmT('Price'), type: 'number', target: 'priceInvoiced', width: 120, min: 0, max: 1000000000, total: false, stepper: false, editable } as VisualColumn,
    { key: 'vat', title: pmT('VAT %'), type: 'number', target: 'vatRatioInvoiced', width: 100, min: 0, max: 100, total: false, stepper: false, editable } as VisualColumn,
    root('sumForContract', 'Sum before VAT', 150),
    root('vatForContract', 'VAT', 120),
    { key: 'sumWithVAT', title: pmT('Sum with VAT'), type: 'number', width: 150, editable: false, stepper: false, fromStored: (_s: any, row: ReusableTableRow) => Math.round((num(row.sumForContract) + num(row.vatForContract)) * 100) / 100 } as VisualColumn,
    root('sumForBudget', 'Sum for budget', 140),
    root('sumForAccounting', 'Sum for accounting', 150),
  ];
}
