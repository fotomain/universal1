// KanbanStageList - route /kanbanstage/list (hamburger menu → Catalogs → Kanban Stages): the DEFAULT Kanban
// stages (kanban_stage_table) that every new project's Kanban starts with. Web: ListWebCardsComponent (drag &
// drop = column order, search, delete + Undo) with KanbanStageCard; iOS / Android: a plain list of the same
// cards. Live in every browser / device through the reusable saga (useRealtimeEntity).
import React from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../components/common/IconApp';
import { SystemMetaData } from '../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../redux/reusable/useRealtimeEntity';
import CurrencyRealtimeBadge from '../currency/CurrencyRealtimeBadge';
import KanbanStageCard from './KanbanStageCard';
import { KANBAN_STAGE_CATALOG_OWNER, KANBAN_STAGE_ENTITY, KANBAN_STAGE_READ_PARAMS, KANBAN_STAGE_ROUTES, kanbanStageToCard } from './kanbanStageModel';

// web only: ListWebCardsComponent renders DOM (drag & drop) - never loaded on iOS / Android
const ListWebCardsComponent: any = Platform.OS === 'web' ? require('../../components/list/web/ListWebCardsComponent').ListWebCardsComponent : null;

export default function KanbanStageList() {
  const router = useRouter();
  const { themeColors: c } = useDesignSystem();
  // one realtime subscription for the catalog while this screen (or the edit screen) is mounted
  const status = useRealtimeEntity(KANBAN_STAGE_ENTITY, { readParams: KANBAN_STAGE_READ_PARAMS });
  const openNew = () => router.push(KANBAN_STAGE_ROUTES.edit as any);
  const openEdit = (rowGUID: string) => router.push({ pathname: KANBAN_STAGE_ROUTES.edit, params: { rowGUID } } as any);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]} testID="kanban-stage-list">
      <View style={styles.header}>
        <Text style={[styles.hint, { color: c.text }]}>
          Default stages of a new project's Kanban (in this order). Each project then edits its own copy: Project settings → Kanban Stages.
        </Text>
        <CurrencyRealtimeBadge status={status} />
        {Platform.OS !== 'web' && (
          <Pressable testID="kanban-stage-add" onPress={openNew} style={[styles.add, { backgroundColor: c.primary }]} accessibilityLabel="Add Kanban stage">
            <IconApp name="add" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
          </Pressable>
        )}
      </View>
      {Platform.OS === 'web' ? (
        <ListWebCardsComponent
          entityName={KANBAN_STAGE_ENTITY}
          entityForArchivationName=""
          crudListTitle="Kanban Stages"
          itemLabel="Kanban stage"
          listOwnerGUID={KANBAN_STAGE_CATALOG_OWNER}
          CardComponent={KanbanStageCard}
          mapItemToCard={kanbanStageToCard}
          onCreateNewItem={openNew}
          onEditCard={(id: string) => openEdit(id)}
          readParams={KANBAN_STAGE_READ_PARAMS}
          crudCardHeight={64}
          crudListWidth={620}
          crudGapBetweenCards={8}
        />
      ) : (
        <NativeKanbanStageList onEdit={openEdit} />
      )}
    </View>
  );
}

/** iOS / Android: ListWebCardsComponent renders DOM elements, so a FlatList of the same cards is used. */
function NativeKanbanStageList({ onEdit }: { onEdit: (rowGUID: string) => void }) {
  const dispatch = useDispatch();
  const raw: any[] = useSelector((s: any) => s?.[KANBAN_STAGE_ENTITY]?.entityDataFromServer) || [];
  const rows = [...raw].sort((a, b) => (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0));
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[KANBAN_STAGE_ENTITY]?.actions;
  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.rowGUID}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', marginTop: 24 }}>No Kanban stages yet.</Text>}
      renderItem={({ item, index }) => (
        <KanbanStageCard
          card={kanbanStageToCard(item, index)}
          onEdit={onEdit}
          onDelete={(id) => actions?.deleteOne && dispatch(actions.deleteOne({ rowGUID: id, rowOwnerGUID: KANBAN_STAGE_CATALOG_OWNER }))}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  hint: { flex: 1, fontSize: 12, opacity: 0.7 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
});
