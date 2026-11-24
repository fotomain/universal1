/** @jest-environment jsdom */
// The Sign In screen sends the user back to the screen he wanted (Identification, Record audio / video ...): its own `returnTo`, else the route the gate remembered
// (a Google / Microsoft sign in on the web, the e-mail link and the menu's Sign In row carry no returnTo), else the profile.
import React, { act } from 'react';

const mockReplace = jest.fn();
let mockParams: any = {};
let mockGoogleUser: any = null;

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
jest.mock('react-native-paper', () => {
  const R = require('react');
  const { View, Text: RNText } = require('react-native');
  return {
    useTheme: () => ({ colors: new Proxy({}, { get: () => '#888' }) }),
    Surface: ({ children }: any) => R.createElement(View, null, children),
    Text: ({ children }: any) => R.createElement(RNText, null, children),
  };
});
jest.mock('../../kit8/ui/components/common', () => ({ ButtonPrimaryApp: () => null, ButtonTextApp: () => null }));
jest.mock('../../kit8/ui/components/common/TextInputApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../kit8/ui/components/activityindicator/ActivityIndicatorCircleApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../kit8/auth/google/SignInWithGoogleButton', () => ({ __esModule: true, default: () => null }));
jest.mock('../../kit8/auth/microsoft/SignInWithMicrosoftButton', () => ({ __esModule: true, default: () => null }));
jest.mock('../../kit8/auth/otp/SignInWithEmailOtp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../kit8/auth/google/useAuth', () => ({ useAuthWithGoogle: () => ({ user: mockGoogleUser, loading: false, signIn: jest.fn() }) }));
jest.mock('../../kit8/auth/session/supabaseAvailability', () => ({ checkSupabaseAvailable: async () => ({ ok: true }) }));
jest.mock('../../kit8/auth/microsoft/useAuthWithMicrosoft', () => ({ useAuthWithMicrosoft: () => ({ loading: false, error: null, signIn: jest.fn() }) }));
jest.mock('../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k', auth: {} } }) }));
jest.mock('../../kit8/lib/localSecureStorage', () => ({ saveUserData: jest.fn(), getUserData: () => Promise.resolve({}) }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const SignInScreen = require('../../app/user/signin/index').default;
const { clearPendingReturnTo, peekPendingReturnTo, setPendingReturnTo } = require('../../kit8/auth/session/pendingReturnTo');

let root: any;
let host: HTMLElement;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<SignInScreen />));
  await flush();
}
const SIGNED_IN_USER = { id: 'abc', email: 'a@b.c', user_metadata: { full_name: 'A B' } };
beforeEach(() => { mockReplace.mockClear(); mockParams = {}; mockGoogleUser = null; clearPendingReturnTo(); window.localStorage.clear(); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

it('after the sign in it goes to the returnTo of the screen (the gate card button)', async () => {
  mockParams = { returnTo: '/media/nfc/identification' };
  mockGoogleUser = SIGNED_IN_USER;
  await mount();
  expect(mockReplace).toHaveBeenCalledWith('/media/nfc/identification');
});

it('no returnTo (menu Sign In row, page reload of Google / Microsoft): it goes to the screen the gate remembered, once', async () => {
  setPendingReturnTo('/media/record/video');
  mockGoogleUser = SIGNED_IN_USER;
  await mount();
  expect(mockReplace).toHaveBeenCalledWith('/media/record/video');
  expect(await peekPendingReturnTo()).toBeNull();   // used up: the next sign in goes to the profile
});

it('nothing wanted: the profile, as before', async () => {
  mockGoogleUser = SIGNED_IN_USER;
  await mount();
  expect(mockReplace).toHaveBeenCalledWith('/user/userprofile');
});

it('a screen opened with returnTo remembers it, so a sign in that reloads the page still finds it', async () => {
  mockParams = { returnTo: '/media/record/audio' };
  await mount();
  expect(await peekPendingReturnTo()).toBe('/media/record/audio');
  expect(mockReplace).not.toHaveBeenCalled();
});
