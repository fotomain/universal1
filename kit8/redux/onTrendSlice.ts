import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface OnTrendState {
  googleDriveNumberOfFiles: {
    dataset_shop_images: number;
    dataset_trend_images: number;
  };
  googleDriveUploading: boolean;
}

const initialState: OnTrendState = {
  googleDriveNumberOfFiles: {
    dataset_shop_images: 0,
    dataset_trend_images: 0,
  },
  googleDriveUploading: false,
};

export const onTrendSlice = createSlice({
  name: "onTrendState",
  initialState,
  reducers: {
    setShopImagesCount: (state, action: PayloadAction<number>) => {
      state.googleDriveNumberOfFiles.dataset_shop_images = action.payload;
    },
    setTrendImagesCount: (state, action: PayloadAction<number>) => {
      state.googleDriveNumberOfFiles.dataset_trend_images = action.payload;
    },
    setGoogleDriveNumberOfFiles: (
      state,
      action: PayloadAction<{ dataset_shop_images?: number; dataset_trend_images?: number }>
    ) => {
      if (typeof action.payload.dataset_shop_images === "number") {
        state.googleDriveNumberOfFiles.dataset_shop_images = action.payload.dataset_shop_images;
      }
      if (typeof action.payload.dataset_trend_images === "number") {
        state.googleDriveNumberOfFiles.dataset_trend_images = action.payload.dataset_trend_images;
      }
    },
    setGoogleDriveUploading: (state, action: PayloadAction<boolean>) => {
      state.googleDriveUploading = action.payload;
    },
    resetOnTrendState: (state) => {
      state.googleDriveNumberOfFiles.dataset_shop_images = 0;
      state.googleDriveNumberOfFiles.dataset_trend_images = 0;
      state.googleDriveUploading = false;
    },
  },
});

export const {
  setShopImagesCount,
  setTrendImagesCount,
  setGoogleDriveNumberOfFiles,
  setGoogleDriveUploading,
  resetOnTrendState,
} = onTrendSlice.actions;

export default onTrendSlice.reducer;
