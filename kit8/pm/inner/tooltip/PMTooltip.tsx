// kit8/pm/inner/tooltip - tooltips ("tips") for every icon / hot zone in the PM module.
//   web:   hover for ~350 ms -> tip; leaving or pressing hides it
//   touch: long-press -> tip for 1.6 s (buttons keep their normal onPress)
// One <PMTooltipLayer/> per screen renders the bubble above everything, so tips are never
// clipped by toolbars / scroll views. Anything can request a tip via usePMTip() or showPMTip().
// Scopes: 'screen' (default) = the layer of the current screen; 'app' = the layer of the root layout,
// which covers the whole window - the app bar buttons use it (a screen layer starts BELOW the app bar,
// so a tip of an app bar button would be cut off there).

import { pmT } from '../../i18n/pmT';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

export type PMTipScope = 'screen' | 'app';

interface TipState {
  text: string | null;
  scope: PMTipScope;
  x: number; // target rect in window coordinates
  y: number;
  w: number;
  h: number;
  show: (text: string, x: number, y: number, w: number, h: number, scope?: PMTipScope) => void;
  hide: () => void;
}

const useTipStore = create<TipState>((set) => ({
  text: null,
  scope: 'screen',
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  show: (text, x, y, w, h, scope = 'screen') => set({ text, x, y, w, h, scope }),
  hide: () => set({ text: null }),
}));

const IS_WEB = Platform.OS === 'web';
const SHOW_DELAY_MS = 350;
const TOUCH_VISIBLE_MS = 1600;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function clearPending() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
}

/** Show a tip for a window-coordinate rect (used by the Skia canvases for bar handles). */
export function showPMTip(text: string, x: number, y: number, w = 0, h = 0, delay = SHOW_DELAY_MS, scope: PMTipScope = 'screen') {
  clearPending();
  pendingTimer = setTimeout(() => useTipStore.getState().show(pmT(text), x, y, w, h, scope), delay);
}

export function hidePMTip() {
  clearPending();
  if (useTipStore.getState().text) useTipStore.getState().hide();
}

/** Spread the result onto a Pressable: <Pressable {...usePMTip('Delete')} onPress={...} /> */
export function usePMTip(text: string | undefined, scope: PMTipScope = 'screen') {
  const ref = useRef<View>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const measureAndShow = useCallback(
    (delay: number) => {
      if (!text || !ref.current) return;
      ref.current.measureInWindow((x, y, w, h) => showPMTip(text, x, y, w, h, delay, scope));
    },
    [text, scope]
  );

  const onHoverIn = useCallback(() => measureAndShow(SHOW_DELAY_MS), [measureAndShow]);
  const onHoverOut = useCallback(() => hidePMTip(), []);
  const onLongPress = useCallback(() => {
    measureAndShow(0);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(hidePMTip, TOUCH_VISIBLE_MS);
  }, [measureAndShow]);

  return {
    ref,
    accessibilityHint: text,
    onHoverIn: IS_WEB ? onHoverIn : undefined,
    onHoverOut: IS_WEB ? onHoverOut : undefined,
    onPressIn: IS_WEB ? onHoverOut : undefined,
    onLongPress: IS_WEB ? undefined : onLongPress,
    delayLongPress: 350,
  };
}

/** Renders the bubble. Place once, as the last child of a screen's root View. */
export function PMTooltipLayer({ background = '#1e293b', color = '#f8fafc', scope = 'screen' }: { background?: string; color?: string; scope?: PMTipScope }) {
  const state = useTipStore();
  // a layer shows only the tips of its own scope
  const tip = state.scope === scope ? state : { ...state, text: null };
  const layerRef = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [bubble, setBubble] = useState({ w: 0, h: 0 });

  const measureLayer = useCallback(() => {
    layerRef.current?.measureInWindow((x, y, w, h) => setOrigin({ x, y, w, h }));
  }, []);
  useEffect(() => {
    if (tip.text) measureLayer();
  }, [tip.text, tip.x, tip.y, measureLayer]);
  useEffect(() => () => hidePMTip(), []);

  let left = 0;
  let top = 0;
  if (tip.text) {
    const cx = tip.x - origin.x + tip.w / 2;
    left = Math.max(4, Math.min(cx - bubble.w / 2, origin.w - bubble.w - 4));
    const below = tip.y - origin.y + tip.h + 6;
    top = below + bubble.h > origin.h - 4 ? tip.y - origin.y - bubble.h - 6 : below; // flip above near the bottom
  }

  return (
    <View ref={layerRef} pointerEvents="none" style={[StyleSheet.absoluteFill, scope === 'app' ? { zIndex: 9999 } : null]} onLayout={measureLayer}>
      {!!tip.text && (
        <View
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== bubble.w || height !== bubble.h) setBubble({ w: width, h: height });
          }}
          style={[styles.bubble, { backgroundColor: background, left, top, opacity: bubble.w ? 1 : 0 }]}
        >
          <Text style={[styles.text, { color }]}>{tip.text}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    maxWidth: 260,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 9999,
  },
  text: { fontSize: 12, fontWeight: '500' },
});
