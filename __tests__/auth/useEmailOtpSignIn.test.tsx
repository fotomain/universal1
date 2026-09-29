/** @jest-environment jsdom */
// Hook state machine: email -> code -> signed in, resend cooldown, change email.
import React, { act } from 'react';

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `myapp-test://${path}`,
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
const mockStore = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
  },
}));
import { useEmailOtpSignIn } from '../../kit8/hooks/useEmailOtpSignIn';

// minimal renderHook on react-dom (same approach as __tests__/pm/ui/pmUiTestKit.tsx)
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const roots: any[] = [];
function renderHook<T>(hook: () => T) {
  const result = { current: undefined as unknown as T };
  const Probe = () => { result.current = hook(); return null; };
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  act(() => root.render(React.createElement(Probe)));
  return { result };
}
afterEach(() => { act(() => roots.splice(0).forEach((r) => r.unmount())); });

const user = { id: 'u-1', email: 'a@b.com', user_metadata: {} };
let authListener: ((event: string, session: any) => void) | null = null;
const makeSupabase = () => ({
  auth: {
    getSession: jest.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: jest.fn((cb: any) => { authListener = cb; return { data: { subscription: { unsubscribe: jest.fn(() => { authListener = null; }) } } }; }),
    signInWithOtp: jest.fn(async () => ({ data: {}, error: null })),
    verifyOtp: jest.fn(async ({ token }: any) =>
      token === '123456'
        ? { data: { user, session: { access_token: 't' } }, error: null }
        : { data: {}, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } }),
  },
}) as any;

beforeEach(() => { jest.useFakeTimers(); mockStore.clear(); authListener = null; });
afterEach(() => jest.useRealTimers());

it('sends the code, verifies it and reports the user', async () => {
  const sb = makeSupabase();
  const onSignedIn = jest.fn();
  const { result } = renderHook(() => useEmailOtpSignIn(sb, { onSignedIn, emailRedirectTo: 'https://app.test/signin' }));

  expect(result.current.step).toBe('email');
  expect(result.current.canSend).toBe(false);
  act(() => result.current.setEmail(' A@B.com '));
  expect(result.current.canSend).toBe(true);

  await act(async () => { await result.current.sendCode(); });
  expect(sb.auth.signInWithOtp).toHaveBeenCalledTimes(1);
  expect(result.current.step).toBe('code');
  expect(result.current.email).toBe('a@b.com');
  expect(result.current.secondsLeft).toBe(60);
  expect(result.current.canResend).toBe(false);

  act(() => result.current.setCode('999 999'));
  await act(async () => { await result.current.verifyCode(); });
  expect(result.current.error?.key).toBe('otpErrorExpired');
  expect(onSignedIn).not.toHaveBeenCalled();

  act(() => result.current.setCode('123-456'));
  expect(result.current.code).toBe('123456');
  expect(result.current.error).toBeNull();
  await act(async () => { await result.current.verifyCode(); });
  expect(sb.auth.verifyOtp).toHaveBeenLastCalledWith({ email: 'a@b.com', token: '123456', type: 'email' });
  expect(onSignedIn).toHaveBeenCalledWith(user);
});

it('blocks resend during the 60 s cooldown, then allows it', async () => {
  const sb = makeSupabase();
  const { result } = renderHook(() => useEmailOtpSignIn(sb));
  act(() => result.current.setEmail('a@b.com'));
  await act(async () => { await result.current.sendCode(); });

  await act(async () => { await result.current.resendCode(); });
  expect(sb.auth.signInWithOtp).toHaveBeenCalledTimes(1);

  act(() => { jest.advanceTimersByTime(30_000); });
  expect(result.current.secondsLeft).toBe(30);

  act(() => { jest.advanceTimersByTime(31_000); });
  expect(result.current.canResend).toBe(true);
  await act(async () => { await result.current.resendCode(); });
  expect(sb.auth.signInWithOtp).toHaveBeenCalledTimes(2);
});

it('change email goes back to step 1 and clears the code', async () => {
  const sb = makeSupabase();
  const { result } = renderHook(() => useEmailOtpSignIn(sb));
  act(() => result.current.setEmail('a@b.com'));
  await act(async () => { await result.current.sendCode(); });
  act(() => result.current.setCode('123'));
  act(() => result.current.changeEmail());
  expect(result.current.step).toBe('email');
  expect(result.current.code).toBe('');
  expect(result.current.email).toBe('a@b.com');
});

