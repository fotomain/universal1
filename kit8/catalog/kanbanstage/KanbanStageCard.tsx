// KanbanStageCard - one default Kanban stage in ListWebCardsComponent (web, drag & drop = column order)
// and in the native list. Tap / Edit -> /kanbanstage/edit?rowGUID=… · Delete -> the list's sql_for_delete.
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import type { CardItem } from '../../ui/components/list/web/lib/types';
import { kanbanStageColorOf } from '../../pm/model/kanbanTypes';
import type { KanbanStageRowJSON } from './kanbanStageModel';

export interface KanbanStageCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** web drag handle from ListWebCardsComponent (@hello-pangea/dnd) */
  dragHandleProps?: any;
  crudCardHeight?: number;
  /** position in the list (1 = first column / default stage of new tasks) */
  position?: number;
}

export default function KanbanStageCard({ card, isSelected, isDragging, onEdit, onDelete, dragHandleProps, crudCardHeight = 64, position }: KanbanStageCardProps) {
  const { themeColors: c } = useDesignSystem();
  const j: Partial<KanbanStageRowJSON> = card.rawItem?.rowJSON || {};
  const inactive = j.isActive === false;
  const color = kanbanStageColorOf(j as any);
  const id = card.id;
  const place = position ?? (card as any).position;
  return (
    <View
      testID={`kanban-stage-card-${id}`}
      style={[
        styles.card,
        {
          minHeight: crudCardHeight,
          backgroundColor: isSelected ? `${c.primary}18` : c.surface,
          borderColor: isSelected ? c.primary : c.border,
          borderLeftColor: color,
          opacity: inactive ? 0.65 : 1,
        },
        isDragging && styles.dragging,
      ]}
    >
      {Platform.OS === 'web' && dragHandleProps ? (
        <div {...dragHandleProps} title="Drag to reorder (= column order)" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4 }}>
          <IconApp name="drag_indicator" size={20} color={c.text} />
        </div>
      ) : null}
      <Pressable style={styles.main} onPress={() => onEdit?.(id)} accessibilityRole="button" accessibilityLabel={`Edit ${j.stageName || 'stage'}`}>
        <View style={[styles.swatch, { backgroundColor: color }]}>
          {!!place && <Text style={styles.position}>{place}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1} testID={`kanban-stage-card-name-${id}`}>
            {j.stageName || '—'}
          </Text>
          <Text style={[styles.meta, { color: c.text }]} numberOfLines={1}>
            {[j.stageCode, j.stageColor].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {inactive && (
          <Text style={[styles.chip, { color: c.text, borderColor: c.border }]} testID={`kanban-stage-card-inactive-${id}`}>
            inactive
          </Text>
        )}
      </Pressable>
      <IconApp testID={`kanban-stage-card-edit-${id}`} name="edit" size={20} color={c.text} onPress={() => onEdit?.(id)} />
      <View style={{ width: 8 }} />
      <IconApp testID={`kanban-stage-card-delete-${id}`} name="delete" size={20} color={c.error} onPress={() => onDelete?.(id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderLeftWidth: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  dragging: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  position: { color: '#fff', fontWeight: '800', fontSize: 13 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  chip: { fontSize: 11, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
});
