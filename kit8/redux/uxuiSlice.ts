import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type FABAnimationVariant = 'defaultFABAnimation' | 'reanimatedBasicFABAnimation';
export type DesignSystemType = 'tamagui' | 'paper' | 'ant' | 'native' | 'expo' | 'googlemd3web';
export type IconsVariant = 'materialIconsOnly' | 'platformOrientedIcons';

export interface SnackbarState {
  visible: boolean;
  message: string;
  duration: number;
  actionLabel?: string;
  undoDeleteData?: any;
  entityName?: string;
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
  /** Project dashboard: app bar buttons (kit8/ui/AppBar.tsx -> PMAppBarButtons) */
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
  activeDesignSystem: 'paper',
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
      } else {
        state.snackbar.message = action.payload.message;
        if (action.payload.duration) state.snackbar.duration = action.payload.duration;
        state.snackbar.actionLabel = action.payload.actionLabel || (action.payload.undoDeleteData ? 'Undo' : 'OK');
        state.snackbar.undoDeleteData = action.payload.undoDeleteData !== undefined ? action.payload.undoDeleteData : null;
        state.snackbar.entityName = action.payload.entityName || 'mediaPostReusable';
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
  showSnackbar,
  hideSnackbar,
  toggleSnackbar,
} = uxuiSlice.actions;

export default uxuiSlice.reducer;
