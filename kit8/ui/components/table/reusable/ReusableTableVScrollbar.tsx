// ReusableTable - a vertical scrollbar for the mouse that stays at the RIGHT EDGE OF THE VISIBLE TABLE.
// The rows of a table of a fixed height scroll in a body ScrollView that sits inside the wide HORIZONTAL ScrollView: the native
// vertical indicator of that body lies at the far right end of the wide content, so it was seen only after scrolling sideways.
// This bar is OUTSIDE the horizontal scroll: a track beside it, aligned with the body (under the header row), a thumb you drag,
// a press on the track jumps there. The native indicator of the body is switched off (showsVerticalScrollIndicator={false}).
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, PanResponder, Pressable, ScrollView, View } from 'react-native';
import {
  EMPTY_VSCROLL, VSCROLL_BAR_WIDTH, VScrollMetrics, vOffsetAfterDrag, vOffsetForTrackPress, vScrollNeeded, vThumbHeight, vThumbTop,
} from './tableVScrollModel';

/** state + the props of the body ScrollView: `bodyProps` goes to the ScrollView, `metrics` + `scrollTo` to the bar */
export function useTableVScroll() {
  const ref = useRef<ScrollView>(null);
  const [metrics, setMetrics] = useState<VScrollMetrics>(EMPTY_VSCROLL);
  const patch = useCallback((p: Partial<VScrollMetrics>) => {
    setMetrics((m) => {
      const next = { ...m, ...p };
      return next.contentH === m.contentH && next.viewH === m.viewH && Math.abs(next.offsetY - m.offsetY) < 0.5 && next.bodyY === m.bodyY ? m : next;
    });
  }, []);
  const scrollTo = useCallback((y: number) => { ref.current?.scrollTo({ y, animated: false }); }, []);
  const bodyProps = useMemo(() => ({
    ref,
    scrollEventThrottle: 16,
    showsVerticalScrollIndicator: false,
    onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => patch({ offsetY: e.nativeEvent.contentOffset.y }),
    onContentSizeChange: (_w: number, h: number) => patch({ contentH: h }),
    onLayout: (e: LayoutChangeEvent) => patch({ viewH: e.nativeEvent.layout.height, bodyY: e.nativeEvent.layout.y }),
  }), [patch]);
  return { metrics, scrollTo, bodyProps };
}

type Props = {
  metrics: VScrollMetrics;
  scrollTo: (y: number) => void;
  /** colors of the table */
  thumbColor: string;
  trackColor: string;
  /** color of the part of the column beside the header row */
  headerColor: string;
  borderColor: string;
  testID: string;
};

export default function ReusableTableVScrollbar({ metrics, scrollTo, thumbColor, trackColor, headerColor, borderColor, testID }: Props) {
  const live = useRef({ metrics, scrollTo, startOffset: 0 });
  live.current.metrics = metrics;
  live.current.scrollTo = scrollTo;
  const [dragging, setDragging] = useState(false);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    // the thumb keeps the drag even when the pointer leaves the narrow track
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { live.current.startOffset = live.current.metrics.offsetY; setDragging(true); },
    onPanResponderMove: (_e, g) => live.current.scrollTo(vOffsetAfterDrag(live.current.metrics, live.current.startOffset, g.dy)),
    onPanResponderRelease: () => setDragging(false),
    onPanResponderTerminate: () => setDragging(false),
  }), []);

  if (!vScrollNeeded(metrics)) return null;
  const thumbH = vThumbHeight(metrics);
  return (
    <View testID={testID} style={{ width: VSCROLL_BAR_WIDTH, borderLeftWidth: 1, borderLeftColor: borderColor }}>
      {/* the part beside the header row */}
      <View style={{ height: metrics.bodyY, backgroundColor: headerColor, borderBottomWidth: metrics.bodyY > 0 ? 1 : 0, borderBottomColor: borderColor }} />
      <Pressable testID={`${testID}-track`} accessibilityRole="scrollbar" style={{ height: metrics.viewH, backgroundColor: trackColor }}
        onPress={(e: any) => scrollTo(vOffsetForTrackPress(live.current.metrics, e?.nativeEvent?.locationY ?? 0))}>
        <View testID={`${testID}-thumb`} {...pan.panHandlers}
          style={{ position: 'absolute', left: 2, right: 2, top: vThumbTop(metrics), height: thumbH, borderRadius: 5, backgroundColor: thumbColor, opacity: dragging ? 1 : 0.75 }} />
      </Pressable>
    </View>
  );
}
