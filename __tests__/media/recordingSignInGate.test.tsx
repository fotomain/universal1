/** @jest-environment jsdom */
// Recordings are for signed-in users only: a guest sees Sign in / Sign in and connect the file storage, a signed-in user sees the recorder
import React from 'react';
import { cleanup, flush, press, q, render, text } from './mediaUiTestKit';

let mockState: any;
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn(), useSelector: (fn: any) => fn(mockState) }));

import { clearPendingReturnTo, peekPendingReturnTo } from '../../kit8/auth/session/pendingReturnTo';
import RecordingSignInGate from '../../kit8/ui/components/media/common/RecordingSignInGate';

const push = jest.fn();
beforeEach(() => { (globalThis as any).__push = push; });
afterEach(() => { cleanup(); jest.clearAllMocks(); });

const gate = () => render(<RecordingSignInGate kind="video" returnTo="/media/record/video"><div data-testid="recorder">recorder</div></RecordingSignInGate>);

it('a guest does not get the recorder: he is offered to sign in', async () => {
  mockState = { activeUserState: { activeUserEmail: 'user@example.com' } };
  gate();
  await flush();
  expect(q('recorder')).toBeNull();
  expect(text('recording-signin-title')).toBe('Sign in to record video');
  press('recording-signin-button');
  expect(push).toHaveBeenLastCalledWith({ pathname: '/user/signin', params: { returnTo: '/media/record/video' } });
});

it('a guest can also ask to set up the file storage after the sign in (the organization screen)', async () => {
  mockState = { activeUserState: { activeUserEmail: 'user@example.com' } };
  gate();
  await flush();
  press('recording-signin-storage-button');
  expect(push).toHaveBeenLastCalledWith({ pathname: '/user/signin', params: { returnTo: '/catalog/organization' } });
});

it('a signed-in user gets the recorder', async () => {
  mockState = { activeUserState: { activeUserEmail: 'foto888999@gmail.com' } };
  gate();
  await flush();
  expect(q('recorder')).not.toBeNull();
  expect(q('recording-signin-gate')).toBeNull();
});

describe('scanning is for signed-in users too', () => {
  const scanGate = (kind: any, returnTo: string) => render(<RecordingSignInGate kind={kind} returnTo={returnTo}><div data-testid="scanner">scanner</div></RecordingSignInGate>);

  it.each([
    ['scan', '/media/scan', 'Sign in to scan codes'],
    ['nfc', '/media/nfc', 'Sign in to read NFC tags'],
    ['identification', '/media/nfc/identification', 'Sign in to identify with an ID card or passport'],
    ['idcard', '/media/nfc/iddocread', 'Sign in to read an ID card or passport'],
  ])('a guest does not get the %s screen: he is offered to sign in and comes back to it', async (kind, route, title) => {
    mockState = { activeUserState: { activeUserEmail: 'user@example.com' } };
    scanGate(kind, route);
    await flush();
    expect(q('scanner')).toBeNull();
    expect(text('recording-signin-title')).toBe(title);
    expect(q('recording-signin-storage-button')).toBeNull();   // the file storage is for recordings only
    press('recording-signin-button');
    expect(push).toHaveBeenLastCalledWith({ pathname: '/user/signin', params: { returnTo: route } });
  });

  it('a signed-in user gets the scanner', async () => {
    mockState = { activeUserState: { activeUserEmail: 'foto888999@gmail.com' } };
    scanGate('scan', '/media/scan');
    await flush();
    expect(q('scanner')).not.toBeNull();
  });
});

describe('the wanted screen is remembered, so ANY sign in comes back to it', () => {
  beforeEach(() => clearPendingReturnTo());

  it('a guest who sees the card: the route is remembered (the menu Sign In row, Google / Microsoft on the web, the e-mail link have no returnTo)', async () => {
    mockState = { activeUserState: { activeUserEmail: 'user@example.com' } };
    render(<RecordingSignInGate kind="identification" returnTo="/media/nfc/identification"><div data-testid="scanner">s</div></RecordingSignInGate>);
    await flush();
    expect(await peekPendingReturnTo()).toBe('/media/nfc/identification');
  });

  it('a signed-in user does not leave a wish behind', async () => {
    mockState = { activeUserState: { activeUserEmail: 'foto888999@gmail.com' } };
    render(<RecordingSignInGate kind="video" returnTo="/media/record/video"><div data-testid="recorder">r</div></RecordingSignInGate>);
    await flush();
    expect(await peekPendingReturnTo()).toBeNull();
  });
});
