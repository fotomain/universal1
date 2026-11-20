/** @jest-environment jsdom */
// The Sign In screen: ONE way of signing in at a time. While Google, Microsoft, the email code (being sent / verified) or the password sign-in works,
// every other button and input of the screen is disabled.
import React, { act } from 'react';

let mockGoogleLoading = false;
let mockMicrosoftLoading = false;
let mockOtpBusyCallback: ((b: boolean) => void) | undefined;
let mockOtpDisabled: boolean | undefined;
const mockGoogleSignIn = jest.fn();
let mockAvailability: any = { ok: true };

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({}),
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
    Text: ({ children, testID }: any) => R.createElement(RNText, { testID }, children),
  };
});
jest.mock('../../kit8/ui/components/common', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  const Btn = ({ children, onPress, disabled, testID }: any) => R.createElement(Pressable, { testID, onPress, disabled: !!disabled }, R.createElement(Text, null, children));
  return { ButtonPrimaryApp: (p: any) => Btn({ ...p, testID: p.testID || 'signin-password-submit' }), ButtonTextApp: Btn };
});
jest.mock('../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ label, disabled, value, onChangeText }: any) => R.createElement(TextInput, { testID: `input-${label}`, value, onChangeText, editable: !disabled }) };
});
jest.mock('../../kit8/ui/components/activityindicator/ActivityIndicatorCircleApp', () => ({ __esModule: true, default: () => require('react').createElement('span', { 'data-testid': 'spinner' }) }));
jest.mock('../../kit8/auth/google/SignInWithGoogleButton', () => {
  const R = require('react');
  const { Pressable } = require('react-native');
  return { __esModule: true, default: ({ onPress, disabled }: any) => R.createElement(Pressable, { testID: 'signin-with-google', onPress, disabled: !!disabled }) };
});
jest.mock('../../kit8/auth/microsoft/SignInWithMicrosoftButton', () => {
  const R = require('react');
  const { Pressable } = require('react-native');
  return { __esModule: true, default: ({ onPress, disabled }: any) => R.createElement(Pressable, { testID: 'signin-with-microsoft', onPress, disabled: !!disabled }) };
});
jest.mock('../../kit8/auth/otp/SignInWithEmailOtp', () => {
  const R = require('react');
  const { Pressable } = require('react-native');
  // the real form is tested elsewhere: this stub shows what the screen hands it
  return {
    __esModule: true,
    default: ({ disabled, onBusyChange }: any) => {
      mockOtpDisabled = disabled;
      mockOtpBusyCallback = onBusyChange;
      return R.createElement(Pressable, { testID: 'otp-form', disabled: !!disabled });
    },
  };
});
jest.mock('../../kit8/auth/google/useAuth', () => ({ useAuthWithGoogle: () => ({ user: null, loading: mockGoogleLoading, signIn: mockGoogleSignIn }) }));
jest.mock('../../kit8/auth/session/supabaseAvailability', () => ({ checkSupabaseAvailable: async () => mockAvailability }));
jest.mock('../../kit8/auth/microsoft/useAuthWithMicrosoft', () => ({ useAuthWithMicrosoft: () => ({ loading: mockMicrosoftLoading, error: null, signIn: jest.fn() }) }));
jest.mock('../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: { supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k', auth: { signInWithPassword: jest.fn(), signUp: jest.fn() } } }) }));
jest.mock('../../kit8/lib/localSecureStorage', () => ({ saveUserData: jest.fn(), getUserData: () => Promise.resolve({}) }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const SignInScreen = require('../../app/user/signin/index').default;

let root: any;
let host: HTMLElement;
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const off = (id: string) => {
  const el = q(id) as HTMLElement | HTMLInputElement | null;
  if (!el) throw new Error(`no ${id}`);
  return el.getAttribute('aria-disabled') === 'true' || (el as HTMLInputElement).readOnly === true || (el as HTMLInputElement).disabled === true;
};
const click = (id: string) => act(() => { (q(id) as HTMLElement).click(); });
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<SignInScreen />));
  await flush();
}
beforeEach(() => { mockGoogleLoading = false; mockMicrosoftLoading = false; mockOtpBusyCallback = undefined; mockOtpDisabled = undefined; mockGoogleSignIn.mockClear(); mockAvailability = { ok: true }; });
afterEach(() => { act(() => root.unmount()); host.remove(); });

it('nothing is disabled while nothing works', async () => {
  await mount();
  ['signin-with-google', 'signin-with-microsoft', 'otp-form', 'signin-toggle-email-mode'].forEach((id) => expect(off(id)).toBe(false));
});

it('Google working: Microsoft, the email form and the toggle are disabled', async () => {
  mockGoogleLoading = true;
  await mount();
  expect(q('spinner')).not.toBeNull();
  expect(off('signin-with-microsoft')).toBe(true);
  expect(mockOtpDisabled).toBe(true);
  expect(off('signin-toggle-email-mode')).toBe(true);
});

it('Microsoft working: Google, the email form and the toggle are disabled', async () => {
  mockMicrosoftLoading = true;
  await mount();
  expect(off('signin-with-google')).toBe(true);
  expect(mockOtpDisabled).toBe(true);
  expect(off('signin-toggle-email-mode')).toBe(true);
});

it('the email code being sent: Google and Microsoft and the toggle are disabled, and enabled again when it is over', async () => {
  await mount();
  act(() => mockOtpBusyCallback!(true));
  expect(off('signin-with-google')).toBe(true);
  expect(off('signin-with-microsoft')).toBe(true);
  expect(off('signin-toggle-email-mode')).toBe(true);
  act(() => mockOtpBusyCallback!(false));
  expect(off('signin-with-google')).toBe(false);
  expect(off('signin-toggle-email-mode')).toBe(false);
});

it('the password form: inputs, buttons and the forgot link follow the same rule', async () => {
  await mount();
  click('signin-toggle-email-mode'); // the password mode
  expect(q('otp-form')).toBeNull();
  ['input-screens.email', 'input-screens.password', 'signin-password-submit', 'signin-forgot-password'].forEach((id) => expect(off(id)).toBe(false));
  act(() => root.unmount());
  host.remove();
  mockMicrosoftLoading = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<SignInScreen />));
  await flush();
  // the toggle is disabled while Microsoft works, so the password mode cannot even be opened
  expect(off('signin-toggle-email-mode')).toBe(true);
});


it('Supabase restarting: pressing Sign in with Google shows the message and does NOT start the sign-in', async () => {
  mockAvailability = { ok: false, reason: 'http', status: 522, message: 'Supabase is not available right now (HTTP 522). If the project is restarting, wait 2-5 minutes and try again.' };
  await mount();
  expect(q('signin-supabase-unavailable')).toBeNull();
  click('signin-with-google');
  await flush();
  expect(q('signin-supabase-unavailable')?.textContent).toContain('HTTP 522');
  expect(mockGoogleSignIn).not.toHaveBeenCalled();
  expect(off('signin-with-google')).toBe(false); // free to try again
});

it('Supabase answering: pressing Sign in with Google starts it and clears an old message', async () => {
  mockAvailability = { ok: false, reason: 'timeout', message: 'down' };
  await mount();
  click('signin-with-google');
  await flush();
  expect(q('signin-supabase-unavailable')).not.toBeNull();
  mockAvailability = { ok: true };
  click('signin-with-google');
  await flush();
  expect(mockGoogleSignIn).toHaveBeenCalledTimes(1);
  expect(q('signin-supabase-unavailable')).toBeNull();
});
