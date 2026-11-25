// The font of the interface in the Paper (MD3) theme: every variant gets the family of the loaded file of ITS weight (no synthetic bold) and the size of the chosen step of the type scale.
import { FontName, FontSizeName, fontStackFor, isFontName, isFontSizeName, nativeFamilyFor, TYPE_SCALE } from './fontCatalog';

/** the size of the MD3 variants is the `medium` step; small / large scale all of them by the ratio of the body sizes */
export function sizeFactor(size: FontSizeName): number {
  const s = isFontSizeName(size) ? size : 'medium';
  return TYPE_SCALE.body[s].fontSize / TYPE_SCALE.body.medium.fontSize;
}

/** fontFamily for a Text: a loaded file on a phone and on the web (with the system stack as the fallback on the web), undefined on a phone for `system` */
export function textFamily(name: FontName, weight: number, web: boolean): string | undefined {
  const file = nativeFamilyFor(isFontName(name) ? name : 'system', weight);
  if (web) return file ? `${file}, ${fontStackFor('system')}` : fontStackFor('system');
  return file;
}

/** a Paper theme with the chosen font (the colors and the rest are untouched) */
export function applyFontsToPaperTheme<T extends { fonts: Record<string, any> }>(theme: T, name: FontName, size: FontSizeName, web: boolean): T {
  const factor = sizeFactor(size);
  const fonts: Record<string, any> = {};
  for (const [variant, f] of Object.entries(theme.fonts || {})) {
    const weight = parseInt(String((f as any)?.fontWeight ?? '400'), 10) || 400;
    const family = textFamily(name, weight, web);
    const next: any = { ...(f as any) };
    if (family) { next.fontFamily = family; next.fontWeight = 'normal'; }
    else if (web) next.fontFamily = fontStackFor('system');
    if (typeof next.fontSize === 'number') next.fontSize = Math.round(next.fontSize * factor * 10) / 10;
    if (typeof next.lineHeight === 'number') next.lineHeight = Math.round(next.lineHeight * factor);
    fonts[variant] = next;
  }
  return { ...theme, fonts };
}
