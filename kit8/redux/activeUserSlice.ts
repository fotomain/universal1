import { createSlice, PayloadAction } from "@reduxjs/toolkit";

/** Placeholder email of the signed-out ("guest") user. */
export const GUEST_USER_EMAIL = "user@example.com";

/** The user fields callers pass to setActiveUser (isLoggedIn is derived, never passed in). */
export interface ActiveUserData {
  /** string(32) - 32 character GUID */
  activeUserGUID: string; /* userGUID32 */
  activeUserEmail: string;
  activeUserFirstName: string;
  activeUserLastName: string;
}

export interface ActiveUserState extends ActiveUserData {
  /** activeUserEmail !== GUEST_USER_EMAIL - kept in sync by every reducer */
  isLoggedIn: boolean;
}

/** The single login rule. */
export const computeIsLoggedIn = (activeUserEmail: string | null | undefined): boolean =>
  activeUserEmail !== GUEST_USER_EMAIL;

/**
 * Use this in components: useSelector(selectIsLoggedIn).
 * Derived from the email, so it is also right for state rehydrated by redux-persist from an older
 * app version that had no isLoggedIn field.
 */
export const selectIsLoggedIn = (state: any): boolean => {
  const s = state?.activeUserState as Partial<ActiveUserState> | undefined;
  return !!s && computeIsLoggedIn(s.activeUserEmail);
};

export const formatTo32CharGUID = (guid: string): string => {
  /* userGUID32 - do not exclude '-' from supabase UID */
  const str = (guid || "");
  if (str.length >= 32) return str.slice(0, 32);
  return str.padEnd(32, "0");
};

const guestUser: ActiveUserData = {
  activeUserGUID: "111459c1-b433-47d4-bf99-031d23a7", /* userGUID32 - 32 chars including hyphens */
  activeUserEmail: GUEST_USER_EMAIL,
  activeUserFirstName: "John",
  activeUserLastName: "Doe",
};

const initialState: ActiveUserState = {
  ...guestUser,
  isLoggedIn: computeIsLoggedIn(guestUser.activeUserEmail), // false
};

export const activeUserSlice = createSlice({
  name: "activeUserState",
  initialState,
  reducers: {
    setActiveUser: (state, action: PayloadAction<ActiveUserData>) => {
      /* userGUID32 */
      state.activeUserGUID = formatTo32CharGUID(action.payload.activeUserGUID); /* userGUID32 */
      state.activeUserEmail = action.payload.activeUserEmail;
      state.activeUserFirstName = action.payload.activeUserFirstName;
      state.activeUserLastName = action.payload.activeUserLastName;
      state.isLoggedIn = computeIsLoggedIn(state.activeUserEmail);
    },
    /** Sign out: back to the guest user (so isLoggedIn becomes false). */
    clearActiveUser: () => ({ ...initialState }),
  },
});

export const { setActiveUser, clearActiveUser } = activeUserSlice.actions;
export default activeUserSlice.reducer;
