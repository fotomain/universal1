// Task lines - the columns of the table of one genus (VisualColumn[] of the ReusableTable).
//   Time:                      # · Role · Role attributes · Person · Person variant (his own variants, taskLinePersonMatch.ts) · Contract · Qty · Unit · Price · VAT % · Sum · VAT · Currency
//   Material / Expense / Revenue: # · Role · Role attributes · Product · Attributes · Contract template · Partner · Partner contract · Qty · Unit · Price · VAT % · Sum · VAT · Currency
// Only GUIDs / keys / numbers are stored in rowJSON (taskLineModel.ts); titles are read from the catalogs.
import React from 'react';
import { Text } from 'react-native';
import { PERSON_CATALOG_OWNER, PERSON_ENTITY } from '../../../../catalog/person/personModel';
import { PARTNER_CATALOG_OWNER, PARTNER_ENTITY } from '../../../../catalog/partner/partnerModel';
import { CONTRACT_ENTITY } from '../../../../catalog/contract/contractModel';
import { TEMPLATE_RESOURCE_CONTRACT_ENTITY, TEMPLATE_RESOURCE_CONTRACT_ROUTES } from '../../../../catalog/management/templateresourcecontract/templateResourceContractModel';
import { PRODUCT_TABLES } from '../../../../catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../../catalog/resourcerole/resourceRoleModel';
import { rowTitle } from '../../../../catalog/product/crud/productCatalogTools';
import type { VisualColumn } from '../../../../ui/components/table/reusable/reusableTableTypes';
import { PMTipIcon } from '../../../inner/buttons';
import { genusOfRole, lineContractCurrency, lineProblems, productVariantOptions, roleVariantOptions, TaskLineCatalogData } from './taskLineCatalogs';
import { personMatchProblems, personVariantOptions } from './taskLinePersonMatch';
import { fxEnabled, fxProblem, fxSnapshotText, LineFxContext, LineFxProject } from './taskLineFx';
import type { TaskLineGenusDef } from './taskLineModel';
import { pmT } from '../../../i18n/pmT';

/** person.rowJSON -> "first name + last name" */
export const personFullName = (person: any): string => {
  const j = person?.rowJSON || {};
  return [j.personFirstName, j.personLastName].filter(Boolean).join(' ').trim() || j.personTitle || person?.rowGUID || '';
};

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
}

export function buildTaskLineColumns({ data, genus, projectCurrency, textColor, errorColor, fxProject, fx }: TaskLineColumnsContext): VisualColumn[] {
  const unitOptions = data.measureUnit.map((u) => ({ value: u.rowGUID, label: rowTitle(u) || u.rowGUID }));
  const cols: VisualColumn[] = [
    { key: 'n', title: '#', type: 'rowNumber' },
    {
      key: 'role', title: pmT('Role'), type: 'catalog', field: 'resourceRoleItem', width: 220,
      catalogEntityName: RESOURCE_ROLE_OWN_TABLES.resourceRole.entity, placeholder: pmT('Select role…'),
      // the roles of this genus (a role type points at its management genus)
      filterItem: (role) => genusOfRole(data, role) === genus.genus,
    },
    {
      key: 'roleAttributes', title: pmT('Role attributes'), type: 'select', field: 'resourceRoleAttributeSetKey', width: 190,
      options: (row) => roleVariantOptions(data, row.rowJSON?.resourceRoleItem), placeholder: pmT('Any'),
    },
  ];

  if (genus.resource === 'person') {
    cols.push(
      {
        key: 'person', title: pmT('Person'), type: 'catalog', field: 'taskResourceItem', width: 220,
        catalogEntityName: PERSON_ENTITY, catalogRowOwnerGUID: PERSON_CATALOG_OWNER, titleExtractor: personFullName, placeholder: pmT('Select person…'),
      },
      {
        // the VARIANT of the person the line books (Senior, English): his own variants, separate from the variants of the role; empty = automatic
        key: 'personVariant', title: pmT('Person variant'), type: 'select', field: 'taskResourceAttributesKey', width: 200,
        options: (row) => personVariantOptions(data, row.rowJSON || {}), placeholder: pmT('Automatic'),
      },
      {
        key: 'contract', title: pmT('Contract'), type: 'catalog', field: 'taskResourceContract', width: 240,
        catalogEntityName: CONTRACT_ENTITY, catalogRowParentGUID: 'person',
        // the contracts of the person selected in the previous columns
        dependsOn: 'person', dependsOnMessage: pmT('Select a person first'), placeholder: pmT('Select contract…'),
      },
    );
  } else {
    cols.push(
      {
        key: 'product', title: pmT('Product'), type: 'catalog', field: 'taskResourceItem', width: 220,
        catalogEntityName: PRODUCT_TABLES.product.entity, placeholder: pmT('Select product…'),
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
    { key: 'qty', title: pmT('Qty'), type: 'number', field: 'qtyTaskLine', width: 130, min: 0, max: 1000000000, total: false },
    { key: 'unit', title: pmT('Unit'), type: 'select', field: 'measureUnitTaskLine', width: 110, options: unitOptions, allowEmpty: false },
    { key: 'price', title: pmT('Price'), type: 'number', field: 'priceTaskLine', width: 130, min: 0, max: 1000000000, total: false },
    { key: 'vat', title: pmT('VAT %'), type: 'number', field: 'vatRatioTaskLine', width: 110, min: 0, max: 100, total: false },
    { key: 'sum', title: pmT('Sum'), type: 'number', field: 'sumForContract', width: 120, editable: false },
    { key: 'sumVAT', title: pmT('VAT'), type: 'number', field: 'sumVATForContract', width: 110, editable: false },
    // the same sums in the accounting / budget currency of the project: a snapshot of the exchange rate (never edited by hand)
    ...(fxProject && fxEnabled(fxProject) ? [
      ...(fxProject.accountingCurrency ? [
        { key: 'sumAcc', title: `${pmT('Sum')} ${fxProject.accountingCurrency}`, type: 'number', field: 'sumForAccounting', width: 130, editable: false } as VisualColumn,
        { key: 'sumVATAcc', title: `${pmT('VAT')} ${fxProject.accountingCurrency}`, type: 'number', field: 'sumVATForAccounting', width: 120, editable: false } as VisualColumn,
      ] : []),
      ...(fxProject.budgetCurrency ? [
        { key: 'sumBud', title: `${pmT('Sum')} ${fxProject.budgetCurrency} (${pmT('budget')})`, type: 'number', field: 'sumForBudget', width: 150, editable: false } as VisualColumn,
        { key: 'sumVATBud', title: `${pmT('VAT')} ${fxProject.budgetCurrency} (${pmT('budget')})`, type: 'number', field: 'sumVATForBudget', width: 140, editable: false } as VisualColumn,
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
    {
      key: 'check', title: '', type: 'custom', width: 44, editable: false,
      renderCell: (row) => {
        const fxMessage = fxProblem(fx, data, genus, row.rowJSON || {});
        const problems = [...lineProblems(data, genus, row.rowJSON || {}), ...personMatchProblems(data, genus, row.rowJSON || {}), ...(fxMessage ? [fxMessage] : [])];
        return problems.length ? <PMTipIcon tip={problems.join('\n')} testID={`task-line-problem-${row.rowGUID}`} name="warning" size={18} color={errorColor} /> : null;
      },
    },
  );
  return cols;
}
