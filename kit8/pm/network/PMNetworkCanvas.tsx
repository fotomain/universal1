// Scrollable, zoomable surface of the network view (pure React Native + react-native-svg,
// no Skia: works on iOS / Android / web without CanvasKit).
//   scroll = two nested ScrollViews (both directions, native momentum)
//   zoom   = the children lay out with `zoom` (crisp text at every zoom, no bitmap scaling);
//            toolbar buttons, Fit, and ctrl/⌘ + wheel on web
// Tapping the empty background clears the selection.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

export const PM_NET_ZOOM_MIN = 0.3;
export const PM_NET_ZOOM_MAX = 2.2;
export const PM_NET_ZOOM_STEP = 1.25;

export const clampZoom = (z: number) => Math.max(PM_NET_ZOOM_MIN, Math.min(PM_NET_ZOOM_MAX, z));

/** Zoom that shows the whole content (never enlarges above 1). */
export function fitZoom(contentW: number, contentH: number, viewW: number, viewH: number): number {
  if (!(contentW > 0 && contentH > 0 && viewW > 0 && viewH > 0)) return 1;
  return clampZoom(Math.min(1, (viewW - 8) / contentW, (viewH - 8) / contentH));
}

/**
 * Zoom state of one network view: fits the content once per `fitKey` (project / variant),
 * then follows the toolbar buttons and ctrl+wheel.
 */
export function useNetworkZoom(contentW: number, contentH: number, fitKey: string) {
  const [zoom, setZoomState] = useState(1);
  const view = useRef({ w: 0, h: 0 });
  const fittedKey = useRef<string | null>(null);
  const size = useRef({ w: contentW, h: contentH });
  size.current = { w: contentW, h: contentH };
  const setZoom = useCallback((z: number) => setZoomState(clampZoom(z)), []);
  const fit = useCallback(() => setZoomState(fitZoom(size.current.w, size.current.h, view.current.w, view.current.h)), []);
  const tryAutoFit = useCallback(() => {
    if (fittedKey.current === fitKey || !view.current.w || !size.current.w) return;
    fittedKey.current = fitKey;
    setZoomState(fitZoom(size.current.w, size.current.h, view.current.w, view.current.h));
  }, [fitKey]);
  useEffect(tryAutoFit, [tryAutoFit, contentW, contentH]);
  const onViewport = useCallback(
    (w: number, h: number) => {
      view.current = { w, h };
      tryAutoFit();
    },
    [tryAutoFit],
  );
  return {
    zoom,
    setZoom,
    fit,
    onViewport,
    zoomIn: () => setZoomState((z) => clampZoom(z * PM_NET_ZOOM_STEP)),
    zoomOut: () => setZoomState((z) => clampZoom(z / PM_NET_ZOOM_STEP)),
  };
}

export default function PMNetworkCanvas({
  contentW,
  contentH,
  zoom,
  onZoom,
  onViewport,
  background,
  onBackgroundPress,
  children,
  testID,
}: {
  /** content size at zoom 1 */
  contentW: number;
  contentH: number;
  zoom: number;
  onZoom: (zoom: number) => void;
  onViewport?: (w: number, h: number) => void;
  background: string;
  onBackgroundPress?: () => void;
  children: React.ReactNode;
  testID?: string;
}) {
  const rootRef = useRef<View>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const [, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    onViewport?.(width, height);
  };

  // web: ctrl / ⌘ + wheel (and trackpad pinch, which the browser reports as ctrl+wheel) = zoom
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = rootRef.current as unknown as HTMLElement | null;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      onZoom(clampZoom(zoomRef.current * Math.exp(-e.deltaY * 0.0025)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onZoom]);

  const w = Math.ceil(contentW * zoom);
  const h = Math.ceil(contentH * zoom);
  return (
    <View ref={rootRef} style={[styles.root, { backgroundColor: background }]} onLayout={onLayout} testID={testID}>
      <ScrollView style={styles.fill} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator>
        <ScrollView horizontal style={styles.fill} contentContainerStyle={{ flexGrow: 1 }} showsHorizontalScrollIndicator>
          <Pressable
            onPress={onBackgroundPress}
            accessible={false}
            style={[{ width: w, height: h, minWidth: '100%' as any }, Platform.OS === 'web' ? ({ cursor: 'default' } as any) : null]}
          >
            <View style={{ width: w, height: h }}>{children}</View>
          </Pressable>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fill: { flex: 1 },
});
