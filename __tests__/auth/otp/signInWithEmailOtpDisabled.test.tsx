/** @jest-environment jsdom */
// SignInWithEmailOtp: `disabled` (another way of signing in works) disables every input and button of the form; `onBusyChange` tells the screen while a code is sent / verified.
import React, { act } from 'react';

let mockOtp: any;
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
jest.mock('react-native-paper', () => {
  const R = require('react');
  const { Text: RNText } = require('react-native');
  return { useTheme: () => ({ colors: new Proxy({}, { get: () => '#888' }) }), Text: ({ children }: any) => R.createElement(RNText, null, children) };
});
jest.mock('../../../kit8/ui/components/common', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  const Btn = ({ children, onPress, disabled, testID }: any) => R.createElement(Pressable, { testID, onPress, disabled: !!disabled }, R.createElement(Text, null, children));
  return { ButtonPrimaryApp: Btn, ButtonTextApp: Btn };
});
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, disabled, editable = true, value }: any) => R.createElement(TextInput, { testID, value, editable: editable && !disabled }) };
});
jest.mock('../../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/activityindicator/ActivityIndicatorCircleApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/auth/otp/EmailConfirmationWayRadio', () => {
  const R = require('react');
  const { Pressable } = require('react-native');
  return { __esModule: true, default: ({ testID, disabled }: any) => R.createElement(Pressable, { testID, disabled: !!disabled }) };
});
jest.mock('../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: {} }) }));
jest.mock('../../../kit8/auth/otp/useEmailOtpSignIn', () => ({ useEmailOtpSignIn: () => mockOtp }));
jest.mock('../../../kit8/auth/session/useAuthRedirectHandler', () => ({ subscribeAuthRedirectError: () => () => undefined, publishAuthRedirectError: jest.fn() }));
jest.mock('../../../kit8/lib/localSecureStorage', () => ({ saveUserData: jest.fn() }));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const SignInWithEmailOtp = require('../../../kit8/auth/otp/SignInWithEmailOtp').default;

const otpState = (over: any = {}) => ({
  step: 'email', confirmationWay: 'otpCode', email: 'a@b.co', code: '', sending: false, verifying: false, busy: false, error: null, codeSent: false, secondsLeft: 0,
  canSend: true, canVerify: true, canResend: true, setEmail: jest.fn(), setCode: jest.fn(), setConfirmationWay: jest.fn(), sendCode: jest.fn(), verifyCode: jest.fn(), resendCode: jest.fn(),
  enterCode: jest.fn(), changeEmail: jest.fn(), ...over,
});

let root: any;
let host: HTMLElement;
const q = (id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const off = (id: string) => {
  const el = q(id) as any;
  if (!el) throw new Error(`no ${id}`);
  return el.getAttribute('aria-disabled') === 'true' || el.readOnly === true || el.disabled === true;
};
function render(props: any = {}) {
  if (!host) { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); }
  act(() => root.render(<SignInWithEmailOtp showTitle={false} {...props} />));
}
afterEach(() => { if (root) act(() => root.unmount()); host?.remove(); host = undefined as any; root = undefined; });

describe('the email step', () => {
  it('everything works by itself', () => {
    mockOtp = otpState();
    render();
    ['email-otp-email', 'email-otp-way', 'email-otp-send', 'email-otp-have-code'].forEach((id) => expect(off(id)).toBe(false));
  });
  it('disabled: the input, the radio and both buttons are off', () => {
    mockOtp = otpState();
    render({ disabled: true });
    ['email-otp-email', 'email-otp-way', 'email-otp-send', 'email-otp-have-code'].forEach((id) => expect(off(id)).toBe(true));
  });
});

describe('the code step', () => {
  it('disabled: the code input, Verify, Resend and Change email are off', () => {
    mockOtp = otpState({ step: 'code', code: '123456' });
    render({ disabled: true });
    ['email-otp-code', 'email-otp-verify', 'email-otp-resend', 'email-otp-change-email'].forEach((id) => expect(off(id)).toBe(true));
    render({ disabled: false });
    ['email-otp-code', 'email-otp-verify', 'email-otp-resend', 'email-otp-change-email'].forEach((id) => expect(off(id)).toBe(false));
  });
});

describe('the link step', () => {
  it('disabled: Resend, Change email and "enter the code instead" are off', () => {
    mockOtp = otpState({ step: 'link', confirmationWay: 'webLink' });
    render({ disabled: true });
    ['email-otp-resend-link', 'email-otp-change-email', 'email-otp-link-enter-code'].forEach((id) => expect(off(id)).toBe(true));
  });
});

describe('onBusyChange', () => {
  it('says true while a code is sent / verified, false after, and false when the form goes away', () => {
    const calls: boolean[] = [];
    mockOtp = otpState();
    render({ onBusyChange: (b: boolean) => calls.push(b) });
    expect(calls).toEqual([false]);
    mockOtp = otpState({ sending: true, busy: true });
    render({ onBusyChange: (b: boolean) => calls.push(b) });
    expect(calls).toEqual([false, true]);
    mockOtp = otpState();
    render({ onBusyChange: (b: boolean) => calls.push(b) });
    expect(calls).toEqual([false, true, false]);
    mockOtp = otpState({ verifying: true, busy: true });
    render({ onBusyChange: (b: boolean) => calls.push(b) });
    act(() => root.unmount());
    host.remove();
    root = undefined; host = undefined as any;
    expect(calls).toEqual([false, true, false, true, false]);
  });
});
