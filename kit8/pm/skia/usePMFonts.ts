// Skia fonts for the Gantt canvases. Skia on web (CanvasKit) has no access to system
// fonts, so matchFont() does not work there - bundled .ttf files work everywhere.
// Space Grotesk ships with the app already (@expo-google-fonts/space-grotesk).

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { SkFont, Skia, SkTypeface, useFont } from '@shopify/react-native-skia';
import { SkiaFontSpec, useSkiaFontPlan } from './dashboardFont';
import { faceBytes, getSystemFontSnapshot, prepareSystemFont, StoredSystemFont, subscribeSystemFont, SystemFontRole } from './systemFontWeb';

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

export function createTypefaceFromBytes(bytes: Uint8Array | null): SkTypeface | null {
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

// ---- the font a dashboard chose (dashboardFont.tsx): Roboto / Inter / Selawik files of assets/fonts (public/fonts on the web) ----
const customTypefaces = new Map<string, SkTypeface | null>(); // file name -> typeface (null = could not be loaded: the Space Grotesk is used instead)
const customLoading = new Map<string, Promise<void>>();

const isTtf = (b: Uint8Array) => {
  const tag = String.fromCharCode(...b.slice(0, 4));
  return b.length > 1000 && (tag === '\u0000\u0001\u0000\u0000' || tag === 'true' || tag === 'OTTO');
};

/** the file of a custom font (web): /fonts/<file>.ttf; a dev server answers an unknown path with its HTML page and status 200, so the header of the file is checked */
function loadCustomTypeface(file: string): Promise<void> {
  if (customTypefaces.has(file)) return Promise.resolve();
  let p = customLoading.get(file);
  if (!p) {
    p = (async () => {
      let tf: SkTypeface | null = null;
      for (const url of [`/fonts/${file}.ttf`, `./fonts/${file}.ttf`]) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const bytes = new Uint8Array(await res.arrayBuffer());
          if (isTtf(bytes)) { tf = createTypefaceFromBytes(bytes); break; }
        } catch {
          // the next candidate
        }
      }
      customTypefaces.set(file, tf);
    })();
    customLoading.set(file, p);
  }
  return p;
}

/** the asset of a custom font for Skia on a phone (the files are required in kit8/ui/fonts/fontAssets.ts) */
function nativeAsset(file: string | null, fallback: any): any {
  if (!file) return fallback;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../../ui/fonts/fontAssets').FONT_ASSETS[file] ?? fallback;
}

const systemTypefaces = new WeakMap<object, Partial<Record<SystemFontRole, SkTypeface | null>>>();
/** the typeface of a face of the copied system font (made once per copy) */
function systemTypeface(font: StoredSystemFont | null, role: SystemFontRole): SkTypeface | null {
  const bytes = faceBytes(font, role);
  if (!font || !bytes) return null;
  let m = systemTypefaces.get(font);
  if (!m) { m = {}; systemTypefaces.set(font, m); }
  const key = font.faces[role] ? role : font.faces.bold && role === 'medium' ? 'bold' : 'regular';
  if (!(key in m)) m[key] = createTypefaceFromBytes(bytes);
  return m[key] ?? null;
}

const noopSubscribe = () => () => {};

/** `system` on the web without a copy of the system font: Inter (bundled, the closest open font to San Francisco, covers Cyrillic); Safari and Firefox cannot give their system font to a page */
const INTER_OF: Record<SystemFontRole, string> = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', bold: 'Inter_700Bold' };

/**
 * The Skia fonts of the canvases. Inside a `DashboardFontScope` (dashboardFont.tsx):
 *   - Roboto / Inter / Selawik = that file at the size of the type scale;
 *   - `system` on the WEB = the copy of the system font of the browser (systemFontWeb.ts, made ready by itself in Chrome / Edge), at the size of the type scale; without a copy (Safari, Firefox, not allowed) Inter;
 *   - `system` on a phone (not built yet) and no scope = the Space Grotesk the canvases always had.
 * `custom` = a font the user chose is really in use (it has Cyrillic itself, the grid's 12 px fallback is then off).
 */
