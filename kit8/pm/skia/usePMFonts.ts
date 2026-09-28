// Skia fonts for the Gantt canvases. Skia on web (CanvasKit) has no access to system
// fonts, so matchFont() does not work there - bundled .ttf files work everywhere.
// Space Grotesk ships with the app already (@expo-google-fonts/space-grotesk).

import { useFont } from '@shopify/react-native-skia';

/* eslint-disable @typescript-eslint/no-var-requires */
const REGULAR = require('@expo-google-fonts/space-grotesk/400Regular/SpaceGrotesk_400Regular.ttf');
const BOLD = require('@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf');
/* eslint-enable @typescript-eslint/no-var-requires */

export const PM_FONT_SIZE = 12;
export const PM_FONT_SIZE_SMALL = 11;

export function usePMFonts() {
  const regular = useFont(REGULAR, PM_FONT_SIZE);
  const bold = useFont(BOLD, PM_FONT_SIZE);
  const small = useFont(REGULAR, PM_FONT_SIZE_SMALL);
  const smallBold = useFont(BOLD, PM_FONT_SIZE_SMALL);
  return { regular, bold, small, smallBold, ready: !!(regular && bold && small && smallBold) };
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
    for (const gw of font.getGlyphWidths(font.getGlyphIDs(text))) w += gw;
    cache.set(text, w);
    return w;
  };
}
