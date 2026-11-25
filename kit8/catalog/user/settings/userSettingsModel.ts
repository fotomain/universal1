// User settings (documentation/USER_SETTINGS_TABLE_WBS.html): the model of userSettingsTable. PURE (no react, no redux, no supabase).
//   userSettingsTable: rowOwnerGUID = user · rowParentGUID = device type · rowFolderGUID = OS; rowJSON = { lastUsedAt, uxuiState }.
//   rowJSON.uxuiState = the PREFERENCES of the redux slice uxuiState + themeSettings + extendedSettings.
import {
  FontChoice,
  FontName,
  FontSizeName,
  isFontName,
  isFontSizeName,
} from '../../../ui/fonts/fontCatalog';
import { normalizePlayVideoSettings, PLAY_VIDEO_DEFAULTS, PlayVideoSettings } from '../../../redux/playVideoSettings';
import { normalizeRecordVideoSettings, RECORD_VIDEO_DEFAULTS, RecordVideoSettings } from '../../../redux/recordVideoSettings';

export const USER_SETTINGS_ENTITY = 'userSetting';
export const USER_SETTINGS_TABLE = 'userSettingsTable';
export const USER_SETTINGS_RPC = { upsert: 'user_settings_upsert', touch: 'user_settings_touch', copyFrom: 'user_settings_copy_from' } as const;

export type DeviceType = 'desktop' | 'phone' | 'tablet';
export type DeviceOS = 'macos' | 'windows' | 'android' | 'ios' | 'ipados' | 'linux' | 'other';
export const DEVICE_TYPES: DeviceType[] = ['desktop', 'phone', 'tablet'];
export const DEVICE_OSES: DeviceOS[] = ['macos', 'windows', 'android', 'ios', 'ipados', 'linux', 'other'];
export interface DeviceKey { deviceType: DeviceType; os: DeviceOS }

export const OS_LABELS: Record<DeviceOS, string> = { macos: 'macOS', windows: 'Windows', android: 'Android', ios: 'iOS', ipados: 'iPadOS', linux: 'Linux', other: 'Other' };
export const DEVICE_LABELS: Record<DeviceType, string> = { desktop: 'Desktop', phone: 'Phone', tablet: 'Tablet' };
export const deviceKeyLabel = (k: DeviceKey) => `${DEVICE_LABELS[k.deviceType]} · ${OS_LABELS[k.os]}`;

/** a row is deleted when it was not used for this long (the saga deleteNotUsedUserSettings) */
export const USER_SETTINGS_MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;
/** lastUsedAt is touched at most this often */
export const USER_SETTINGS_TOUCH_EVERY_MS = 24 * 60 * 60 * 1000;

export type DesignSystemName = 'tamagui' | 'paper' | 'ant' | 'native' | 'expo' | 'googlemd3web' | 'applemacui';
const DESIGN_SYSTEMS: DesignSystemName[] = ['tamagui', 'paper', 'ant', 'native', 'expo', 'googlemd3web', 'applemacui'];

/** the font settings of one place: the name, the size, an optional weight */
export interface FontSetting extends FontChoice {}

export type ThemeElement = 'input' | 'label' | 'button' | 'title';
export const THEME_ELEMENTS: ThemeElement[] = ['input', 'label', 'button', 'title'];

export interface ThemeSettings {
  fontName: FontName;
  fontSize: FontSizeName;
  /** changeable font settings per theme element; a missing element follows fontName / fontSize */
  elements: Partial<Record<ThemeElement, FontSetting>>;
  /** the colors the user changed (MD3 color name -> color); the rest is the palette of the light / dark theme */
  colors: Record<string, string>;
  /** the color of the floating action button; null / absent = the theme's */
  fabColor: string | null;
}

export interface DashboardFontSettings {
  header: FontSetting;
  dataCell: FontSetting;
  cellBackground: string;
}
export interface ExtendedSettings {
  estimationDashboard: DashboardFontSettings;
  projectDashboard: DashboardFontSettings;
}

/** what is stored in rowJSON.uxuiState (the preferences of the redux slice + the two new groups) */
export interface UxuiSettingsJSON {
  activeDesignSystem?: DesignSystemName;
  iconsVariant?: 'materialIconsOnly' | 'platformOrientedIcons';
  darkMode?: boolean;
  fabAnimationVariant?: 'defaultFABAnimation' | 'reanimatedBasicFABAnimation';
  bottomTabsAreVisible?: boolean;
  askBeforeDeletePost?: boolean;
  PlayVideoSettings?: PlayVideoSettings;
  RecordVideoSettings?: RecordVideoSettings;
  themeSettings: ThemeSettings;
  extendedSettings: ExtendedSettings;
}