export function usePMFonts() {
  const isWeb = Platform.OS === 'web';
  const plan = useSkiaFontPlan();
  const rf = plan?.regular.file ?? null, bf = plan?.bold.file ?? null, hf = plan?.header.file ?? null;
  const sysFont = useSyncExternalStore(isWeb ? subscribeSystemFont : noopSubscribe, isWeb ? getSystemFontSnapshot : () => null, () => null);
  const wantsSystem = !!plan && [plan.regular, plan.bold, plan.small, plan.smallBold, plan.header].some((sp) => sp.system);
  // a spec of the plan -> its size: the scale, but a `system` font that is not available (no copy, a phone) keeps the canvas size
  // (on the web a `system` font without a copy is drawn with Inter at the scale size, see INTER_OF; on a phone it keeps the canvas size)
  const sizeOf = (sp: SkiaFontSpec | undefined, dflt: number) => (!sp ? dflt : sp.system && !isWeb ? sp.fallbackSize : sp.size);
  const rs = sizeOf(plan?.regular, PM_FONT_SIZE), ss = sizeOf(plan?.small, PM_FONT_SIZE_SMALL), hs = sizeOf(plan?.header, PM_FONT_SIZE);

  // Native (iOS/Android): standard react-native-skia font loading via asset ID
  const nativeReg = useFont(isWeb ? null : nativeAsset(rf, REGULAR), rs);
  const nativeBold = useFont(isWeb ? null : nativeAsset(bf, BOLD), sizeOf(plan?.bold, PM_FONT_SIZE));
  const nativeSmall = useFont(isWeb ? null : nativeAsset(rf, REGULAR), ss);
  const nativeSmallBold = useFont(isWeb ? null : nativeAsset(bf, BOLD), sizeOf(plan?.smallBold, PM_FONT_SIZE_SMALL));
  const nativeHeader = useFont(isWeb || !hf ? null : nativeAsset(hf, BOLD), hs);

  // Web (CanvasKit): preloaded or async-loaded SkTypeface
  const [webTypefaces, setWebTypefaces] = useState(() => ({
    regular: cachedRegularTf,
    bold: cachedBoldTf,
  }));
  const [, setCustomTick] = useState(0);

  useEffect(() => {
    if (!isWeb) return;
    if (cachedRegularTf && cachedBoldTf) return;
    preloadPMFonts().then(([reg, bold]) => {
      setWebTypefaces({ regular: reg, bold });
    });
  }, [isWeb]);

  // the copy of the system font is made ready (IndexedDB / the permission / the first click, see systemFontWeb.ts) once, when a dashboard asks for `system`
  // `sysChecked`: the answer is known (IndexedDB read, permission looked at), so the canvas does not draw Inter for a moment and then switch to the system font
  const [sysChecked, setSysChecked] = useState(false);
  useEffect(() => {
    if (!isWeb || !wantsSystem) return;
    let live = true;
    prepareSystemFont().then(() => { if (live) setSysChecked(true); });
    return () => { live = false; };
  }, [isWeb, wantsSystem]);

  // the files: the chosen ones + Inter for every `system` spec that has no copy of the system font (Safari / Firefox / not allowed / not asked yet)
  const interFiles = isWeb && wantsSystem && !sysFont && plan
    ? [plan.regular, plan.bold, plan.small, plan.smallBold, plan.header].filter((sp) => sp.system).map((sp) => INTER_OF[sp.system!])
    : [];
  const wantedFiles = Array.from(new Set([rf, bf, hf, ...interFiles].filter((f): f is string => !!f)));
  const wantedKey = wantedFiles.join('|');
  useEffect(() => {
    if (!isWeb || wantedFiles.length === 0) return;
    let live = true;
    Promise.all(wantedFiles.map(loadCustomTypeface)).then(() => { if (live) setCustomTick((n) => n + 1); });
    return () => { live = false; };
  }, [isWeb, wantedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const regTf = webTypefaces.regular ?? cachedRegularTf;
  const bldTf = webTypefaces.bold ?? cachedBoldTf;
  // a custom font that is still loading (not in the map) = not ready; one that failed (null) = the Space Grotesk
  const customDone = wantedFiles.every((f) => customTypefaces.has(f));
  const pick = (sp: SkiaFontSpec | undefined, dflt: SkTypeface | null): { tf: SkTypeface | null; own: boolean } => {
    if (sp?.file) return customTypefaces.has(sp.file) ? { tf: customTypefaces.get(sp.file) ?? dflt, own: !!customTypefaces.get(sp.file) } : { tf: null, own: true };
    if (sp?.system) {
      const t = isWeb ? systemTypeface(sysFont, sp.system) : null;
      if (t) return { tf: t, own: true };
      if (!isWeb) return { tf: dflt, own: false };
      const inter = INTER_OF[sp.system];
      return customTypefaces.has(inter) ? { tf: customTypefaces.get(inter) ?? dflt, own: !!customTypefaces.get(inter) } : { tf: null, own: true };
    }
    return { tf: dflt, own: false };
  };
  const pr = pick(plan?.regular, regTf), pb = pick(plan?.bold, bldTf), ps = pick(plan?.small, regTf), psb = pick(plan?.smallBold, bldTf), ph = pick(plan?.header, bldTf);
  const rTf = pr.tf, bTf = pb.tf, sTf = ps.tf, sbTf = psb.tf, hTf = ph.tf;
  const bs = sizeOf(plan?.bold, PM_FONT_SIZE), sbs = sizeOf(plan?.smallBold, PM_FONT_SIZE_SMALL);
  const custom = [pr, pb, ps, psb, ph].some((x) => x.own);

  const regular = useMemo(() => (isWeb && rTf ? Skia.Font(rTf, rs) : null), [isWeb, rTf, rs]);
  const bold = useMemo(() => (isWeb && bTf ? Skia.Font(bTf, bs) : null), [isWeb, bTf, bs]);
  const small = useMemo(() => (isWeb && sTf ? Skia.Font(sTf, ss) : null), [isWeb, sTf, ss]);
  const smallBold = useMemo(() => (isWeb && sbTf ? Skia.Font(sbTf, sbs) : null), [isWeb, sbTf, sbs]);
  const header = useMemo(() => (isWeb && hTf ? Skia.Font(hTf, hs) : null), [isWeb, hTf, hs]);

  // the header of the tree: the size of the header font, the small size (11) of the canvas when the dashboard asks for nothing / the system font is not there
  const headerSmall = useMemo(() => (isWeb && hTf ? Skia.Font(hTf, plan ? hs : PM_FONT_SIZE_SMALL) : null), [isWeb, hTf, hs, plan]);

  if (!isWeb) {
    const nHeader = hf ? nativeHeader : nativeBold;
    return {
      regular: nativeReg,
      bold: nativeBold,
      small: nativeSmall,
      smallBold: nativeSmallBold,
      /** header of the grid / of the tree (the bold of the canvas unless the dashboard chose a header font) */
      header: nHeader,
      headerSmall: hf ? nativeHeader : nativeSmallBold,
      custom: !!rf || !!bf || !!hf,
      ready: !!(nativeReg && nativeBold && nativeSmall && nativeSmallBold && nHeader),
    };
  }

  return {
    regular,
    bold,
    small,
    smallBold,
    header: plan ? header : bold,
    headerSmall: plan ? headerSmall : smallBold,
    custom,
    ready: !!(regular && bold && small && smallBold && (plan ? header : bold) && customDone && (!wantsSystem || sysChecked)),
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
