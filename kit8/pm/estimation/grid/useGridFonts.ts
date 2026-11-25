// Fonts of the estimate grid for text that the font of the tree (Space Grotesk: Latin only) cannot draw - the norms of the Russian norm books are Cyrillic, the titles of the columns may be
// translated. A cell whose text has a character outside Latin + punctuation + currency signs is drawn with a FALLBACK font:
//   web      Roboto (Latin + Cyrillic + Greek), fetched only when such a text is on the screen: /fonts/Roboto_*.ttf of the app, else the CDN of the package (the same way usePMFonts fetches Space Grotesk);
//            CanvasKit has no system fonts. Until it has arrived (or without a network) the text is drawn with the normal font (boxes for the missing letters, as the task tree does).
//   native   the system font of the phone (it has them all)
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { matchFont, Skia, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { createTypefaceFromBytes, PM_FONT_SIZE } from '../../skia/usePMFonts';

const FONT_VERSION = '0.4.1';
const REGULAR = ['/fonts/Roboto_400Regular.ttf', './fonts/Roboto_400Regular.ttf', `https://cdn.jsdelivr.net/npm/@expo-google-fonts/roboto@${FONT_VERSION}/400Regular/Roboto_400Regular.ttf`];
const BOLD = ['/fonts/Roboto_700Bold.ttf', './fonts/Roboto_700Bold.ttf', `https://cdn.jsdelivr.net/npm/@expo-google-fonts/roboto@${FONT_VERSION}/700Bold/Roboto_700Bold.ttf`];

/** a character the Space Grotesk of the tree has no glyph for (anything outside Latin, Latin Extended, general punctuation and currency signs) */
export const needsFallbackFont = (text: string): boolean => /[^\u0000-ɏ -⁯₠-⃏←-⇿∀-⋿]/.test(text);

/** the first candidate that really is a font (a dev server answers an unknown /fonts/ path with its HTML page and status 200: the header of the file tells) */
async function fetchTtf(urls: string[]): Promise<Uint8Array | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const tag = String.fromCharCode(...bytes.slice(0, 4));
      if (bytes.length > 1000 && (tag === '\u0000\u0001\u0000\u0000' || tag === 'true' || tag === 'OTTO')) return bytes;
    } catch {
      // the next candidate
    }
  }
  return null;
}

let cached: { regular: SkTypeface | null; bold: SkTypeface | null } | null = null;
let loading: Promise<void> | null = null;
function loadWebTypefaces(): Promise<void> {
  if (cached) return Promise.resolve();
  if (!loading) {
    loading = Promise.all([fetchTtf(REGULAR), fetchTtf(BOLD)]).then(([r, b]) => {
      cached = { regular: createTypefaceFromBytes(r), bold: createTypefaceFromBytes(b) };
    });
  }
  return loading;
}

export interface GridFallbackFonts { regular: SkFont | null; bold: SkFont | null }

/** the fallback fonts; nothing is loaded until `wanted` (some visible text needs them) */
export function useGridFallbackFonts(wanted: boolean): GridFallbackFonts {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!wanted || Platform.OS !== 'web' || cached) return;
    let live = true;
    loadWebTypefaces().then(() => { if (live) setTick((n) => n + 1); }).catch(() => undefined);
    return () => { live = false; };
  }, [wanted]);
  const web = Platform.OS === 'web';
  const ready = wanted && (web ? !!cached : true);
  return useMemo<GridFallbackFonts>(() => {
    if (!ready) return { regular: null, bold: null };
    if (web) {
      return {
        regular: cached?.regular ? Skia.Font(cached.regular, PM_FONT_SIZE) : null,
        bold: cached?.bold ? Skia.Font(cached.bold, PM_FONT_SIZE) : null,
      };
    }
    const family = Platform.select({ ios: 'Helvetica', default: 'sans-serif' }) as string;
    try {
      return { regular: matchFont({ fontFamily: family, fontSize: PM_FONT_SIZE }), bold: matchFont({ fontFamily: family, fontSize: PM_FONT_SIZE, fontWeight: 'bold' }) };
    } catch {
      return { regular: null, bold: null };
    }
  }, [ready, web]);
}
