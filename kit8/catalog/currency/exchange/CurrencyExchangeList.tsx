// CurrencyExchangeList - route /currency/exchange/list?currencyGUID=… : the exchange rates of ONE currency,
// newest day first. Web: ListWebCardsComponent (search, delete + Undo, fixed date order) with CurrencyRateCard;
// iOS / Android: a FlatList of the same cards. Both follow Supabase Realtime (other browsers / devices) through
// the reusable saga, scoped to the currency with readParams.match = { rowOwnerGUID: currencyGUID }.
import React, { useCallback, useMemo } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../components/common/IconApp';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../redux/reusable/useRealtimeEntity';
import { matchRow } from '../../../redux/reusable/realtimeRows';
import CurrencyRealtimeBadge from '../CurrencyRealtimeBadge';
import { CURRENCY_ENTITY, CURRENCY_READ_PARAMS, CURRENCY_ROUTES, CurrencyRow } from '../currencyModel';
import CurrencyRateCard from './CurrencyRateCard';
import { CURRENCY_EXCHANGE_ENTITY, CURRENCY_EXCHANGE_ROUTES, exchangeReadParams, rateToCard, sortRatesNewestFirst } from './currencyExchangeModel';

// web only: ListWebCardsComponent renders DOM (drag & drop) - never loaded on iOS / Android
const ListWebCardsComponent: any = Platform.OS === 'web' ? require('../../../components/list/web/ListWebCardsComponent').ListWebCardsComponent : null;

export default function CurrencyExchangeList() {
  const router = useRouter();
  const { themeColors: c } = useDesignSystem();
  const params = useLocalSearchParams<{ currencyGUID?: string }>();
  const currencyGUID = typeof params.currencyGUID === 'string' && params.currencyGUID ? params.currencyGUID : '';

  // the currency (code / name in the title) - live as well
  useRealtimeEntity(CURRENCY_ENTITY, { readParams: CURRENCY_READ_PARAMS });
  const currencies: CurrencyRow[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const currency = currencies.find((r) => r.rowGUID === currencyGUID);
  const code = currency?.rowJSON?.currencyCode || '';

  // one realtime subscription for this currency's rates (shared with the edit screen of the same currency)
  const readParams = useMemo(() => exchangeReadParams(currencyGUID), [currencyGUID]);
  const status = useRealtimeEntity(CURRENCY_EXCHANGE_ENTITY, { readParams, enabled: !!currencyGUID });

  const openNew = () => router.push({ pathname: CURRENCY_EXCHANGE_ROUTES.edit, params: { currencyGUID } } as any);
  const openEdit = (rowGUID: string) => router.push({ pathname: CURRENCY_EXCHANGE_ROUTES.edit, params: { currencyGUID, rowGUID } } as any);
  const backToCurrencies = () => router.push(CURRENCY_ROUTES.list as any);

  // the card shows the currency code next to the ratio
  const RateCard = useCallback((p: any) => <CurrencyRateCard {...p} currencyCode={code} />, [code]);

  if (!currencyGUID) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: c.background }]} testID="currency-exchange-list-no-currency">
        <Text style={{ color: c.text, marginBottom: 12 }}>Choose a currency to see its exchange rates.</Text>
        <Pressable onPress={backToCurrencies} accessibilityRole="link" testID="currency-exchange-to-currencies">
          <Text style={[styles.link, { color: c.primary }]}>Open currencies</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="currency-exchange-list">
      <View style={styles.header}>
        <Pressable onPress={backToCurrencies} accessibilityRole="link" style={styles.back} testID="currency-exchange-back">
          <IconApp name="arrow_back" size={18} color={c.primary} />
          <Text style={[styles.link, { color: c.primary }]}>Currencies</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]} numberOfLines={1} testID="currency-exchange-title">
          {code ? `${code}${currency?.rowJSON?.currencyName ? ` · ${currency.rowJSON.currencyName}` : ''}` : 'Currency'}
        </Text>
        <CurrencyRealtimeBadge status={status} />
        {Platform.OS !== 'web' && (
          <Pressable testID="currency-exchange-add" onPress={openNew} style={[styles.add, { backgroundColor: c.primary }]} accessibilityLabel="Add rate">
            <IconApp name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS === 'web' ? (
        <ListWebCardsComponent
          entityName={CURRENCY_EXCHANGE_ENTITY}
          entityForArchivationName=""
          crudListTitle={code ? `${code} rates` : 'Rates'}
          itemLabel="Exchange rate"
          listOwnerGUID={currencyGUID}
          CardComponent={RateCard}
          mapItemToCard={rateToCard}
          onCreateNewItem={openNew}
          onEditCard={(id: string) => openEdit(id)}
          readParams={readParams}
          reorderEnabled={false}
          crudCardHeight={64}
          crudListWidth={620}
          crudGapBetweenCards={8}
        />
      ) : (
        <NativeRateList currencyGUID={currencyGUID} code={code} onEdit={openEdit} />
      )}
    </View>
  );
}

/** iOS / Android: ListWebCardsComponent renders DOM elements, so a FlatList of the same cards is used. */
function NativeRateList({ currencyGUID, code, onEdit }: { currencyGUID: string; code: string; onEdit: (rowGUID: string) => void }) {
  const dispatch = useDispatch();
  const all: any[] = useSelector((s: any) => s?.[CURRENCY_EXCHANGE_ENTITY]?.entityDataFromServer) || [];
  const rows = useMemo(() => sortRatesNewestFirst(all.filter((r) => matchRow(r, { rowOwnerGUID: currencyGUID }))), [all, currencyGUID]);
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[CURRENCY_EXCHANGE_ENTITY]?.actions;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.rowGUID}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', marginTop: 24 }}>No rates yet.</Text>}
      renderItem={({ item, index }) => (
        <CurrencyRateCard
          card={rateToCard(item, index, rows)}
          currencyCode={code}
          onEdit={onEdit}
          onDelete={(id) => actions?.deleteOne && dispatch(actions.deleteOne({ rowGUID: id, rowOwnerGUID: currencyGUID }))}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, flexWrap: 'wrap', maxWidth: 652, width: '100%', alignSelf: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { fontWeight: '600', textDecorationLine: 'underline' },
  title: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginLeft: 'auto' },
});
