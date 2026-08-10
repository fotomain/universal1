import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type FABAnimationVariant = 'defaultFABAnimation' | 'reanimatedBasicFABAnimation';
export type DesignSystemType = 'tamagui' | 'paper' | 'ant' | 'native' | 'expo' | 'googlemd3web';
export type IconsVariant = 'materialIconsOnly' | 'platformOrientedIcons';

export interface UxuiState {
  darkMode: boolean;
  fabAnimationVariant: FABAnimationVariant;
  activeDesignSystem: DesignSystemType;
  iconsVariant: IconsVariant;
}

const uxuiInitialState: UxuiState = {
  darkMode: false, // uxuiState:darkMode = false at first login
  fabAnimationVariant: 'defaultFABAnimation',
  activeDesignSystem: 'paper',
  iconsVariant: 'materialIconsOnly',
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
  },
});

export const { setDarkMode, toggleDarkMode, setFabAnimationVariant, setDesignSystem, setIconsVariant } = uxuiSlice.actions;
export default uxuiSlice.reducer;
