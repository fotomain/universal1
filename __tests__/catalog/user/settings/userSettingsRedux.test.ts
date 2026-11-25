jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}), { virtual: true });

import { configureStore } from '@reduxjs/toolkit';
import reducer, {
  applyUserSettings, resetThemeColors, selectExtendedSettings, selectThemeSettings, setDashboardSettings, setThemeColor, setThemeElementFont, setThemeSettings,
} from '../../../../kit8/redux/uxuiSlice';
import userThemeReducer, { applyThemeColors, setThemeMode } from '../../../../kit8/redux/userThemeSlice';
import { extractUxuiSettings, pickKnown, settingsOfRow, settingsSignature } from '../../../../kit8/catalog/user/settings/userSettingsSyncCore';
import { deleteExpiredUserSettings, deleteNotUsedUserSettingsSaga, startUserSettingsCleanup, stopUserSettingsCleanup } from '../../../../kit8/redux/deleteNotUsedUserSettings';
import { platformDefaults } from '../../../../kit8/catalog/user/settings/userSettingsModel';
import { CustomDarkTheme, CustomLightTheme } from '../../../../kit8/ui/theme/palettes';

const mac = { deviceType: 'desktop', os: 'macos' } as const;
const win = { deviceType: 'desktop', os: 'windows' } as const;
const store = () => configureStore({ reducer: { uxuiState: reducer, userTheme: userThemeReducer } as any, middleware: (g) => g({ serializableCheck: false, immutableCheck: false }) });

describe('uxuiState settings reducers', () => {
  it('theme settings: font name / size, one color, reset, the font of one element', () => {
    const s = store();
    s.dispatch(setThemeSettings({ fontName: 'inter', fontSize: 'large' }));
    s.dispatch(setThemeColor({ key: 'primary', value: '#123456' }));
    s.dispatch(setThemeColor({ key: 'error', value: '#ab0000' }));
    s.dispatch(setThemeElementFont({ element: 'input', font: { fontName: 'selawik', fontSize: 'small' } }));
    let t = selectThemeSettings(s.getState());
    expect(t).toMatchObject({ fontName: 'inter', fontSize: 'large', colors: { primary: '#123456', error: '#ab0000' } });
    expect(t.elements.input).toEqual({ fontName: 'selawik', fontSize: 'small' });
    s.dispatch(setThemeColor({ key: 'error', value: null }));
    s.dispatch(setThemeElementFont({ element: 'input', font: null }));
    t = selectThemeSettings(s.getState());
    expect(t.colors).toEqual({ primary: '#123456' });
    expect(t.elements.input).toBeUndefined();
    s.dispatch(resetThemeColors());
    expect(selectThemeSettings(s.getState()).colors).toEqual({});
    expect(selectThemeSettings(s.getState()).fontName).toBe('inter');
  });
  it('the selector returns the same object until the state changes (no loop)', () => {
    const s = store();
    expect(selectThemeSettings(s.getState())).toBe(selectThemeSettings(s.getState()));
    expect(selectExtendedSettings(s.getState())).toBe(selectExtendedSettings(s.getState()));
  });
  it('a state persisted before the settings existed reads as the defaults', () => {
    expect(selectThemeSettings({ uxuiState: {} })).toMatchObject({ fontName: 'system', fontSize: 'medium' });
    expect(selectExtendedSettings({ uxuiState: undefined }).projectDashboard.cellBackground).toBe('transparent');
  });
  it('dashboard settings: the owner key names are written, a wrong value is refused', () => {
    const s = store();
    s.dispatch(setDashboardSettings({ dashboard: 'estimationDashboard', patch: { header: { fontName: 'roboto', fontSize: 'large', fontWeight: 700 }, cellBackground: '#eeeeee' } }));
    const raw: any = (s.getState() as any).uxuiState.extendedSettings;
    expect(raw.estimationDashboard.fontForEstimationDashboardHeader).toEqual({ fontName: 'roboto', fontSize: 'large', fontWeight: 700 });
    expect(raw.estimationDashboard.estimationDashboardTable.cellBackground).toBe('#eeeeee');
    s.dispatch(setDashboardSettings({ dashboard: 'projectDashboard', patch: { cellBackground: 'url(evil)' as any } }));
    expect(selectExtendedSettings(s.getState()).projectDashboard.cellBackground).toBe('transparent');
  });
  it('applyUserSettings puts the row of the device into the slice', () => {
    const s = store();
    s.dispatch(applyUserSettings({ ...platformDefaults(win), darkMode: true, activeDesignSystem: 'tamagui', themeSettings: { fontName: 'selawik', fontSize: 'small', elements: {}, colors: { primary: '#00ff00' }, fabColor: '#ff00ff' } as any }));
    const ux: any = (s.getState() as any).uxuiState;
    expect(ux).toMatchObject({ darkMode: true, activeDesignSystem: 'tamagui' });
    expect(selectThemeSettings(s.getState())).toMatchObject({ fontName: 'selawik', fabColor: '#ff00ff', colors: { primary: '#00ff00' } });
  });
});

