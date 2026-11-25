import {
  DEFAULT_FONT, defaultDesignSystemFor, expiredRowGUIDs, findRowOfDevice, needsTouch, normalizeExtendedSettings, normalizeFontSetting, normalizeThemeSettings, normalizeUxuiSettings,
  otherDeviceRows, platformDefaults, USER_SETTINGS_MAX_AGE_MS, extendedSettingsToJSON,
} from '../../../../kit8/catalog/user/settings/userSettingsModel';

const mac = { deviceType: 'desktop', os: 'macos' } as const;
const win = { deviceType: 'desktop', os: 'windows' } as const;

describe('Rule 1: the default look', () => {
  it('Expo UI on Apple, Paper everywhere else', () => {
    for (const os of ['ios', 'ipados', 'macos'] as const) expect(defaultDesignSystemFor(os)).toBe('expo');
    for (const os of ['android', 'windows', 'linux', 'other'] as const) expect(defaultDesignSystemFor(os)).toBe('paper');
  });
  it('platformDefaults has the system font, medium size, a transparent cell background', () => {
    const d: any = platformDefaults(mac);
    expect(d.activeDesignSystem).toBe('expo');
    expect(d.themeSettings).toMatchObject({ fontName: 'system', fontSize: 'medium', colors: {}, fabColor: null });
    expect(normalizeExtendedSettings(d.extendedSettings).estimationDashboard.cellBackground).toBe('transparent');
    expect(normalizeExtendedSettings(d.extendedSettings).projectDashboard.cellBackground).toBe('transparent');
    expect(platformDefaults(win).activeDesignSystem).toBe('paper');
  });
});

describe('normalizers', () => {
  it('a font setting keeps valid values and replaces wrong ones', () => {
    expect(normalizeFontSetting({ fontName: 'inter', fontSize: 'large', fontWeight: 600 })).toEqual({ fontName: 'inter', fontSize: 'large', fontWeight: 600 });
    expect(normalizeFontSetting({ fontName: 'comic', fontSize: 'huge', fontWeight: 5000 })).toEqual(DEFAULT_FONT);
    expect(normalizeFontSetting(null)).toEqual(DEFAULT_FONT);
  });
  it('theme settings: elements follow the theme, only color strings are kept', () => {
    const t = normalizeThemeSettings({ fontName: 'roboto', fontSize: 'small', elements: { input: { fontName: 'selawik' }, bogus: { fontName: 'inter' } }, colors: { primary: '#ff0000', error: 'javascript:alert(1)', surface: 'transparent' }, fabColor: '#00FF00' });
    expect(t.fontName).toBe('roboto');
    expect(t.elements.input).toEqual({ fontName: 'selawik', fontSize: 'small' });
    expect((t.elements as any).bogus).toBeUndefined();
    expect(t.colors).toEqual({ primary: '#ff0000', surface: 'transparent' });
    expect(t.fabColor).toBe('#00FF00');
    expect(normalizeThemeSettings(undefined).fabColor).toBeNull();
  });
  it('extended settings use the key names of the owner and round-trip', () => {
    const json: any = extendedSettingsToJSON(normalizeExtendedSettings(undefined));
    expect(Object.keys(json.estimationDashboard).sort()).toEqual(['estimationDashboardTable', 'fontForEstimationDashboardDataCell', 'fontForEstimationDashboardHeader']);
    expect(Object.keys(json.projectDashboard).sort()).toEqual(['fontForProjectDashboardDataCell', 'fontForProjectDashboardHeader', 'projectDashboardTable']);
    expect(json.estimationDashboard.estimationDashboardTable.cellBackground).toBe('transparent');
    json.projectDashboard.fontForProjectDashboardHeader = { fontName: 'inter', fontSize: 'large', fontWeight: 700 };
    json.projectDashboard.projectDashboardTable.cellBackground = '#112233';
    const back = normalizeExtendedSettings(json);
    expect(back.projectDashboard.header).toEqual({ fontName: 'inter', fontSize: 'large', fontWeight: 700 });
    expect(back.projectDashboard.cellBackground).toBe('#112233');
    expect(back.estimationDashboard.header.fontWeight).toBe(500);
  });
  it('uxuiState: unknown keys stay, wrong values go, appleui is renamed, old media settings are normalized', () => {
    const n: any = normalizeUxuiSettings({ activeDesignSystem: 'appleui', darkMode: 'yes', futureKey: { a: 1 }, PlayVideoSettings: { hideButtonsAfter: 99 }, iconsVariant: 'nope' }, win);
    expect(n.activeDesignSystem).toBe('applemacui');
    expect(n.darkMode).toBeUndefined();
    expect(n.iconsVariant).toBeUndefined();
    expect(n.futureKey).toEqual({ a: 1 });
    expect(n.PlayVideoSettings.hideButtonsAfter).toBe(10);
    expect(normalizeUxuiSettings('garbage', mac).activeDesignSystem).toBe('expo');
    expect(normalizeUxuiSettings(null, win).activeDesignSystem).toBe('paper');
  });
});

