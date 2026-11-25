// The blocks of the /settings screen. Every block reads / writes the redux state (uxuiState, userTheme); the sync to userSettingsTable is done by UserSettingsHost.
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import {
  resetThemeColors,
  selectExtendedSettings,
  selectThemeSettings,
  setAskBeforeDeletePost,
  setBottomTabsAreVisible,
  setDashboardSettings,
  setIconsVariant,
  setPlayVideoSettings,
  setRecordVideoSettings,
  setThemeColor,
  setThemeElementFont,
  setThemeSettings,
} from '../../redux/uxuiSlice';
import { setFabColor } from '../../redux/userThemeSlice';
import { PLAY_VIDEO_LIMITS, selectPlayVideoSettings } from '../../redux/playVideoSettings';
import { RECORD_DATE_TIME_OVER_POSITIONS, selectRecordVideoSettings } from '../../redux/recordVideoSettings';
import RadioSetApp from '../components/RadioSetApp';
import SegmentButtonsApp from '../components/common/SegmentButtonsApp';
import SwitchApp from '../components/common/SwitchApp';
import ColorPickerRowApp from '../components/common/ColorPickerRowApp';
import ButtonSecondaryApp from '../components/common/ButtonSecondaryApp';
import DesignSystemSelectorComponent from '../components/DesignSystemSelectorComponent';
import { FABAnimationSelectorComponent } from '../components/fab/FABAnimationSelectorComponent';
import DarkThemeSwitchComponent from '../components/DarkThemeSwitchComponent';
import { FONT_LABELS, FONT_NAMES, FONT_SIZE_LABELS, FONT_SIZE_NAMES, FontName, FontSizeName, resolveFont, fontStackFor, SYSTEM_SANS_STACK } from '../fonts/fontCatalog';
import { loadFont } from '../fonts/useAppFonts';
import { textFamily } from '../fonts/paperFonts';
import { DashboardFontSettings, deviceKeyLabel, ExtendedSettings, THEME_ELEMENTS, ThemeElement, TRANSPARENT } from '../../catalog/user/settings/userSettingsModel';
import { useUserSettingsActions } from '../../catalog/user/settings/useUserSettings';
import { THEME_COLOR_KEYS } from './settingsModel';

export function Block({ title, hint, children, testID }: { title: string; hint?: string; children: React.ReactNode; testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  return (
    <View testID={testID} style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 14 }}>
      <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', marginBottom: hint ? 2 : 10 }}>{title}</Text>
      {!!hint && <Text style={{ color: c.text, opacity: 0.65, fontSize: 13, marginBottom: 10 }}>{hint}</Text>}
      {children}
    </View>
  );
}

/** the text of a font sample in ITS font (the file is loaded when the block is shown) */
function sampleStyle(name: FontName, size: FontSizeName, role: 'body' | 'header' | 'title' = 'body') {
  const r = resolveFont({ fontName: name, fontSize: size }, role);
  const family = textFamily(name, r.fontWeight, Platform.OS === 'web');
  return { fontFamily: family, fontSize: r.fontSize, lineHeight: r.lineHeight, letterSpacing: r.letterSpacing, fontWeight: family && name !== 'system' ? ('normal' as const) : (String(r.fontWeight) as any) };
}

// ---------------------------------------------------------------- General
export function DesignSystemBlock() {
  return <DesignSystemSelectorComponent />;
}
export function DarkModeBlock() {
  return (
    <Block title="Dark mode">
      <DarkThemeSwitchComponent testID="settings-dark-switch" showIcon={false} />
    </Block>
  );
}
export function IconsBlock() {
  const dispatch = useDispatch();
  const { iconsVariant } = useDesignSystem();
  return (
    <Block title="Icon styles">
      <SegmentButtonsApp
        testID="settings-icons"
        value={iconsVariant}
        onValueChange={(v: any) => dispatch(setIconsVariant(v))}
        buttons={[{ value: 'materialIconsOnly', label: 'Material Icons' }, { value: 'platformOrientedIcons', label: 'Platform Oriented' }]}
      />
    </Block>
  );
}
export function BehaviourBlock() {
  const dispatch = useDispatch();
  const tabs = useSelector((s: any) => Boolean(s?.uxuiState?.bottomTabsAreVisible));
  const ask = useSelector((s: any) => s?.uxuiState?.askBeforeDeletePost !== false);
  return (
    <Block title="Buttons and questions">
      <SwitchApp testID="settings-bottom-tabs" label="Bottom tabs" value={tabs} onValueChange={(v) => dispatch(setBottomTabsAreVisible(v))} />
      <View style={{ height: 8 }} />
      <SwitchApp testID="settings-ask-delete" label="Ask before deleting a post" value={ask} onValueChange={(v) => dispatch(setAskBeforeDeletePost(v))} />
      <View style={{ height: 12 }} />
      <FABAnimationSelectorComponent />
    </Block>
  );
}

