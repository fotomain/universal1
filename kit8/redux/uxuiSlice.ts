import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type FABAnimationVariant = 'defaultFABAnimation' | 'reanimatedBasicFABAnimation';
export type DesignSystemType = 'tamagui' | 'paper' | 'ant' | 'native' | 'expo' | 'googlemd3web';
export type IconsVariant = 'materialIconsOnly' | 'platformOrientedIcons';

export interface SnackbarState {
  visible: boolean;
  message: string;
  duration: number;
  actionLabel?: string;
}

export interface UxuiState {
  darkMode: boolean;
  fabAnimationVariant: FABAnimationVariant;
  activeDesignSystem: DesignSystemType;
  iconsVariant: IconsVariant;
  bottomTabsAreVisible: boolean;
  snackbar: SnackbarState;
}

const uxuiInitialState: UxuiState = {
  darkMode: false, // uxuiState:darkMode = false at first login
  fabAnimationVariant: 'defaultFABAnimation',
  activeDesignSystem: 'paper',
  iconsVariant: 'materialIconsOnly',
  bottomTabsAreVisible: false,
  snackbar: {
    visible: false,
    message: '',
    duration: 3000,
    actionLabel: 'OK',
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
    showSnackbar: (state, action: PayloadAction<{ message: string; duration?: number; actionLabel?: string } | string>) => {
      if (!state.snackbar) {
        state.snackbar = { visible: false, message: '', duration: 3000, actionLabel: 'OK' };
      }
      state.snackbar.visible = true;
      if (typeof action.payload === 'string') {
        state.snackbar.message = action.payload;
      } else {
        state.snackbar.message = action.payload.message;
        if (action.payload.duration) state.snackbar.duration = action.payload.duration;
        if (action.payload.actionLabel) state.snackbar.actionLabel = action.payload.actionLabel;
      }
    },
    hideSnackbar: (state) => {
      if (!state.snackbar) {
        state.snackbar = { visible: false, message: '', duration: 3000, actionLabel: 'OK' };
      }
      state.snackbar.visible = false;
    },
    toggleSnackbar: (state, action: PayloadAction<{ visible?: boolean; message?: string } | boolean | undefined>) => {
      if (!state.snackbar) {
        state.snackbar = { visible: false, message: '', duration: 3000, actionLabel: 'OK' };
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
  showSnackbar,
  hideSnackbar,
  toggleSnackbar,
} = uxuiSlice.actions;

export default uxuiSlice.reducer;
