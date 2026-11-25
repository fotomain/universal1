import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getDeviceKey } from "../catalog/user/settings/deviceKey";
import { normalizePlayVideoSettings, PLAY_VIDEO_DEFAULTS, PlayVideoSettings } from "./playVideoSettings";
import { normalizeRecordVideoSettings, RECORD_VIDEO_DEFAULTS, RecordVideoSettings } from "./recordVideoSettings";
import {
  defaultExtendedSettings,
  defaultThemeSettings,
  DashboardFontSettings,
  ExtendedSettings,
  FontSetting,
  normalizeExtendedSettings,
  normalizeFontSetting,
  normalizeThemeSettings,
  ThemeElement,
  ThemeSettings,
  UxuiSettingsJSON,
  extendedSettingsToJSON,
  defaultDesignSystemFor,
} from "../catalog/user/settings/userSettingsModel";

export type FABAnimationVariant = 'defaultFABAnimation' | 'reanimatedBasicFABAnimation';
export type DesignSystemType = 'tamagui' | 'paper' | 'ant' | 'native' | 'expo' | 'googlemd3web' | 'applemacui';
export type IconsVariant = 'materialIconsOnly' | 'platformOrientedIcons';

export interface SnackbarState {
  visible: boolean;
  message: string;
  duration: number;
  actionLabel?: string;
  undoDeleteData?: any;
  entityName?: string;
  /** an error message (a failed post ...): the snack bar is red */
  isError?: boolean;
}

export interface UxuiState {
  darkMode: boolean;
  fabAnimationVariant: FABAnimationVariant;
  activeDesignSystem: DesignSystemType;
  iconsVariant: IconsVariant;
  bottomTabsAreVisible: boolean;
  askBeforeDeletePost: boolean;
  snackbar: SnackbarState;
  /** JSON of the record the user is looking at (project settings, edit task, task page, dependency ...):
   *  "Share screenshot + JSON" of the app three dots menu sends it together with the screenshot. */
  currentJSON: UxuiCurrentJSON | null;
  /** Project dashboard: app bar buttons (kit8/ui/components/common/ApplicationBarApp.tsx -> PMAppBarButtons) */
  hideProjectToolBar: boolean;
  hideGanttToolBar: boolean;
  hideGanttChartNode: boolean;
  hideTreeNode: boolean;
  /** counter: every "refresh" press adds 1; the Project dashboard re-reads its data when it changes */
  refreshProjectData: number;
  /** Task tree: the "select lines" column (round check boxes) is hidden (tree tool bar button) */
  hideTreeSelectColumn: boolean;
  /** What another app shared into this app (kit8/providers/WithIntent.tsx); null = nothing waiting. */
  intentInfo: UxuiIntentInfo | null;
  /** Video player (kit8/ui/components/media): hide the buttons after N seconds, rewind / forward N seconds. A persisted state of an older version has none: read it with selectPlayVideoSettings. */
  PlayVideoSettings: PlayVideoSettings;
  /** Video recorder: the date and time over the video + its corner. Read it with selectRecordVideoSettings (documentation/CAMERA_DATE_TIME.html). */
  RecordVideoSettings: RecordVideoSettings;
  /** Fonts and colors the user chose (userSettingsTable.rowJSON.uxuiState.themeSettings). A persisted state of an older version has none: read it with selectThemeSettings. */
  themeSettings: ThemeSettings;
  /** Fonts + cell background of the Estimation / Project dashboard (rowJSON.uxuiState.extendedSettings, in the owner's key names). Read it with selectExtendedSettings. */
  extendedSettings: Record<string, any>;
}

/** uxui.intentInfo: what was received + what the user decided to add from it. */
export type UxuiIntentTarget = 'projectTask' | 'projectStage' | 'calendarTask' | 'mediaPost';
export type UxuiIntentPostType = 'youtube' | 'webpage' | 'file' | 'text';

export interface UxuiIntentFile {
  path: string;
  mimeType?: string | null;
  fileName?: string | null;
  size?: number | null;
}

export interface UxuiIntentInfo {
  /** one id per received share */
  intentGUID: string;
  /** ISO time it arrived */
  intentReceivedAt: string;
  /** the shared link, or the path / content uri of the first shared file */
  intentURL: string | null;
  /** MIME type: of the first file, 'text/uri-list' for a link, 'text/plain' for text */
  intentMIME: string | null;
  /** shared plain text (may contain the link) */
  intentText: string | null;
  /** page / video title when the sharing app sent one */
  intentTitle: string | null;
  intentFiles: UxuiIntentFile[];
  /** detected post type: YouTube link, other web link, local file, plain text */
  intentPostType: UxuiIntentPostType;
  /** new = the "what to add" question is open; routed = the user chose, the target screen takes it; done */
  intentStatus: 'new' | 'routed' | 'done';
  /** what the user chose in RadioSetApp */
  intentTarget?: UxuiIntentTarget | null;
}

