/** @jest-environment jsdom */
import React from 'react';
import { cleanup, flush, press, pressAsync, q, render, text } from './mediaUiTestKit';

const scanner: any = { onCodeScanned: null as null | ((codes: any[]) => void), props: null as any };
(globalThis as any).__scanner = scanner;
(globalThis as any).__camPerm = { hasPermission: true, requestPermission: jest.fn(async () => true) };
jest.mock('react-native-vision-camera', () => {
  const R = require('react');
  const Camera = R.forwardRef((props: any, _ref: any) => {
    (globalThis as any).__scanner.props = props;
    return R.createElement('div', { 'data-testid': 'camera' });
  });
  return {
    Camera,
    useCameraDevice: () => ({ id: 'back', minZoom: 1, maxZoom: 8, neutralZoom: 1, hasTorch: true }),
    useCameraPermission: () => (globalThis as any).__camPerm,
    useCodeScanner: (cfg: any) => { (globalThis as any).__scanner.onCodeScanned = cfg.onCodeScanned; (globalThis as any).__scanner.config = cfg; return cfg; },
  };
});
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(async () => undefined), NotificationFeedbackType: { Success: 'success' } }));
const mockClip = jest.fn(async (_: string) => true);
jest.mock('expo-clipboard', () => ({ setStringAsync: (t: string) => mockClip(t) }));
const mockWrite = jest.fn(async (build: any) => build({ ownerGUID: 'u1', rowGUID: 'r1', platform: 'android' }, undefined));
let mockSignedIn = true;
jest.mock('../../kit8/ui/components/media/common/useWriteMediaPost', () => ({ useWriteMediaPost: () => mockWrite, useIsSignedIn: () => mockSignedIn }));

import ScanCodes from '../../kit8/ui/components/media/scan/ScanCodes';
import { Linking } from 'react-native';

const code = (value: string, type = 'qr') => (globalThis as any).__scanner.onCodeScanned([{ value, type }]);
import { act } from 'react';

beforeEach(() => { mockSignedIn = true; });
afterEach(() => { cleanup(); jest.clearAllMocks(); });

it('reads QR codes AND barcodes: the scanner is given every code type', async () => {
  render(<ScanCodes />);
  await flush();
  const types = (globalThis as any).__scanner.config.codeTypes;
  expect(types).toEqual(expect.arrayContaining(['qr', 'ean-13', 'upc-a', 'code-128', 'data-matrix', 'pdf-417']));
  expect((globalThis as any).__scanner.props.codeScanner).toBeTruthy();
  expect(text('scan-hint')).toContain('Point the camera');
});

it('a code shows its result, stops the camera, and Scan again goes back to the camera', async () => {
  render(<ScanCodes />);
  await flush();
  act(() => code('https://example.com/a'));
  expect(text('scan-result-kind')).toBe('Link · QR code');
  expect(text('scan-result-line-0')).toBe('https://example.com/a');
  expect((globalThis as any).__scanner.props.isActive).toBe(false);
  press('scan-result-again');
  expect(q('scan-result')).toBeNull();
  expect((globalThis as any).__scanner.props.isActive).toBe(true);
});

it('the same code seen again in the next frames is ignored while the result is shown; a barcode is a product', async () => {
  render(<ScanCodes />);
  await flush();
  act(() => code('4006381333931', 'ean-13'));
  expect(text('scan-result-kind')).toBe('Product code · EAN-13');
  act(() => code('https://other.example'));
  expect(text('scan-result-line-0')).toBe('4006381333931'); // the camera is off: nothing replaces the result
});

it('Open uses the link, Copy puts the text on the clipboard', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
  render(<ScanCodes />);
  await flush();
  act(() => code('WIFI:T:WPA;S:Home;P:secret;;'));
  expect(q('scan-result-open')).toBeNull(); // a Wi-Fi code has nothing to open
  await pressAsync('scan-result-copy');
  expect(mockClip).toHaveBeenCalledWith('Network: Home\nSecurity: WPA\nPassword: secret');
  press('scan-result-again');
  act(() => code('mailto:a@b.com'));
  await pressAsync('scan-result-open');
  expect(open).toHaveBeenCalledWith('mailto:a@b.com');
});

it('offers a media post with the result: the post is built from the code and written', async () => {
  render(<ScanCodes />);
  await flush();
  act(() => code('https://example.com/a'));
  await pressAsync('scan-result-post-create');
  expect(mockWrite).toHaveBeenCalledTimes(1);
  const post = await mockWrite.mock.results[0].value;
  expect(post.rowJSON).toMatchObject({ mediaPostSubTitle: 'QR code · Link', mediaPostDescription: 'https://example.com/a', dataOriginName: 'scanner' });
  expect(q('scan-result-post-saved')).not.toBeNull();
});

it('a guest can scan; the offer asks him to sign in', async () => {
  mockSignedIn = false;
  render(<ScanCodes />);
  await flush();
  act(() => code('hello'));
  expect(text('scan-result-line-0')).toBe('hello');
  expect(q('scan-result-post-guest')).not.toBeNull();
  expect(q('scan-result-post-create')).toBeNull();
});

it('the torch button turns the torch on', async () => {
  render(<ScanCodes />);
  await flush();
  expect((globalThis as any).__scanner.props.torch).toBe('off');
  press('scan-torch');
  expect((globalThis as any).__scanner.props.torch).toBe('on');
});
