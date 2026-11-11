/** @jest-environment jsdom */
// Web path of the hook (react-native maps to react-native-web in Jest, so Platform.OS is 'web').
import React, { act } from 'react';
import { useAuthWithMicrosoft } from '../../../kit8/auth/microsoft/useAuthWithMicrosoft';

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

const makeSupabase = (signInWithOAuth: any) => ({ auth: { signInWithOAuth } }) as any;

it('starts the Microsoft (azure) sign-in with the email scope and the sign in page of this origin', async () => {
  const signInWithOAuth = jest.fn(async () => ({ data: {}, error: null }));
  const { result } = renderHook(() => useAuthWithMicrosoft(makeSupabase(signInWithOAuth)));
  expect(result.current.loading).toBe(false);
  await act(async () => { await result.current.signIn(); });
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: 'azure',
    options: { redirectTo: `${window.location.origin}/user/signin`, scopes: 'email' },
  });
  expect(result.current.error).toBeNull();
});

it('shows the error of Supabase and stops loading', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const signInWithOAuth = jest.fn(async () => ({ data: {}, error: { message: 'Unsupported provider: provider is not enabled' } }));
  const { result } = renderHook(() => useAuthWithMicrosoft(makeSupabase(signInWithOAuth)));
  await act(async () => { await result.current.signIn(); });
  expect(result.current.error).toBe('Unsupported provider: provider is not enabled');
  expect(result.current.loading).toBe(false);
  spy.mockRestore();
});

it('clears an old error when it is tried again', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const signInWithOAuth = jest.fn()
    .mockResolvedValueOnce({ data: {}, error: { message: 'boom' } })
    .mockResolvedValueOnce({ data: {}, error: null });
  const { result } = renderHook(() => useAuthWithMicrosoft(makeSupabase(signInWithOAuth)));
  await act(async () => { await result.current.signIn(); });
  expect(result.current.error).toBe('boom');
  await act(async () => { await result.current.signIn(); });
  expect(result.current.error).toBeNull();
  spy.mockRestore();
});
