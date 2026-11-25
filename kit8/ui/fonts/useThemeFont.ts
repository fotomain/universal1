// The font of a theme element (input / label / button / title) as a style: the choice of the user (uxuiState.themeSettings, saved in userSettingsTable), the type scale, the loaded file.
// Safe without a redux Provider (a unit test): the defaults then. A custom font is used once its files are loaded; until then the system font.
import { useContext, useMemo, useSyncExternalStore } from 'react';
import { ReactReduxContext } from 'react-redux';
import { Platform } from 'react-native';
import { selectThemeSettings } from '../../redux/uxuiSlice';
import { FontName, FontRole, FontSizeName, resolveFont } from './fontCatalog';
import { textFamily } from './paperFonts';
import { useAppFonts } from './useAppFonts';
import { DEFAULT_FONT, ThemeElement } from '../../catalog/user/settings/userSettingsModel';

const ROLE_OF_ELEMENT: Record<ThemeElement, FontRole> = { input: 'body', label: 'label', button: 'header', title: 'title' };
const noop = () => () => {};

export interface ThemeFontStyle {
  fontFamily?: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontWeight: 'normal' | '400' | '500' | '600' | '700';
}

/** the style of a font choice (pure; the loaded state decides if the custom family is used) */
export function themeFontStyle(name: FontName, size: FontSizeName, role: FontRole, weight: number | undefined, loaded: boolean, web: boolean): ThemeFontStyle {
  const r = resolveFont({ fontName: name, fontSize: size, fontWeight: weight }, role);
  const useName: FontName = loaded ? name : 'system';
  const family = textFamily(useName, r.fontWeight, web);
  return {
    fontFamily: family,
    fontSize: r.fontSize,
    lineHeight: r.lineHeight,
    letterSpacing: r.letterSpacing,
    fontWeight: family && useName !== 'system' ? 'normal' : (String(r.fontWeight) as ThemeFontStyle['fontWeight']),
  };
}

export function useThemeFont(element: ThemeElement): ThemeFontStyle {
  const ctx = useContext(ReactReduxContext) as any;
  const store = ctx?.store;
  const theme = useSyncExternalStore(store ? store.subscribe : noop, () => (store ? selectThemeSettings(store.getState()) : null) as any, () => null as any);
  const own = theme?.elements?.[element];
  const name: FontName = own?.fontName ?? theme?.fontName ?? DEFAULT_FONT.fontName;
  const size: FontSizeName = own?.fontSize ?? theme?.fontSize ?? DEFAULT_FONT.fontSize;
  const loaded = useAppFonts(name);
  return useMemo(() => themeFontStyle(name, size, ROLE_OF_ELEMENT[element], own?.fontWeight, loaded, Platform.OS === 'web'), [name, size, element, own?.fontWeight, loaded]);
}
