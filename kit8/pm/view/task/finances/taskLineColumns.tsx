// Task lines - the columns of the table of one genus (VisualColumn[] of the ReusableTable).
//   Errors (the FIRST column, only when a line of the tab has an error) · Budget item (the first data column: what the line is budgeted as; a line
//   without one is not posted) · then:
//   Time:                      # · Role · Role attributes · Person · Person variant (his own variants, taskLinePersonMatch.ts) · Contract · Qty · Unit · Price · VAT % · Sum · VAT · Currency
//     with equipment (the project's input switches, kit8/pm/model/taskInputScope.ts): person only = as above | equipment only = Equipment · Equipment variant (no Contract) |
//     both = # · Resource (the menu Person | Equipment) · Role · Role attributes · Person / Equipment (ONE column, the catalog follows the Resource of the row) · Variant · Contract
//     with work centers (project switch projectTimeOfWorkCenterNeeded): the menu is Resource: Person | Equipment | Partner (taskWorkCenterKind) and the ONE column "Person / Equipment / Partner" picks the
//     WORK CENTERS (kit8/catalog/work_center) of that kind; a line made before (a person / equipment held directly) still shows its person / equipment. A work center follows its base: a Person work
//     center has the contract of its person, a variant of its own (Copy Variant settings).
//   Material / Expense / Revenue: # · Role · Role attributes · [Item number] · [Search name] · Product · Attributes · Contract template · Partner · Partner contract · Qty · Unit · Price · VAT % · Sum · VAT · Currency
//     (Item number / Search name: inputs for a fast choice of the product (they show the chosen product's field), only while the project shows them - productFieldsOfProject `shown`)
// Only GUIDs / keys / numbers are stored in rowJSON (taskLineModel.ts); titles are read from the catalogs.
import React from 'react';
import { Text, View } from 'react-native';
import { PERSON_CATALOG_OWNER, PERSON_ENTITY } from '../../../../catalog/person/personModel';
import { EQUIPMENT_CATALOG_OWNER, EQUIPMENT_ENTITY } from '../../../../catalog/equipment/equipmentModel';
import { WORK_CENTER_CATALOG_OWNER, WORK_CENTER_ENTITY, WORK_CENTER_KINDS } from '../../../../catalog/work_center/workCenterModel';
import { PARTNER_CATALOG_OWNER, PARTNER_ENTITY } from '../../../../catalog/partner/partnerModel';
import { CONTRACT_ENTITY } from '../../../../catalog/contract/contractModel';
import { TEMPLATE_RESOURCE_CONTRACT_ENTITY, TEMPLATE_RESOURCE_CONTRACT_ROUTES } from '../../../../catalog/management/templateresourcecontract/templateResourceContractModel';
import { BUDGET_ITEM_TABLE, isBudgetItemFolder } from '../../../../catalog/budget/item/budgetItemModel';
import { distributionOptions } from '../../../../catalog/distribution/distributionModel';
import { PRODUCT_TABLES } from '../../../../catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../../catalog/resourcerole/resourceRoleModel';
import { rowTitle } from '../../../../catalog/product/crud/productCatalogTools';
import type { VisualColumn } from '../../../../ui/components/table/reusable/reusableTableTypes';
import { PMTipIcon } from '../../../inner/buttons';
import { lineContractCurrency, lineProblems, productVariantOptions, roleFitsLine, roleVariantOptions, TaskLineCatalogData } from './taskLineCatalogs';
import { lineBaseItem, lineMenuKind, personFullName, resourceEntityOfKind, resourceTitleOfRow, RESOURCE_WORDS } from './taskLineResource';
import type { TimeResourceKind } from '../../../model/taskInputScope';
import { personMatchProblems, personVariantOptions } from './taskLinePersonMatch';
import { fxEnabled, fxProblem, fxSnapshotText, LineFxContext, LineFxProject } from './taskLineFx';
import { taskLineTable, type TaskLineGenusDef } from './taskLineModel';
import { pmNumberColumn } from '../../../components/pmNumberColumn';
import { pmT } from '../../../i18n/pmT';
import { businessUnitNodes, businessUnitPath, businessUnitProblem, isBusinessUnitActive, selectableBusinessUnits } from '../../../../catalog/business_unit/businessUnitModel';
import { isProductFolder, productRowsWithFolders, productSelectColumns, productSubtitle } from '../../../../catalog/product/productSelectModel';
import { itemNumberOf, NO_PRODUCT_FIELDS, searchNameOf, type ProductFields } from '../../../../catalog/product/productFieldsModel';
import SelectCatalogItemWithFolders from '../../../../catalog/select/with_folders/SelectCatalogItemWithFolders';
import SelectCatalogItemFromTreeReusable from '../../../../catalog/select/from_tree/SelectCatalogItemFromTreeReusable';
import { BUSINESS_UNIT_SOURCE_TEXT, lineBudgetKind } from './taskLineBusinessUnit';