describe('the user colors reach the Paper theme', () => {
  it('applyThemeColors lays the chosen colors over the palette of the current mode', () => {
    const s = store();
    s.dispatch(applyThemeColors({ colors: { primary: '#abcdef' }, fabColor: '#111111' }));
    let u: any = (s.getState() as any).userTheme;
    expect(u.theme.colors.primary).toBe('#abcdef');
    expect(u.theme.colors.surface).toBe(CustomLightTheme.colors.surface);
    expect(u.fabColor).toBe('#111111');
    s.dispatch(setThemeMode('dark'));
    s.dispatch(applyThemeColors({ colors: { primary: '#abcdef' }, fabColor: null }));
    u = (s.getState() as any).userTheme;
    expect(u.theme.colors.surface).toBe(CustomDarkTheme.colors.surface);
    expect(u.theme.colors.primary).toBe('#abcdef');
    expect(u.fabColor).toBeUndefined();
  });
});

describe('sync core', () => {
  it('extract + signature: equal state = equal signature; unknown keys of a row are not compared', () => {
    const s = store();
    const a = settingsSignature(extractUxuiSettings(s.getState(), mac));
    expect(settingsSignature(extractUxuiSettings(s.getState(), mac))).toBe(a);
    s.dispatch(setThemeSettings({ fontName: 'roboto' }));
    expect(settingsSignature(extractUxuiSettings(s.getState(), mac))).not.toBe(a);
    const row = { rowJSON: { uxuiState: { ...extractUxuiSettings(s.getState(), mac), futureKey: 1 } } };
    expect(settingsSignature(settingsOfRow(row, mac))).toBe(settingsSignature(extractUxuiSettings(s.getState(), mac)));
    expect((pickKnown({ a: 1, darkMode: true }) as any).a).toBeUndefined();
  });
  it('a row applied to the slice keeps all its values; applying it again changes nothing (no echo loop)', () => {
    const s = store();
    const incoming: any = settingsOfRow({ rowJSON: { uxuiState: { activeDesignSystem: 'paper', themeSettings: { fontName: 'selawik', fontSize: 'large', colors: { primary: '#101010' } }, PlayVideoSettings: { hideButtonsAfter: 4 } } } }, win);
    s.dispatch(applyUserSettings(incoming));
    const after: any = extractUxuiSettings(s.getState(), win);
    expect(after.themeSettings).toEqual(incoming.themeSettings);
    expect(after.PlayVideoSettings).toEqual(incoming.PlayVideoSettings);
    expect(after.extendedSettings).toEqual(incoming.extendedSettings);
    // a row without the small preferences (written by an older app) is completed by the state: the host takes the signature AFTER the apply
    const sig = settingsSignature(after);
    s.dispatch(applyUserSettings(incoming));
    expect(settingsSignature(extractUxuiSettings(s.getState(), win))).toBe(sig);
  });
});

describe('deleteNotUsedUserSettings', () => {
  const now = Date.parse('2026-12-31T00:00:00.000Z');
  it('reads the rows of the user and deletes the expired ones only', async () => {
    const rows = [
      { rowGUID: 'own', rowParentGUID: 'desktop', rowFolderGUID: 'macos', rowJSON: { lastUsedAt: '2026-01-01T00:00:00.000Z' } },
      { rowGUID: 'old', rowParentGUID: 'phone', rowFolderGUID: 'ios', rowJSON: { lastUsedAt: '2026-10-01T00:00:00.000Z' } },
      { rowGUID: 'new', rowParentGUID: 'tablet', rowFolderGUID: 'ipados', rowJSON: { lastUsedAt: '2026-12-20T00:00:00.000Z' } },
    ];
    const deleted: string[][] = [];
    const api = { readOwnRows: jest.fn(async () => rows), deleteRows: jest.fn(async (g: string[]) => { deleted.push(g); return g.length; }) };
    const gone = await deleteExpiredUserSettings(api, 'user-1', mac, now);
    expect(api.readOwnRows).toHaveBeenCalledWith('user-1');
    expect(gone).toEqual(['old']);
    expect(deleted).toEqual([['old']]);
  });
  it('nothing expired = no delete call', async () => {
    const api = { readOwnRows: async () => [], deleteRows: jest.fn(async () => 0) };
    expect(await deleteExpiredUserSettings(api, 'u', mac, now)).toEqual([]);
    expect(api.deleteRows).not.toHaveBeenCalled();
  });
  it('the saga starts on startUserSettingsCleanup and stops on stopUserSettingsCleanup', () => {
    const gen: any = deleteNotUsedUserSettingsSaga();
    const first = gen.next();
    expect(first.value.type).toBe('TAKE');
    const forked = gen.next(startUserSettingsCleanup({ userGUID: 'u', key: mac }));
    expect(forked.value.type).toBe('FORK');
    const again = gen.next('task');
    expect(again.value.type).toBe('TAKE');
    const cancelled = gen.next(stopUserSettingsCleanup());
    expect(cancelled.value.type).toBe('CANCEL');
  });
});
