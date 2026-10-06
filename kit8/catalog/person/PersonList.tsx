// PersonList - route /person/list. Web: ListWebCardsComponent (drag & drop order, search, delete +
// Undo) with PersonCard; iOS / Android: a plain list of PersonCard. Both stay in sync with Supabase
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
import PersonCard from './PersonCard';
import {
  PERSON_CATALOG_OWNER,
  PERSON_ENTITY,
  PERSON_READ_PARAMS,
  PERSON_ROUTES,
  personToCard,
} from './personModel';

// web only: ListWebCardsComponent renders DOM (drag & drop) - never loaded on iOS / Android
const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../ui/components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export default function PersonList() {
  const router = useRouter();
  const { themeColors: c } = useDesignSystem();
  const status = useRealtimeEntity(PERSON_ENTITY, { readParams: PERSON_READ_PARAMS });

  const openNew = () => router.push(PERSON_ROUTES.edit as any);
  const openEdit = (rowGUID: string) =>
    router.push({ pathname: PERSON_ROUTES.edit, params: { rowGUID } } as any);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="person-list">
      <View style={styles.header}>
        <CurrencyRealtimeBadge status={status} />
        {Platform.OS !== 'web' && (
          <Pressable
            testID="person-add"
            onPress={openNew}
            style={[styles.add, { backgroundColor: c.primary }]}
            accessibilityLabel="Add person"
          >
            <IconApp name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS === 'web' ? (
        <ListWebCardsComponent
          entityName={PERSON_ENTITY}
          entityForArchivationName=""
          crudListTitle="Persons"
          itemLabel="Person"
          listOwnerGUID={PERSON_CATALOG_OWNER}
          CardComponent={PersonCard}
          mapItemToCard={personToCard}
          onCreateNewItem={openNew}
          onEditCard={(id: string) => openEdit(id)}
          readParams={PERSON_READ_PARAMS}
          crudCardHeight={76}
          crudListWidth={640}
          crudGapBetweenCards={8}
        />
      ) : (
        <NativePersonList onEdit={openEdit} />
      )}
    </View>
  );
}

/** iOS / Android: ListWebCardsComponent renders DOM elements, so a FlatList of the same cards is used. */
function NativePersonList({ onEdit }: { onEdit: (rowGUID: string) => void }) {
  const dispatch = useDispatch();
  const rows: any[] = useSelector((s: any) => s?.[PERSON_ENTITY]?.entityDataFromServer) || [];
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[PERSON_ENTITY]?.actions;

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.rowGUID}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={
        <Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', marginTop: 24 }}>
          No persons in catalog yet.
        </Text>
      }
      renderItem={({ item, index }) => (
        <PersonCard
          card={personToCard(item, index)}
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
