// One Kanban column = one stage of project_kanban_stage_table. The whole column is a
// react-native-reanimated-dnd Droppable (cards dropped anywhere in it land in this stage; the
// place inside the column is computed by the dashboard from the drop position).
// Highlighted while a card or a tree row is dragged over it.

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { PMIconButton } from '../../inner/buttons/PMIconButton';
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
  onProgressChange?: (guid: string, percent: number) => void;
  /** multi selection (round check boxes): checked rows of the PM store */
  checkedGUIDs?: Record<string, true>;
  onToggleChecked?: (guid: string) => void;
  /** sorting of this column: field title + direction (undefined = saved card order) */
  sortLabel?: string;
  sortDirection?: 'asc' | 'desc';
  /** header buttons / right-click (touch: long-press) of the header: window point */
  onOpenSort?: (stageGUID: string, x: number, y: number) => void;
  onOpenMenu?: (stageGUID: string, x: number, y: number) => void;
}

const pointOf = (e: any): { x: number; y: number } => {
  const n = e?.nativeEvent ?? e ?? {};
  return { x: n.pageX ?? n.clientX ?? 0, y: n.pageY ?? n.clientY ?? 0 };
};

export default function PMKanbanColumn(p: PMKanbanColumnProps) {
  const { column, palette } = p;
  const stage = column.stage;
  const color = kanbanStageColorOf(stage.rowJSON);
  const wip = stage.rowJSON.wipLimit && stage.rowJSON.wipLimit > 0 ? stage.rowJSON.wipLimit : 0;
  const overWip = wip > 0 && column.cards.length > wip;
  const headerRef = React.useRef<View>(null);
  /** window point under the header (buttons report no usable point on every platform) */
  const openAt = (fn: ((stageGUID: string, x: number, y: number) => void) | undefined, e?: any) => {
    if (!fn) return;
    const p = pointOf(e);
    if (p.x || p.y) return fn(stage.rowGUID, p.x, p.y);
    const node: any = headerRef.current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, w: number, h: number) => fn(stage.rowGUID, x + w - 200, y + h));
    else fn(stage.rowGUID, 0, 0);
  };
  // web: right-click the header = column menu
  React.useEffect(() => {
    if (Platform.OS !== 'web' || p.readOnly) return;
    const el = headerRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      p.onOpenMenu?.(stage.rowGUID, e.clientX, e.clientY);
    };
    el.addEventListener('contextmenu', onCtx);
    return () => el.removeEventListener('contextmenu', onCtx);
  }, [p.onOpenMenu, p.readOnly, stage.rowGUID]); // eslint-disable-line react-hooks/exhaustive-deps

  const content = (
    <>
      <Pressable
        ref={headerRef}
        testID={`pm-kanban-colhead-${stage.rowGUID}`}
        onLongPress={p.readOnly ? undefined : (e) => openAt(p.onOpenMenu, e)}
        delayLongPress={450}
        style={[styles.header, { borderBottomColor: color }]}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {stage.rowJSON.stageName || '—'}
          </Text>
          {!!p.sortLabel && (
            <Text style={[styles.sortText, { color: palette.primary }]} numberOfLines={1} testID={`pm-kanban-colsortlabel-${stage.rowGUID}`}>
              {p.sortDirection === 'desc' ? '↓' : '↑'} {p.sortLabel}
            </Text>
          )}
        </View>
        <Text style={[styles.count, { color: overWip ? palette.error : palette.textMuted, borderColor: overWip ? palette.error : palette.border }]}>
          {wip ? `${column.cards.length}/${wip}` : column.cards.length}
        </Text>
        {!!p.onOpenSort && (
          <PMIconButton
            compact
            size={16}
            testID={`pm-kanban-colsort-${stage.rowGUID}`}
            icon="sort"
            title={p.sortLabel ? `Sorted by ${p.sortLabel} - change the sorting` : 'Sort the cards of this column'}
            color={p.sortLabel ? palette.primary : palette.text}
            onPress={() => openAt(p.onOpenSort)}
          />
        )}
        {!!p.onOpenMenu && !p.readOnly && (
          <PMIconButton
            compact
            size={16}
            testID={`pm-kanban-colmenu-${stage.rowGUID}`}
            icon="more_vert"
            title="Column menu: select all tasks, clear the column"
            color={palette.text}
            onPress={() => openAt(p.onOpenMenu)}
          />
        )}
      </Pressable>
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
            onProgressChange={p.onProgressChange}
            checked={!!p.checkedGUIDs?.[card.guid]}
            onToggleChecked={p.onToggleChecked}
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
  title: { fontWeight: '700', fontSize: 13 },
  sortText: { fontSize: 10, fontWeight: '600' },
  count: { fontSize: 11, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden' },
  body: { padding: 8 },
  empty: { fontSize: 12, textAlign: 'center', paddingVertical: 18, borderWidth: 1, borderStyle: 'dashed', borderRadius: 8 },
});