export interface UserSettingsRowJSON {
  lastUsedAt: string;
  uxuiState: UxuiSettingsJSON;
  [key: string]: any;
}

export const TRANSPARENT = 'transparent';

export const DEFAULT_FONT: FontSetting = { fontName: 'system', fontSize: 'medium' };

export function normalizeFontSetting(raw: any, fallback: FontSetting = DEFAULT_FONT): FontSetting {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out: FontSetting = {
    fontName: isFontName(r.fontName) ? r.fontName : fallback.fontName,
    fontSize: isFontSizeName(r.fontSize) ? r.fontSize : fallback.fontSize,
  };
  const w = typeof r.fontWeight === 'number' ? r.fontWeight : fallback.fontWeight;
  if (typeof w === 'number' && w >= 100 && w <= 900) out.fontWeight = w;
  return out;
}

const COLOR_RE = /^(transparent|#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/;
export const isColorString = (v: unknown): v is string => typeof v === 'string' && COLOR_RE.test(v.trim());

export function normalizeThemeSettings(raw: any): ThemeSettings {
  const r = raw && typeof raw === 'object' ? raw : {};
  const base: FontSetting = normalizeFontSetting(r);
  const elements: ThemeSettings['elements'] = {};
  for (const el of THEME_ELEMENTS) if (r.elements && r.elements[el]) elements[el] = normalizeFontSetting(r.elements[el], base);
  const colors: Record<string, string> = {};
  if (r.colors && typeof r.colors === 'object') for (const [k, v] of Object.entries(r.colors)) if (isColorString(v)) colors[k] = (v as string).trim();
  return { fontName: base.fontName, fontSize: base.fontSize, elements, colors, fabColor: isColorString(r.fabColor) ? r.fabColor.trim() : null };
}

export function defaultDashboardSettings(): DashboardFontSettings {
  return { header: { ...DEFAULT_FONT, fontWeight: 500 }, dataCell: { ...DEFAULT_FONT }, cellBackground: TRANSPARENT };
}

// the keys of rowJSON as the owner named them
export function dashboardFromJSON(raw: any, headerKey: string, cellKey: string, tableKey: string): DashboardFontSettings {
  const r = raw && typeof raw === 'object' ? raw : {};
  const d = defaultDashboardSettings();
  const bg = r[tableKey]?.cellBackground;
  return { header: normalizeFontSetting(r[headerKey], d.header), dataCell: normalizeFontSetting(r[cellKey], d.dataCell), cellBackground: isColorString(bg) ? bg.trim() : TRANSPARENT };
}
export function dashboardToJSON(s: DashboardFontSettings, headerKey: string, cellKey: string, tableKey: string): Record<string, any> {
  return { [headerKey]: s.header, [cellKey]: s.dataCell, [tableKey]: { cellBackground: s.cellBackground } };
}

export function normalizeExtendedSettings(raw: any): ExtendedSettings {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    estimationDashboard: dashboardFromJSON(r.estimationDashboard, 'fontForEstimationDashboardHeader', 'fontForEstimationDashboardDataCell', 'estimationDashboardTable'),
    projectDashboard: dashboardFromJSON(r.projectDashboard, 'fontForProjectDashboardHeader', 'fontForProjectDashboardDataCell', 'projectDashboardTable'),
  };
}
export function extendedSettingsToJSON(s: ExtendedSettings): Record<string, any> {
  return {
    estimationDashboard: dashboardToJSON(s.estimationDashboard, 'fontForEstimationDashboardHeader', 'fontForEstimationDashboardDataCell', 'estimationDashboardTable'),
    projectDashboard: dashboardToJSON(s.projectDashboard, 'fontForProjectDashboardHeader', 'fontForProjectDashboardDataCell', 'projectDashboardTable'),
  };
}

export function defaultThemeSettings(): ThemeSettings {
  return { ...DEFAULT_FONT, elements: {}, colors: {}, fabColor: null } as ThemeSettings;
}
export function defaultExtendedSettings(): ExtendedSettings {
  return { estimationDashboard: defaultDashboardSettings(), projectDashboard: defaultDashboardSettings() };
}

