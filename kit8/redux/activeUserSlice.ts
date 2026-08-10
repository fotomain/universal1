import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ActiveUserState {
  /** string(32) - 32 character GUID */
  activeUserGUID: string; /* userGUID32 */
  activeUserEmail: string;
  activeUserFirstName: string;
  activeUserLastName: string;
}

export const formatTo32CharGUID = (guid: string): string => {
  /* userGUID32 - do not exclude '-' from supabase UID */
  const str = (guid || "");
  if (str.length >= 32) return str.slice(0, 32);
  return str.padEnd(32, "0");
};

const initialState: ActiveUserState = {
  activeUserGUID: "111459c1-b433-47d4-bf99-031d23a7", /* userGUID32 - 32 chars including hyphens */
  activeUserEmail: "user@example.com",
  activeUserFirstName: "John",
  activeUserLastName: "Doe",
};

export const activeUserSlice = createSlice({
  name: "activeUserState",
  initialState,
  reducers: {
    setActiveUser: (state, action: PayloadAction<ActiveUserState>) => {
      /* userGUID32 */
      state.activeUserGUID = formatTo32CharGUID(action.payload.activeUserGUID); /* userGUID32 */
      state.activeUserEmail = action.payload.activeUserEmail;
      state.activeUserFirstName = action.payload.activeUserFirstName;
      state.activeUserLastName = action.payload.activeUserLastName;
    },
    clearActiveUser: (state) => {
      state.activeUserGUID = ""; /* userGUID32 */
      state.activeUserEmail = "";
      state.activeUserFirstName = "";
      state.activeUserLastName = "";
    },
  },
});

export const { setActiveUser, clearActiveUser } = activeUserSlice.actions;
export default activeUserSlice.reducer;
