/** @jest-environment jsdom */
// Web photo screen: the flashlight (torch) of the camera track
import React from 'react';
import { cleanup, flush, pressAsync, q, render, text } from './mediaUiTestKit';

jest.mock('../../kit8/ui/components/media/photo/applyPhotoFilter.web', () => ({ applyPhotoFilter: jest.fn() }));
jest.mock('../../kit8/ui/components/media/photo/useSavePhoto', () => ({ useSavePhoto: () => jest.fn() }));

import RecordPhoto from '../../kit8/ui/components/media/photo/RecordPhoto.web';

let applyConstraints: jest.Mock;
const track = (torch: boolean) => ({ stop: jest.fn(), getCapabilities: () => (torch ? { torch: true } : {}), applyConstraints });
const open = (torch: boolean) => {
  const video = [track(torch)];
  const stream = { getTracks: () => video, getVideoTracks: () => video };
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: jest.fn(async () => stream) }, configurable: true });
};

beforeEach(() => {
  applyConstraints = jest.fn(async () => undefined);
  (HTMLMediaElement.prototype as any).play = jest.fn(() => Promise.resolve());
  (globalThis as any).__recordVideoSettings = undefined;
});
afterEach(() => { cleanup(); jest.clearAllMocks(); });

it('a camera with a torch: the button lights it (a permanent light) and switches it off again', async () => {
  open(true);
  render(<RecordPhoto />);
  await flush();
  expect(text('record-photo-torch')).toBe('flashlight-off');
  await pressAsync('record-photo-torch');
  await flush();
  expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: true }] });
  expect(text('record-photo-torch')).toBe('flashlight');
  await pressAsync('record-photo-torch');
  await flush();
  expect(applyConstraints).toHaveBeenLastCalledWith({ advanced: [{ torch: false }] });
});

it('the remembered choice lights the torch when the camera opens', async () => {
  open(true);
  (globalThis as any).__recordVideoSettings = { recordTorchEnabled: true };
  render(<RecordPhoto />);
  await flush();
  expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
});

it('a camera without a torch (a laptop): no button', async () => {
  open(false);
  render(<RecordPhoto />);
  await flush();
  expect(q('record-photo-torch')).toBeNull();
  expect(q('record-photo-flip')).not.toBeNull();
});
