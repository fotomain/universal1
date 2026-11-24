/** @jest-environment jsdom */
// "Where to go after the sign in": remembered in memory + localStorage (web), forgotten after 15 minutes, only in-app paths
import {
  PENDING_RETURN_TO_TTL_MS,
  clearPendingReturnTo,
  peekPendingReturnTo,
  resetPendingReturnToMemory,
  setPendingReturnTo,
} from '../../../kit8/auth/session/pendingReturnTo';

beforeEach(() => { clearPendingReturnTo(); window.localStorage.clear(); });

it('remembers the route and gives it back (more than once, until cleared)', async () => {
  setPendingReturnTo('/media/nfc/identification');
  expect(await peekPendingReturnTo()).toBe('/media/nfc/identification');
  expect(await peekPendingReturnTo()).toBe('/media/nfc/identification');
  clearPendingReturnTo();
  expect(await peekPendingReturnTo()).toBeNull();
});

it('survives a page reload (the Google / Microsoft sign in on the web): read back from localStorage', async () => {
  setPendingReturnTo('/media/record/video');
  resetPendingReturnToMemory();
  expect(await peekPendingReturnTo()).toBe('/media/record/video');
});

it('forgets a wish older than 15 minutes', async () => {
  const t0 = 1_000_000;
  setPendingReturnTo('/media/record/audio', t0);
  expect(await peekPendingReturnTo(t0 + PENDING_RETURN_TO_TTL_MS)).toBe('/media/record/audio');
  expect(await peekPendingReturnTo(t0 + PENDING_RETURN_TO_TTL_MS + 1)).toBeNull();
});

it('never remembers another site or a non path', async () => {
  ['https://evil.example/x', '//evil.example', 'media/scan', '', null, undefined, 5].forEach((v) => setPendingReturnTo(v));
  expect(await peekPendingReturnTo()).toBeNull();
});

it('the last wish wins', async () => {
  setPendingReturnTo('/media/scan');
  setPendingReturnTo('/catalog/organization');
  expect(await peekPendingReturnTo()).toBe('/catalog/organization');
});