/** uxui.currentJSON: what the JSON is (shown as the file name / caption) + the JSON itself. */
export interface UxuiCurrentJSON {
  /** e.g. 'project', 'task', 'dependency' */
  kind: string;
  title?: string;
  json: any;
}

const uxuiInitialState: UxuiState = {
  darkMode: false, // uxuiState:darkMode = false at first login
  fabAnimationVariant: 'defaultFABAnimation',
  activeDesignSystem: defaultDesignSystemFor(getDeviceKey().os), // Rule 1: the most native look - Expo UI on Apple, Paper elsewhere (a persisted choice of an older state wins)
  iconsVariant: 'materialIconsOnly',
  bottomTabsAreVisible: false,
  askBeforeDeletePost: true,
  currentJSON: null,
  hideProjectToolBar: false,
  hideGanttToolBar: false,
  hideGanttChartNode: false,
  hideTreeNode: false,
  refreshProjectData: 0,
  hideTreeSelectColumn: false,
  intentInfo: null,
  PlayVideoSettings: { ...PLAY_VIDEO_DEFAULTS },
  RecordVideoSettings: { ...RECORD_VIDEO_DEFAULTS },
  themeSettings: defaultThemeSettings(),
  extendedSettings: extendedSettingsToJSON(defaultExtendedSettings()),
  snackbar: {
    visible: false,
    message: '',
    duration: 4000,
    actionLabel: 'OK',
    undoDeleteData: null,
    entityName: 'mediaPostReusable',
  },
};

