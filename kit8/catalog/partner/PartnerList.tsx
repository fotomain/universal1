// PartnerList - route /partner/list. Web: ListWebCardsComponent (drag & drop order, search, delete +
// Undo) with PartnerCard; iOS / Android: a plain list of PartnerCard. Both stay in sync with Supabase
// Realtime through the reusable saga (useRealtimeEntity).
import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import PartnerCard from './PartnerCard';
import {
  PARTNER_CATALOG_OWNER,
  PARTNER_ENTITY,
  PARTNER_READ_PARAMS,
  PARTNER_ROUTES,
  partnerToCard,
} from './partnerModel';

// web only: ListWebCardsComponent renders DOM (drag & drop) - never loaded on iOS / Android
const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../ui/components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export default function PartnerList() {
  const router = useRouter();
  const { themeColors: c } = useDesignSystem();
  const status = useRealtimeEntity(PARTNER_ENTITY, { readParams: PARTNER_READ_PARAMS });

  const openNew = () => router.push(PARTNER_ROUTES.edit as any);
  const openEdit = (rowGUID: string) =>
    router.push({ pathname: PARTNER_ROUTES.edit, params: { rowGUID } } as any);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="partner-list">
      <View style={styles.header}>
        <CurrencyRealtimeBadge status={status} />
        {Platform.OS !== 'web' && (
          <Pressable
            testID="partner-add"
            onPress={openNew}
            style={[styles.add, { backgroundColor: c.primary }]}
            accessibilityLabel="Add partner"
          >
            <IconApp name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS === 'web' ? (
        <ListWebCardsComponent
          entityName={PARTNER_ENTITY}
          entityForArchivationName=""
          crudListTitle="Partners"
          itemLabel="Partner"
          listOwnerGUID={PARTNER_CATALOG_OWNER}
          CardComponent={PartnerCard}
          mapItemToCard={partnerToCard}
          onCreateNewItem={openNew}
          onEditCard={(id: string) => openEdit(id)}
          readParams={PARTNER_READ_PARAMS}
          crudCardHeight={76}
          crudListWidth={640}
          crudGapBetweenCards={8}
        />
      ) : (
        <NativePartnerList onEdit={openEdit} />
      )}
    </View>
  );
}

/** iOS / Android: ListWebCardsComponent renders DOM elements, so a FlatList of the same cards is used. */
function NativePartnerList({ onEdit }: { onEdit: (rowGUID: string) => void }) {
  const dispatch = useDispatch();
  const rows: any[] = useSelector((s: any) => s?.[PARTNER_ENTITY]?.entityDataFromServer) || [];
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[PARTNER_ENTITY]?.actions;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.rowGUID}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={
        <Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', marginTop: 24 }}>
          No partners in catalog yet.
        </Text>
      }
      renderItem={({ item, index }) => (
        <PartnerCard
          card={partnerToCard(item, index)}
          onEdit={onEdit}
          onDelete={(id) => actions?.deleteOne && dispatch(actions.deleteOne({ rowGUID: id }))}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
});
