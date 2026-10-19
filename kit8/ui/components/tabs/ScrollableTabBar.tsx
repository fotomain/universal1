// ScrollableTabBar - the row of a TOP TAB bar that scrolls left / right when the tabs do not fit (a narrow window, a phone, many tabs).
//   <ScrollableTabBar testID="x-tabs" style={styles.tabsBar}>{tabs}</ScrollableTabBar>
// `style` is the style the bar had as a plain row View (border, margin ...): it goes to the outer box; `gap` / `columnGap` go between the tabs; flexDirection / flexWrap are ignored (always ONE row).
// Touch: swipe. Web: the mouse wheel and shift + wheel scroll it; a chevron button shows at the edge that has more tabs (only while the tabs overflow), so a mouse user always has a way.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import IconApp from '../common/IconApp';

/** the pure side: which edges have more tabs behind them */
export function tabBarEdges(x: number, viewW: number, contentW: number): { left: boolean; right: boolean } {
  if (!(viewW > 0) || !(contentW > viewW + 1)) return { left: false, right: false };
  return { left: x > 2, right: x + viewW < contentW - 2 };
}

export interface ScrollableTabBarProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** colour of the chevron buttons (default: grey) */
  arrowColor?: string;
}

export default function ScrollableTabBar({ children, style, testID, arrowColor = '#888' }: ScrollableTabBarProps) {
  const { gap, columnGap, flexWrap: _w, flexDirection: _d, ...outer } = (StyleSheet.flatten(style) || {}) as ViewStyle;
  const ref = useRef<ScrollView>(null);
  const [m, setM] = useState({ x: 0, viewW: 0, contentW: 0 });
  const edges = tabBarEdges(m.x, m.viewW, m.contentW);

  const by = useCallback((dir: 1 | -1) => ref.current?.scrollTo({ x: Math.max(0, m.x + dir * Math.max(80, m.viewW * 0.6)), animated: true }), [m.x, m.viewW]);

  // web: the wheel scrolls the bar sideways (a vertical wheel has no other use over a tab bar)
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const node: any = (ref.current as any)?.getScrollableNode?.();
    if (!node?.addEventListener) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth) return;
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!dx) return;
      node.scrollLeft += dx;
      e.preventDefault();
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  const arrow = (dir: 1 | -1) => (
    <Pressable
      testID={testID ? `${testID}-${dir < 0 ? 'left' : 'right'}` : undefined}
      accessibilityLabel={dir < 0 ? 'Scroll tabs left' : 'Scroll tabs right'}
      onPress={() => by(dir)}
      hitSlop={6}
      style={styles.arrow}
    >
      <IconApp name={dir < 0 ? 'chevron_left' : 'chevron_right'} size={20} color={arrowColor} />
    </Pressable>
  );

  return (
    <View testID={testID} accessibilityRole="tablist" style={[outer, styles.box]}>
      {edges.left && arrow(-1)}
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={{ flexDirection: 'row', alignItems: 'stretch', gap: (gap ?? columnGap) as any }}
        scrollEventThrottle={32}
        onScroll={(e) => { const x = e.nativeEvent.contentOffset.x; setM((o) => (Math.abs(o.x - x) < 1 ? o : { ...o, x })); }}
        onLayout={(e) => { const viewW = e.nativeEvent.layout.width; setM((o) => (o.viewW === viewW ? o : { ...o, viewW })); }}
        onContentSizeChange={(contentW) => setM((o) => (o.contentW === contentW ? o : { ...o, contentW }))}
      >
        {children}
      </ScrollView>
      {edges.right && arrow(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'stretch' },
  scroll: { flex: 1, minWidth: 0 },
  arrow: { justifyContent: 'center', paddingHorizontal: 2 },
});
