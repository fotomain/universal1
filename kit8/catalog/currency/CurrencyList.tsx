// CurrencyList - route /currency/list. A ReusableTable (web + iOS + Android) of the currencies as PAIRS: one row per currency with its pair
// (BASE/CODE), the currency and all its ratios - Default and Budget, with the inverse ratios and their dates (currencyTableColumns.ts).
// Search, sort / filter of the columns, drag & drop order (web), sql_for_delete + Undo, export come from the table; the row menu (right-click /
// long-press / ⋮) has Edit, Rates, Refresh rates and Upload all data from a date. Stays in sync with Supabase Realtime (other browsers /
// devices) through the reusable saga; the ratios are read again when the rates were refreshed or when the table changes.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import { PMIconButton } from '../../pm/inner/buttons/PMIconButton';
import ReusableTable from '../../ui/components/table/reusable/ReusableTable';
import type { ReusableTableRow } from '../../ui/components/table/reusable/reusableTableTypes';
import CurrencyRealtimeBadge from './CurrencyRealtimeBadge';
import CurrencyUploadFromDateModal from './CurrencyUploadFromDateModal';
import { REFRESH_ALL, useRefreshCurrencyRatio } from './refresh/useRefreshCurrencyRatio';
import { CURRENCY_CATALOG_OWNER, CURRENCY_ENTITY, CURRENCY_READ_PARAMS, CURRENCY_ROUTES, emptyCurrency } from './currencyModel';
import { CURRENCY_EXCHANGE_ROUTES } from './exchange/currencyExchangeModel';
import { buildCurrencyTableColumns } from './currencyTableColumns';
import { useCurrencyPairRatios } from './useCurrencyPairRatios';

export default function CurrencyList() {
  const router = useRouter();
  const { themeColors: c } = useDesignSystem();
  // one realtime subscription for the catalog while this screen (or the edit screen) is mounted
  const status = useRealtimeEntity(CURRENCY_ENTITY, { readParams: CURRENCY_READ_PARAMS });
  const currencies: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  // the latest ratios of every currency; read again when a refresh / upload of the rates ends
  const pairs = useCurrencyPairRatios(currencies);
  // exchange rates from the ECB (Frankfurter API): all currencies, or one line
  const refresh = useRefreshCurrencyRatio();
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !refresh.busy) pairs.reload();
    wasBusy.current = !!refresh.busy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh.busy]);
  /** the currency whose "Upload all data from a date" dialog is open */
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const openNew = () => router.push(CURRENCY_ROUTES.edit as any);
  const openEdit = (rowGUID: string) => router.push({ pathname: CURRENCY_ROUTES.edit, params: { rowGUID } } as any);
  const openRates = (currencyGUID: string) => router.push({ pathname: CURRENCY_EXCHANGE_ROUTES.list, params: { currencyGUID } } as any);

  const { base, ratiosOf } = pairs;
  const columns = useMemo(
    () => buildCurrencyTableColumns({ base, ratiosOf, textColor: c.text, linkColor: c.primary, onOpenRates: openRates }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, ratiosOf, c.text, c.primary],
  );
  const refreshing = (guid: string) => refresh.busy === REFRESH_ALL || refresh.busy === guid;
  const codeOf = (guid: string) => String(currencies.find((r) => r.rowGUID === guid)?.rowJSON?.currencyCode || '');

  return (
    <ScrollView style={[styles.root, { backgroundColor: c.background }]} contentContainerStyle={styles.content} testID="currency-list">
      <ReusableTable
        testID="currency-table"
        entityName={CURRENCY_ENTITY}
        crudListTitle="Currencies"
        itemLabel="Currency"
        listOwnerGUID={CURRENCY_CATALOG_OWNER}
        readParams={CURRENCY_READ_PARAMS}
        visualColumns={columns}
        defaultRowJSON={emptyCurrency}
        // a new currency is made in the edit screen (it validates the code); the table's "+ Add" would save an empty one
        crudPanelEnabled={false}
        dragAndDropColumns
        resizeColumnWidth
        tableMaxWidth={1400}
        emptyText="No currencies yet. Press Add."
        toolbarExtra={
          <>
            <PMIconButton tipScope="app" testID="currency-add" icon="add" title="Add a currency" color={c.primary} onPress={openNew} />
            <PMIconButton tipScope="app" testID="currency-refresh-rates-all" icon="sync" title={refresh.busy === REFRESH_ALL ? 'Refreshing…' : 'Refresh the exchange rates of all currencies'} color={c.primary} disabled={!!refresh.busy} onPress={refresh.refreshAll} />
            <CurrencyRealtimeBadge status={status} />
          </>
        }
        extraMenuItems={(row: ReusableTableRow, close) => [
          { testID: `currency-row-edit-${row.rowGUID}`, label: 'Edit', icon: 'edit', onPress: () => { close(); openEdit(row.rowGUID); } },
          { testID: `currency-row-rates-${row.rowGUID}`, label: 'Rates', icon: 'currency_exchange', onPress: () => { close(); openRates(row.rowGUID); } },
          { testID: `currency-row-refresh-${row.rowGUID}`, label: 'Refresh rates', icon: 'sync', disabled: refreshing(row.rowGUID), onPress: () => { close(); refresh.refreshOne(row.rowGUID); } },
          { testID: `currency-row-upload-${row.rowGUID}`, label: 'Upload all data from a date', icon: 'cloud_download', disabled: refreshing(row.rowGUID), onPress: () => { close(); setUploadFor(row.rowGUID); } },
        ]}
        realtime
      />
      <CurrencyUploadFromDateModal
        testID="currency-table-upload-modal"
        visible={!!uploadFor}
        currencyCode={uploadFor ? codeOf(uploadFor) : ''}
        busy={!!uploadFor && refreshing(uploadFor)}
        onClose={() => setUploadFor(null)}
        onUpload={(fromDate) => (uploadFor ? refresh.uploadFrom(uploadFor, fromDate) : false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 12 },
});