const uxuiSlice = createSlice({
  name: "uxuiState",
  initialState: uxuiInitialState,
  reducers: {
    setDarkMode: (state, action: PayloadAction<boolean>) => {
      state.darkMode = action.payload;
    },
    toggleDarkMode: (state) => {
      state.darkMode = !state.darkMode;
    },
    setFabAnimationVariant: (state, action: PayloadAction<FABAnimationVariant>) => {
      state.fabAnimationVariant = action.payload;
    },
    setDesignSystem: (state, action: PayloadAction<DesignSystemType>) => {
      state.activeDesignSystem = action.payload;
    },
    setIconsVariant: (state, action: PayloadAction<IconsVariant>) => {
      state.iconsVariant = action.payload;
    },
    setBottomTabsAreVisible: (state, action: PayloadAction<boolean>) => {
      state.bottomTabsAreVisible = action.payload;
    },
    setAskBeforeDeletePost: (state, action: PayloadAction<boolean>) => {
      state.askBeforeDeletePost = action.payload;
    },
    toggleAskBeforeDeletePost: (state) => {
      state.askBeforeDeletePost = !state.askBeforeDeletePost;
    },
    setCurrentJSON: (state, action: PayloadAction<UxuiCurrentJSON | null>) => {
      state.currentJSON = action.payload;
    },
    setHideProjectToolBar: (state, action: PayloadAction<boolean>) => {
      state.hideProjectToolBar = action.payload;
    },
    setHideGanttToolBar: (state, action: PayloadAction<boolean>) => {
      state.hideGanttToolBar = action.payload;
    },
    /** the chart and the tree are never hidden together: hiding one shows the other */
    setHideGanttChartNode: (state, action: PayloadAction<boolean>) => {
      state.hideGanttChartNode = action.payload;
      if (action.payload) state.hideTreeNode = false;
    },
    setHideTreeNode: (state, action: PayloadAction<boolean>) => {
      state.hideTreeNode = action.payload;
      if (action.payload) state.hideGanttChartNode = false;
    },
    refreshProjectData: (state) => {
      state.refreshProjectData = (state.refreshProjectData || 0) + 1;
    },
    setHideTreeSelectColumn: (state, action: PayloadAction<boolean>) => {
      state.hideTreeSelectColumn = action.payload;
    },
    /** the settings panel of the video player: only the given fields change, everything is kept valid */
    setPlayVideoSettings: (state, action: PayloadAction<Partial<PlayVideoSettings>>) => {
      state.PlayVideoSettings = normalizePlayVideoSettings({ ...normalizePlayVideoSettings(state.PlayVideoSettings), ...action.payload });
    },
    resetPlayVideoSettings: (state) => {
      state.PlayVideoSettings = { ...PLAY_VIDEO_DEFAULTS };
    },
    setRecordVideoSettings: (state, action: PayloadAction<Partial<RecordVideoSettings>>) => {
      state.RecordVideoSettings = normalizeRecordVideoSettings({ ...normalizeRecordVideoSettings(state.RecordVideoSettings), ...action.payload });
    },
    resetRecordVideoSettings: (state) => {
      state.RecordVideoSettings = { ...RECORD_VIDEO_DEFAULTS };
    },
    // ===== userSettingsTable: fonts, colors, dashboards (kit8/catalog/user/settings)
    /** the font name / size of the theme and the colors: only the given fields change, everything is kept valid */
    setThemeSettings: (state, action: PayloadAction<Partial<ThemeSettings>>) => {
      state.themeSettings = normalizeThemeSettings({ ...normalizeThemeSettings(state.themeSettings), ...action.payload });
    },
    /** the font of ONE theme element (input, label, button, title); null = follows the theme font again */
    setThemeElementFont: (state, action: PayloadAction<{ element: ThemeElement; font: FontSetting | null }>) => {
      const cur = normalizeThemeSettings(state.themeSettings);
      const elements = { ...cur.elements };
      if (action.payload.font) elements[action.payload.element] = normalizeFontSetting(action.payload.font, cur);
      else delete elements[action.payload.element];
      state.themeSettings = { ...cur, elements };
    },
    /** one color of the theme (an MD3 color name); null = back to the palette */
    setThemeColor: (state, action: PayloadAction<{ key: string; value: string | null }>) => {
      const cur = normalizeThemeSettings(state.themeSettings);
      const colors = { ...cur.colors };
      if (action.payload.value) colors[action.payload.key] = action.payload.value;
      else delete colors[action.payload.key];
      state.themeSettings = normalizeThemeSettings({ ...cur, colors });
    },
    resetThemeColors: (state) => {
      state.themeSettings = { ...normalizeThemeSettings(state.themeSettings), colors: {}, fabColor: null };
    },
    /** the fonts / cell background of ONE dashboard */
    setDashboardSettings: (state, action: PayloadAction<{ dashboard: keyof ExtendedSettings; patch: Partial<DashboardFontSettings> }>) => {
      const cur = normalizeExtendedSettings(state.extendedSettings);
      const next: ExtendedSettings = { ...cur, [action.payload.dashboard]: { ...cur[action.payload.dashboard], ...action.payload.patch } };
      state.extendedSettings = extendedSettingsToJSON(normalizeExtendedSettings(extendedSettingsToJSON(next)));
    },
    /** the row of userSettingsTable of this device arrived (or Copy from my other device): its preferences become the state */
    applyUserSettings: (state, action: PayloadAction<UxuiSettingsJSON>) => {
      const p: any = action.payload || {};
      if (p.activeDesignSystem) state.activeDesignSystem = p.activeDesignSystem;
      if (p.iconsVariant) state.iconsVariant = p.iconsVariant;
      if (typeof p.darkMode === 'boolean') state.darkMode = p.darkMode;
      if (p.fabAnimationVariant) state.fabAnimationVariant = p.fabAnimationVariant;
      if (typeof p.bottomTabsAreVisible === 'boolean') state.bottomTabsAreVisible = p.bottomTabsAreVisible;
      if (typeof p.askBeforeDeletePost === 'boolean') state.askBeforeDeletePost = p.askBeforeDeletePost;
      if (p.PlayVideoSettings) state.PlayVideoSettings = normalizePlayVideoSettings(p.PlayVideoSettings);
      if (p.RecordVideoSettings) state.RecordVideoSettings = normalizeRecordVideoSettings(p.RecordVideoSettings);
      state.themeSettings = normalizeThemeSettings(p.themeSettings);
      state.extendedSettings = extendedSettingsToJSON(normalizeExtendedSettings(p.extendedSettings));
    },
    /** a new share arrived (null = forget it) */
    setIntentInfo: (state, action: PayloadAction<UxuiIntentInfo | null>) => {
      state.intentInfo = action.payload;
    },
    /** the user chose what to add / the target screen finished */
    updateIntentInfo: (state, action: PayloadAction<Partial<UxuiIntentInfo>>) => {
      if (state.intentInfo) state.intentInfo = { ...state.intentInfo, ...action.payload };
    },
    showSnackbar: (
      state,
      action: PayloadAction<
        | {
            message: string;
            duration?: number;
            actionLabel?: string;
            undoDeleteData?: any;
            entityName?: string;
            isError?: boolean;
          }
        | string
      >
    ) => {
      if (!state.snackbar) {
        state.snackbar = { visible: false, message: '', duration: 4000, actionLabel: 'OK', undoDeleteData: null, entityName: 'mediaPostReusable' };
      }
      state.snackbar.visible = true;
      if (typeof action.payload === 'string') {
        state.snackbar.message = action.payload;
        state.snackbar.actionLabel = 'OK';
        state.snackbar.undoDeleteData = null;
        state.snackbar.entityName = 'mediaPostReusable';
        state.snackbar.isError = false;
      } else {
        state.snackbar.message = action.payload.message;
        if (action.payload.duration) state.snackbar.duration = action.payload.duration;
        state.snackbar.actionLabel = action.payload.actionLabel || (action.payload.undoDeleteData ? 'Undo' : 'OK');
        state.snackbar.undoDeleteData = action.payload.undoDeleteData !== undefined ? action.payload.undoDeleteData : null;
        state.snackbar.entityName = action.payload.entityName || 'mediaPostReusable';
        state.snackbar.isError = Boolean(action.payload.isError);
      }
    },
    hideSnackbar: (state) => {
      if (!state.snackbar) {
        state.snackbar = { visible: false, message: '', duration: 4000, actionLabel: 'OK', undoDeleteData: null, entityName: 'mediaPostReusable' };
      }
      state.snackbar.visible = false;
    },
    toggleSnackbar: (state, action: PayloadAction<{ visible?: boolean; message?: string } | boolean | undefined>) => {
      if (!state.snackbar) {
        state.snackbar = { visible: false, message: '', duration: 4000, actionLabel: 'OK', undoDeleteData: null, entityName: 'mediaPostReusable' };
      }
      if (typeof action.payload === 'boolean') {
        state.snackbar.visible = action.payload;
      } else if (action.payload && typeof action.payload === 'object') {
        if (action.payload.visible !== undefined) state.snackbar.visible = action.payload.visible;
        if (action.payload.message !== undefined) state.snackbar.message = action.payload.message;
      } else {
        state.snackbar.visible = !state.snackbar.visible;
      }
    },
  },
});