/** person.rowJSON -> "first name + last name" (taskLineResource.ts) */
export { personFullName };

/** every error of a line: the catalogs (role / variant / template), the person match and the exchange rates; [] = none */
export function taskLineErrors(data: TaskLineCatalogData, genus: TaskLineGenusDef, rowJSON: Record<string, any>, fx?: LineFxContext | null): string[] {
  const fxMessage = fxProblem(fx, data, genus, rowJSON);
  return [...lineProblems(data, genus, rowJSON), ...personMatchProblems(data, genus, rowJSON), ...(fxMessage ? [fxMessage] : [])];
}

export interface TaskLineColumnsContext {
  data: TaskLineCatalogData;
  genus: TaskLineGenusDef;
  /** the project's default contract currency, shown when a line has no contract yet */
  projectCurrency?: string | null;
  textColor: string;
  errorColor: string;
  /** the project's accounting / budget currencies: the columns of the converted sums are shown when it has one (taskLineFx.ts) */
  fxProject?: LineFxProject | null;
  /** the exchange rates (null while they are being read): the reason a sum could not be converted is a mark on the line */
  fx?: LineFxContext | null;
  /** show the Errors column (default true): the table passes false while no line of the tab has an error */
  showErrors?: boolean;
  /** Time: the resource kinds the table offers (taskInputScope.ts `timeKindsOffered`); two = the menu "Resource: Person | Equipment". Default: a person only (as before equipment) */
  timeKinds?: TimeResourceKind[];
  /** the optional product fields (Item number, Search name) of THIS project (productFieldsOfProject): columns / details / search of the product window. Default: none */
  productFields?: ProductFields;
}

