// One Kanban card = one task / milestone of the project tree.
//   drag (web: mouse drag · touch: long-press + drag) = move to another column / reorder (react-native-reanimated-dnd)
//   tap = select the task (the tree selects + scrolls to it) · double tap / ✎ = edit (PMTaskEditModal)
//   ‹ › = previous / next stage (phones: no dragging across off-screen columns needed)
// The progress bar shows the task %, which is independent of the Kanban stage.

import React, { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Draggable } from 'react-native-reanimated-dnd';
import { PMPalette, withAlpha } from '../theme';
import { formatDateShort } from '../project/scheduling';
import { PMIconButton } from '../../inner/buttons/PMIconButton';
import { PMTipIcon } from '../../inner/buttons';
import type { PMKanbanCard as Card } from './kanbanModel';

const IS_WEB = Platform.OS === 'web';
const DOUBLE_TAP_MS = 320;

export interface PMKanbanCardDragData {
  guid: string;
  stageGUID: string;
}

export interface PMKanbanCardProps {
  card: Card;
  stageGUID: string;
  stageColor: string;
  palette: PMPalette;
  selected: boolean;
  readOnly: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  /** the card's measurable view (drop index) */
  registerRef: (guid: string, view: View | null) => void;
  onSelect: (guid: string) => void;
  onEdit: (guid: string) => void;
  onMoveBy: (guid: string, dir: -1 | 1) => void;
  onDragStart: (data: PMKanbanCardDragData) => void;
  onDragEnd: (data: PMKanbanCardDragData) => void;
}

function PMKanbanCardInner({
  card,
  stageGUID,
  stageColor,
  palette,
  selected,
  readOnly,
  canMoveLeft,
  canMoveRight,
  registerRef,
  onSelect,
  onEdit,
  onMoveBy,
  onDragStart,
  onDragEnd,
}: PMKanbanCardProps) {
  const lastTap = useRef(0);
  const accent = card.color || (card.critical ? palette.critical : stageColor);
  const progress = Math.max(0, Math.min(100, card.progress));
  const dates =
    card.startMs !== null && card.finishMs !== null
      ? card.kind === 'milestone'
        ? formatDateShort(card.startMs)
        : `${formatDateShort(card.startMs)} – ${formatDateShort(card.finishMs - 1)}`
      : '';

  const onPress = () => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (!readOnly) onEdit(card.guid);
      return;
    }
    lastTap.current = now;
    onSelect(card.guid);
  };

  const body = (
    <View
      ref={(v) => registerRef(card.guid, v)}
      collapsable={false}
      testID={`pm-kanban-card-${card.guid}`}
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: selected ? palette.primary : palette.border, borderLeftColor: accent },
        selected ? { borderWidth: 2, borderLeftWidth: 4 } : null,
      ]}
    >
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={card.name} style={IS_WEB ? ({ cursor: readOnly ? 'pointer' : 'grab' } as any) : null}>
        <View style={styles.titleRow}>
          {card.kind === 'milestone' && <PMTipIcon tip="Milestone" testID={`pm-kanban-ms-${card.guid}`} name="flag" size={14} color={palette.milestone} style={{ marginRight: 4 }} />}
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
            {card.name || '(no name)'}
          </Text>
          {card.critical && <View style={[styles.criticalDot, { backgroundColor: palette.critical }]} />}
        </View>
        <Text style={[styles.meta, { color: palette.textMuted }]} numberOfLines={1}>
          {[card.wbs, card.parentName].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: withAlpha(palette.primary, 0.15) }]}>
            <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: palette.primary }]} />
          </View>
          <Text style={[styles.progressText, { color: palette.textMuted }]}>{progress}%</Text>
        </View>
      </Pressable>
      <View style={styles.footer}>
        <Text style={[styles.meta, { color: palette.textMuted, flex: 1 }]} numberOfLines={1}>
          {dates}
        </Text>
        {!readOnly && (
          <>
            <PMIconButton testID={`pm-kanban-left-${card.guid}`} icon="chevron_left" title="Previous stage" color={palette.text} size={16} compact disabled={!canMoveLeft} onPress={() => onMoveBy(card.guid, -1)} />
            <PMIconButton testID={`pm-kanban-right-${card.guid}`} icon="chevron_right" title="Next stage" color={palette.text} size={16} compact disabled={!canMoveRight} onPress={() => onMoveBy(card.guid, 1)} />
            <PMIconButton testID={`pm-kanban-edit-${card.guid}`} icon="edit" title="Edit task (name, progress %, dates…)" color={palette.text} size={16} compact onPress={() => onEdit(card.guid)} />
          </>
        )}
      </View>
    </View>
  );

  if (readOnly) return <View style={styles.slot}>{body}</View>;
  const data: PMKanbanCardDragData = { guid: card.guid, stageGUID };
  return (
    <Draggable<PMKanbanCardDragData>
      data={data}
      draggableId={card.guid}
      // touch: long-press first, so a plain swipe still scrolls the board
      preDragDelay={IS_WEB ? 0 : 250}
      collisionAlgorithm="center"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={styles.slot}
    >
      {body}
    </Draggable>
  );
}

export const PMKanbanCard = React.memo(PMKanbanCardInner);
export default PMKanbanCard;

const styles = StyleSheet.create({
  slot: { marginBottom: 8 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, borderRadius: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  title: { flex: 1, fontSize: 13, fontWeight: '600' },
  criticalDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6, marginTop: 4 },
  meta: { fontSize: 11, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3 },
  progressText: { fontSize: 11, marginLeft: 6, minWidth: 30, textAlign: 'right' },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
});