/** Rule 1: the default design system is the most native one - the Expo UI theme on Apple devices, react-native-paper everywhere else */
export function defaultDesignSystemFor(os: DeviceOS): DesignSystemName {
  return os === 'ios' || os === 'ipados' || os === 'macos' ? 'expo' : 'paper';
}

/** the settings of a device that has none yet */
export function platformDefaults(key: DeviceKey): UxuiSettingsJSON {
  return {
    activeDesignSystem: defaultDesignSystemFor(key.os),
    themeSettings: defaultThemeSettings(),
    extendedSettings: defaultExtendedSettings(),
  };
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

/** Wrong or missing values are replaced by the defaults of the device; unknown keys are KEPT (a newer app may have written them). */
export function normalizeUxuiSettings(raw: any, key: DeviceKey): UxuiSettingsJSON {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out: any = { ...r };
  out.activeDesignSystem = DESIGN_SYSTEMS.includes(r.activeDesignSystem === 'appleui' ? 'applemacui' : r.activeDesignSystem)
    ? (r.activeDesignSystem === 'appleui' ? 'applemacui' : r.activeDesignSystem)
    : defaultDesignSystemFor(key.os);
  if (r.iconsVariant !== 'materialIconsOnly' && r.iconsVariant !== 'platformOrientedIcons') delete out.iconsVariant;
  if (!isBool(r.darkMode)) delete out.darkMode;
  if (r.fabAnimationVariant !== 'defaultFABAnimation' && r.fabAnimationVariant !== 'reanimatedBasicFABAnimation') delete out.fabAnimationVariant;
  if (!isBool(r.bottomTabsAreVisible)) delete out.bottomTabsAreVisible;
  if (!isBool(r.askBeforeDeletePost)) delete out.askBeforeDeletePost;
  if (r.PlayVideoSettings !== undefined) out.PlayVideoSettings = normalizePlayVideoSettings(r.PlayVideoSettings); else delete out.PlayVideoSettings;
  if (r.RecordVideoSettings !== undefined) out.RecordVideoSettings = normalizeRecordVideoSettings(r.RecordVideoSettings); else delete out.RecordVideoSettings;
  out.themeSettings = normalizeThemeSettings(r.themeSettings);
  out.extendedSettings = extendedSettingsToJSON(normalizeExtendedSettings(r.extendedSettings));
  return out as UxuiSettingsJSON;
}

/** the row of this device among the rows of the user */
export function findRowOfDevice<T extends { rowParentGUID?: string; rowFolderGUID?: string }>(rows: T[] | undefined | null, key: DeviceKey): T | undefined {
  return (rows || []).find((r) => r.rowParentGUID === key.deviceType && r.rowFolderGUID === key.os);
}
/** the rows of the user's OTHER devices (for "Copy from my other device"), the most recently used first */
export function otherDeviceRows<T extends { rowParentGUID?: string; rowFolderGUID?: string; rowJSON?: any }>(rows: T[] | undefined | null, key: DeviceKey): T[] {
  return (rows || [])
    .filter((r) => !(r.rowParentGUID === key.deviceType && r.rowFolderGUID === key.os))
    .sort((a, b) => String(b.rowJSON?.lastUsedAt || '').localeCompare(String(a.rowJSON?.lastUsedAt || '')));
}

/** the rows that are not used any more: lastUsedAt older than the limit; never the row of this device; a row without a time stamp is treated as just used */
export function expiredRowGUIDs(
  rows: { rowGUID?: string; rowParentGUID?: string; rowFolderGUID?: string; rowJSON?: any }[] | undefined | null,
  key: DeviceKey,
  now: number = Date.now(),
  maxAgeMs: number = USER_SETTINGS_MAX_AGE_MS,
): string[] {
  const out: string[] = [];
  for (const r of rows || []) {
    if (!r.rowGUID) continue;
    if (r.rowParentGUID === key.deviceType && r.rowFolderGUID === key.os) continue;
    const t = Date.parse(String(r.rowJSON?.lastUsedAt ?? ''));
    if (!Number.isFinite(t)) continue;
    if (now - t > maxAgeMs) out.push(r.rowGUID);
  }
  return out;
}

/** true when lastUsedAt is old enough that the app should touch it again */
export function needsTouch(lastUsedAt: unknown, now: number = Date.now(), everyMs: number = USER_SETTINGS_TOUCH_EVERY_MS): boolean {
  const t = Date.parse(String(lastUsedAt ?? ''));
  return !Number.isFinite(t) || now - t >= everyMs;
}

export { PLAY_VIDEO_DEFAULTS, RECORD_VIDEO_DEFAULTS };