export function buildTaskLineColumns({ data, genus, projectCurrency, textColor, errorColor, fxProject, fx, showErrors = true, timeKinds = ['person'], productFields = NO_PRODUCT_FIELDS }: TaskLineColumnsContext): VisualColumn[] {
  const unitOptions = data.measureUnit.map((u) => ({ value: u.rowGUID, label: rowTitle(u) || u.rowGUID }));
  const worker = genus.resource !== 'product';
  const kinds = worker && timeKinds.length ? timeKinds : ['person' as const];
  /** the project books WORK CENTERS: the menu is Person | Equipment | Partner = the kind of the work centers offered */
  const withWorkCenters = worker && kinds.includes('workCenter');
  /** the menu "Resource: Person | Equipment" is there only while both kinds are offered (with work centers always) */
  const hasMenu = worker && (kinds.length > 1 || withWorkCenters);
  /** the tree of the business units (the window that chooses the unit of a line) */
  const unitNodes = businessUnitNodes(data.businessUnit);
  /** the items of THIS genus (a Time line offers the Time items); a folder is no choice */
  const budgetItemOfGenus = (item: any) => !isBudgetItemFolder(item) && item.rowJSON?.managementGenusItem === genus.genus;
  /** the product folders + the products in one list (the window that chooses a product) */
  const productRows = productRowsWithFolders(data.productFolder, data.product);
  const productColumns = productSelectColumns(productFields);
  const cols: VisualColumn[] = [
    // the error messages of the line: the first column of the table (after the drag and the select-row columns), before the number; not there when no line has an error
    ...(showErrors ? [{
      key: 'errors', title: pmT('Errors'), type: 'custom', width: 280, editable: false, pinFirst: true,
      renderCell: (row) => {
        const problems = taskLineErrors(data, genus, row.rowJSON || {}, fx);
        return problems.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <PMTipIcon tip={problems.join('\n')} testID={`task-line-problem-${row.rowGUID}`} name="warning" size={18} color={errorColor} />
            <Text numberOfLines={1} style={{ color: errorColor, fontSize: 12, flex: 1 }}>{problems.join(' · ')}</Text>
          </View>
        ) : null;
      },
      searchText: (row) => taskLineErrors(data, genus, row.rowJSON || {}, fx).join(' '),
    } as VisualColumn] : []),
    {
      // what the line is budgeted as (budgetItemTable): the items of THIS genus (the item points at its management genus); a line without one is not posted
      key: 'budgetItem', title: pmT('Budget item'), type: 'catalog', field: 'budgetItemTaskLine', width: 200,
      catalogEntityName: BUDGET_ITEM_TABLE.entity, placeholder: pmT('Select budget item…'),
      filterItem: (item) => budgetItemOfGenus(item),
      // the window of the choice: Tree (folders + items; a tree-table) | List (as before: the items, title + description), a RadioSetApp switches them
      renderPicker: ({ testID, value, onChange, disabled, compact, triggerStyle, placeholder }) => (
        <SelectCatalogItemWithFolders
          testID={testID}
          rows={data.budgetItem}
          isFolder={isBudgetItemFolder}
          filterItem={budgetItemOfGenus}
          subtitleOf={(r) => r.rowJSON?.description || undefined}
          value={value}
          onChange={(guid) => onChange(guid)}
          title={pmT('Budget item')}
          placeholder={placeholder}
          icon="request_quote"
          compact={compact}
          triggerStyle={triggerStyle}
          disabled={disabled}
        />
      ),
    },
    // the business unit the line is posted to (right after the budget item): the units that take the kind of the line (a cost is not posted to a revenue center);
    // empty = the app takes it from the first source that has one: resource, role, budget item, contract, project (taskLineBusinessUnit.ts). Only while there are units.
    ...(data.businessUnit.length > 0 ? [
      {
        // chosen from the TREE of the units (a window with a search box); the units that do not take the kind of the line are greyed, with the reason
        key: 'businessUnit', title: pmT('Business unit'), type: 'custom', width: 240,
        renderCell: (row, _i, patch) => {
          const json = row.rowJSON || {};
          const kind = lineBudgetKind(data, genus.genus, json);
          const keep = json.businessUnitTaskLine as string | null | undefined;
          const ok = new Set(selectableBusinessUnits(data.businessUnit, { kind, cfrRows: data.cfrType, keep }).map((r) => r.rowGUID));
          return (
            <View style={{ flex: 1, minWidth: 0 }}>
              <SelectCatalogItemFromTreeReusable
                testID={`task-line-unit-${row.rowGUID}`}
                nodes={unitNodes}
                value={keep ?? null}
                pathOf={(id) => businessUnitPath(data.businessUnit, id)}
                isSelectable={(id) => ok.has(id)}
                reasonWhy={(id) => {
                  const unit = data.businessUnit.find((r) => r.rowGUID === id);
                  return (unit && !isBusinessUnitActive(unit) ? pmT('This unit is not active') : businessUnitProblem(data.businessUnit, data.cfrType, id, kind)) || pmT('This unit cannot be chosen here');
                }}
                title={pmT('Business unit')}
                placeholder={pmT('Not set')}
                searchPlaceholder={pmT('Search business units…')}
                compact
                triggerStyle={{ borderRadius: 0, borderWidth: 0, backgroundColor: 'transparent' }}
                // the user's own choice: source 'line' (an empty field follows the sources again)
                onChange={(id) => patch({ businessUnitTaskLine: id, businessUnitSourceTaskLine: id ? 'line' : null })}
              />
            </View>
          );
        },
        searchText: (row) => businessUnitPath(data.businessUnit, row.rowJSON?.businessUnitTaskLine),
      } as VisualColumn,
      {
        key: 'businessUnitSource', title: pmT('Unit from'), type: 'custom', width: 150, editable: false,
        renderCell: (row) => {
          const src = row.rowJSON?.businessUnitSourceTaskLine as keyof typeof BUSINESS_UNIT_SOURCE_TEXT | undefined;
          return <Text numberOfLines={1} testID={`task-line-unit-source-${row.rowGUID}`} style={{ color: textColor, opacity: 0.65, fontSize: 12 }}>{src && row.rowJSON?.businessUnitTaskLine ? pmT(BUSINESS_UNIT_SOURCE_TEXT[src] ?? src) : ''}</Text>;
        },
        searchText: (row) => businessUnitPath(data.businessUnit, row.rowJSON?.businessUnitTaskLine),
      } as VisualColumn,
    ] : []),
    { key: 'n', title: '#', type: 'rowNumber' },
    // the menu Person | Equipment: BEFORE the role and the resource, because the role and the resource are picked from the catalogs of the kind chosen here
    ...(hasMenu ? [(withWorkCenters ? {
      // Person | Equipment | Partner: the kind of the work centers the resource column offers; a line that holds a person / equipment directly shows its own kind
      key: 'resourceKind', title: pmT('Resource'), type: 'select', field: 'taskWorkCenterKind', width: 130, allowEmpty: false, placeholder: pmT('Person'),
      options: WORK_CENTER_KINDS.map((k) => ({ value: k.value, label: pmT(k.label) })),
      fromStored: (_stored: any, row: any) => lineMenuKind(data, row.rowJSON || {}),
    } : {
      key: 'resourceKind', title: pmT('Resource'), type: 'select', field: 'taskResourceKind', width: 130, allowEmpty: false, placeholder: pmT('Person'),
      options: kinds.map((k) => ({ value: k, label: pmT(RESOURCE_WORDS[k].title) })),
    }) as VisualColumn] : []),
    {
      key: 'role', title: pmT('Role'), type: 'catalog', field: 'resourceRoleItem', width: 220,
      catalogEntityName: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity, placeholder: pmT('Select role…'),
      // the roles of this genus (a role type points at its management genus) and - on a Time line - of the kind of the resource (a person's or an equipment's roles)
      filterItem: (role, row) => roleFitsLine(data, genus, row.rowJSON || {}, role),
    },
    {
      key: 'roleAttributes', title: pmT('Role attributes'), type: 'select', field: 'resourceRoleAttributeSetKey', width: 190,
      options: (row) => roleVariantOptions(data, row.rowJSON?.resourceRoleItem), placeholder: pmT('Any'),
    },
  ];

  if (worker) {
    const personOnly = kinds.length === 1 && kinds[0] === 'person';
    const equipmentOnly = kinds.length === 1 && kinds[0] === 'equipment';
    /** an inactive equipment / work center is not offered; the one already on the line stays */
    const eqActive = (r: any, row: any) => r?.rowJSON?.isActive !== false || r?.rowGUID === row?.rowJSON?.taskResourceItem;
    const resourceKey = hasMenu ? 'resource' : equipmentOnly ? 'equipment' : 'person';
    cols.push(
      (personOnly ? {
        key: 'person', title: pmT('Person'), type: 'catalog', field: 'taskResourceItem', width: 220,
        catalogEntityName: PERSON_ENTITY, catalogRowOwnerGUID: PERSON_CATALOG_OWNER, titleExtractor: personFullName, placeholder: pmT('Select person…'),
      } : equipmentOnly ? {
        key: 'equipment', title: pmT('Equipment'), type: 'catalog', field: 'taskResourceItem', width: 220,
        catalogEntityName: EQUIPMENT_ENTITY, catalogRowOwnerGUID: EQUIPMENT_CATALOG_OWNER, titleExtractor: resourceTitleOfRow, placeholder: pmT('Select equipment…'),
        // an inactive equipment is not offered (the one already on the line stays)
        filterItem: eqActive,
      } : withWorkCenters ? {
        // WORK CENTERS: ONE column "Person / Equipment / Partner"; it lists the work centers of the kind of the menu; a line that holds a person / equipment directly (made before work centers) still picks from
        // its own catalog (ReusableTable catalogEntityNameOf)
        key: 'resource', title: `${pmT('Person')} / ${pmT('Equipment')} / ${pmT('Partner')}`, type: 'catalog', field: 'taskResourceItem', width: 300,
        catalogEntityName: WORK_CENTER_ENTITY, catalogEntityNames: [PERSON_ENTITY, EQUIPMENT_ENTITY, WORK_CENTER_ENTITY],
        catalogEntityNameOf: (row) => (row.rowJSON?.taskResourceKind === 'person' || row.rowJSON?.taskResourceKind === 'equipment' ? resourceEntityOfKind(row.rowJSON.taskResourceKind) : WORK_CENTER_ENTITY),
        titleExtractor: resourceTitleOfRow, placeholder: pmT('Select resource…'),
        filterItem: (r, row) => (r?.rowOwnerGUID === WORK_CENTER_CATALOG_OWNER ? r.rowJSON?.workCenterKind === lineMenuKind(data, row.rowJSON || {}) && eqActive(r, row)
          : r?.rowOwnerGUID === EQUIPMENT_CATALOG_OWNER ? eqActive(r, row) : true),
      } : {
        // BOTH kinds: ONE column, the catalog follows the Resource of the row (ReusableTable catalogEntityNameOf); a row without a kind is a person's
        key: 'resource', title: `${pmT('Person')} / ${pmT('Equipment')}`, type: 'catalog', field: 'taskResourceItem', width: 240,
        catalogEntityName: PERSON_ENTITY, catalogEntityNames: [PERSON_ENTITY, EQUIPMENT_ENTITY],
        catalogEntityNameOf: (row) => (row.rowJSON?.taskResourceKind === 'equipment' ? EQUIPMENT_ENTITY : PERSON_ENTITY),
        titleExtractor: resourceTitleOfRow, placeholder: pmT('Select resource…'),
        filterItem: (r, row) => (r?.rowOwnerGUID === EQUIPMENT_CATALOG_OWNER ? eqActive(r, row) : true),
      }) as VisualColumn,
      {
        // the VARIANT of the person / equipment the line books (Senior, English / Heavy, With operator): its own variants, separate from the variants of the role; empty = automatic
        key: hasMenu ? 'resourceVariant' : equipmentOnly ? 'equipmentVariant' : 'personVariant', field: 'taskResourceAttributesKey', width: 200, type: 'select',
        title: hasMenu ? pmT('Variant') : pmT(equipmentOnly ? RESOURCE_WORDS.equipment.variant : RESOURCE_WORDS.person.variant),
        options: (row) => personVariantOptions(data, row.rowJSON || {}), placeholder: pmT('Automatic'),
      } as VisualColumn,
      // the contract of a PERSON (an equipment has none: its hour is costed by the rate of the role)
      ...(equipmentOnly ? [] : [{
        key: 'contract', title: pmT('Contract'), type: 'catalog', field: 'taskResourceContract', width: 240,
        catalogEntityName: CONTRACT_ENTITY, catalogRowParentGUID: 'person',
        // the contracts of the person selected in the previous column(s); with work centers: the contracts of the PERSON a Person work center stands for (its base)
        dependsOn: resourceKey, dependsOnMessage: pmT(withWorkCenters ? 'Select a person or a work center first' : 'Select a person first'), placeholder: pmT('Select contract…'),
        ...(withWorkCenters ? { dependsOnScopesCatalog: false, filterItem: (contract: any, row: any) => contract?.rowOwnerGUID === lineBaseItem(data, genus, row.rowJSON || {}) } : {}),
      } as VisualColumn]),
    );
  } else {
    /** the field of the chosen product (rowJSON.taskResourceItem) + an input: typing finds a product (ProductFieldInputCell) */
    const productFieldColumn = (key: string, title: string, width: number, field: 'itemNumber' | 'searchName', textOf: (r: any) => string): VisualColumn => {
      const valueOf = (row: any) => textOf(data.product.find((p) => p.rowGUID === row.rowJSON?.taskResourceItem));
      return {
        key, title: pmT(title), type: 'custom', width,
        // loaded when a cell is drawn: the cell needs the design system, and the node tests import this file without it
        renderCell: (row, _i, patch) => {
          const ProductFieldInputCell = require('./ProductFieldInputCell').default;
          return (
          <ProductFieldInputCell testID={`task-line-${key}-${row.rowGUID}`} field={field} shown={valueOf(row)} products={data.product} onPick={(guid: string) => patch({ taskResourceItem: guid })} />
          );
        },
        searchText: valueOf,
      } as VisualColumn;
    };
    cols.push(
      // the optional product fields, BEFORE the Product (project settings -> Product: Enabled AND "Visible in projects")
      ...(productFields.itemNumber.shown ? [productFieldColumn('productItemNumber', 'Item number', 150, 'itemNumber', itemNumberOf)] : []),
      ...(productFields.searchName.shown ? [productFieldColumn('productSearchName', 'Search name', 170, 'searchName', searchNameOf)] : []),
      {
        key: 'product', title: pmT('Product'), type: 'catalog', field: 'taskResourceItem', width: 220,
        catalogEntityName: PRODUCT_TABLES.product.entity, placeholder: pmT('Select product…'),
        // the window of the choice: Tree (the product folders + the products; a tree-table) | List (as before: the products, title + description), a RadioSetApp switches them
        renderPicker: ({ testID, value, onChange, disabled, compact, triggerStyle, placeholder }) => (
          <SelectCatalogItemWithFolders
            testID={testID}
            rows={productRows}
            isFolder={isProductFolder}
            columns={productColumns}
            // Tree | Tree + items (the folders on the left, the products of the branch on the right) | List
            views={['tree', 'split', 'list']}
            subtitleOf={(r) => productSubtitle(r, productFields)}
            value={value}
            onChange={(guid) => onChange(guid)}
            title={pmT('Product')}
            placeholder={placeholder}
            icon="inventory_2"
            compact={compact}
            triggerStyle={triggerStyle}
            disabled={disabled}
          />
        ),
      },
      {
        key: 'productAttributes', title: pmT('Attributes'), type: 'select', field: 'taskResourceAttributesKey', width: 190,
        options: (row) => productVariantOptions(data, row.rowJSON?.taskResourceItem), placeholder: pmT('Any'),
      },
      {
        // the contract the line ASKS FOR before a partner is known: a template of ITS genus (task_line_table.rowJSON.taskManagementGenusLine)
        key: 'contractTemplate', title: pmT('Contract template'), type: 'catalog', field: 'resourceContractTemplateTaskLine', width: 240,
        catalogEntityName: TEMPLATE_RESOURCE_CONTRACT_ENTITY, placeholder: pmT('Select template…'),
        filterItem: (template, row) => template.rowOwnerGUID === (row.rowJSON?.taskManagementGenusLine || row.rowParentGUID),
        detailsRoute: (guid) => ({ pathname: TEMPLATE_RESOURCE_CONTRACT_ROUTES.list, params: { focusRowGUID: guid } }),
      },
      {
        key: 'partner', title: genus.genus === 'revenueGenus' ? pmT('Customer') : pmT('Supplier'), type: 'catalog', field: 'taskLinePartnerItem', width: 220,
        catalogEntityName: PARTNER_ENTITY, catalogRowOwnerGUID: PARTNER_CATALOG_OWNER, placeholder: pmT('Select partner…'),
      },
      {
        key: 'partnerContract', title: pmT('Partner contract'), type: 'catalog', field: 'taskLinePartnerContract', width: 240,
        catalogEntityName: CONTRACT_ENTITY, catalogRowParentGUID: 'partner',
        dependsOn: 'partner', dependsOnMessage: pmT('Select a partner first'), placeholder: pmT('Select contract…'),
      },
    );
  }

  cols.push(
    // the footer sums the quantity only while ALL the lines of the tab have the SAME unit (2 pcs + 3 pcs = 5 pcs; hours + pieces is no sum): "—" when the units differ
    { key: 'qty', title: pmT('Qty'), type: 'number', field: 'qtyTaskLine', width: 130, min: 0, max: 1000000000, totalWhenSame: 'unit', totalSuffix: (unit) => unitOptions.find((o) => o.value === unit)?.label ?? '', ...pmNumberColumn(taskLineTable, 'qtyTaskLine') },
    { key: 'unit', title: pmT('Unit'), type: 'select', field: 'measureUnitTaskLine', width: 110, options: unitOptions, allowEmpty: false },
    { key: 'price', title: pmT('Price'), type: 'number', field: 'priceTaskLine', width: 130, min: 0, max: 1000000000, total: false, ...pmNumberColumn(taskLineTable, 'priceTaskLine') },
    { key: 'vat', title: pmT('VAT %'), type: 'number', field: 'vatRatioTaskLine', width: 110, min: 0, max: 100, total: false, ...pmNumberColumn(taskLineTable, 'vatRatioTaskLine') },
    // how the budget of the line is spread over its days (catalog Distribution, read-only there); stored as the rowGUID
    { key: 'distribution', title: pmT('Budget distribution'), type: 'select', field: 'distributionForBudgetTaskLine', width: 190, options: distributionOptions(data.distribution), placeholder: pmT('Not chosen') },
    { key: 'sum', title: pmT('Sum'), type: 'number', field: 'sumForContract', width: 120, editable: false },
    { key: 'sumVAT', title: pmT('VAT'), type: 'number', field: 'sumVATForContract', width: 110, editable: false },
    // the same sums in the accounting / budget currency of the project: a snapshot of the exchange rate (never edited by hand)
    ...(fxProject && fxEnabled(fxProject) ? [
      ...(fxProject.accountingCurrency ? [
        { key: 'sumAcc', title: `${pmT('Accounting')} ${fxProject.accountingCurrency}`, type: 'number', field: 'sumForAccounting', width: 130, editable: false } as VisualColumn,
        { key: 'sumVATAcc', title: `${pmT('Accounting')} ${pmT('VAT')}`, type: 'number', field: 'sumVATForAccounting', width: 120, editable: false } as VisualColumn,
      ] : []),
      ...(fxProject.budgetCurrency ? [
        { key: 'sumBud', title: `${pmT('Budget')} ${fxProject.budgetCurrency}`, type: 'number', field: 'sumForBudget', width: 150, editable: false } as VisualColumn,
        { key: 'sumVATBud', title: `${pmT('Budget')} ${pmT('VAT')}`, type: 'number', field: 'sumVATForBudget', width: 140, editable: false } as VisualColumn,
      ] : []),
      {
        key: 'fxRate', title: pmT('Exchange rate'), type: 'custom', width: 300, editable: false,
        renderCell: (row) => <Text numberOfLines={1} testID={`task-line-fx-${row.rowGUID}`} style={{ color: textColor, opacity: 0.75, fontSize: 12 }}>{fxSnapshotText(row.rowJSON?.fxSnapshotTaskLine)}</Text>,
        searchText: (row) => fxSnapshotText(row.rowJSON?.fxSnapshotTaskLine),
      } as VisualColumn,
    ] : []),
    {
      key: 'currency', title: pmT('Currency'), type: 'custom', width: 90, editable: false,
      renderCell: (row) => <Text numberOfLines={1} style={{ color: textColor, opacity: 0.75, fontSize: 13 }}>{lineContractCurrency(data, row.rowJSON || {}, projectCurrency)}</Text>,
      searchText: (row) => lineContractCurrency(data, row.rowJSON || {}, projectCurrency),
    },
  );
  return cols;
}