// ---------------------------------------------------------------- Fonts
export function FontThemeBlock() {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const theme = useSelector(selectThemeSettings);
  const [, setTick] = useState(0);
  useEffect(() => {
    // the files of the three bundled fonts, so every name below is drawn in its own font
    Promise.all((['roboto', 'inter', 'selawik'] as FontName[]).map((n) => loadFont(n))).then(() => setTick((t) => t + 1));
  }, []);
  return (
    <Block title="Font of the interface" hint="System = the font of your device or browser. Roboto, Inter and Selawik are bundled (open licenses).">
      <View testID="settings-font-names">
        {FONT_NAMES.map((n) => {
          const on = theme.fontName === n;
          return (
            <Pressable
              key={n}
              testID={`settings-font-${n}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => dispatch(setThemeSettings({ fontName: n }))}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: on ? c.primary : c.border, marginBottom: 6 }}
            >
              <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? c.primary : c.border, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                {on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: c.text }, sampleStyle(n, theme.fontSize, 'header')]}>{FONT_LABELS[n]}{n === 'system' ? ' - the font of this device' : ''}</Text>
                <Text style={[{ color: c.text, opacity: 0.75 }, sampleStyle(n, theme.fontSize)]}>The quick brown fox jumps over the lazy dog 0123456789</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: c.text, fontWeight: '600', marginTop: 8, marginBottom: 6 }}>Size</Text>
      <SegmentButtonsApp
        testID="settings-font-size"
        value={theme.fontSize}
        onValueChange={(v: any) => dispatch(setThemeSettings({ fontSize: v }))}
        buttons={FONT_SIZE_NAMES.map((s) => ({ value: s, label: FONT_SIZE_LABELS[s] }))}
      />
      <Text testID="settings-font-size-note" style={{ color: c.text, opacity: 0.65, fontSize: 12, marginTop: 4 }}>Body text: {FONT_SIZE_NAMES.map((s) => `${resolveFont({ fontName: 'system', fontSize: s }).fontSize} px`).join(' / ')} (Material 3 type scale)</Text>
    </Block>
  );
}

const ELEMENT_LABELS: Record<ThemeElement, string> = { input: 'Input text', label: 'Label', button: 'Button', title: 'Title' };

export function FontElementsBlock() {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const theme = useSelector(selectThemeSettings);
  return (
    <Block title="Font of each element" hint="Each element follows the font of the interface until you choose its own.">
      {THEME_ELEMENTS.map((el) => {
        const own = theme.elements[el];
        const name = own?.fontName ?? 'theme';
        const size = own?.fontSize ?? 'theme';
        const set = (patch: { fontName?: string; fontSize?: string }) => {
          const fontName = (patch.fontName ?? name) as string;
          const fontSize = (patch.fontSize ?? size) as string;
          if (fontName === 'theme' && fontSize === 'theme') dispatch(setThemeElementFont({ element: el, font: null }));
          else dispatch(setThemeElementFont({ element: el, font: { fontName: (fontName === 'theme' ? theme.fontName : fontName) as FontName, fontSize: (fontSize === 'theme' ? theme.fontSize : fontSize) as FontSizeName } }));
        };
        return (
          <View key={el} testID={`settings-element-${el}`} style={{ marginBottom: 12 }}>
            <Text style={{ color: c.text, fontWeight: '600', marginBottom: 4 }}>{ELEMENT_LABELS[el]}</Text>
            <SegmentButtonsApp compact testID={`settings-element-${el}-name`} value={name} onValueChange={(v: any) => set({ fontName: v })} buttons={[{ value: 'theme', label: 'Theme' }, ...FONT_NAMES.map((n) => ({ value: n, label: FONT_LABELS[n] }))]} />
            <View style={{ height: 4 }} />
            <SegmentButtonsApp compact testID={`settings-element-${el}-size`} value={size} onValueChange={(v: any) => set({ fontSize: v })} buttons={[{ value: 'theme', label: 'Theme' }, ...FONT_SIZE_NAMES.map((s) => ({ value: s, label: FONT_SIZE_LABELS[s] }))]} />
          </View>
        );
      })}
    </Block>
  );
}

// ---------------------------------------------------------------- Colors
export function ThemeColorsBlock() {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const theme = useSelector(selectThemeSettings);
  const paper = useSelector((s: any) => s?.userTheme?.theme?.colors || {});
  return (
    <Block title="Theme colors" hint="The colors you change are saved with your settings and follow you to every device of this kind.">
      {THEME_COLOR_KEYS.map(({ key, title }) => (
        <View key={key} testID={`settings-color-${key}`} style={{ marginBottom: 10 }}>
          <Text style={{ color: c.text, fontWeight: '600', marginBottom: 4 }}>{title}{theme.colors[key] ? '' : '  (palette)'}</Text>
          <ColorPickerRowApp
            testID={`settings-color-${key}-picker`}
            value={theme.colors[key] ?? null}
            defaultColor={typeof paper[key] === 'string' ? paper[key] : undefined}
            onChange={(v) => dispatch(setThemeColor({ key, value: v }))}
          />
        </View>
      ))}
      <ButtonSecondaryApp testID="settings-colors-reset" onPress={() => dispatch(resetThemeColors())}>Reset the colors</ButtonSecondaryApp>
    </Block>
  );
}
export function FabColorBlock() {
  const dispatch = useDispatch();
  const theme = useSelector(selectThemeSettings);
  return (
    <Block title="Floating button color">
      <ColorPickerRowApp
        testID="settings-fab-color"
        value={theme.fabColor}
        onChange={(v) => {
          dispatch(setThemeSettings({ fabColor: v }));
          dispatch(setFabColor(v || undefined));
        }}
      />
    </Block>
  );
}

// ---------------------------------------------------------------- Dashboards
export function DashboardBlock({ dashboard, title }: { dashboard: keyof ExtendedSettings; title: string }) {
  const dispatch = useDispatch();
  const { themeColors: c } = useDesignSystem();
  const all = useSelector(selectExtendedSettings);
  const d: DashboardFontSettings = all[dashboard];
  const patch = (p: Partial<DashboardFontSettings>) => dispatch(setDashboardSettings({ dashboard, patch: p }));
  const fontRow = (which: 'header' | 'dataCell', label: string) => (
    <View style={{ marginBottom: 10 }} testID={`settings-${dashboard}-${which}`}>
      <Text style={{ color: c.text, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
      <SegmentButtonsApp compact testID={`settings-${dashboard}-${which}-name`} value={d[which].fontName} onValueChange={(v: any) => patch({ [which]: { ...d[which], fontName: v } } as any)} buttons={FONT_NAMES.map((n) => ({ value: n, label: FONT_LABELS[n] }))} />
      <View style={{ height: 4 }} />
      <SegmentButtonsApp compact testID={`settings-${dashboard}-${which}-size`} value={d[which].fontSize} onValueChange={(v: any) => patch({ [which]: { ...d[which], fontSize: v } } as any)} buttons={FONT_SIZE_NAMES.map((s) => ({ value: s, label: FONT_SIZE_LABELS[s] }))} />
    </View>
  );
  return (
    <Block title={title} hint="The header and the data cells of the table, and the background of the cells (transparent shows the theme).">
      {fontRow('header', 'Header font')}
      {fontRow('dataCell', 'Data cell font')}
      <Text style={{ color: c.text, fontWeight: '600', marginBottom: 4 }}>Cell background{d.cellBackground === TRANSPARENT ? '  (transparent)' : ''}</Text>
      <ColorPickerRowApp testID={`settings-${dashboard}-bg`} value={d.cellBackground === TRANSPARENT ? null : d.cellBackground} onChange={(v) => patch({ cellBackground: v ?? TRANSPARENT })} />
    </Block>
  );
}

// ---------------------------------------------------------------- Media
export function PlayVideoBlock() {
  const dispatch = useDispatch();
  const s = useSelector(selectPlayVideoSettings);
  const L = PLAY_VIDEO_LIMITS;
  const hide = [1.5, 2.5, 5, 10].filter((v) => v >= L.hideButtonsAfter.min && v <= L.hideButtonsAfter.max);
  const jump = [5, 10, 15, 30];
  return (
    <Block title="Video player">
      <Text style={{ fontWeight: '600', marginBottom: 4 }}>Hide the buttons after (seconds)</Text>
      <SegmentButtonsApp testID="settings-play-hide" value={String(s.hideButtonsAfter)} onValueChange={(v: any) => dispatch(setPlayVideoSettings({ hideButtonsAfter: parseFloat(v) }))} buttons={hide.map((v) => ({ value: String(v), label: String(v) }))} />
      <Text style={{ fontWeight: '600', marginTop: 10, marginBottom: 4 }}>Rewind / forward (seconds)</Text>
      <SegmentButtonsApp testID="settings-play-jump" value={String(s.rewindSecondsValue)} onValueChange={(v: any) => dispatch(setPlayVideoSettings({ rewindSecondsValue: parseFloat(v) }))} buttons={jump.map((v) => ({ value: String(v), label: String(v) }))} />
    </Block>
  );
}
export function RecordVideoBlock() {
  const dispatch = useDispatch();
  const s = useSelector(selectRecordVideoSettings);
  return (
    <Block title="Video recorder">
      <SwitchApp testID="settings-record-stamp" label="Date and time over the video" value={s.recordDateTimeOverEnabled} onValueChange={(v) => dispatch(setRecordVideoSettings({ recordDateTimeOverEnabled: v }))} />
      {s.recordDateTimeOverEnabled && (
        <RadioSetApp testID="settings-record-position" columns={2} options={RECORD_DATE_TIME_OVER_POSITIONS.map((p) => ({ id: p.id, label: p.label }))} value={s.recordDateTimeOverPosition} onChange={(v: any) => dispatch(setRecordVideoSettings({ recordDateTimeOverPosition: v }))} style={{ marginTop: 8 }} />
      )}
      <View style={{ height: 8 }} />
      <SwitchApp testID="settings-record-torch" label="Flashlight while the camera is open" value={s.recordTorchEnabled} onValueChange={(v) => dispatch(setRecordVideoSettings({ recordTorchEnabled: v }))} />
    </Block>
  );
}

// ---------------------------------------------------------------- This device
export function DeviceBlock() {
  const { themeColors: c } = useDesignSystem();
  const { key, mine, others, signedIn, copyFromDevice, resetToDefaults } = useUserSettingsActions();
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<string>('');
  const run = async (what: string, fn: () => Promise<any>, ok: string) => {
    setBusy(what);
    setMsg('');
    try { await fn(); setMsg(ok); } catch (e: any) { setMsg(String(e?.message || e)); } finally { setBusy(''); }
  };
  return (
    <Block title="This device" hint="Your settings are kept for each kind of device (desktop, phone or tablet) and operating system, and shared by all your browsers and work places of that kind.">
      <Text testID="settings-device-key" style={{ color: c.text, fontWeight: '600' }}>{deviceKeyLabel(key)}</Text>
      <Text style={{ color: c.text, opacity: 0.7, marginBottom: 10 }}>
        {!signedIn ? 'Not signed in: the settings stay on this device only until you sign in.' : mine ? `Saved. Last used: ${String(mine.rowJSON?.lastUsedAt || '').slice(0, 10)}` : 'Not saved yet.'}
      </Text>
      {signedIn && others.length > 0 && (
        <View style={{ marginBottom: 10 }} testID="settings-copy-from">
          <Text style={{ color: c.text, fontWeight: '600', marginBottom: 6 }}>Copy from my other device</Text>
          {others.map((r: any) => (
            <ButtonSecondaryApp
              key={r.rowGUID}
              testID={`settings-copy-from-${r.rowParentGUID}-${r.rowFolderGUID}`}
              disabled={!!busy}
              onPress={() => run('copy', () => copyFromDevice({ deviceType: r.rowParentGUID, os: r.rowFolderGUID }), 'Copied.')}
            >
              {deviceKeyLabel({ deviceType: r.rowParentGUID, os: r.rowFolderGUID })}
            </ButtonSecondaryApp>
          ))}
        </View>
      )}
      <ButtonSecondaryApp testID="settings-reset-defaults" disabled={!!busy} onPress={() => run('reset', resetToDefaults, 'The defaults of this device are back.')}>Reset to the defaults of this device</ButtonSecondaryApp>
      {!!msg && <Text testID="settings-device-message" style={{ color: c.text, marginTop: 8 }}>{msg}</Text>}
    </Block>
  );
}

/** id of a section -> the block that draws it */
export const SECTION_COMPONENTS: Record<string, React.ComponentType> = {
  'design-system': DesignSystemBlock,
  'dark-mode': DarkModeBlock,
  icons: IconsBlock,
  behaviour: BehaviourBlock,
  'font-theme': FontThemeBlock,
  'font-elements': FontElementsBlock,
  colors: ThemeColorsBlock,
  'fab-color': FabColorBlock,
  'dash-estimation': () => <DashboardBlock dashboard="estimationDashboard" title="Estimation dashboard" />,
  'dash-project': () => <DashboardBlock dashboard="projectDashboard" title="Project dashboard" />,
  'media-play': PlayVideoBlock,
  'media-record': RecordVideoBlock,
  'device-info': DeviceBlock,
};
