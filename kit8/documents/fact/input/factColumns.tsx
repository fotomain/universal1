// factColumns - the columns of the ReusableTable of the fact input form (one tab = one genus of one document):
//   # · Date · Role · Resource · Unit · Planned · Qty · Price · Sum for budget · Sum for contract · Sum for accounting
// Where a cell is stored: Date = the root column rowPeriodDatetime (EDITABLE in every line, a calendar date cell), Qty = the root column qtyForContract (the ONLY quantity a user states),
// Planned = qtyForBudget (the quantity of the task line, frozen), the three sums are root columns computed by the database (qty x price); Role / Resource / Unit / Price are the description
// of the line in rowJSON - typed in the FREE input, frozen in the STRONG input (the database refuses a change). A posted document shows everything and edits nothing.
import { EQUIPMENT_ENTITY } from '../../../catalog/equipment/equipmentModel';
import { PERSON_CATALOG_OWNER, PERSON_ENTITY } from '../../../catalog/person/personModel';
import { PRODUCT_TABLES } from '../../../catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../catalog/resourcerole/resourceRoleModel';
import { rowTitle } from '../../../catalog/product/crud/productCatalogTools';
import { MANAGEMENT_GENUS } from '../../../catalog/management/genus/managementGenusModel';
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../../pm/i18n/pmT';
import { genusOfRole } from '../../../pm/view/task/finances/taskLineCatalogs';
import type { TaskLineCatalogData } from '../../../pm/view/task/finances/taskLineCatalogs';
import { resourceTitleOfRow } from '../../../pm/view/task/finances/taskLineResource';
import { FACT_NEW_ROW_KEYS, FACT_USAGE_TIMELINE_TABLE, FactHeaderView, canEditLines, dayOfPeriod } from './factInputModel';
import { pmNumberColumn } from '../../../pm/components/pmNumberColumn';

export interface FactColumnsContext {
  data: TaskLineCatalogData;
  /** the genus of the tab */
  genus: string;
  header: FactHeaderView;
}

/** the columns whose cells the user can edit in this document: none in a posted one; the description of the line only in the free input */
export function factEditability(header: FactHeaderView): { dateAndQty: boolean; description: boolean } {
  const edit = canEditLines(header);
  return { dateAndQty: edit, description: edit && !header.strong };
}

export function buildFactColumns({ data, genus, header }: FactColumnsContext): VisualColumn[] {
  const { dateAndQty, description } = factEditability(header);
  const unitOptions = data.measureUnit.map((u) => ({ value: u.rowGUID, label: rowTitle(u) || u.rowGUID }));
  const isTime = genus === MANAGEMENT_GENUS.time;
  const root = (key: string, title: string, width: number, total = true): VisualColumn =>
    ({ key, title: pmT(title), type: 'number', target: key as any, width, editable: false, total, stepper: false } as VisualColumn);
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    // rowPeriodDatetime is a timestamptz: the table shows and takes the DAY ('YYYY-MM-DD'); the database keeps the start of that day
    { key: 'day', title: pmT('Date'), type: 'date', picker: true, target: 'rowPeriodDatetime', width: 170, editable: dateAndQty, fromStored: (v, row) => (v ? dayOfPeriod(String(v)) : (row?.rowJSON?.[FACT_NEW_ROW_KEYS.day] ?? null)) } as VisualColumn,
    {
      key: 'role', title: pmT('Role'), type: 'catalog', field: 'resourceRoleItem', width: 220, editable: description,
      catalogEntityName: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity, placeholder: pmT('Select role…'),
      // the roles of this tab (a role type points at its management genus)
      filterItem: (role) => genusOfRole(data, role) === genus,
    } as VisualColumn,
    isTime
      ? {
          key: 'resource', title: `${pmT('Person')} / ${pmT('Equipment')}`, type: 'catalog', field: 'taskResourceItem', width: 240, editable: description,
          catalogEntityName: PERSON_ENTITY, catalogRowOwnerGUID: PERSON_CATALOG_OWNER, catalogEntityNames: [PERSON_ENTITY, EQUIPMENT_ENTITY],
          catalogEntityNameOf: (row) => (row.rowJSON?.taskResourceKind === 'equipment' ? EQUIPMENT_ENTITY : PERSON_ENTITY),
          titleExtractor: resourceTitleOfRow, placeholder: pmT('Select resource…'),
        } as VisualColumn
      : {
          key: 'resource', title: pmT('Product'), type: 'catalog', field: 'taskResourceItem', width: 220, editable: description,
          catalogEntityName: PRODUCT_TABLES.product.entity, placeholder: pmT('Select product…'),
        } as VisualColumn,
    { key: 'unit', title: pmT('Unit'), type: 'select', field: 'measureUnitTaskLine', width: 110, options: unitOptions, allowEmpty: false, editable: description } as VisualColumn,
    root('qtyForBudget', 'Planned', 110, false),
    { key: 'qty', title: pmT('Qty'), type: 'number', target: 'qtyForContract', width: 130, min: 0, max: 1000000000, total: false, stepper: false, editable: dateAndQty, ...pmNumberColumn(FACT_USAGE_TIMELINE_TABLE, 'qtyForContract') } as VisualColumn,
    { key: 'price', title: pmT('Price'), type: 'number', field: 'priceTaskLine', width: 120, min: 0, max: 1000000000, total: false, stepper: false, editable: description, ...pmNumberColumn(FACT_USAGE_TIMELINE_TABLE, 'priceTaskLine') } as VisualColumn,
    root('sumForBudget', 'Sum for budget', 140),
    root('sumForContract', 'Sum for contract', 140),
    root('sumForAccounting', 'Sum for accounting', 150),
    // the VAT of a STRONG line (the VAT rate of its task line, frozen into the line); a FREE line has no task line, so these stay empty (documentation/VENDOR_INVOICE_DOC.html section 16)
    root('vatForContract', 'VAT for contract', 130),
    root('vatForBudget', 'VAT for budget', 130),
    root('vatForAccounting', 'VAT for accounting', 140),
  ];
}

