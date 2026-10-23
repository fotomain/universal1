// Payment plan - the columns of the table of one direction (VisualColumn[] of the ReusableTable). documentation/PAYMENTS_PLAN_WBS.html
//   Errors (the first column, only while a payment of the tab has an error) · Supplier / Customer (a partner) · Person (Outbound only) · Contract · Budget item · Business unit · Currency · Anchor
//   (Task start | Task end) · Shift (days) · Planned date · Sum (with VAT) · Sum in the accounting currency · Sum in the budget currency · Exchange rate
// Only GUIDs / keys / numbers are stored (paymentPlanModel.ts); the titles are read from the catalogs. Every sum is WITH VAT - the headers say so.
import React from 'react';
import { Text, View } from 'react-native';
import { PERSON_CATALOG_OWNER, PERSON_ENTITY } from '../../../../catalog/person/personModel';
import { PARTNER_CATALOG_OWNER, PARTNER_ENTITY } from '../../../../catalog/partner/partnerModel';
import { CONTRACT_ENTITY } from '../../../../catalog/contract/contractModel';
import { contractPaymentDirections } from '../../../../catalog/contract/contractPaymentModel';
import { BUDGET_ITEM_TABLE, isBudgetItemFolder } from '../../../../catalog/budget/item/budgetItemModel';
import { businessUnitNodes, businessUnitPath, businessUnitProblem, isBusinessUnitActive, selectableBusinessUnits } from '../../../../catalog/business_unit/businessUnitModel';
import { isVendorCandidate } from '../../../../catalog/vendor/mainVendorModel';
import type { VisualColumn } from '../../../../ui/components/table/reusable/reusableTableTypes';
import SelectCatalogItemWithFolders from '../../../../catalog/select/with_folders/SelectCatalogItemWithFolders';
import SelectCatalogItemFromTreeReusable from '../../../../catalog/select/from_tree/SelectCatalogItemFromTreeReusable';
import { PMTipIcon } from '../../../inner/buttons';
import { pmNumberColumn } from '../../../components/pmNumberColumn';
import { pmT } from '../../../i18n/pmT';
import type { TaskLineCatalogData } from '../finances/taskLineCatalogs';
import { personFullName } from '../finances/taskLineResource';
import type { LineFxProject } from '../finances/taskLineFx';
import { paymentPlanProblems, type PaymentCatalogs } from './paymentPlanCompute';
import type { PaymentTaskDays } from './paymentPlanDates';
import type { PaymentFxContext } from './paymentPlanMoney';
import { isPaymentBudgetItemOf, PAYMENT_ANCHORS, taskPaymentPlanTable, type PaymentDirection } from './paymentPlanModel';
import type { PaymentPaid } from './paymentPlanApi';

export interface PaymentColumnsContext {
  data: TaskLineCatalogData;
  direction: PaymentDirection;
  days: PaymentTaskDays;
  /** the project switch paymentPlanAfterTaskFinishEnabled */
  afterFinishOn: boolean;
  fx: PaymentFxContext | null;
  /** the project's accounting / budget currencies: their sum columns are shown when it has them */
  fxProject: LineFxProject | null;
  projectCurrency: string | null;
  textColor: string;
  errorColor: string;
  /** show the Errors column (default true): the table passes false while no payment of the tab has an error */
  showErrors?: boolean;
  /** what the POSTED payment facts have paid of each posted payment (documentation/PAYMENTS_FACT_WBS.html): the read only columns Paid / Open are added while there is any posted payment */
  paid?: Map<string, PaymentPaid>;
}

/** every problem of a payment (the Errors column and the search) */
export const paymentErrors = (ctx: Pick<PaymentColumnsContext, 'direction' | 'days' | 'afterFinishOn'> & { data: PaymentCatalogs; fx?: PaymentFxContext | null; projectCurrency?: string | null }, rowJSON: Record<string, any>): string[] =>
  paymentPlanProblems({ data: ctx.data, direction: ctx.direction, days: ctx.days, fx: ctx.fx, projectCurrency: ctx.projectCurrency, afterFinishOn: ctx.afterFinishOn }, rowJSON).map((m) => pmT(m));