it('does not send again for the same address during the cooldown (Send just reopens the code field)', async () => {
  const sb = makeSupabase();
  const { result } = renderHook(() => useEmailOtpSignIn(sb));
  act(() => result.current.setEmail('a@b.com'));
  await act(async () => { await result.current.sendCode(); });
  act(() => result.current.changeEmail());
  expect(result.current.cooldownActive).toBe(true);
  await act(async () => { await result.current.sendCode(); });
  expect(sb.auth.signInWithOtp).toHaveBeenCalledTimes(1);
  expect(result.current.step).toBe('code');
  // another address is not blocked
  act(() => result.current.changeEmail());
  act(() => result.current.setEmail('c@d.com'));
  await act(async () => { await result.current.sendCode(); });
  expect(sb.auth.signInWithOtp).toHaveBeenCalledTimes(2);
});

it('uses the wait time from the Supabase rate-limit error', async () => {
  const sb = makeSupabase();
  sb.auth.signInWithOtp.mockImplementationOnce(async () => ({
    data: {}, error: { status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 42 seconds.' },
  }));
  const { result } = renderHook(() => useEmailOtpSignIn(sb));
  act(() => result.current.setEmail('a@b.com'));
  await act(async () => { await result.current.sendCode(); });
  expect(result.current.error?.key).toBe('otpErrorRateLimit');
  expect(result.current.secondsLeft).toBe(42);
  expect(result.current.step).toBe('email');
});

it('project email quota: no countdown, user can still enter a code already received', async () => {
  const sb = makeSupabase();
  sb.auth.signInWithOtp.mockImplementationOnce(async () => ({
    data: {}, error: { status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
  }));
  const { result } = renderHook(() => useEmailOtpSignIn(sb));
  act(() => result.current.setEmail('a@b.com'));
  await act(async () => { await result.current.sendCode(); });
  expect(result.current.error?.key).toBe('otpErrorEmailQuota');
  expect(result.current.secondsLeft).toBe(0);
  act(() => { result.current.enterCode(); });
  expect(result.current.step).toBe('code');
  act(() => result.current.setCode('123456'));
  await act(async () => { await result.current.verifyCode(); });
  expect(sb.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.com', token: '123456', type: 'email' });
});

it('web link: remembers the choice, waits on the link step and signs in when the session arrives', async () => {
  const sb = makeSupabase();
  const onSignedIn = jest.fn();
  const { result } = renderHook(() => useEmailOtpSignIn(sb, { onSignedIn, emailRedirectTo: 'https://app.test/signin' }));
  expect(result.current.confirmationWay).toBe('otpCode');
  act(() => result.current.setConfirmationWay('webLink'));
  expect(mockStore.get('auth.emailConfirmationWay.v1')).toBe('webLink');

  act(() => result.current.setEmail('a@b.com'));
  await act(async () => { await result.current.sendCode(); });
  expect(sb.auth.signInWithOtp).toHaveBeenCalledWith({
    email: 'a@b.com',
    options: { shouldCreateUser: true, emailRedirectTo: 'https://app.test/signin' },
  });
  expect(result.current.step).toBe('link');
  expect(authListener).toBeTruthy();

  // user opens the link (other tab / deep link) -> supabase-js reports SIGNED_IN
  act(() => authListener!('SIGNED_IN', { user }));
  expect(onSignedIn).toHaveBeenCalledTimes(1);
  expect(onSignedIn).toHaveBeenCalledWith(user);
  act(() => authListener?.('TOKEN_REFRESHED', { user }));
  expect(onSignedIn).toHaveBeenCalledTimes(1);
});

it('restores the remembered confirmation way', async () => {
  mockStore.set('auth.emailConfirmationWay.v1', 'webLink');
  const { result } = renderHook(() => useEmailOtpSignIn(makeSupabase()));
  await act(async () => { await Promise.resolve(); });
  expect(result.current.confirmationWay).toBe('webLink');
});

it('link step: "enter the code instead" switches to the code field without sending', async () => {
  const sb = makeSupabase();
  const { result } = renderHook(() => useEmailOtpSignIn(sb, { confirmationWay: 'webLink' }));
  act(() => result.current.setEmail('a@b.com'));
  await act(async () => { await result.current.sendCode(); });
  expect(result.current.step).toBe('link');
  act(() => { result.current.enterCode(); });
  expect(result.current.step).toBe('code');
  expect(sb.auth.signInWithOtp).toHaveBeenCalledTimes(1);
});

it('native default redirect is the app deep link', async () => {
  const sb = makeSupabase();
  const { result } = renderHook(() => useEmailOtpSignIn(sb));
  act(() => result.current.setEmail('a@b.com'));
  await act(async () => { await result.current.sendCode(); });
  const redirect = sb.auth.signInWithOtp.mock.calls[0][0].options.emailRedirectTo;
  // jest maps react-native -> react-native-web, so Platform.OS is 'web' here: <origin>/signin
  expect(redirect).toBe(`${window.location.origin}/signin`);
});
