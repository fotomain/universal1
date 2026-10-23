// paymentFactColumns - the columns of the ReusableTable of the lines of a payment fact (PMPaymentFactDocumentLines). documentation/PAYMENTS_FACT_WBS.html
//   Errors (while a line has a problem) · # · Project · Task · Contract · Budget item · Business unit · Currency · Plan sum · Sum for contract · Sum for accounting · Sum for budget · Amount of the money account · Amount source
// Only GUIDs / keys / numbers are stored (rowJSON of project_payment_fact_lines); the titles are read from the catalogs. EVERY sum is WITH VAT - the headers say so. The converted sums (accounting, budget, money account)
// are written by the database (the trigger converts at the rate of the date of the document): read only, except the amount of the money account, which can be TYPED (the real bank amount).
import React from 'react';
import { Text, View } from 'react-native';
import { CONTRACT_ENTITY } from '../../../catalog/contract/contractModel';
import { BUDGET_ITEM_TABLE, isBudgetItemFolder } from '../../../catalog/budget/item/budgetItemModel';
import { businessUnitNodes, businessUnitPath, businessUnitProblem, isBusinessUnitActive, selectableBusinessUnits } from '../../../catalog/business_unit/businessUnitModel';
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import SelectCatalogItemWithFolders from '../../../catalog/select/with_folders/SelectCatalogItemWithFolders';
import SelectCatalogItemFromTreeReusable from '../../../catalog/select/from_tree/SelectCatalogItemFromTreeReusable';
import { PMTipIcon } from '../../../pm/inner/buttons';
import { pmNumberColumn } from '../../../pm/components/pmNumberColumn';
import { pmT } from '../../../pm/i18n/pmT';
import type { TaskLineCatalogData } from '../../../pm/view/task/finances/taskLineCatalogs';
import LinePlaceCell from '../../vendor/lineplace/LinePlaceCell';
import type { LinePlace, PlaceField } from '../../vendor/lineplace/linePlaceModel';
import { PAYMENT_FACT_LINES_TABLE, PaymentFactDirection, lineDiffersFromPlan, lineIsTyped, paymentFactGenusOf, paymentFactLineErrors } from './paymentFactModel';

export interface PaymentFactColumnsContext {
  data: TaskLineCatalogData;
  direction: PaymentFactDirection | '';
  /** the payee of the document: a partner or a person (the contracts offered are the contracts of the payee) */
  payee: { kind: 'partner' | 'person'; guid: string } | null;
  /** the currency of the money account (the title of the amount column) */
  accountCurrency: string;
  /** the document is a draft: the cells can be changed */
  editable: boolean;
  /** project / task names of the lines (usePaymentFactPlaces) */
  places: Record<string, LinePlace>;
  /** paste · pick · clear the task of an INDEPENDENT line of a draft; missing = the task cannot be changed */
  placeActions?: { paste: (field: PlaceField, row: any) => void; pick: (field: PlaceField, row: any) => void; clear: (field: PlaceField, row: any) => void };
  textColor: string;
  errorColor: string;
  /** show the Errors column (default true): the table passes false while no line has a problem */
  showErrors?: boolean;
}

export const paymentFactErrors = (row: any): string[] => paymentFactLineErrors(row).map((m) => pmT(m));

