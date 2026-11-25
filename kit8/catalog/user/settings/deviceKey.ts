// Which row of userSettingsTable is mine: device type (desktop | phone | tablet) + operating system. PURE core + a thin reader of the real device.
import { DeviceKey, DeviceOS, DeviceType } from './userSettingsModel';

export interface DeviceInfoInput {
  /** react-native Platform.OS */
  platformOS: string;
  /** expo-device deviceType: 0 unknown, 1 phone, 2 tablet, 3 desktop, 4 tv */
  expoDeviceType?: number | null;
  /** browser user agent (web) */
  userAgent?: string;
  /** navigator.maxTouchPoints (web) */
  maxTouchPoints?: number;
  /** the shorter side of the screen in px (web) */
  screenMinSide?: number;
  /** navigator.userAgentData.platform when the browser has it (web) */
  uaDataPlatform?: string;
}

function osOfUserAgent(ua: string, uaDataPlatform: string | undefined, touch: number): DeviceOS {
  const platform = (uaDataPlatform || '').toLowerCase();
  const u = ua.toLowerCase();
  if (/iphone|ipod/.test(u)) return 'ios';
  if (/ipad/.test(u)) return 'ipados';
  if (/android/.test(u) || platform === 'android') return 'android';
  // an iPad in "desktop site" mode says Macintosh: only a touch screen tells it apart
  if (/macintosh|mac os x/.test(u) || platform === 'macos') return touch > 1 ? 'ipados' : 'macos';
  if (/windows|win32|win64/.test(u) || platform === 'windows') return 'windows';
  if (/linux|x11|cros/.test(u) || platform === 'linux') return 'linux';
  return 'other';
}

/** pure: the key from what the device says */
export function computeDeviceKey(info: DeviceInfoInput): DeviceKey {
  const touch = info.maxTouchPoints ?? 0;
  if (info.platformOS === 'ios') {
    const t = info.expoDeviceType;
    return t === 2 ? { deviceType: 'tablet', os: 'ipados' } : { deviceType: t === 3 ? 'desktop' : 'phone', os: t === 3 ? 'macos' : 'ios' };
  }
  if (info.platformOS === 'android') {
    return { deviceType: info.expoDeviceType === 2 ? 'tablet' : 'phone', os: 'android' };
  }
  if (info.platformOS === 'macos') return { deviceType: 'desktop', os: 'macos' };
  if (info.platformOS === 'windows') return { deviceType: 'desktop', os: 'windows' };
  // web
  const ua = info.userAgent || '';
  const os = osOfUserAgent(ua, info.uaDataPlatform, touch);
  const mobileUA = /mobi|iphone|ipod|android.*mobile/i.test(ua);
  let deviceType: DeviceType = 'desktop';
  if (os === 'ios') deviceType = 'phone';
  else if (os === 'ipados') deviceType = 'tablet';
  else if (os === 'android') deviceType = mobileUA || (info.screenMinSide ?? 0) < 600 ? 'phone' : 'tablet';
  return { deviceType, os };
}

let cached: DeviceKey | null = null;

/** the key of THIS device, computed once */
export function getDeviceKey(): DeviceKey {
  if (cached) return cached;
  let platformOS = 'web';
  let expoDeviceType: number | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    platformOS = require('react-native').Platform.OS;
  } catch {
    // keep web
  }
  if (platformOS !== 'web') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      expoDeviceType = Number(require('expo-device').deviceType ?? 0);
    } catch {
      expoDeviceType = null;
    }
  }
  const nav: any = typeof navigator !== 'undefined' ? navigator : {};
  const scr: any = typeof screen !== 'undefined' ? screen : {};
  cached = computeDeviceKey({
    platformOS,
    expoDeviceType,
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    uaDataPlatform: nav.userAgentData?.platform,
    screenMinSide: Math.min(Number(scr.width) || 9999, Number(scr.height) || 9999),
  });
  return cached;
}

/** tests only */
export function resetDeviceKeyCache() {
  cached = null;
}