describe('the rows of a user', () => {
  const rows = [
    { rowGUID: 'a', rowParentGUID: 'desktop', rowFolderGUID: 'macos', rowJSON: { lastUsedAt: '2026-11-25T10:00:00.000Z' } },
    { rowGUID: 'b', rowParentGUID: 'phone', rowFolderGUID: 'ios', rowJSON: { lastUsedAt: '2026-11-20T10:00:00.000Z' } },
    { rowGUID: 'c', rowParentGUID: 'tablet', rowFolderGUID: 'android', rowJSON: { lastUsedAt: '2026-11-24T10:00:00.000Z' } },
  ];
  it('finds the row of this device and lists the others, newest first', () => {
    expect(findRowOfDevice(rows, mac)?.rowGUID).toBe('a');
    expect(findRowOfDevice(rows, win)).toBeUndefined();
    expect(otherDeviceRows(rows, mac).map((r) => r.rowGUID)).toEqual(['c', 'b']);
    expect(otherDeviceRows(undefined, mac)).toEqual([]);
  });
  it('deleteNotUsed: older than a month goes, the row of this device and a row without a time stamp stay', () => {
    const now = Date.parse('2026-12-25T00:00:00.000Z');
    const old = [
      { rowGUID: 'own', rowParentGUID: 'desktop', rowFolderGUID: 'macos', rowJSON: { lastUsedAt: '2026-01-01T00:00:00.000Z' } },
      { rowGUID: 'old', rowParentGUID: 'phone', rowFolderGUID: 'ios', rowJSON: { lastUsedAt: '2026-11-20T00:00:00.000Z' } },
      { rowGUID: 'young', rowParentGUID: 'tablet', rowFolderGUID: 'ipados', rowJSON: { lastUsedAt: '2026-12-10T00:00:00.000Z' } },
      { rowGUID: 'nostamp', rowParentGUID: 'desktop', rowFolderGUID: 'linux', rowJSON: {} },
    ];
    expect(expiredRowGUIDs(old, mac, now)).toEqual(['old']);
  });
  it('31 days is the limit: 30 days stay, 32 days go', () => {
    const now = Date.parse('2026-12-31T00:00:00.000Z');
    const at = (days: number) => [{ rowGUID: 'x', rowParentGUID: 'phone', rowFolderGUID: 'ios', rowJSON: { lastUsedAt: new Date(now - days * 86400000).toISOString() } }];
    expect(USER_SETTINGS_MAX_AGE_MS).toBe(31 * 86400000);
    expect(expiredRowGUIDs(at(30), mac, now)).toEqual([]);
    expect(expiredRowGUIDs(at(32), mac, now)).toEqual(['x']);
  });
  it('needsTouch: once a day', () => {
    const now = Date.parse('2026-11-25T12:00:00.000Z');
    expect(needsTouch('2026-11-25T08:00:00.000Z', now)).toBe(false);
    expect(needsTouch('2026-11-24T08:00:00.000Z', now)).toBe(true);
    expect(needsTouch(undefined, now)).toBe(true);
  });
});
