// One Kanban card = one task / milestone of the project tree.
//   drag (web: mouse drag · touch: long-press + drag) = move to another column / reorder (react-native-reanimated-dnd)
//   tap = select the task (the tree selects + scrolls to it) · double tap / ✎ = edit (PMTaskEditModal)
//   ‹ › = previous / next stage (phones: no dragging across off-screen columns needed)
// The progress bar shows the Kanban stage progress %, which is independently editable.

import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Draggable } from 'react-native-reanimated-dnd';
import { PMPalette, withAlpha } from '../theme';
import { formatDateShort } from '../project/scheduling';
import { PMIconButton } from '../../inner/buttons/PMIconButton';
import { PMTipIcon } from '../../inner/buttons';
import { usePMStore } from '../../store/store_pm';
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
  onProgressChange?: (guid: string, percent: number) => void;
  /** multi selection: round check box (checked cards are dragged / moved together) */
  checked?: boolean;
  onToggleChecked?: (guid: string) => void;
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
  onProgressChange,
  checked,
  onToggleChecked,
}: PMKanbanCardProps) {
  const lastTap = useRef(0);
  const criticalPriority = usePMStore((s) => s.criticalPathColorHasPriorityOverTheCustomTaskColor);
  const accent = (card.critical && criticalPriority) ? palette.critical : (card.color || (card.critical ? palette.critical : stageColor));
  const stageProgress = Math.max(0, Math.min(100, Math.round(card.kanbanStageProgressPercent ?? 0)));
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [progressInput, setProgressInput] = useState('');
  const [trackWidth, setTrackWidth] = useState(0);
  const progressInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditingProgress) {
      const selectVal = () => {
        const el = progressInputRef.current as any;
        if (!el) return;
        if (typeof el.focus === 'function') el.focus();
        if (typeof el.select === 'function') {
          el.select();
        } else if (typeof el.setSelectionRange === 'function') {
          el.setSelectionRange(0, el.value?.length ?? 10);
        }
      };
      selectVal();
      const timer = setTimeout(selectVal, 20);
      return () => clearTimeout(timer);
    }
  }, [isEditingProgress]);

  const dates =
    card.startMs !== null && card.finishMs !== null
      ? card.kind === 'milestone'
        ? formatDateShort(card.startMs)
        : `${formatDateShort(card.startMs)} – ${formatDateShort(card.finishMs - 1)}`
      : '';

  const commitProgress = () => {
    setIsEditingProgress(false);
    const n = progressInput.trim() === '' ? 0 : parseInt(progressInput, 10);
    if (Number.isFinite(n)) {
      const clamped = Math.max(0, Math.min(100, n));
      if (clamped !== stageProgress) {
        onProgressChange?.(card.guid, clamped);
      }
    }
  };

  const onTrackPress = (e: any) => {
    if (readOnly || trackWidth <= 0) return;
    const locX = e.nativeEvent?.locationX ?? 0;
    const pct = Math.max(0, Math.min(100, Math.round((locX / trackWidth) * 100)));
    onProgressChange?.(card.guid, pct);
  };

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
        { backgroundColor: checked ? withAlpha(palette.primary, 0.1) : palette.surface, borderColor: selected || checked ? palette.primary : palette.border, borderLeftColor: accent },
        selected ? { borderWidth: 2, borderLeftWidth: 4 } : null,
      ]}
    >
      {!!onToggleChecked && !readOnly && (
        <Pressable
          testID={`pm-kanban-check-${card.guid}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!checked }}
          accessibilityLabel={`Select ${card.name}`}
          hitSlop={6}
          onPress={() => onToggleChecked(card.guid)}
          style={[styles.check, { borderColor: checked ? palette.primary : palette.textMuted, backgroundColor: checked ? palette.primary : 'transparent' }]}
        >
          {checked && <Text style={styles.checkMark}>✓</Text>}
        </Pressable>
      )}
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={card.name} style={IS_WEB ? ({ cursor: readOnly ? 'pointer' : 'grab' } as any) : null}>
        <View style={[styles.titleRow, !!onToggleChecked && !readOnly ? { paddingRight: 24 } : null]}>
          {card.kind === 'milestone' && <PMTipIcon tip="Milestone" testID={`pm-kanban-ms-${card.guid}`} name="flag" size={14} color={palette.milestone} style={{ marginRight: 4 }} />}
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
            {card.name || '(no name)'}
          </Text>
          {card.critical && <View style={[styles.criticalDot, { backgroundColor: palette.critical }]} />}
        </View>
        <Text style={[styles.meta, { color: palette.textMuted }]} numberOfLines={1}>
          {[card.wbs, card.parentName, card.progress > 0 ? `Task: ${card.progress}%` : null].filter(Boolean).join(' · ')}
        </Text>
      </Pressable>
      <View style={styles.progressRow}>
        <Pressable
          testID={`pm-kanban-progress-track-${card.guid}`}
          accessibilityRole="adjustable"
          accessibilityLabel={`Kanban stage progress ${stageProgress}%`}
          accessibilityValue={{ min: 0, max: 100, now: stageProgress }}
          disabled={readOnly}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          onPress={onTrackPress}
          style={[
            styles.progressTrack,
            { backgroundColor: withAlpha(stageColor, 0.18) },
            IS_WEB && !readOnly ? ({ cursor: 'pointer' } as any) : null,
          ]}
        >
          <View style={[styles.progressFill, { width: `${stageProgress}%`, backgroundColor: stageColor }]} />
        </Pressable>
        {isEditingProgress ? (
          <TextInput
            ref={progressInputRef}
            testID={`pm-kanban-progress-input-${card.guid}`}
            value={progressInput}
            onChangeText={(t) => setProgressInput(t.replace(/[^0-9]/g, '').slice(0, 3))}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            onFocus={(e: any) => {
              const target = e.target ?? (progressInputRef.current as any);
              if (target && typeof target.select === 'function') {
                target.select();
              }
            }}
            onBlur={commitProgress}
            onSubmitEditing={commitProgress}
            style={[
              styles.progressInput,
              { color: palette.text, borderColor: palette.primary, backgroundColor: palette.surface },
            ]}
          />
        ) : (
          <Pressable
            testID={`pm-kanban-progress-badge-${card.guid}`}
            accessibilityRole="button"
            accessibilityLabel={`Edit stage progress, current ${stageProgress}%`}
            disabled={readOnly}
            onPress={(e) => {
              e.stopPropagation?.();
              if (!readOnly) {
                setProgressInput(String(stageProgress));
                setIsEditingProgress(true);
              }
            }}
            style={({ hovered }: any) => [
              styles.progressBadge,
              { borderColor: withAlpha(stageColor, 0.4) },
              hovered && !readOnly ? { backgroundColor: withAlpha(palette.primary, 0.12) } : null,
              IS_WEB && !readOnly ? ({ cursor: 'pointer' } as any) : null,
            ]}
          >
            <Text style={[styles.progressText, { color: palette.text }]}>{stageProgress}%</Text>
            {!readOnly && (
              <Text style={{ fontSize: 9, color: palette.textMuted, marginLeft: 2 }}>✎</Text>
            )}
          </Pressable>
        )}
      </View>
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
  check: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 13 },
  title: { flex: 1, fontSize: 13, fontWeight: '600' },
  criticalDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6, marginTop: 4 },
  meta: { fontSize: 11, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  progressTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 4 },
  progressBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 6, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1 },
  progressInput: { fontSize: 11, fontWeight: '600', marginLeft: 6, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, width: 44, textAlign: 'center' },
  progressText: { fontSize: 11, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
});
