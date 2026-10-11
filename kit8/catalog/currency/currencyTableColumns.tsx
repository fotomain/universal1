// Currency table - the columns of the ReusableTable of /currency/list: the PAIR (BASE/CODE), the currency and ALL its ratios
//   # · Pair · Code · Name · Symbol · Decimals · Ratio (Default) · Inverse · Rate date · Budget ratio · Budget inverse · Budget date · Rates · Active
// The currency fields are read-only here (they are edited in /currency/edit, which validates the code); only "Active" is a check box.
// The ratios are not stored in the currency row: they come from useCurrencyPairRatios (the latest rate of each rate type).
import React from 'react';
import { Pressable, Text } from 'react-native';
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { formatRatio, inversePairLabel, inverseRatio, pairLabel, PairRatios } from './currencyPairs';

export interface CurrencyTableColumnsContext {
  /** the base currency of the rates (EXPO_PUBLIC_CURRENCY_RATES_BASE) */
  base: string;
  ratiosOf: (code: string) => PairRatios;
  textColor: string;
  linkColor: string;
  /** the pair is a link to the rates of the currency */
  onOpenRates: (currencyGUID: string) => void;
}

const codeOf = (row: any): string => String(row?.rowJSON?.currencyCode || '').toUpperCase();

export function buildCurrencyTableColumns({ base, ratiosOf, textColor, linkColor, onOpenRates }: CurrencyTableColumnsContext): VisualColumn[] {
  const text = (value: string, opacity = 1) => <Text numberOfLines={1} style={{ color: textColor, opacity, fontSize: 13 }}>{value}</Text>;
  /** a ratio column: custom (the value is not in rowJSON); the text is also what the search box and the export use */
  const ratioCol = (key: string, title: string, width: number, value: (r: PairRatios) => string, opacity = 1): VisualColumn => ({
    key, title, type: 'custom', width, editable: false, align: 'right',
    renderCell: (row) => text(value(ratiosOf(codeOf(row))), opacity),
    searchText: (row) => value(ratiosOf(codeOf(row))),
  });
  const isBase = (row: any) => codeOf(row) === base;
  const dayOf = (v?: { day: string }) => v?.day || '';
  return [
    { key: 'n', title: '#', type: 'rowNumber' },
    {
      // BASE/CODE: 1 base unit = <ratio> units of the currency; a link to the rates of the currency
      key: 'pair', title: 'Pair', type: 'custom', width: 110, editable: false,
      renderCell: (row) => (
        <Pressable testID={`currency-pair-${row.rowGUID}`} onPress={() => onOpenRates(row.rowGUID)} accessibilityRole="link" accessibilityLabel={`Exchange rates of ${codeOf(row) || 'currency'}`}>
          <Text numberOfLines={1} style={{ color: linkColor, fontWeight: '700', fontSize: 13, textDecorationLine: 'underline' }}>{pairLabel(base, codeOf(row))}</Text>
        </Pressable>
      ),
      searchText: (row) => `${pairLabel(base, codeOf(row))} ${inversePairLabel(base, codeOf(row))}`,
    },
    { key: 'code', title: 'Code', type: 'text', field: 'currencyCode', width: 80, editable: false },
    { key: 'name', title: 'Name', type: 'text', field: 'currencyName', width: 200, editable: false },
    { key: 'symbol', title: 'Symbol', type: 'text', field: 'currencySymbol', width: 80, editable: false },
    { key: 'decimals', title: 'Decimals', type: 'integer', field: 'decimalDigits', width: 90, editable: false, stepper: false, total: false },
    // Default = the daily rate (accounting), Budget = the planned rate of a budget (currencyExchangeModel.ts)
    ratioCol('ratio', `Ratio ${base}→CCY`, 130, (r) => formatRatio(r.default?.ratio)),
    ratioCol('inverse', `Inverse CCY→${base}`, 140, (r) => formatRatio(inverseRatio(r.default?.ratio)), 0.8),
    { ...ratioCol('rateDate', 'Rate date', 110, (r) => dayOf(r.default), 0.7), align: 'left' },
    ratioCol('budgetRatio', `Budget ${base}→CCY`, 140, (r) => formatRatio(r.budget?.ratio)),
    ratioCol('budgetInverse', `Budget CCY→${base}`, 150, (r) => formatRatio(inverseRatio(r.budget?.ratio)), 0.8),
    { ...ratioCol('budgetDate', 'Budget date', 110, (r) => dayOf(r.budget), 0.7), align: 'left' },
    {
      key: 'rates', title: 'Rates', type: 'custom', width: 80, editable: false, align: 'right',
      // how many rate rows the currency has (the base has none: its ratio is 1)
      renderCell: (row) => text(isBase(row) ? '—' : String(ratiosOf(codeOf(row)).count), 0.7),
      searchText: (row) => (isBase(row) ? '' : String(ratiosOf(codeOf(row)).count)),
    },
    { key: 'active', title: 'Active', type: 'boolean', field: 'isActive', width: 80, align: 'center' },
  ];
}
