// PMProjectKanbanStateList - CRUD ListWebCardsComponent of project_kanban_stage_table for this project
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useDesignSystem } from '../../../../../providers/WithDesignSystem';
import IconApp from '../../../../../components/common/IconApp';
import { SystemMetaData } from '../../../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../../../redux/reusable/useRealtimeEntity';
import { PROJECT_KANBAN_STAGE_ENTITY } from '../../../../model/constants';
import { PM_KANBAN_STAGE_COLORS } from '../../../../model/kanbanTypes';
import KanbanStageCard from '../../../../../catalog/kanbanstage/KanbanStageCard';
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
  const actions = SystemMetaData[PROJECT_KANBAN_STAGE_ENTITY]?.actions;

  const [modalVisible, setModalVisible] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  const readParams = useMemo(
    () => ({ paginationSize: 1000, originationCurrentPage: 0, match: { rowOwnerGUID: projectGUID || '' } }),
    [projectGUID]
  );

  useRealtimeEntity(PROJECT_KANBAN_STAGE_ENTITY, {
    readParams,
    enabled: Boolean(projectGUID),
  });

  const allRows: any[] = useSelector(
    (s: any) => s?.[PROJECT_KANBAN_STAGE_ENTITY]?.entityDataFromServer || []
  );

  const projectStages = useMemo(() => {
    if (!projectGUID) return [];
    return allRows
      .filter((r) => r.rowOwnerGUID === projectGUID)
      .sort((a, b) => (a.orderInList ?? 0) - (b.orderInList ?? 0));
  }, [allRows, projectGUID]);

  const mapItemToCard = (item: any, index: number): CardItem => ({
    id: item.rowGUID,
    title: item.rowJSON?.stageName || `Stage ${index + 1}`,
    description: [item.rowJSON?.stageColor, item.rowJSON?.wipLimit ? `WIP: ${item.rowJSON.wipLimit}` : ''].filter(Boolean).join(' · '),
    orderInList: item.orderInList ?? (index + 1) * 1000,
    rawItem: item,
  });

  const openNew = () => {
    setEditingRow(null);
    setModalVisible(true);
  };

  const openEdit = (id: string) => {
    const found = projectStages.find((r) => r.rowGUID === id);
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
          <Text style={styles.addBtnText}>Add Stage</Text>
        </Pressable>
      </View>

      {Platform.OS === 'web' && ListWebCardsComponent ? (
        <ListWebCardsComponent
          entityName={PROJECT_KANBAN_STAGE_ENTITY}
          entityForArchivationName=""
          crudListTitle="Kanban Stages"
          itemLabel="Kanban Stage"
          listOwnerGUID={projectGUID}
          CardComponent={KanbanStageCard}
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
          data={projectStages}
          keyExtractor={(item) => item.rowGUID}
          contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { color: `${c.text}88` }]}>
              No kanban stages configured yet.
            </Text>
          }
          renderItem={({ item, index }) => (
            <KanbanStageCard
              card={mapItemToCard(item, index)}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        />
      )}

      {modalVisible && (
        <StageEditDialog
          visible={modalVisible}
          projectGUID={projectGUID}
          initialRow={editingRow}
          onClose={() => setModalVisible(false)}
        />
      )}
    </View>
  );
}

function StageEditDialog({
  visible,
  projectGUID,
  initialRow,
  onClose,
}: {
  visible: boolean;
  projectGUID: string;
  initialRow: any;
  onClose: () => void;
}) {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const actions = SystemMetaData[PROJECT_KANBAN_STAGE_ENTITY]?.actions;

  const [name, setName] = useState(initialRow?.rowJSON?.stageName || '');
  const [color, setColor] = useState(initialRow?.rowJSON?.stageColor || PM_KANBAN_STAGE_COLORS[1]);
  const [wip, setWip] = useState(String(initialRow?.rowJSON?.wipLimit ?? ''));

  const save = () => {
    if (!name.trim()) return;
    const wipLimit = parseInt(wip, 10) || 0;
    if (initialRow) {
      if (actions?.updateOne) {
        dispatch(
          actions.updateOne({
            rowGUID: initialRow.rowGUID,
            rowOwnerGUID: projectGUID,
            rowJSON: {
              ...initialRow.rowJSON,
              stageName: name.trim(),
              stageColor: color,
              wipLimit,
            },
          })
        );
      }
    } else {
      if (actions?.createOne) {
        dispatch(
          actions.createOne({
            rowGUID: Crypto.randomUUID(),
            rowOwnerGUID: projectGUID,
            rowParentGUID: 'empty',
            orderInList: Date.now(),
            rowJSON: {
              stageName: name.trim(),
              stageColor: color,
              wipLimit,
            },
          })
        );
      }
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.dialogCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.dialogTitle, { color: c.text }]}>
            {initialRow ? 'Edit Stage' : 'New Kanban Stage'}
          </Text>

          <Text style={[styles.fieldLabel, { color: c.text }]}>Stage Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. In Progress"
            placeholderTextColor={c.border}
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />

          <Text style={[styles.fieldLabel, { color: c.text }]}>Color</Text>
          <View style={styles.colorRow}>
            {PM_KANBAN_STAGE_COLORS.slice(0, 8).map((clr) => (
              <Pressable
                key={clr}
                onPress={() => setColor(clr)}
                style={[
                  styles.colorDot,
                  { backgroundColor: clr },
                  color === clr && { borderWidth: 2, borderColor: c.text },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: c.text }]}>WIP Limit (optional)</Text>
          <TextInput
            value={wip}
            onChangeText={setWip}
            placeholder="0 = unlimited"
            placeholderTextColor={c.border}
            keyboardType="numeric"
            style={[styles.input, { color: c.text, borderColor: c.border }]}
          />

          <View style={styles.dialogActions}>
            <Pressable onPress={onClose} style={[styles.dialogBtn, { borderColor: c.border, borderWidth: 1 }]}>
              <Text style={{ color: c.text }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={save} style={[styles.dialogBtn, { backgroundColor: c.primary }]}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  dialogBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
