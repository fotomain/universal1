// A small group of mutually exclusive icon buttons (same look as the Gantt bar's
// "Dependency arrows" selector). Used by GanttToggleButtons and the
// variant toggles of PMNetworkDiagram / PMNetworkSchedule.
//
// onReorder (optional) makes the buttons draggable: press and drag a button sideways (touch: long-press
// first, so a plain swipe still scrolls) and drop it between the others -> onReorder(new order of the values).

import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { PMIconButton } from '../../inner/buttons/PMIconButton';

export interface PMSegmentOption<T extends string> {
  value: T;
  icon: string;
  /** optional visible text next to the icon */
  label?: string;
  /** tip */
  title: string;
}

const IS_COARSE =
  Platform.OS !== 'web' ||
  (typeof window !== 'undefined' && typeof (window as any).matchMedia === 'function' && !!(window as any).matchMedia('(pointer: coarse)')?.matches);

/** New order after `moved` was dropped with its center at `center` (layouts: x / width of every button before the drag). */
export function reorderByDrop<T extends string>(order: T[], moved: T, center: number, layouts: Record<string, { x: number; w: number }>): T[] {
  const others = order.filter((v) => v !== moved);
  let index = 0;
  for (const v of others) {
    const l = layouts[v];
    if (l && l.x + l.w / 2 < center) index += 1;
  }
  const out = [...others];
  out.splice(index, 0, moved);
  return out;
}

function DraggableSegment<T extends string>({
  value,
  onDragStart,
  onDragMove,
  onDragEnd,
  offset,
  onLayoutItem,
  children,
}: {
  value: T;
  onDragStart: (v: T) => void;
  onDragMove: (dx: number) => void;
  onDragEnd: (v: T, dx: number) => void;
  offset: number | null;
  onLayoutItem: (v: T, x: number, w: number) => void;
  children: React.ReactNode;
}) {
  const pan = React.useMemo(() => {
    const g = Gesture.Pan()
      .runOnJS(true)
      .onStart(() => onDragStart(value))
      .onChange((e) => onDragMove(e.translationX))
      .onEnd((e) => onDragEnd(value, e.translationX));
    if (IS_COARSE) g.activateAfterLongPress(260);
    else g.minDistance(8);
    return g;
  }, [value, onDragStart, onDragMove, onDragEnd]);
  return (
    <GestureDetector gesture={pan}>
      <View
        testID={`pm-segment-drag-${value}`}
        onLayout={(e) => onLayoutItem(value, e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
        style={offset === null ? null : { zIndex: 20, opacity: 0.85, transform: [{ translateX: offset }] }}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

export default function PMSegmentedIconButtons<T extends string>({
  options,
  value,
  onChange,
  color,
  activeColor,
  border,
  testID,
  onReorder,
}: {
  options: PMSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  color: string;
  activeColor: string;
  border: string;
  testID: string;
  /** makes the buttons draggable: called with the new order of the values */
  onReorder?: (order: T[]) => void;
}) {
  const layouts = useRef<Record<string, { x: number; w: number }>>({});
  const [drag, setDrag] = useState<{ value: T; dx: number } | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const onDragStart = React.useCallback((v: T) => setDrag({ value: v, dx: 0 }), []);
  const onDragMove = React.useCallback((dx: number) => setDrag((d) => (d ? { ...d, dx } : d)), []);
  const onDragEnd = React.useCallback((v: T, dx: number) => {
    setDrag(null);
    const l = layouts.current[v];
    if (!l || !onReorderRef.current) return;
    const order = optionsRef.current.map((o) => o.value);
    const next = reorderByDrop(order, v, l.x + l.w / 2 + dx, layouts.current);
    if (next.some((x, i) => x !== order[i])) onReorderRef.current(next);
  }, []);
  const onLayoutItem = React.useCallback((v: T, x: number, w: number) => {
    layouts.current[v] = { x, w };
  }, []);

  return (
    <View style={[styles.group, { borderColor: border }]} testID={testID} accessibilityRole="radiogroup">
      {options.map((o) => {
        const button = (
          <PMIconButton
            key={o.value}
            testID={`${testID}-${o.value}`}
            icon={o.icon}
            label={o.label}
            title={o.title}
            active={value === o.value}
            activeColor={activeColor}
            color={color}
            onPress={() => value !== o.value && onChange(o.value)}
          />
        );
        if (!onReorder) return button;
        return (
          <DraggableSegment
            key={o.value}
            value={o.value}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            offset={drag && drag.value === o.value ? drag.dx : null}
            onLayoutItem={onLayoutItem}
          >
            {button}
          </DraggableSegment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    paddingLeft: 2,
    marginHorizontal: 2,
  },
});
