// productReceiptColumns - the columns of the ReusableTable of the lines of a product receipt (ProductReceiptLines): #, [Genus on the All tab], Role, Resource, Unit, Qty, Price, VAT %,
// Sum before VAT, VAT, Sum with VAT, Sum for budget, Sum for accounting.
// Qty / Price / VAT % are the root columns qtyReceived / priceReceived / vatRatioReceived (EDITABLE in a draft only); the sums are root columns computed by the database; the description of the line
// (role, resource, unit) is read only: it is the task line the line came from - except an INDEPENDENT line (no task line, project setting independentInvoiceInputAvailable), which the user describes.
import React from 'react';
import { Text } from 'react-native';
import { EQUIPMENT_ENTITY } from '../../../catalog/equipment/equipmentModel';
import { PERSON_CATALOG_OWNER, PERSON_ENTITY } from '../../../catalog/person/personModel';
import { PRODUCT_TABLES } from '../../../catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../catalog/resourcerole/resourceRoleModel';
import { rowTitle } from '../../../catalog/product/crud/productCatalogTools';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../../pm/i18n/pmT';
import type { TaskLineCatalogData } from '../../../pm/view/task/finances/taskLineCatalogs';
import { resourceTitleOfRow } from '../../../pm/view/task/finances/taskLineResource';
import { PRODUCT_RECEIPT_ALL_TAB, PRODUCT_RECEIPT_LINES_TABLE } from './productReceiptModel';
import { pmNumberColumn } from '../../../pm/components/pmNumberColumn';
import LinePlaceCell from '../lineplace/LinePlaceCell';
import type { LinePlace, PlaceField } from '../lineplace/linePlaceModel';

export interface ProductReceiptColumnsContext {
  data: TaskLineCatalogData;
  /** the tab: All or a genus */
  tab: string;
  /** the document is a draft: quantity, price and VAT % can be changed */
  editable: boolean;
  /** independent input is on (draft + the project setting): the role, resource and unit of an INDEPENDENT line (no task line) can be filled in */
  independent?: boolean;
  /** MULTI PROJECT product receipt (copied from a Multi Project purchase order): three columns after # - productReceiptLineProject, productReceiptTaskGUID, productReceiptTaskLineGUID - all READ ONLY (the lines follow the purchase order) */
  multiProject?: boolean;
  /** the project / task names of the lines { lineGUID: place } (product_receipt_line_places) */
  places?: Record<string, LinePlace>;
  placeActions?: { paste: (field: PlaceField, row: ReusableTableRow) => void; pick: (field: PlaceField, row: ReusableTableRow) => void; clear: (field: PlaceField, row: ReusableTableRow) => void };
}

const genusTitle: Record<string, string> = { [MANAGEMENT_GENUS.time]: 'Time', [MANAGEMENT_GENUS.material]: 'Material', [MANAGEMENT_GENUS.expense]: 'Expenses' };
const num = (v: unknown): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };

