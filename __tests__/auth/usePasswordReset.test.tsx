/** @jest-environment jsdom */
// Hook state machine: email -> code + new password -> done; reset link -> newPassword -> done.
import React, { act } from 'react';

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `myapp-test://${path}`,
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));
import { usePasswordReset } from '../../kit8/hooks/usePasswordReset';
import { publishRecoveryRedirect } from '../../kit8/hooks/useAuthRedirectHandler';

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
afterEach(() => { act(() => roots.splice(0).forEach((r) => r.unmount())); publishRecoveryRedirect(false); });

const user = { id: 'u-1', email: 'a@b.com', user_metadata: {} };
let authListener: ((event: string, session: any) => void) | null = null;
const makeSupabase = (update?: any) => ({
  auth: {
    getSession: jest.fn(async () => ({ data: { session: { user } } })),
    onAuthStateChange: jest.fn((cb: any) => { authListener = cb; return { data: { subscription: { unsubscribe: jest.fn() } } }; }),
    resetPasswordForEmail: jest.fn(async () => ({ data: {}, error: null })),
    verifyOtp: jest.fn(async ({ token }: any) =>
      token === '123456'
        ? { data: { user, session: { access_token: 't' } }, error: null }
        : { data: {}, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } }),
    updateUser: jest.fn(update || (async () => ({ data: { user }, error: null }))),
  },
}) as any;

beforeEach(() => { jest.useFakeTimers(); authListener = null; });
afterEach(() => jest.useRealTimers());

it('email -> code + new password -> done', async () => {
  const sb = makeSupabase();
  const onPasswordChanged = jest.fn();
  const { result } = renderHook(() => usePasswordReset(sb, { initialEmail: 'A@B.com', onPasswordChanged, redirectTo: 'https://app.test/forgotpassword' }));
  expect(result.current.step).toBe('email');
  expect(result.current.canSend).toBe(true);

  await act(async () => { await result.current.sendResetEmail(); });
  expect(sb.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.com', { redirectTo: 'https://app.test/forgotpassword' });
  expect(result.current.step).toBe('code');
  expect(result.current.secondsLeft).toBe(60);

  act(() => { result.current.setCode('123456'); result.current.setPassword('newpass1'); result.current.setConfirm('newpass2'); });
  expect(result.current.canSubmit).toBe(false);
  expect(result.current.passwordHint).toBe('pwMismatch');
  await act(async () => { await result.current.submit(); });
  expect(result.current.error?.key).toBe('pwMismatch');
  expect(sb.auth.verifyOtp).not.toHaveBeenCalled();

  act(() => result.current.setCode('999999'));
  act(() => result.current.setConfirm('newpass1'));
  expect(result.current.canSubmit).toBe(true);
  await act(async () => { await result.current.submit(); });
  expect(result.current.error?.key).toBe('otpErrorExpired');
  expect(result.current.step).toBe('code');
  expect(sb.auth.updateUser).not.toHaveBeenCalled();

  act(() => result.current.setCode('123456'));
  await act(async () => { await result.current.submit(); });
  expect(sb.auth.verifyOtp).toHaveBeenLastCalledWith({ email: 'a@b.com', token: '123456', type: 'recovery' });
  expect(sb.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass1' });
  expect(result.current.step).toBe('done');
  expect(result.current.password).toBe('');
  expect(onPasswordChanged).toHaveBeenCalledWith(user);
});

it('code ok but saving fails -> stays on the password-only step', async () => {
  const sb = makeSupabase(async () => ({ data: {}, error: { code: 'same_password', message: 'same' } }));
  const { result } = renderHook(() => usePasswordReset(sb, { initialEmail: 'a@b.com' }));
  act(() => { result.current.enterCode(); });
  expect(result.current.step).toBe('code');
  expect(sb.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  act(() => { result.current.setCode('123456'); result.current.setPassword('oldpass'); result.current.setConfirm('oldpass'); });
  await act(async () => { await result.current.submit(); });
  expect(result.current.step).toBe('newPassword');
  expect(result.current.error?.key).toBe('pwSameAsOld');
});

it('reset link (PASSWORD_RECOVERY) jumps to the new-password step', async () => {
  const sb = makeSupabase();
  const { result } = renderHook(() => usePasswordReset(sb));
  act(() => { authListener?.('PASSWORD_RECOVERY', { user }); });
  expect(result.current.step).toBe('newPassword');
  expect(result.current.email).toBe('a@b.com');
  act(() => { result.current.setPassword('brandnew'); result.current.setConfirm('brandnew'); });
  await act(async () => { await result.current.submit(); });
  expect(sb.auth.verifyOtp).not.toHaveBeenCalled();
  expect(result.current.step).toBe('done');
});

it('reset link detected by the redirect handler (deep link / web URL)', async () => {
  const sb = makeSupabase();
  const { result } = renderHook(() => usePasswordReset(sb));
  await act(async () => { publishRecoveryRedirect(true); });
  expect(result.current.step).toBe('newPassword');
});

it('blocks resend during the cooldown', async () => {
  const sb = makeSupabase();
  const { result } = renderHook(() => usePasswordReset(sb, { initialEmail: 'a@b.com' }));
  await act(async () => { await result.current.sendResetEmail(); });
  await act(async () => { await result.current.resendResetEmail(); });
  expect(sb.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1);
  act(() => { jest.advanceTimersByTime(61_000); });
  await act(async () => { await result.current.resendResetEmail(); });
  expect(sb.auth.resetPasswordForEmail).toHaveBeenCalledTimes(2);
});
