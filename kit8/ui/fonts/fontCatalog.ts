// The fonts of the interface (documentation/USER_SETTINGS_TABLE_WBS.html, section Fonts / Sizes). PURE: no React, no react-native, no expo-font (the files are required in fontAssets.ts).
//   system  = the font the device or the browser has (no file); roboto / inter / selawik = bundled open fonts (assets/fonts, licenses next to them).
// San Francisco (the system font of Apple) may NOT be shipped as a file: `system` asks the device for it (CSS system-ui / the native system font).

export type FontName = 'system' | 'roboto' | 'inter' | 'selawik';
export type FontSizeName = 'small' | 'medium' | 'large';
export type FontRole = 'body' | 'header' | 'label' | 'title';

export const FONT_NAMES: FontName[] = ['system', 'roboto', 'inter', 'selawik'];
export const FONT_SIZE_NAMES: FontSizeName[] = ['small', 'medium', 'large'];
export const FONT_LABELS: Record<FontName, string> = { system: 'System', roboto: 'Roboto', inter: 'Inter', selawik: 'Selawik' };
export const FONT_SIZE_LABELS: Record<FontSizeName, string> = { small: 'Small', medium: 'Medium', large: 'Large' };

/** The names of the loaded files (the keys of fontAssets.ts, also the fontFamily on a phone) by weight. A weight a family lacks maps to the nearest one (Selawik has no 500). */
export const FONT_FILES: Record<Exclude<FontName, 'system'>, Record<number, string>> = {
  roboto: { 400: 'Roboto_400Regular', 500: 'Roboto_500Medium', 700: 'Roboto_700Bold' },
  inter: { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' },
  selawik: { 300: 'Selawik_300Light', 350: 'Selawik_350Semilight', 400: 'Selawik_400Regular', 600: 'Selawik_600SemiBold', 700: 'Selawik_700Bold' },
};
/** italic files (only Roboto ships one) */
export const FONT_ITALIC_FILES: Partial<Record<FontName, string>> = { roboto: 'Roboto_400Regular_Italic' };

/** CSS font stacks (web). Every choice ends with the system stack: a font that has not arrived yet shows the system font, never a blank text. */
export const SYSTEM_SANS_STACK = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const SYSTEM_SERIF_STACK = "ui-serif, 'New York', Georgia, serif";
export const SYSTEM_MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, 'Cascadia Mono', Consolas, monospace";
const CSS_NAMES: Record<Exclude<FontName, 'system'>, string> = { roboto: 'Roboto', inter: 'Inter', selawik: 'Selawik' };

export function fontStackFor(name: FontName): string {
  return name === 'system' ? SYSTEM_SANS_STACK : `${CSS_NAMES[name]}, ${SYSTEM_SANS_STACK}`;
}

export function isFontName(v: unknown): v is FontName {
  return typeof v === 'string' && (FONT_NAMES as string[]).includes(v);
}
export function isFontSizeName(v: unknown): v is FontSizeName {
  return typeof v === 'string' && (FONT_SIZE_NAMES as string[]).includes(v);
}

/** the file weight nearest to the wanted weight (ties go to the heavier one) */
export function nearestWeight(available: number[], wanted: number): number {
  let best = available[0];
  for (const w of available) {
    const d = Math.abs(w - wanted);
    const bd = Math.abs(best - wanted);
    if (d < bd || (d === bd && w > best)) best = w;
  }
  return best;
}

/** The family name for React Native (phone and web): the loaded file of the wanted weight, or undefined for `system` (= no fontFamily = the system font). */
export function nativeFamilyFor(name: FontName, weight = 400, italic = false): string | undefined {
  if (name === 'system') return undefined;
  if (italic && FONT_ITALIC_FILES[name]) return FONT_ITALIC_FILES[name];
  const files = FONT_FILES[name];
  const w = nearestWeight(Object.keys(files).map(Number), weight);
  return files[w];
}

/** Material 3 type scale as the Angular Material 3 gives it: size px, line height px, letter spacing px, weight */
export interface TypeStep { fontSize: number; lineHeight: number; letterSpacing: number; fontWeight: number }

export const TYPE_SCALE: Record<FontRole, Record<FontSizeName, TypeStep>> = {
  // data cell / input text: body-small, body-medium, body-large
  body: {
    small: { fontSize: 12, lineHeight: 16, letterSpacing: 0.4, fontWeight: 400 },
    medium: { fontSize: 14, lineHeight: 20, letterSpacing: 0.25, fontWeight: 400 },
    large: { fontSize: 16, lineHeight: 24, letterSpacing: 0.5, fontWeight: 400 },
  },
  // header of a table: label-medium, title-small, title-medium
  header: {
    small: { fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontWeight: 500 },
    medium: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: 500 },
    large: { fontSize: 16, lineHeight: 24, letterSpacing: 0.15, fontWeight: 500 },
  },
  // label above an input: label-small, label-medium, label-large
  label: {
    small: { fontSize: 11, lineHeight: 16, letterSpacing: 0.5, fontWeight: 500 },
    medium: { fontSize: 12, lineHeight: 16, letterSpacing: 0.5, fontWeight: 500 },
    large: { fontSize: 14, lineHeight: 20, letterSpacing: 0.1, fontWeight: 500 },
  },
  // title of a screen / card: title-medium, title-large, headline-small
  title: {
    small: { fontSize: 16, lineHeight: 24, letterSpacing: 0.15, fontWeight: 500 },
    medium: { fontSize: 22, lineHeight: 28, letterSpacing: 0, fontWeight: 400 },
    large: { fontSize: 24, lineHeight: 32, letterSpacing: 0, fontWeight: 400 },
  },
};

export interface FontChoice { fontName: FontName; fontSize: FontSizeName; fontWeight?: number }

/** what a Text needs: the family (undefined = the system font on a phone), the css stack (web), the size numbers */
export interface ResolvedFont extends TypeStep {
  /** React Native fontFamily: the loaded file, undefined for `system` */
  fontFamily: string | undefined;
  /** CSS font-family (web), the system stack as the fallback */
  cssFontFamily: string;
}

export function resolveFont(choice: FontChoice, role: FontRole = 'body'): ResolvedFont {
  const name = isFontName(choice.fontName) ? choice.fontName : 'system';
  const size = isFontSizeName(choice.fontSize) ? choice.fontSize : 'medium';
  const step = TYPE_SCALE[role][size];
  const weight = typeof choice.fontWeight === 'number' ? choice.fontWeight : step.fontWeight;
  return { ...step, fontWeight: weight, fontFamily: nativeFamilyFor(name, weight), cssFontFamily: fontStackFor(name) };
}

/** every file name the registry names (for the test that the files exist, and for the loader) */
export function allFontFileNames(): string[] {
  const out: string[] = [];
  for (const files of Object.values(FONT_FILES)) out.push(...Object.values(files));
  out.push(...(Object.values(FONT_ITALIC_FILES) as string[]));
  return out;
}

/** Row height of a table whose data cells use this size (line height + 12 px of padding, never below 32) */
export function tableRowHeightFor(size: FontSizeName): number {
  return Math.max(32, TYPE_SCALE.body[isFontSizeName(size) ? size : 'medium'].lineHeight + 12);
}
