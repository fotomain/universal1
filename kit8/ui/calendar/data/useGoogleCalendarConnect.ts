// "Connect Google Calendar": gets a Google access token with the calendar scope (expo-auth-session,
// the recommended Google provider: web, Android and iOS). The token lives in memory for its lifetime
// (about one hour); after that the user connects again with one tap.
//
// .env (Google Cloud Console > APIs & Services > Credentials; enable the "Google Calendar API"):
//   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com       (web; authorised JS origin + redirect URI = the app URL)
//   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com   (Android client of the app package)
//   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com       (iOS client of the bundle id)

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GOOGLE_CALENDAR_SCOPE } from './userCalendarGoogle';

WebBrowser.maybeCompleteAuthSession();

const CLIENT_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
};

/** True when .env has the Google client id of this platform (the hook below must not be used otherwise). */
export const isGoogleCalendarConfigured = () => !!(Platform.OS === 'web' ? CLIENT_IDS.web : Platform.OS === 'ios' ? CLIENT_IDS.ios : CLIENT_IDS.android);

let token: { accessToken: string; expiresAtMs: number } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The current Google Calendar access token, or null (not connected / expired). */
export function getGoogleCalendarToken(): string | null {
  if (token && token.expiresAtMs - 60 * 1000 > Date.now()) return token.accessToken;
  return null;
}

export function disconnectGoogleCalendar() {
  token = null;
  emit();
}

/** Any component: is Google Calendar connected right now? */
export function useGoogleCalendarToken(): string | null {
  return useSyncExternalStore(subscribe, getGoogleCalendarToken, () => null);
}

/**
 * Only in a component that is rendered when isGoogleCalendarConfigured() is true
 * (the Google provider needs the client id of the platform).
 */
export function useGoogleCalendarConnect() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: CLIENT_IDS.web || undefined,
    androidClientId: CLIENT_IDS.android || undefined,
    iosClientId: CLIENT_IDS.ios || undefined,
    scopes: ['openid', 'email', GOOGLE_CALENDAR_SCOPE],
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const auth = response.authentication;
    const accessToken = auth?.accessToken || (response.params as any)?.access_token;
    if (!accessToken) return;
    const seconds = Number(auth?.expiresIn || (response.params as any)?.expires_in) || 3600;
    token = { accessToken, expiresAtMs: Date.now() + seconds * 1000 };
    emit();
  }, [response]);

  const connect = useCallback(() => promptAsync(), [promptAsync]);
  return { ready: !!request, connect, connected: !!useGoogleCalendarToken(), disconnect: disconnectGoogleCalendar };
}
