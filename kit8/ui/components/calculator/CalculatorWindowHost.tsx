// CalculatorWindowHost - the STANDALONE calculator window (app bar three dots menu -> Calculator). It floats over the screen: it is a plain absolutely
// positioned view (not a modal), so the main screen below stays usable - the user clicks in the window or in the screen and works with both. The title
// bar drags it (mouse and finger); it stays inside the screen; the place and the memory are kept while the app runs. Mounted once in app/_layout.tsx.
import React, { useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../common/IconApp';
import CalculatorApp, { CALCULATOR_WIDTH } from './CalculatorApp';
import { closeCalculatorWindow, setCalculatorWindowPosition, useCalculatorStore } from './calculatorStore';
import { useCalculatorTexts } from './calculatorTexts';

const TITLE_HEIGHT = 36;

/** keeps the window inside the screen (at least the title bar stays reachable) */
export function clampCalculatorWindow(x: number, y: number, winW: number, winH: number): { x: number; y: number } {
  const maxX = Math.max(0, winW - CALCULATOR_WIDTH - 2);
  const maxY = Math.max(0, winH - TITLE_HEIGHT - 2);
  return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
}

export default function CalculatorWindowHost() {
  const store = useCalculatorStore();
  if (!store.windowOpen) return null;
  return <CalculatorWindow />;
}

function CalculatorWindow() {
  const { themeColors: c } = useDesignSystem();
  const { tx } = useCalculatorTexts();
  const store = useCalculatorStore();
  const { width: winW, height: winH } = useWindowDimensions();
  const start = clampCalculatorWindow(store.windowX ?? winW - CALCULATOR_WIDTH - 24, store.windowY ?? 72, winW, winH);
  const [pos, setPos] = useState(start);
  const origin = useRef(start);
  const posRef = useRef(pos);
  posRef.current = pos;
  const size = useRef({ winW, winH });
  size.current = { winW, winH };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { origin.current = posRef.current; },
      onPanResponderMove: (_e, g) => {
        const p = clampCalculatorWindow(origin.current.x + g.dx, origin.current.y + g.dy, size.current.winW, size.current.winH);
        posRef.current = p;
        setPos(p);
      },
      onPanResponderRelease: () => setCalculatorWindowPosition(posRef.current.x, posRef.current.y),
      onPanResponderTerminate: () => setCalculatorWindowPosition(posRef.current.x, posRef.current.y),
    }),
  ).current;

  return (
    // box-none: only the window takes touches, everything around it goes to the screen below
    <View pointerEvents="box-none" style={styles.layer} testID="calculator-window-layer">
      <View testID="calculator-window" style={[styles.window, { left: pos.x, top: pos.y, width: CALCULATOR_WIDTH + 2, backgroundColor: c.background, borderColor: c.border }]}>
        <View
          testID="calculator-window-title"
          {...pan.panHandlers}
          {...(Platform.OS === 'web' ? ({ title: tx('drag') } as any) : {})}
          style={[styles.title, { backgroundColor: c.primary + '22', borderBottomColor: c.border }, Platform.OS === 'web' ? ({ cursor: 'move', userSelect: 'none' } as any) : null]}
        >
          <IconApp name="calculate" size={18} color={c.primary} />
          <Text style={[styles.titleText, { color: c.text }]} numberOfLines={1}>{tx('title')}</Text>
          <Pressable testID="calculator-window-x" accessibilityRole="button" accessibilityLabel={tx('close')} onPress={closeCalculatorWindow} hitSlop={8} style={styles.x}>
            <IconApp name="close" size={18} color={c.text} />
          </Pressable>
        </View>
        <CalculatorApp mode="window" testID="calculator-window-app" onCancel={closeCalculatorWindow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, elevation: 10000 },
  window: {
    position: 'absolute', borderWidth: 1, borderRadius: 14, overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 8px 28px rgba(0,0,0,0.32)' } as any, default: { elevation: 16, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } } }),
  },
  title: { height: TITLE_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: 1 },
  titleText: { flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600' },
  x: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
