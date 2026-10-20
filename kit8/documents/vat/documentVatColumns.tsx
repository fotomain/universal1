// documentVatColumns - the VAT columns of the lines of the four documents (vendor invoice, customer invoice, purchase order, product receipt); documentation/VENDOR_INVOICE_DOC.html sections 6-9.
//   vatRateColumn      the VAT rate chosen from valueAddedTaxTable (rowJSON.vatRateGUID; the database copies its percent into the line and freezes the recoverable share).
//                      A legacy line (no rate GUID) shows the catalog rate with its percent, else its own percent as a rate of its own.
//   accountingColumns  Accounting before VAT · VAT for accounting (both TYPED by the user in a draft: the database calculates the price / the VAT % back) · Sum for accounting (the TOTAL with VAT),
//                      then Sum for budget and VAT for budget (NET of VAT and its VAT). Typing needs a plan rate on the line (a plan price and a unit sum).
import type { ReusableTableRow, SelectOption, VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../pm/i18n/pmT';
import { pmNumberColumn } from '../../pm/components/pmNumberColumn';

const asNumber = (v: unknown): number | null => { const n = typeof v === 'number' ? v : Number(v); return v === null || v === undefined || v === '' || !Number.isFinite(n) ? null : n; };

/** the label of a row of valueAddedTaxTable: its title, else "21 %" */
export const vatRateLabel = (r: { rowJSON?: any } | undefined | null): string => {
  const j = r?.rowJSON || {};
  const title = typeof j.vatTableTitle === 'string' && j.vatTableTitle.trim() ? j.vatTableTitle.trim() : '';
  const p = asNumber(j.vatTablePercent);
  return title || (p === null ? '' : `${p} %`);
};

/** a line can take a typed accounting sum when the plan of its task line gives a rate: a plan price > 0 and a unit sum for accounting */
export const lineHasPlanRate = (row: ReusableTableRow | null | undefined): boolean => {
  const j = (row as any)?.rowJSON || {};
  return (asNumber(j.priceTaskLine) ?? 0) > 0 && asNumber(j.unitSumForAccounting) !== null;
};

const CUSTOM = 'custom:';
/** the catalog rate of a line: the stored GUID, else the rate with the same percent; none = a rate of its own (custom:<percent>) */
export function vatRateOfLine(rates: { rowGUID: string; rowJSON?: any }[], row: ReusableTableRow, ratioKey: string): string {
  const stored = (row as any)?.rowJSON?.vatRateGUID;
  if (typeof stored === 'string' && stored) return stored;
  const p = asNumber((row as any)?.[ratioKey]);
  if (p === null) return '';
  const found = rates.find((r) => asNumber(r.rowJSON?.vatTablePercent) === p && (asNumber(r.rowJSON?.vatRecoverablePercent) ?? 100) === 100) ?? rates.find((r) => asNumber(r.rowJSON?.vatTablePercent) === p);
  return found ? found.rowGUID : `${CUSTOM}${p}`;
}

export function vatRateColumn({ data, editable, ratioKey }: { data: { valueAddedTax?: any[] }; editable: boolean; ratioKey: string }): VisualColumn {
  const rates: any[] = [...(data.valueAddedTax || [])].sort((a, b) => (asNumber(a.orderInList) ?? 0) - (asNumber(b.orderInList) ?? 0));
  const options = (row: ReusableTableRow): SelectOption[] => {
    const list: SelectOption[] = rates.map((r) => ({ value: r.rowGUID, label: vatRateLabel(r) || r.rowGUID }));
    const current = vatRateOfLine(rates, row, ratioKey);
    if (current.startsWith(CUSTOM)) list.push({ value: current, label: `${current.slice(CUSTOM.length)} %` });
    return list;
  };
  return {
    key: 'vat', title: pmT('VAT rate'), type: 'select', field: 'vatRateGUID', width: 150, editable, allowEmpty: false, placeholder: '',
    options,
    fromStored: (_s: any, row: ReusableTableRow) => vatRateOfLine(rates, row, ratioKey),
    validate: (v: any) => (typeof v === 'string' && v.startsWith(CUSTOM) ? pmT('Choose a VAT rate of the catalog.') : null),
  } as VisualColumn;
}

export function accountingColumns({ editable, tableName }: { editable: boolean; tableName: string }): VisualColumn[] {
  const root = (key: string, title: string, width: number): VisualColumn => ({ key, title: pmT(title), type: 'number', target: key as any, width, editable: false, total: true, stepper: false } as VisualColumn);
  const typed = (key: string, title: string, width: number): VisualColumn => ({
    key, title: pmT(title), type: 'number', target: key as any, width, min: 0, max: 1000000000, total: true, stepper: false, editable,
    validate: (_v: any, row: ReusableTableRow) => (lineHasPlanRate(row) ? null : pmT('This line has no plan rate (a plan price and a unit sum): the accounting sum cannot be typed.')),
    ...pmNumberColumn(tableName, key),
  } as VisualColumn);
  return [
    root('sumForBudget', 'Sum for budget', 140),
    root('vatForBudget', 'VAT for budget', 120),
    typed('sumForAccountingBeforeVAT', 'Accounting before VAT', 160),
    typed('sumForAccountingVAT', 'VAT for accounting', 140),
    root('sumForAccounting', 'Sum for accounting (with VAT)', 170),
  ];
}
