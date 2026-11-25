// The pure part of the sync between the redux state and the row of userSettingsTable: what is extracted, what is compared.
import { selectExtendedSettings, selectThemeSettings } from '../../../redux/uxuiSlice';
import { normalizePlayVideoSettings } from '../../../redux/playVideoSettings';
import { normalizeRecordVideoSettings } from '../../../redux/recordVideoSettings';
import { DeviceKey, extendedSettingsToJSON, normalizeUxuiSettings, UxuiSettingsJSON } from './userSettingsModel';

/** the preferences of the redux slice uxuiState that are saved (the rest - snackbar, currentJSON, intentInfo ... - is transient) */
export function extractUxuiSettings(state: any, key: DeviceKey): UxuiSettingsJSON {
  const u = state?.uxuiState || {};
  const raw: any = {
    activeDesignSystem: u.activeDesignSystem,
    iconsVariant: u.iconsVariant,
    darkMode: u.darkMode,
    fabAnimationVariant: u.fabAnimationVariant,
    bottomTabsAreVisible: u.bottomTabsAreVisible,
    askBeforeDeletePost: u.askBeforeDeletePost,
    PlayVideoSettings: normalizePlayVideoSettings(u.PlayVideoSettings),
    RecordVideoSettings: normalizeRecordVideoSettings(u.RecordVideoSettings),
    themeSettings: selectThemeSettings(state),
    extendedSettings: extendedSettingsToJSON(selectExtendedSettings(state)),
  };
  return pickKnown(normalizeUxuiSettings(raw, key));
}

const KNOWN = ['activeDesignSystem', 'iconsVariant', 'darkMode', 'fabAnimationVariant', 'bottomTabsAreVisible', 'askBeforeDeletePost', 'PlayVideoSettings', 'RecordVideoSettings', 'themeSettings', 'extendedSettings'];

/** only the keys this app version knows (a newer app may have written more: they stay in the row, they are not compared) */
export function pickKnown(json: any): UxuiSettingsJSON {
  const out: any = {};
  for (const k of KNOWN) if (json && json[k] !== undefined) out[k] = json[k];
  return out;
}

function stable(v: any): any {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o: any, k) => { o[k] = stable(v[k]); return o; }, {});
  return v;
}
/** two settings are equal when their signatures are */
export function settingsSignature(json: any): string {
  return JSON.stringify(stable(pickKnown(json)));
}

/** the settings of a row as this app version understands them */
export function settingsOfRow(row: any, key: DeviceKey): UxuiSettingsJSON {
  return pickKnown(normalizeUxuiSettings(row?.rowJSON?.uxuiState, key));
}
