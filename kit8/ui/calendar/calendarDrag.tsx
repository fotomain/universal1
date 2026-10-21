// Drag and drop of calendar entries (mouse on web, long press + drag on a phone).
// `createDragGesture` is the plain state machine (tested without a screen); `DragItem` is the view that
// uses it; the views give the geometry (`DragSpec`): pixels of the drag -> days and minutes.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { DRAG_SNAP_MINUTES, MoveDelta } from './data/userCalendarMove';

/** Pixels a finger / mouse may move and still be a tap. */
export const DRAG_THRESHOLD = 6;
/** Phones: how long to hold before the entry lifts (a quick swipe scrolls the page instead). */
export const DRAG_LONG_PRESS_MS = 350;

export interface DragGestureOptions {
  /** true = the drag starts only after a long press (touch screens: a swipe scrolls) */
  needsLongPress: boolean;
  onStart: () => void;
  onMove: (dx: number, dy: number) => void;
  onDrop: (dx: number, dy: number) => void;
  onCancel: () => void;
  onTap: () => void;
}

/** Pointer events in, tap / drag callbacks out. */
export function createDragGesture(o: DragGestureOptions) {
  let x0 = 0;
  let y0 = 0;
  let armed = false; // may drag as soon as it moves
  let dragging = false;
  let scrolled = false; // moved before the long press: not a tap, not a drag
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const far = (dx: number, dy: number) => Math.hypot(dx, dy) > DRAG_THRESHOLD;
  return {
    grant(x: number, y: number) {
      x0 = x;
      y0 = y;
      dragging = false;
      scrolled = false;
      armed = !o.needsLongPress;
      clear();
      if (o.needsLongPress) {
        timer = setTimeout(() => {
          timer = null;
          armed = true;
          dragging = true;
          o.onStart();
        }, DRAG_LONG_PRESS_MS);
      }
    },
    move(x: number, y: number) {
      const dx = x - x0;
      const dy = y - y0;
      if (!armed) {
        if (far(dx, dy)) {
          scrolled = true;
          clear();
        }
        return;
      }
      if (!dragging) {
        if (!far(dx, dy)) return;
        dragging = true;
        o.onStart();
      }
      o.onMove(dx, dy);
    },
    release(x: number, y: number) {
      clear();
      const dx = x - x0;
      const dy = y - y0;
      if (dragging) {
        dragging = false;
        o.onDrop(dx, dy);
      } else if (!scrolled && !far(dx, dy)) o.onTap();
      armed = false;
    },
    terminate() {
      clear();
      if (dragging) o.onCancel();
      dragging = false;
      armed = false;
    },
    /** false while an entry is held: the scroll view must not take the touch away */
    canTerminate: () => !dragging,
    isDragging: () => dragging,
  };
}

export const snapMinutes = (minutes: number) => Math.round(minutes / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;

/** Week / Day grid: a column is `colW` wide, an hour `hourH` high. */
export function timeGridDelta(dx: number, dy: number, colW: number, hourH: number): MoveDelta {
  return { dayDelta: colW > 0 ? Math.round(dx / colW) : 0, minuteDelta: snapMinutes((dy / hourH) * 60) };
}

/** Month grid and all-day band: whole days; a row of the month is one week. */
export function monthDelta(dx: number, dy: number, cellW: number, rowH: number): MoveDelta {
  return { dayDelta: (cellW > 0 ? Math.round(dx / cellW) : 0) + (rowH > 0 ? 7 * Math.round(dy / rowH) : 0), minuteDelta: 0 };
}

export interface DragSpec {
  delta: (dx: number, dy: number) => MoveDelta;
  /** where the snapped entry is drawn while it is held (time grid); without it the entry only fades */
  offset?: (d: MoveDelta) => { x: number; y: number };
  /** the drop target moves (month cell / day header highlight); null = the drag ended */
  hover?: (d: MoveDelta | null) => void;
}

export interface DragItemProps {
  testID?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
  spec: DragSpec;
  onTap: () => void;
  onDrop: (d: MoveDelta) => void;
  children: React.ReactNode;
}

/** A tappable, draggable entry. Plain responder events, so it works the same inside a ScrollView. */
export function DragItem({ testID, label, style, spec, onTap, onDrop, children }: DragItemProps) {
  const [held, setHeld] = useState<{ x: number; y: number } | null>(null);
  const latest = useRef({ spec, onTap, onDrop });
  latest.current = { spec, onTap, onDrop };
  const gesture = useMemo(
    () =>
      createDragGesture({
        needsLongPress: Platform.OS !== 'web',
        onStart: () => setHeld({ x: 0, y: 0 }),
        onMove: (dx, dy) => {
          const { spec: s } = latest.current;
          const d = s.delta(dx, dy);
          setHeld(s.offset ? s.offset(d) : { x: 0, y: 0 });
          s.hover?.(d);
        },
        onDrop: (dx, dy) => {
          const { spec: s, onDrop: drop } = latest.current;
          const d = s.delta(dx, dy);
          s.hover?.(null);
          setHeld(null);
          if (d.dayDelta || d.minuteDelta) drop(d);
        },
        onCancel: () => {
          latest.current.spec.hover?.(null);
          setHeld(null);
        },
        onTap: () => latest.current.onTap(),
      }),
    []
  );
  useEffect(() => () => gesture.terminate(), [gesture]);
  const at = (e: any) => [e.nativeEvent.pageX as number, e.nativeEvent.pageY as number] as const;
  const webOnly = (Platform.OS === 'web' ? { cursor: held ? 'grabbing' : 'grab', userSelect: 'none' } : {}) as ViewStyle;
  return (
    <View
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => gesture.canTerminate()}
      onResponderGrant={(e) => gesture.grant(...at(e))}
      onResponderMove={(e) => gesture.move(...at(e))}
      onResponderRelease={(e) => gesture.release(...at(e))}
      onResponderTerminate={() => gesture.terminate()}
      style={[style, webOnly, held && { zIndex: 50, elevation: 6, opacity: spec.offset ? 0.9 : 0.5, transform: [{ translateX: held.x }, { translateY: held.y }] }]}
    >
      {children}
    </View>
  );
}
