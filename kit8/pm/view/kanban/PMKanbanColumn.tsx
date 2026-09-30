// One Kanban column = one stage of project_kanban_stage_table. The whole column is a
// react-native-reanimated-dnd Droppable (cards dropped anywhere in it land in this stage; the
// place inside the column is computed by the dashboard from the drop position).
// Highlighted while a card or a tree row is dragged over it.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Droppable } from 'react-native-reanimated-dnd';
import { PMPalette, withAlpha } from '../theme';
import { kanbanStageColorOf } from '../../model/kanbanTypes';
import { PMKanbanCard, PMKanbanCardDragData } from './PMKanbanCard';
import { PM_KANBAN_COLUMN_HEADER } from './kanbanLayout';
import type { PMKanbanColumn as Column } from './kanbanModel';

export interface PMKanbanColumnProps {
  column: Column;
  index: number;
  columnCount: number;
  width: number;
  minHeight: number;
  palette: PMPalette;
  selectedGUID: string | null;
  readOnly: boolean;
  /** a tree row is dragged over this column */
  treeDragOver: boolean;
  /** a card of this column is being dragged (the column is raised above its neighbours) */
  raised: boolean;
  /** remounts the cards after a drag (resets the Draggable translation) */
  epoch: number;
  registerRef: (guid: string, view: View | null) => void;
  onDropCard: (data: PMKanbanCardDragData, stageGUID: string) => void;
  onSelect: (guid: string) => void;
  onEdit: (guid: string) => void;
  onMoveBy: (guid: string, dir: -1 | 1) => void;
  onDragStart: (data: PMKanbanCardDragData) => void;
  onDragEnd: (data: PMKanbanCardDragData) => void;
}

export default function PMKanbanColumn(p: PMKanbanColumnProps) {
  const { column, palette } = p;
  const stage = column.stage;
  const color = kanbanStageColorOf(stage.rowJSON);
  const wip = stage.rowJSON.wipLimit && stage.rowJSON.wipLimit > 0 ? stage.rowJSON.wipLimit : 0;
  const overWip = wip > 0 && column.cards.length > wip;

  const content = (
    <>
      <View style={[styles.header, { borderBottomColor: color }]}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {stage.rowJSON.stageName || '—'}
        </Text>
        <Text style={[styles.count, { color: overWip ? palette.error : palette.textMuted, borderColor: overWip ? palette.error : palette.border }]}>
          {wip ? `${column.cards.length}/${wip}` : column.cards.length}
        </Text>
      </View>
      <View style={styles.body}>
        {column.cards.map((card, i) => (
          <PMKanbanCard
            key={`${card.guid}:${p.epoch}`}
            card={card}
            stageGUID={stage.rowGUID}
            stageColor={color}
            palette={palette}
            selected={p.selectedGUID === card.guid}
            readOnly={p.readOnly}
            canMoveLeft={p.index > 0}
            canMoveRight={p.index < p.columnCount - 1}
            registerRef={p.registerRef}
            onSelect={p.onSelect}
            onEdit={p.onEdit}
            onMoveBy={p.onMoveBy}
            onDragStart={p.onDragStart}
            onDragEnd={p.onDragEnd}
          />
        ))}
        {!column.cards.length && (
          <Text style={[styles.empty, { color: palette.textMuted, borderColor: palette.border }]}>{p.readOnly ? 'No tasks' : 'Drop tasks here'}</Text>
        )}
      </View>
    </>
  );

  const boxStyle = [
    styles.column,
    {
      width: p.width,
      minHeight: p.minHeight,
      backgroundColor: p.treeDragOver ? withAlpha(color, 0.18) : palette.header,
      borderColor: p.treeDragOver ? color : palette.border,
    },
    p.raised ? styles.raised : null,
  ];

  if (p.readOnly) {
    return (
      <View style={boxStyle} testID={`pm-kanban-column-${stage.rowGUID}`}>
        {content}
      </View>
    );
  }
  return (
    <View style={[{ width: p.width }, p.raised ? styles.raised : null]}>
      <Droppable<PMKanbanCardDragData>
        droppableId={stage.rowGUID}
        onDrop={(data) => p.onDropCard(data, stage.rowGUID)}
        activeStyle={{ backgroundColor: withAlpha(color, 0.18), borderColor: color }}
        style={boxStyle}
      >
        <View testID={`pm-kanban-column-${stage.rowGUID}`}>{content}</View>
      </Droppable>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'visible' },
  raised: { zIndex: 20, elevation: 20 },
  header: { height: PM_KANBAN_COLUMN_HEADER, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  title: { flex: 1, fontWeight: '700', fontSize: 13 },
  count: { fontSize: 11, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
  body: { padding: 8 },
  empty: { fontSize: 12, textAlign: 'center', paddingVertical: 18, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8 },
});