export function buildPaymentFactColumns(ctx: PaymentFactColumnsContext): VisualColumn[] {
  const { data, direction, payee, accountCurrency, editable, places, placeActions, textColor, errorColor, showErrors = true } = ctx;
  const unitNodes = businessUnitNodes(data.businessUnit);
  const paymentItem = (item: any) => !isBudgetItemFolder(item) && !!direction && item?.rowJSON?.managementGenusItem === paymentFactGenusOf(direction);
  const ro = (c: VisualColumn): VisualColumn => ({ ...c, editable: editable && c.editable !== false } as VisualColumn);

  const cols: VisualColumn[] = [
    ...(showErrors ? [{
      key: 'errors', title: pmT('Errors'), type: 'custom', width: 300, editable: false, pinFirst: true,
      renderCell: (row) => {
        const problems = paymentFactErrors(row);
        return problems.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <PMTipIcon tip={problems.join('\n')} testID={`payment-fact-problem-${row.rowGUID}`} name="warning" size={18} color={errorColor} />
            <Text numberOfLines={1} style={{ color: errorColor, fontSize: 12, flex: 1 }}>{problems.join(' · ')}</Text>
          </View>
        ) : null;
      },
      searchText: (row) => paymentFactErrors(row).join(' '),
    } as VisualColumn] : []),
    { key: 'n', title: '#', type: 'rowNumber' },
    {
      key: 'project', title: pmT('Project'), type: 'custom', width: 170, editable: false,
      renderCell: (row) => <Text numberOfLines={1} style={{ color: textColor, fontSize: 12 }}>{places[String(row.rowGUID)]?.projectName || ''}</Text>,
      searchText: (row) => places[String(row.rowGUID)]?.projectName ?? '',
    } as VisualColumn,
    {
      // the task: read only on a line of a plan payment; an UNPLANNED line of a draft can paste / select / clear it (the project follows)
      key: 'task', title: pmT('Task'), type: 'custom', width: 220, editable: false,
      renderCell: (row) => (
        <LinePlaceCell
          testID={`payment-fact-place-task-${row.rowGUID}`} field="task" place={places[String(row.rowGUID)]} editable={editable && !row.paymentPlanLineGUID && !!placeActions}
          onPaste={() => placeActions?.paste('task', row)} onPick={() => placeActions?.pick('task', row)} onClear={() => placeActions?.clear('task', row)}
        />
      ),
      searchText: (row) => places[String(row.rowGUID)]?.taskName ?? '',
    } as VisualColumn,
    ro({
      // the contracts of the payee of the document
      key: 'contract', title: pmT('Contract'), type: 'catalog', field: 'paymentFactContract', width: 240,
      catalogEntityName: CONTRACT_ENTITY, placeholder: pmT('Select contract…'),
      filterItem: (c, row) => c?.rowGUID === row.rowJSON?.paymentFactContract || (!!payee && c?.rowOwnerGUID === payee.guid && c?.rowParentGUID === payee.kind),
    } as VisualColumn),
    ro({
      // the budget item of the PAYMENTS genus of the direction: taken from the plan payment / the contract, EDITABLE
      key: 'budgetItem', title: pmT('Budget item'), type: 'catalog', field: 'paymentFactBudgetItem', width: 220,
      catalogEntityName: BUDGET_ITEM_TABLE.entity, placeholder: pmT('Select budget item…'),
      filterItem: (item) => paymentItem(item),
      renderPicker: ({ testID, value, onChange, disabled, compact, triggerStyle, placeholder }) => (
        <SelectCatalogItemWithFolders
          testID={testID} rows={data.budgetItem} isFolder={isBudgetItemFolder} filterItem={paymentItem} subtitleOf={(r) => r.rowJSON?.description || undefined}
          value={value} onChange={(guid) => onChange(guid)} title={pmT('Budget item')} placeholder={placeholder} icon="request_quote" compact={compact} triggerStyle={triggerStyle} disabled={disabled}
        />
      ),
    } as VisualColumn),
    ...(data.businessUnit.length > 0 ? [ro({
      key: 'businessUnit', title: pmT('Business unit'), type: 'custom', width: 240,
      renderCell: (row, _i, patch) => {
        const keep = row.rowJSON?.paymentFactBusinessUnit as string | null | undefined;
        const ok = new Set(selectableBusinessUnits(data.businessUnit, { kind: null, cfrRows: data.cfrType, keep }).map((r) => r.rowGUID));
        return (
          <View style={{ flex: 1, minWidth: 0 }}>
            <SelectCatalogItemFromTreeReusable
              testID={`payment-fact-unit-${row.rowGUID}`} nodes={unitNodes} value={keep ?? null} disabled={!editable}
              pathOf={(id) => businessUnitPath(data.businessUnit, id)} isSelectable={(id) => ok.has(id)}
              reasonWhy={(id) => {
                const unit = data.businessUnit.find((r) => r.rowGUID === id);
                return (unit && !isBusinessUnitActive(unit) ? pmT('This unit is not active') : businessUnitProblem(data.businessUnit, data.cfrType, id, null)) || pmT('This unit cannot be chosen here');
              }}
              title={pmT('Business unit')} placeholder={pmT('Not set')} searchPlaceholder={pmT('Search business units…')} compact
              triggerStyle={{ borderRadius: 0, borderWidth: 0, backgroundColor: 'transparent' }}
              onChange={(id) => patch({ paymentFactBusinessUnit: id })}
            />
          </View>
        );
      },
      searchText: (row) => businessUnitPath(data.businessUnit, row.rowJSON?.paymentFactBusinessUnit),
    } as VisualColumn)] : []),
    {
      key: 'currency', title: pmT('Currency'), type: 'custom', width: 90, editable: false,
      renderCell: (row) => <Text numberOfLines={1} style={{ color: textColor, opacity: 0.75, fontSize: 13 }}>{row.rowJSON?.paymentFactCurrency ?? ''}</Text>,
      searchText: (row) => String(row.rowJSON?.paymentFactCurrency ?? ''),
    } as VisualColumn,
    {
      // what the plan payment said (the open sum when the line was made); a line that pays another sum is marked
      key: 'planSum', title: pmT('Plan (with VAT)'), type: 'custom', width: 130, editable: false,
      renderCell: (row) => {
        const v = row.rowJSON?.paymentFactPlanSum;
        return <Text numberOfLines={1} style={{ color: lineDiffersFromPlan(row) ? errorColor : textColor, opacity: 0.8, fontSize: 13 }}>{typeof v === 'number' ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}</Text>;
      },
    } as VisualColumn,
    ro({ key: 'sum', title: pmT('Sum with VAT'), type: 'number', field: 'sumForContract', width: 150, min: 0, max: 1000000000000, total: false, stepper: false, ...pmNumberColumn(PAYMENT_FACT_LINES_TABLE, 'sumForContract') } as VisualColumn),
    { key: 'sumAcc', title: pmT('Accounting (with VAT)'), type: 'number', field: 'sumForAccounting', width: 160, editable: false, stepper: false, total: false } as VisualColumn,
    { key: 'sumBud', title: pmT('Budget (with VAT)'), type: 'number', field: 'sumForBudget', width: 150, editable: false, stepper: false, total: false } as VisualColumn,
    ro({
      // the real bank amount in the currency of the money account: converted at the rate of the date, or TYPED (it then stays; clear the cell to convert again)
      key: 'sumAccount', title: `${pmT('Amount of the money account')}${accountCurrency ? ` (${accountCurrency})` : ''}`, type: 'number', field: 'sumForMoneyAccount', width: 190, min: 0, max: 1000000000000, total: false, stepper: false,
      ...pmNumberColumn(PAYMENT_FACT_LINES_TABLE, 'sumForMoneyAccount'),
    } as VisualColumn),
    {
      key: 'accountSource', title: pmT('Amount is'), type: 'custom', width: 110, editable: false,
      renderCell: (row) => <Text numberOfLines={1} testID={`payment-fact-source-${row.rowGUID}`} style={{ color: textColor, opacity: 0.7, fontSize: 12 }}>{pmT(lineIsTyped(row) ? 'typed' : 'converted')}</Text>,
      searchText: (row) => (lineIsTyped(row) ? 'typed' : 'converted'),
    } as VisualColumn,
  ];
  return cols;
}
