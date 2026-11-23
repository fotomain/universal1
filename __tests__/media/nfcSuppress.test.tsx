/** @jest-environment jsdom */
// The ID card touching the phone while the ID reading is on the screen must NOT open the NFC screen (it made an "NFC tag" post instead of the ID post).
import React from 'react';
import { Platform } from 'react-native';
import { cleanup, flush, render } from './mediaUiTestKit';

const mockPush = jest.fn();
let mockBackgroundCb: null | ((t: any) => void) = null;
const mockTake = jest.fn(async () => null as any);
jest.mock('../../kit8/ui/components/media/nfc/nfcReader', () => ({
  takeBackgroundTag: () => mockTake(),
  listenBackgroundTags: (cb: any) => { mockBackgroundCb = cb; return () => { mockBackgroundCb = null; }; },
}));
const mockPushRead = jest.fn(() => true);
jest.mock('../../kit8/ui/components/media/nfc/nfcInbox', () => ({ pushNfcRead: (r: any) => mockPushRead(r) }));
jest.mock('../../kit8/ui/components/media/nfc/nfcModel', () => ({ makeReceived: (t: any, w: string) => ({ tag: t, how: w }) }));

import NfcBackgroundHandler from '../../kit8/ui/components/media/nfc/NfcBackgroundHandler';
import { isBackgroundNfcSuppressed, suppressBackgroundNfc } from '../../kit8/ui/components/media/nfc/nfcSuppress';

const realOS = Platform.OS;
beforeEach(() => { (Platform as any).OS = 'android'; (globalThis as any).__push = mockPush; mockTake.mockResolvedValue(null); });
afterEach(() => { cleanup(); (Platform as any).OS = realOS; jest.clearAllMocks(); });

it('suppression is counted and released once', () => {
  expect(isBackgroundNfcSuppressed()).toBe(false);
  const a = suppressBackgroundNfc();
  const b = suppressBackgroundNfc();
  a(); a();
  expect(isBackgroundNfcSuppressed()).toBe(true); // b is still on
  b();
  expect(isBackgroundNfcSuppressed()).toBe(false);
});

it('a background tag opens the NFC screen as before', async () => {
  render(<NfcBackgroundHandler />);
  await flush();
  mockBackgroundCb!({ id: '04AA' });
  expect(mockPushRead).toHaveBeenCalledTimes(1);
});

it('while the ID reading is on the screen the tag is ignored (listener and "the app came back" path)', async () => {
  const release = suppressBackgroundNfc();
  mockTake.mockResolvedValue({ id: '04AA' });
  render(<NfcBackgroundHandler />);
  await flush();
  mockBackgroundCb!({ id: '04AA' });
  expect(mockPushRead).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  release();
  mockBackgroundCb!({ id: '04BB' });
  expect(mockPushRead).toHaveBeenCalledTimes(1);
});
