// PMProjectKanbanStateList - CRUD ListWebCardsComponent of project_task_kanban_state_table for this project
import React, { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../../providers/WithDesignSystem';
import IconApp from '../../../../../components/common/IconApp';
import { SystemMetaData } from '../../../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../../../redux/reusable/useRealtimeEntity';
import { PROJECT_TASK_KANBAN_STATE_ENTITY } from '../../../../model/constants';
import PMTaskKanbanStateCard from './PMTaskKanbanStateCard';
import PMTaskKanbanStateEditModal from './PMTaskKanbanStateEditModal';
import type { CardItem } from '../../../../../components/list/web/lib/types';

// Web only: ListWebCardsComponent renders DOM (@hello-pangea/dnd)
const ListWebCardsComponent: any =
  Platform.OS === 'web'
    ? require('../../../../../components/list/web/ListWebCardsComponent').ListWebCardsComponent
    : null;

export interface PMProjectKanbanStateListProps {
  projectGUID?: string | null;
  onOpenKanbanStages?: () => void;
}

export default function PMProjectKanbanStateList({
  projectGUID,
  onOpenKanbanStages,
}: PMProjectKanbanStateListProps) {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[PROJECT_TASK_KANBAN_STATE_ENTITY]?.actions;

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  const readParams = useMemo(
    () => ({ paginationSize: 1000, originationCurrentPage: 0, match: { rowOwnerGUID: projectGUID || '' } }),
    [projectGUID]
  );

  useRealtimeEntity(PROJECT_TASK_KANBAN_STATE_ENTITY, {
    readParams,
    enabled: Boolean(projectGUID),
  });

  const allRows: any[] = useSelector(
    (s: any) => s?.[PROJECT_TASK_KANBAN_STATE_ENTITY]?.entityDataFromServer || []
  );

  const projectStates = useMemo(() => {
    if (!projectGUID) return [];
    return allRows
      .filter((r) => r.rowOwnerGUID === projectGUID)
      .sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));
  }, [allRows, projectGUID]);

  const mapItemToCard = (item: any, index: number): CardItem => ({
    id: item.rowGUID,
    title: item.rowJSON?.name || `State ${index + 1}`,
    description: `Stage: ${item.rowJSON?.stageGUID || ''}`,
    rawItem: item,
  });

  const openNew = () => {
    setEditingRow(null);
    setModalVisible(true);
  };

  const openEdit = (id: string) => {
    const found = projectStates.find((r) => r.rowGUID === id);
    if (found) {
      setEditingRow(found);
      setModalVisible(true);
    }
  };

  const handleDelete = (id: string) => {
    if (actions?.deleteOne) {
      dispatch(actions.deleteOne({ rowGUID: id, rowOwnerGUID: projectGUID }));
    }
  };

  if (!projectGUID) {
    return (
      <View style={[styles.placeholderCard, { backgroundColor: `${c.border}20`, borderColor: c.border }]}>
        <IconApp name="info" size={24} color={c.text} />
        <Text style={[styles.placeholderText, { color: c.text }]}>
          Save this project first to manage task Kanban states.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbarRow}>
        {onOpenKanbanStages && (
          <Pressable
            testID="pm-project-kanban-stages"
            onPress={onOpenKanbanStages}
            style={[styles.stagesBtn, { borderColor: c.primary, backgroundColor: `${c.primary}15` }]}
          >
            <IconApp name="view_column" size={16} color={c.primary} />
            <Text style={[styles.stagesBtnText, { color: c.primary }]}>
              Kanban Stages
            </Text>
          </Pressable>
        )}

        <Pressable
          testID="pm-project-add-kanban-state"
          onPress={openNew}
          style={[styles.addBtn, { backgroundColor: c.primary }]}
        >
          <IconApp name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Task State</Text>
        </Pressable>
      </View>

      {Platform.OS === 'web' && ListWebCardsComponent ? (
        <ListWebCardsComponent
          entityName={PROJECT_TASK_KANBAN_STATE_ENTITY}
          entityForArchivationName=""
          crudListTitle="Task Kanban States"
          itemLabel="Task State"
          listOwnerGUID={projectGUID}
          CardComponent={PMTaskKanbanStateCard}
          mapItemToCard={mapItemToCard}
          onCreateNewItem={openNew}
          onEditCard={openEdit}
          readParams={readParams}
          crudCardHeight={68}
          crudListWidth={540}
          crudGapBetweenCards={8}
        />
      ) : (
        <FlatList
          data={projectStates}
          keyExtractor={(item) => item.rowGUID}
          contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: `${c.text}88` }]}>
              No task kanban states assigned yet.
            </Text>
          }
          renderItem={({ item, index }) => (
            <PMTaskKanbanStateCard
              card={mapItemToCard(item, index)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      {modalVisible && (
        <PMTaskKanbanStateEditModal
          visible={modalVisible}
          projectGUID={projectGUID}
          initialRow={editingRow}
          onClose={() => setModalVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 6,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  stagesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  stagesBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  placeholderCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  placeholderText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 16,
  },
});