export function buildPaymentColumns(ctx: PaymentColumnsContext): VisualColumn[] {
  const { data, direction, textColor, errorColor, fxProject, showErrors = true, paid } = ctx;
  const outbound = direction === 'outbound';
  const unitNodes = businessUnitNodes(data.businessUnit);
  const paymentItem = (item: any) => !isBudgetItemFolder(item) && isPaymentBudgetItemOf(direction, item);
  const owner = (row: any): string | null => row.rowJSON?.paymentPlanPartner || row.rowJSON?.paymentPlanPerson || null;

  const cols: VisualColumn[] = [
    ...(showErrors ? [{
      key: 'errors', title: pmT('Errors'), type: 'custom', width: 300, editable: false, pinFirst: true,
      renderCell: (row) => {
        const problems = paymentErrors(ctx, row.rowJSON || {});
        return problems.length ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <PMTipIcon tip={problems.join('\n')} testID={`payment-plan-problem-${row.rowGUID}`} name="warning" size={18} color={errorColor} />
            <Text numberOfLines={1} style={{ color: errorColor, fontSize: 12, flex: 1 }}>{problems.join(' · ')}</Text>
          </View>
        ) : null;
      },
      searchText: (row) => paymentErrors(ctx, row.rowJSON || {}).join(' '),
    } as VisualColumn] : []),
    { key: 'n', title: '#', type: 'rowNumber' },
    {
      // the payee: a supplier (Outbound) / a customer (Inbound); an inactive partner is not offered (the one already chosen stays)
      key: 'partner', title: outbound ? pmT('Supplier') : pmT('Customer'), type: 'catalog', field: 'paymentPlanPartner', width: 220,
      catalogEntityName: PARTNER_ENTITY, catalogRowOwnerGUID: PARTNER_CATALOG_OWNER, placeholder: pmT('Select partner…'),
      filterItem: (p, row) => (outbound ? isVendorCandidate(p, row.rowJSON?.paymentPlanPartner) : (p?.rowGUID === row.rowJSON?.paymentPlanPartner || (p?.rowJSON?.partnerIsCustomer !== false && p?.rowJSON?.isActive !== false))),
    },
    // a person is paid (Outbound only): his contract is the contract of the payment
    ...(outbound ? [{
      key: 'person', title: pmT('Person'), type: 'catalog', field: 'paymentPlanPerson', width: 200,
      catalogEntityName: PERSON_ENTITY, catalogRowOwnerGUID: PERSON_CATALOG_OWNER, titleExtractor: personFullName, placeholder: pmT('Select person…'),
    } as VisualColumn] : []),
    {
      // the contracts of the payee that can pay in this direction (a supplier contract Outbound, a customer contract Inbound); a contract chosen first gives its payee
      key: 'contract', title: pmT('Contract'), type: 'catalog', field: 'paymentPlanContract', width: 240,
      catalogEntityName: CONTRACT_ENTITY, placeholder: pmT('Select contract…'),
      filterItem: (c, row) => {
        if (c?.rowGUID === row.rowJSON?.paymentPlanContract) return true;
        const who = owner(row);
        return (!who || c?.rowOwnerGUID === who) && contractPaymentDirections(c?.rowJSON).includes(direction) && !(direction === 'inbound' && c?.rowParentGUID === 'person');
      },
    },
    {
      // the budget item of the PAYMENTS genus of the direction: taken from the contract, EDITABLE (a choice here stays when the contract changes)
      key: 'budgetItem', title: pmT('Budget item'), type: 'catalog', field: 'paymentPlanBudgetItem', width: 220,
      catalogEntityName: BUDGET_ITEM_TABLE.entity, placeholder: pmT('Select budget item…'),
      filterItem: (item) => paymentItem(item),
      renderPicker: ({ testID, value, onChange, disabled, compact, triggerStyle, placeholder }) => (
        <SelectCatalogItemWithFolders
          testID={testID}
          rows={data.budgetItem}
          isFolder={isBudgetItemFolder}
          filterItem={paymentItem}
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
    ...(data.businessUnit.length > 0 ? [{
      key: 'businessUnit', title: pmT('Business unit'), type: 'custom', width: 240,
      renderCell: (row, _i, patch) => {
        const keep = row.rowJSON?.paymentPlanBusinessUnit as string | null | undefined;
        const ok = new Set(selectableBusinessUnits(data.businessUnit, { kind: null, cfrRows: data.cfrType, keep }).map((r) => r.rowGUID));
        return (
          <View style={{ flex: 1, minWidth: 0 }}>
            <SelectCatalogItemFromTreeReusable
              testID={`payment-plan-unit-${row.rowGUID}`}
              nodes={unitNodes}
              value={keep ?? null}
              pathOf={(id) => businessUnitPath(data.businessUnit, id)}
              isSelectable={(id) => ok.has(id)}
              reasonWhy={(id) => {
                const unit = data.businessUnit.find((r) => r.rowGUID === id);
                return (unit && !isBusinessUnitActive(unit) ? pmT('This unit is not active') : businessUnitProblem(data.businessUnit, data.cfrType, id, null)) || pmT('This unit cannot be chosen here');
              }}
              title={pmT('Business unit')}
              placeholder={pmT('Not set')}
              searchPlaceholder={pmT('Search business units…')}
              compact
              triggerStyle={{ borderRadius: 0, borderWidth: 0, backgroundColor: 'transparent' }}
              onChange={(id) => patch({ paymentPlanBusinessUnit: id })}
            />
          </View>
        );
      },
      searchText: (row) => businessUnitPath(data.businessUnit, row.rowJSON?.paymentPlanBusinessUnit),
    } as VisualColumn] : []),
    {
      key: 'currency', title: pmT('Currency'), type: 'custom', width: 90, editable: false,
      renderCell: (row) => <Text numberOfLines={1} style={{ color: textColor, opacity: 0.75, fontSize: 13 }}>{row.rowJSON?.paymentPlanCurrency ?? ''}</Text>,
      searchText: (row) => String(row.rowJSON?.paymentPlanCurrency ?? ''),
    },
    {
      // what the shift is counted from: the start or the end of the task
      key: 'anchor', title: pmT('Shift from'), type: 'select', field: 'paymentPlanTimelineAnchor', width: 140, allowEmpty: false, placeholder: pmT('Task start'),
      options: PAYMENT_ANCHORS.map((a) => ({ value: a.value, label: pmT(a.label) })),
    },
    { key: 'shift', title: pmT('Shift (days)'), type: 'integer', field: 'paymentPlanTimelineShiftDays', width: 130, min: 0, max: 3650, total: false, ...pmNumberColumn(taskPaymentPlanTable, 'paymentPlanTimelineShiftDays') },
    { key: 'date', title: pmT('Planned date'), type: 'date', field: 'paymentPlannedTransactionDate', width: 150, picker: true },
    { key: 'sum', title: pmT('Sum with VAT'), type: 'number', field: 'sumForContract', width: 150, min: 0, max: 1000000000000, total: false, ...pmNumberColumn(taskPaymentPlanTable, 'sumForContract') },
  ];

  if (fxProject?.accountingCurrency) cols.push({ key: 'sumAcc', title: `${pmT('Accounting')} ${fxProject.accountingCurrency} (${pmT('with VAT')})`, type: 'number', field: 'sumForAccounting', width: 170, editable: false } as VisualColumn);
  if (fxProject?.budgetCurrency) cols.push({ key: 'sumBud', title: `${pmT('Budget')} ${fxProject.budgetCurrency} (${pmT('with VAT')})`, type: 'number', field: 'sumForBudget', width: 170, editable: false } as VisualColumn);
  if (fxProject && (fxProject.accountingCurrency || fxProject.budgetCurrency)) {
    cols.push({
      key: 'fxRate', title: pmT('Exchange rate'), type: 'custom', width: 300, editable: false,
      renderCell: (row) => <Text numberOfLines={1} testID={`payment-plan-fx-${row.rowGUID}`} style={{ color: textColor, opacity: 0.75, fontSize: 12 }}>{paymentFxText(row.rowJSON?.paymentPlanFxSnapshot)}</Text>,
      searchText: (row) => paymentFxText(row.rowJSON?.paymentPlanFxSnapshot),
    } as VisualColumn);
  }
  // Paid / Open: what the posted payment facts have paid of a POSTED payment, in its currency (read only; empty for a payment that is not posted)
  if (paid && paid.size > 0) {
    const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    cols.push({
      key: 'paid', title: pmT('Paid (with VAT)'), type: 'custom', width: 140, editable: false,
      renderCell: (row) => { const p = paid.get(String(row.rowGUID)); return <Text numberOfLines={1} testID={`payment-plan-paid-${row.rowGUID}`} style={{ color: textColor, fontSize: 13 }}>{p ? money(p.paid) : ''}</Text>; },
      searchText: (row) => { const p = paid.get(String(row.rowGUID)); return p ? String(p.paid) : ''; },
    } as VisualColumn);
    cols.push({
      key: 'open', title: pmT('Open (with VAT)'), type: 'custom', width: 140, editable: false,
      renderCell: (row) => { const p = paid.get(String(row.rowGUID)); return <Text numberOfLines={1} testID={`payment-plan-open-${row.rowGUID}`} style={{ color: p && p.open < 0 ? errorColor : textColor, fontSize: 13 }}>{p ? money(p.open) : ''}</Text>; },
      searchText: (row) => { const p = paid.get(String(row.rowGUID)); return p ? String(p.open) : ''; },
    } as VisualColumn);
  }
  return cols;
}

/** 'USD → EUR 0.925926 (Default) · 2026-03-02' - what the snapshot says */
export function paymentFxText(s: { from: string; day: string; accounting?: { to: string; rateType: string; rate: number }; budget?: { to: string; rateType: string; rate: number } } | null | undefined): string {
  if (!s) return '';
  const part = (r?: { to: string; rateType: string; rate: number }) => (r ? `${s.from} → ${r.to} ${Math.round(r.rate * 1e6) / 1e6} (${r.rateType})` : '');
  return [part(s.accounting), part(s.budget)].filter(Boolean).join(' · ') + ` · ${s.day}`;
}