export function buildProductReceiptColumns({ data, tab, editable, independent = false, multiProject = false, places = {}, placeActions }: ProductReceiptColumnsContext): VisualColumn[] {
  // a line that came from a task line is described by it: only an independent line (no taskLineGUID) takes a role, resource and unit
  const describe = { editable: independent, validate: (_v: any, row: ReusableTableRow) => (row.taskLineGUID ? pmT('This line comes from a task line: only the quantity, the price and the VAT % change.') : null) };
  const unitOptions = data.measureUnit.map((u) => ({ value: u.rowGUID, label: rowTitle(u) || u.rowGUID }));
  const root = (key: string, title: string, width: number, total = true): VisualColumn =>
    ({ key, title: pmT(title), type: 'number', target: key as any, width, editable: false, total, stepper: false } as VisualColumn);
  const placeColumn = (key: string, title: string, field: PlaceField, width: number): VisualColumn => ({
    key, title: pmT(title), type: 'custom', width, editable: false,
    renderCell: (row: ReusableTableRow) => (
      <LinePlaceCell
        testID={`product-receipt-place-${field}-${row.rowGUID}`} field={field} place={places[String(row.rowGUID)]} editable={false}
        onPaste={() => placeActions?.paste(field, row)} onPick={() => placeActions?.pick(field, row)} onClear={() => placeActions?.clear(field, row)}
      />
    ),
    searchText: (row: ReusableTableRow) => (field === 'task' ? places[String(row.rowGUID)]?.taskName : places[String(row.rowGUID)]?.taskLineGUID) ?? '',
  } as VisualColumn);
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    ...(multiProject
      ? [
          { key: 'productReceiptLineProject', title: pmT('Project'), type: 'custom', width: 170, editable: false,
            renderCell: (row: ReusableTableRow) => <Text numberOfLines={1} style={{ fontSize: 12 }}>{places[String(row.rowGUID)]?.projectName || ''}</Text>,
            searchText: (row: ReusableTableRow) => places[String(row.rowGUID)]?.projectName ?? '' } as VisualColumn,
          placeColumn('productReceiptTaskGUID', 'Task', 'task', 230),
          placeColumn('productReceiptTaskLineGUID', 'Task line', 'taskLine', 290),
        ]
      : []),
    ...(tab === PRODUCT_RECEIPT_ALL_TAB
      ? [{ key: 'genus', title: pmT('Kind'), type: 'text', width: 100, editable: false, fromStored: (_s: any, row: ReusableTableRow) => pmT(genusTitle[String(row.genusGUID)] ?? String(row.genusGUID ?? '')) } as VisualColumn]
      : []),
    {
      key: 'role', title: pmT('Role'), type: 'catalog', field: 'resourceRoleItem', width: 210, ...describe,
      catalogEntityName: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity, placeholder: '',
    } as VisualColumn,
    {
      // Time: person / equipment · Material: the product · Expense: nothing
      key: 'resource', title: pmT('Resource'), type: 'catalog', field: 'taskResourceItem', width: 230, ...describe,
      catalogEntityName: PRODUCT_TABLES.product.entity, catalogRowOwnerGUID: PERSON_CATALOG_OWNER, catalogEntityNames: [PERSON_ENTITY, EQUIPMENT_ENTITY, PRODUCT_TABLES.product.entity],
      catalogEntityNameOf: (row: ReusableTableRow) => (row.genusGUID === MANAGEMENT_GENUS.time ? (row.rowJSON?.taskResourceKind === 'equipment' ? EQUIPMENT_ENTITY : PERSON_ENTITY) : PRODUCT_TABLES.product.entity),
      titleExtractor: resourceTitleOfRow, placeholder: '',
    } as VisualColumn,
    { key: 'unit', title: pmT('Unit'), type: 'select', field: 'measureUnitTaskLine', width: 100, options: unitOptions, allowEmpty: true, ...describe } as VisualColumn,
    { key: 'qty', title: pmT('Qty'), type: 'number', target: 'qtyReceived', width: 120, min: 0, max: 1000000000, total: false, stepper: false, editable, ...pmNumberColumn(PRODUCT_RECEIPT_LINES_TABLE, 'qtyReceived') } as VisualColumn,
    { key: 'price', title: pmT('Price'), type: 'number', target: 'priceReceived', width: 120, min: 0, max: 1000000000, total: false, stepper: false, editable, ...pmNumberColumn(PRODUCT_RECEIPT_LINES_TABLE, 'priceReceived') } as VisualColumn,
    { key: 'vat', title: pmT('VAT %'), type: 'number', target: 'vatRatioReceived', width: 100, min: 0, max: 100, total: false, stepper: false, editable, ...pmNumberColumn(PRODUCT_RECEIPT_LINES_TABLE, 'vatRatioReceived') } as VisualColumn,
    root('sumForContract', 'Sum before VAT', 150),
    root('vatForContract', 'VAT', 120),
    { key: 'sumWithVAT', title: pmT('Sum with VAT'), type: 'number', width: 150, editable: false, stepper: false, fromStored: (_s: any, row: ReusableTableRow) => Math.round((num(row.sumForContract) + num(row.vatForContract)) * 100) / 100 } as VisualColumn,
    root('sumForBudget', 'Sum for budget', 140),
    root('sumForAccounting', 'Sum for accounting', 150),
  ];
}
