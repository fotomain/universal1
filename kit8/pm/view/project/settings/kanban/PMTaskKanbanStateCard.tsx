// PMTaskKanbanStateCard - Card for project_task_kanban_state_table row in ListWebCardsComponent
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../../../providers/WithDesignSystem';
import IconApp from '../../../../../components/common/IconApp';
import type { CardItem } from '../../../../../components/list/web/lib/types';
import { usePMStore } from '../../../../store/store_pm';
import { usePMKanbanStore } from '../../../../store/store_kanban';

export interface PMTaskKanbanStateCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  dragHandleProps?: any;
  crudCardHeight?: number;
  testID?: string;
}

export default function PMTaskKanbanStateCard({
  card,
  isSelected,
  isDragging,
  onEdit,
  onDelete,
  dragHandleProps,
  crudCardHeight = 68,
  testID,
}: PMTaskKanbanStateCardProps) {
  const { themeColors: c } = useDesignSystem();
  const rawItem = card.rawItem || {};
  const j = rawItem.rowJSON || {};
  const id = card.id;

  const taskGUID = rawItem.rowParentGUID;
  const stageGUID = j.stageGUID;
  const progressPct = j.kanbanStageProgressPercent;

  // Look up task name and stage from PM and Kanban stores
  const task = usePMStore((s) => (taskGUID ? s.tasksById[taskGUID] : undefined));
  const stages = usePMKanbanStore((s) => s.stages || []);
  const stage = stages.find((st) => st.rowGUID === stageGUID);

  const taskName = task?.rowJSON?.name || card.title || `Task (${taskGUID?.slice(0, 8) || 'unknown'})`;
  const stageName = stage?.rowJSON?.stageName || 'Default stage';
  const stageColor = stage?.rowJSON?.stageColor || c.primary;

  return (
    <View
      testID={testID || `pm-kanban-state-card-${id}`}
      style={[
        styles.card,
        {
          minHeight: crudCardHeight,
          backgroundColor: isSelected ? `${c.primary}18` : c.surface,
          borderColor: isSelected ? c.primary : c.border,
        },
        isDragging && styles.dragging,
      ]}
    >
      {Platform.OS === 'web' && dragHandleProps ? (
        <div {...dragHandleProps} title="Drag to reorder" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4 }}>
          <IconApp name="drag_indicator" size={18} color={c.text} />
        </div>
      ) : null}

      <Pressable
        style={styles.main}
        onPress={() => onEdit?.(id)}
        accessibilityRole="button"
        accessibilityLabel={`Edit task state ${taskName}`}
      >
        <View style={[styles.avatarBadge, { backgroundColor: `${c.primary}18` }]}>
          <IconApp name="task_alt" size={18} color={c.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.taskTitle, { color: c.text }]} numberOfLines={1}>
            {taskName}
          </Text>

          <View style={styles.badgeRow}>
            <View style={[styles.stageBadge, { backgroundColor: `${stageColor}20`, borderColor: stageColor }]}>
              <View style={[styles.stageDot, { backgroundColor: stageColor }]} />
              <Text style={[styles.stageBadgeText, { color: stageColor }]} numberOfLines={1}>
                {stageName}
              </Text>
            </View>

            {progressPct !== undefined && progressPct !== null && (
              <View style={[styles.progressBadge, { borderColor: c.border }]}>
                <Text style={[styles.progressText, { color: c.text }]}>
                  {progressPct}%
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>

      <IconApp
        testID={`kanban-state-edit-${id}`}
        name="edit"
        size={18}
        color={c.text}
        onPress={() => onEdit?.(id)}
      />
      <View style={{ width: 8 }} />
      <IconApp
        testID={`kanban-state-delete-${id}`}
        name="delete"
        size={18}
        color={c.error}
        onPress={() => onDelete?.(id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dragging: {
    ...Platform.select({
      web: { boxShadow: '0 8px 16px rgba(0,0,0,0.2)' },
      default: { elevation: 8 },
    }),
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  stageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
