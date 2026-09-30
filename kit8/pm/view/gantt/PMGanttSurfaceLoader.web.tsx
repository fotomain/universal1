// Web: React Native Skia draws through CanvasKit (WebAssembly). CanvasKit must be
// initialised BEFORE any module that imports @shopify/react-native-skia is evaluated,
// so the Skia surface is code-split and imported only after loadCanvasKit() resolves.
//
// canvaskit.wasm is served from /public (copied from node_modules/canvaskit-wasm/bin/full,
// `npx setup-skia-web public` does the same); if it is missing we fall back to the CDN
// build of the exact same canvaskit-wasm version.

import React, { Suspense } from 'react';
import { Text, View } from 'react-native';
// @ts-ignore - canvaskit-wasm ships no types for this entry point
import CanvasKitInit from 'canvaskit-wasm/bin/full/canvaskit';
import type { PMGanttSurfaceProps } from './PMGanttSurface';
import ActivityIndicatorCircleApp from '../../../components/activityindicator/ActivityIndicatorCircleApp';

const CANVASKIT_VERSION = '0.40.0'; // must match node_modules/canvaskit-wasm (react-native-skia 2.4.x)

let ckPromise: Promise<void> | null = null;

export function loadCanvasKit(): Promise<void> {
  const g = globalThis as any;
  if (g.CanvasKit) return Promise.resolve();
  if (!ckPromise) {
    const init = (locate: (file: string) => string) => CanvasKitInit({ locateFile: locate }) as Promise<unknown>;
    ckPromise = init((file) => `/${file}`)
      .catch(() => init((file) => `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full/${file}`))
      .then((ck) => {
        g.CanvasKit = ck;
      });
    ckPromise.catch(() => {
      ckPromise = null; // allow a retry on the next mount
    });
  }
  return ckPromise;
}

const LazySurface = React.lazy(() =>
  loadCanvasKit()
    .then(async () => {
      try {
        const { preloadPMFonts } = await import('../../skia/usePMFonts');
        await preloadPMFonts();
      } catch (e) {
        console.warn('[PMGanttSurfaceLoader] Font preload error:', e);
      }
    })
    .then(() => import('./PMGanttSurface'))
);

class SurfaceErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>The Gantt renderer could not start.</Text>
          <Text style={{ opacity: 0.7, textAlign: 'center' }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function PMGanttSurfaceLoader(props: PMGanttSurfaceProps) {
  return (
    <SurfaceErrorBoundary>
      <Suspense
        fallback={
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicatorCircleApp testID="pm-gantt-loading" />
          </View>
        }
      >
        <LazySurface {...props} />
      </Suspense>
    </SurfaceErrorBoundary>
  );
}
