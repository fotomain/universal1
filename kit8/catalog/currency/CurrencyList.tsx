// CurrencyList - route /currency/list. Web: ListWebCardsComponent (drag & drop order, search, delete +
// Undo) with CurrencyCard; iOS / Android: a plain list of CurrencyCard. Both stay in sync with Supabase
// Realtime (other browsers / devices) through the reusable saga (useRealtimeEntity / realtime prop).
import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyCard from './CurrencyCard';
import CurrencyRealtimeBadge from './CurrencyRealtimeBadge';
import { CURRENCY_CATALOG_OWNER, CURRENCY_ENTITY, CURRENCY_READ_PARAMS, CURRENCY_ROUTES, currencyToCard } from './currencyModel';

// web only: ListWebCardsComponent renders DOM (drag & drop) - never loaded on iOS / Android
const ListWebCardsComponent: any = Platform.OS === 'web' ? require('../../components/list/web/ListWebCardsComponent').ListWebCardsComponent : null;

export default function CurrencyList() {
  const router = useRouter();
  const { themeColors: c } = useDesignSystem();
  // one realtime subscription for the catalog while this screen (or the edit screen) is mounted
  const status = useRealtimeEntity(CURRENCY_ENTITY, { readParams: CURRENCY_READ_PARAMS });
  const openNew = () => router.push(CURRENCY_ROUTES.edit as any);
  const openEdit = (rowGUID: string) => router.push({ pathname: CURRENCY_ROUTES.edit, params: { rowGUID } } as any);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="currency-list">
      <View style={styles.header}>
        <CurrencyRealtimeBadge status={status} />
        {Platform.OS !== 'web' && (
          <Pressable testID="currency-add" onPress={openNew} style={[styles.add, { backgroundColor: c.primary }]} accessibilityLabel="Add currency">
            <IconApp name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS === 'web' ? (
        <ListWebCardsComponent
          entityName={CURRENCY_ENTITY}
          entityForArchivationName=""
          crudListTitle="Currencies"
          itemLabel="Currency"
          listOwnerGUID={CURRENCY_CATALOG_OWNER}
          CardComponent={CurrencyCard}
          mapItemToCard={currencyToCard}
          onCreateNewItem={openNew}
          onEditCard={(id: string) => openEdit(id)}
          readParams={CURRENCY_READ_PARAMS}
          crudCardHeight={72}
          crudListWidth={620}
          crudGapBetweenCards={8}
        />
      ) : (
        <NativeCurrencyList onEdit={openEdit} />
      )}
    </View>
  );
}

/** iOS / Android: ListWebCardsComponent renders DOM elements, so a FlatList of the same cards is used. */
function NativeCurrencyList({ onEdit }: { onEdit: (rowGUID: string) => void }) {
  const dispatch = useDispatch();
  const rows: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer) || [];
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[CURRENCY_ENTITY]?.actions;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.rowGUID}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', marginTop: 24 }}>No currencies yet.</Text>}
      renderItem={({ item, index }) => (
        <CurrencyCard card={currencyToCard(item, index)} onEdit={onEdit} onDelete={(id) => actions?.deleteOne && dispatch(actions.deleteOne({ rowGUID: id }))} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
});
