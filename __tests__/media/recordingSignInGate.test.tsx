/** @jest-environment jsdom */
// Recordings are for signed-in users only: a guest sees Sign in / Sign in and connect the file storage, a signed-in user sees the recorder
import React from 'react';
import { cleanup, flush, press, q, render, text } from './mediaUiTestKit';

let mockState: any;
jest.mock('react-redux', () => ({ useDispatch: () => jest.fn(), useSelector: (fn: any) => fn(mockState) }));

import RecordingSignInGate from '../../kit8/ui/components/media/RecordingSignInGate';

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
