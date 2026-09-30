// Skia fonts for the Gantt canvases. Skia on web (CanvasKit) has no access to system
// fonts, so matchFont() does not work there - bundled .ttf files work everywhere.
// Space Grotesk ships with the app already (@expo-google-fonts/space-grotesk).

import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { SkFont, Skia, SkTypeface, useFont } from '@shopify/react-native-skia';

/* eslint-disable @typescript-eslint/no-var-requires */
const REGULAR = Platform.OS !== 'web' ? require('@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf') : null;
const BOLD = Platform.OS !== 'web' ? require('@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf') : null;
/* eslint-enable @typescript-eslint/no-var-requires */

export const PM_FONT_SIZE = 12;
export const PM_FONT_SIZE_SMALL = 11;

const FONT_VERSION = '0.4.1';
const REGULAR_CANDIDATES = [
  '/fonts/SpaceGrotesk_400Regular.ttf',
  './fonts/SpaceGrotesk_400Regular.ttf',
  `https://cdn.jsdelivr.net/npm/@expo-google-fonts/space-grotesk@${FONT_VERSION}/400Regular/SpaceGrotesk_400Regular.ttf`,
];
const BOLD_CANDIDATES = [
  '/fonts/SpaceGrotesk_700Bold.ttf',
  './fonts/SpaceGrotesk_700Bold.ttf',
  `https://cdn.jsdelivr.net/npm/@expo-google-fonts/space-grotesk@${FONT_VERSION}/700Bold/SpaceGrotesk_700Bold.ttf`,
];

let cachedRegularTf: SkTypeface | null = null;
let cachedBoldTf: SkTypeface | null = null;
let preloadPromise: Promise<[SkTypeface | null, SkTypeface | null]> | null = null;

async function fetchFontBytes(urls: string[]): Promise<Uint8Array | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf && buf.byteLength > 1000) {
          return new Uint8Array(buf);
        }
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function createTypefaceFromBytes(bytes: Uint8Array | null): SkTypeface | null {
  if (!bytes) return null;
  try {
    const data = Skia.Data.fromBytes(bytes);
    return Skia.Typeface.MakeFreeTypeFaceFromData(data);
  } catch (e) {
    console.warn('[usePMFonts] MakeFreeTypeFaceFromData error:', e);
    return null;
  }
}

/** Preloads web Skia typefaces so they are ready when PMGanttSurface mounts. */
export function preloadPMFonts(): Promise<[SkTypeface | null, SkTypeface | null]> {
  if (Platform.OS !== 'web') return Promise.resolve([null, null]);
  if (cachedRegularTf && cachedBoldTf) return Promise.resolve([cachedRegularTf, cachedBoldTf]);
  if (!preloadPromise) {
    preloadPromise = (async () => {
      const [regBytes, boldBytes] = await Promise.all([
        fetchFontBytes(REGULAR_CANDIDATES),
        fetchFontBytes(BOLD_CANDIDATES),
      ]);

      if (regBytes) cachedRegularTf = createTypefaceFromBytes(regBytes);
      if (boldBytes) cachedBoldTf = createTypefaceFromBytes(boldBytes);

      return [cachedRegularTf, cachedBoldTf] as [SkTypeface | null, SkTypeface | null];
    })();
  }
  return preloadPromise;
}

export function usePMFonts() {
  const isWeb = Platform.OS === 'web';

  // Native (iOS/Android): standard react-native-skia font loading via asset ID
  const nativeReg = useFont(isWeb ? null : REGULAR, PM_FONT_SIZE);
  const nativeBold = useFont(isWeb ? null : BOLD, PM_FONT_SIZE);
  const nativeSmall = useFont(isWeb ? null : REGULAR, PM_FONT_SIZE_SMALL);
  const nativeSmallBold = useFont(isWeb ? null : BOLD, PM_FONT_SIZE_SMALL);

  // Web (CanvasKit): preloaded or async-loaded SkTypeface
  const [webTypefaces, setWebTypefaces] = useState(() => ({
    regular: cachedRegularTf,
    bold: cachedBoldTf,
  }));

  useEffect(() => {
    if (!isWeb) return;
    if (cachedRegularTf && cachedBoldTf) return;
    preloadPMFonts().then(([reg, bold]) => {
      setWebTypefaces({ regular: reg, bold });
    });
  }, [isWeb]);

  if (!isWeb) {
    return {
      regular: nativeReg,
      bold: nativeBold,
      small: nativeSmall,
      smallBold: nativeSmallBold,
      ready: !!(nativeReg && nativeBold && nativeSmall && nativeSmallBold),
    };
  }

  const regTf = webTypefaces.regular ?? cachedRegularTf;
  const bldTf = webTypefaces.bold ?? cachedBoldTf;

  const regular = useMemo(() => (regTf ? Skia.Font(regTf, PM_FONT_SIZE) : null), [regTf]);
  const bold = useMemo(() => (bldTf ? Skia.Font(bldTf, PM_FONT_SIZE) : null), [bldTf]);
  const small = useMemo(() => (regTf ? Skia.Font(regTf, PM_FONT_SIZE_SMALL) : null), [regTf]);
  const smallBold = useMemo(() => (bldTf ? Skia.Font(bldTf, PM_FONT_SIZE_SMALL) : null), [bldTf]);

  return {
    regular,
    bold,
    small,
    smallBold,
    ready: !!(regular && bold && small && smallBold),
  };
}

type Measurable = {
  getGlyphIDs: (text: string) => number[];
  getGlyphWidths: (glyphs: number[]) => number[];
} | null;

/**
 * Memo-friendly text width measurer. Uses glyph widths because SkFont.measureText is
 * not implemented on React Native Web (CanvasKit) - this works on every platform.
 */
export function makeMeasure(font: Measurable) {
  const cache = new Map<string, number>();
  return (text: string): number => {
    if (!font) return text.length * 6.5;
    const hit = cache.get(text);
    if (hit !== undefined) return hit;
    let w = 0;
    try {
      for (const gw of font.getGlyphWidths(font.getGlyphIDs(text))) w += gw;
    } catch {
      w = text.length * 6.5;
    }
    cache.set(text, w);
    return w;
  };
}