export const {
  setDarkMode,
  toggleDarkMode,
  setFabAnimationVariant,
  setDesignSystem,
  setIconsVariant,
  setBottomTabsAreVisible,
  setAskBeforeDeletePost,
  toggleAskBeforeDeletePost,
  setCurrentJSON,
  setHideProjectToolBar,
  setHideGanttToolBar,
  setHideGanttChartNode,
  setHideTreeNode,
  refreshProjectData,
  setHideTreeSelectColumn,
  setIntentInfo,
  updateIntentInfo,
  setPlayVideoSettings,
  resetPlayVideoSettings,
  setRecordVideoSettings,
  resetRecordVideoSettings,
  setThemeSettings,
  setThemeElementFont,
  setThemeColor,
  resetThemeColors,
  setDashboardSettings,
  applyUserSettings,
  showSnackbar,
  hideSnackbar,
  toggleSnackbar,
} = uxuiSlice.actions;

export default uxuiSlice.reducer;

// ---- selectors of the settings of userSettingsTable: they return a STORED reference while the slice is unchanged (a selector that builds a new object per call loops)
const themeCache = new WeakMap<object, ThemeSettings>();
export function selectThemeSettings(state: any): ThemeSettings {
  const raw = state?.uxuiState?.themeSettings;
  if (!raw || typeof raw !== 'object') return DEFAULT_THEME_SETTINGS;
  let v = themeCache.get(raw);
  if (!v) { v = normalizeThemeSettings(raw); themeCache.set(raw, v); }
  return v;
}
const extendedCache = new WeakMap<object, ExtendedSettings>();
export function selectExtendedSettings(state: any): ExtendedSettings {
  const raw = state?.uxuiState?.extendedSettings;
  if (!raw || typeof raw !== 'object') return DEFAULT_EXTENDED_SETTINGS;
  let v = extendedCache.get(raw);
  if (!v) { v = normalizeExtendedSettings(raw); extendedCache.set(raw, v); }
  return v;
}
const DEFAULT_THEME_SETTINGS = defaultThemeSettings();
const DEFAULT_EXTENDED_SETTINGS = defaultExtendedSettings();
