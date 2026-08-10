import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { MD3Theme, MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import { CustomLightTheme, CustomDarkTheme } from "../theme/palettes";

export interface UserThemeState {
  isDark: boolean;
  theme: MD3Theme;
  fabColor?: string;
}

const initialState: UserThemeState = {
  isDark: false,
  theme: CustomLightTheme,
  fabColor: undefined,
};

export const userThemeSlice = createSlice({
  name: "userTheme",
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<"light" | "dark">) => {
      state.isDark = action.payload === "dark";
      state.theme = action.payload === "dark" ? CustomDarkTheme : CustomLightTheme;
    },
    toggleThemeMode: (state) => {
      state.isDark = !state.isDark;
      state.theme = state.isDark ? CustomDarkTheme : CustomLightTheme;
    },
    setCustomTheme: (state, action: PayloadAction<Partial<MD3Theme["colors"]>>) => {
      state.theme = {
        ...state.theme,
        colors: {
          ...state.theme.colors,
          ...action.payload,
        },
      };
    },
    updateThemeColor: (
      state,
      action: PayloadAction<{ key: keyof MD3Theme["colors"]; value: string }>
    ) => {
      const { key, value } = action.payload;
      state.theme.colors[key] = value as any;
    },
    setFabColor: (state, action: PayloadAction<string | undefined>) => {
      state.fabColor = action.payload;
    },
    resetTheme: (state) => {
      state.theme = state.isDark ? CustomDarkTheme : CustomLightTheme;
      state.fabColor = undefined;
    },
    // themeStore-ticket-step3: Apply theme JSON loaded from Supabase themeStore
    applyThemeFromSupabase: (state, action: PayloadAction<any>) => {
      const payload = action.payload || {};
      if (typeof payload.isDark === 'boolean') {
        state.isDark = payload.isDark;
      }
      if (payload.theme) {
        state.theme = {
          ...state.theme,
          ...payload.theme,
          colors: {
            ...state.theme?.colors,
            ...payload.theme?.colors,
          },
        };
      } else {
        state.theme = state.isDark ? CustomDarkTheme : CustomLightTheme;
      }
      if (payload.fabColor !== undefined) {
        state.fabColor = payload.fabColor;
      }
    },
  },
});

export const {
  setThemeMode,
  toggleThemeMode,
  setCustomTheme,
  updateThemeColor,
  setFabColor,
  resetTheme,
  applyThemeFromSupabase,
} = userThemeSlice.actions;

export default userThemeSlice.reducer;

