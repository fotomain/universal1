// The font a dashboard asks for, for the SKIA canvases (the task tree, the estimate grid). A ReusableTable reads the choice of the user (userSettingsTable, uxuiState.extendedSettings) by itself
// (`dashboard` prop); the Skia canvases cannot use a CSS family or the system font, they need the font FILE. `DashboardFontScope` puts the choice of one dashboard in a context and `usePMFonts`
// (usePMFonts.ts) reads it: no scope = the Space Grotesk the canvases always had. The font `system` is the system font of the browser when the user let the page copy it (systemFontWeb.ts), else (Safari, Firefox, not allowed) Inter, the closest open font; on a phone, for now, that Space Grotesk.
import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import { selectExtendedSettings } from '../../redux/uxuiSlice';
import { ExtendedSettings, FontSetting } from '../../catalog/user/settings/userSettingsModel';
import { resolveFont } from '../../ui/fonts/fontCatalog';
import { roleForWeight, SystemFontRole } from './systemFontWeb';

/**
 * one font of the canvas: `file` = a key of FONT_ASSETS (the file name without .ttf) of a chosen Roboto / Inter / Selawik; `system` = the user chose the font `system`: on the WEB the canvas draws it
 * with the copy of the system font the browser gave (systemFontWeb.ts, Settings -> Dashboards), when there is none Inter (web), or on a phone for now the Space Grotesk of the canvases at `fallbackSize`.
 */
export interface SkiaFontSpec { file: string | null; size: number; system?: SystemFontRole; fallbackSize: number }

export interface SkiaFontPlan {
  regular: SkiaFontSpec;
  bold: SkiaFontSpec;
  small: SkiaFontSpec;
  smallBold: SkiaFontSpec;
  header: SkiaFontSpec;
}

const DEFAULT_SIZE = 12;

const specOf = (setting: FontSetting, role: 'body' | 'header', weight: number | undefined, size: (n: number) => number, fallback: number): SkiaFontSpec => {
  const r = resolveFont({ ...setting, fontWeight: weight }, role);
  const s = size(r.fontSize);
  if (setting.fontName === 'system') return { file: null, size: s, system: roleForWeight(r.fontWeight), fallbackSize: fallback };
  return { file: r.fontFamily ?? null, size: s, fallbackSize: fallback };
};

/** the files + sizes for the choice of a dashboard (pure) */
export function skiaFontPlan(dataCell: FontSetting, header: FontSetting): SkiaFontPlan {
  const same = (n: number) => n;
  const less = (n: number) => n - 1;
  return {
    regular: specOf(dataCell, 'body', dataCell.fontWeight, same, DEFAULT_SIZE),
    bold: specOf(dataCell, 'body', 700, same, DEFAULT_SIZE),
    small: specOf(dataCell, 'body', dataCell.fontWeight, less, DEFAULT_SIZE - 1),
    smallBold: specOf(dataCell, 'body', 700, less, DEFAULT_SIZE - 1),
    header: specOf(header, 'header', header.fontWeight, same, DEFAULT_SIZE),
  };
}

export const SkiaFontContext = createContext<SkiaFontPlan | null>(null);
export const useSkiaFontPlan = (): SkiaFontPlan | null => useContext(SkiaFontContext);

const noop = () => () => {};

/** Wrap the canvases of ONE dashboard: they draw their text with the fonts the user chose for it (Settings -> Dashboards). */
export function DashboardFontScope({ dashboard, children }: { dashboard: keyof ExtendedSettings; children: React.ReactNode }) {
  const ctx = useContext(ReactReduxContext) as any;
  const store = ctx?.store;
  const all = useSyncExternalStore(store ? store.subscribe : noop, () => (store ? selectExtendedSettings(store.getState()) : null) as any, () => null as any);
  const d = all ? all[dashboard] : null;
  const dn = d?.dataCell.fontName, ds = d?.dataCell.fontSize, dw = d?.dataCell.fontWeight;
  const hn = d?.header.fontName, hs = d?.header.fontSize, hw = d?.header.fontWeight;
  const plan = useMemo(() => (d ? skiaFontPlan({ fontName: dn, fontSize: ds, fontWeight: dw }, { fontName: hn, fontSize: hs, fontWeight: hw }) : null), [d ? 1 : 0, dn, ds, dw, hn, hs, hw]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SkiaFontContext.Provider value={plan}>{children}</SkiaFontContext.Provider>;
}
