// ReusableTable - one column header. dragAndDropColumns: drag the header left / right to move the column;
// resizeColumnWidth: drag the separator at its right edge to change the width. Mouse and touch (PanResponder).
import React, { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export interface ReusableTableHeaderCellProps {
  columnKey: string;
  title: string;
  width: number;
  justify: 'flex-start' | 'center' | 'flex-end';
  colors: { text: string; primary: string; border: string; background: string };
  draggable: boolean;
  resizable: boolean;
  /** released after a horizontal drag of dx px */
  onDragEnd: (columnKey: string, dx: number) => void;
  /** while the separator is dragged: the new width */
  onResize: (columnKey: string, width: number) => void;
  /** separator released: the final width */
  onResizeEnd?: (columnKey: string, width: number) => void;
  /** uxuiTable.verticalDelimitersForColumnNames: line at the right edge */
  delimiter?: boolean;
  /** "Filter & sort" button ▾ (undefined = the column has none) */
  onMenu?: (columnKey: string, x: number, y: number) => void;
  /** the table is sorted by this column */
  sortDirection?: 'asc' | 'desc' | null;
  /** this column has a filter */
  filtered?: boolean;
  testID: string;
}

const GRIP_W = 10;

export default function ReusableTableHeaderCell({ columnKey, title, width, justify, colors, draggable, resizable, onDragEnd, onResize, onResizeEnd, onMenu, sortDirection, filtered, delimiter, testID }: ReusableTableHeaderCellProps) {
  const dragX = useRef(new Animated.Value(0)).current;
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  // the handlers are created once: the current props are read through this ref
  const live = useRef({ width, onDragEnd, onResize, onResizeEnd, columnKey });
  live.current = { width, onDragEnd, onResize, onResizeEnd, columnKey };
  const startWidth = useRef(width);

  const drag = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => setDragging(true),
    onPanResponderMove: (_e, g) => dragX.setValue(g.dx),
    onPanResponderRelease: (_e, g) => { setDragging(false); dragX.setValue(0); live.current.onDragEnd(live.current.columnKey, g.dx); },
    onPanResponderTerminate: () => { setDragging(false); dragX.setValue(0); },
    onPanResponderTerminationRequest: () => false,
  }), [dragX]);

  const resize = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { startWidth.current = live.current.width; setResizing(true); },
    onPanResponderMove: (_e, g) => live.current.onResize(live.current.columnKey, startWidth.current + g.dx),
    onPanResponderRelease: (_e, g) => { setResizing(false); live.current.onResizeEnd?.(live.current.columnKey, startWidth.current + g.dx); },
    onPanResponderTerminate: () => setResizing(false),
    onPanResponderTerminationRequest: () => false,
  }), []);

  return (
    <Animated.View
      testID={`${testID}-header-${columnKey}`}
      style={[styles.cell, delimiter && !resizable ? { borderRightWidth: 1, borderRightColor: colors.border } : null, { width, zIndex: dragging ? 10 : 0, transform: [{ translateX: dragX }], backgroundColor: dragging ? colors.primary + '22' : 'transparent' }]}
    >
      <View
        {...(draggable ? drag.panHandlers : {})}
        style={[styles.label, { justifyContent: justify }, Platform.OS === 'web' && draggable ? ({ cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' } as any) : null]}
      >
        <Text numberOfLines={1} selectable={false} style={[styles.text, { color: colors.text }]}>{title}</Text>
      </View>
      {!!onMenu && (
        <Pressable
          testID={`${testID}-column-menu-button-${columnKey}`}
          accessibilityLabel={`Filter and sort ${title}`}
          hitSlop={4}
          onPress={(e: any) => onMenu(columnKey, e?.nativeEvent?.pageX ?? 0, (e?.nativeEvent?.pageY ?? 0) + 12)}
          style={styles.menuBtn}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: sortDirection || filtered ? colors.primary : colors.text + '70' }}>
            {filtered ? '● ' : ''}{sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : filtered ? '' : '▾'}
          </Text>
        </Pressable>
      )}
      {resizable && (
        <View
          {...resize.panHandlers}
          testID={`${testID}-resize-${columnKey}`}
          accessibilityLabel={`Resize column ${title}`}
          style={[styles.grip, Platform.OS === 'web' ? ({ cursor: 'col-resize', userSelect: 'none' } as any) : null]}
        >
          <View style={{ width: resizing ? 3 : 1, alignSelf: 'stretch', backgroundColor: resizing ? colors.primary : delimiter ? colors.border : 'transparent' }} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: { flexDirection: 'row', alignItems: 'stretch', alignSelf: 'stretch' },
  label: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 6 },
  text: { fontSize: 13, fontWeight: '700' },
  menuBtn: { paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  grip: { width: GRIP_W, alignItems: 'flex-end', justifyContent: 'center' },
});
