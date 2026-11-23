/** @jest-environment jsdom */
// Identification needs the camera first: the access is asked for at the start and the screen does not open without it.
import React from 'react';
import { Linking } from 'react-native';
import { cleanup, flush, pressAsync, q, render, text } from './mediaUiTestKit';

const cam: any = { granted: false, answer: true, asked: 0 };
(globalThis as any).__gateCam = cam;
jest.mock('react-native-vision-camera', () => {
  const R = require('react');
  return {
    useCameraPermission: () => {
      const g = (globalThis as any).__gateCam;
      const [has, setHas] = R.useState(g.granted);
      return { hasPermission: has, requestPermission: async () => { g.asked += 1; setHas(g.answer); return g.answer; } };
    },
  };
});

import CameraPermissionGate from '../../kit8/ui/components/media/common/CameraPermissionGate';

const gate = () => render(<CameraPermissionGate reason="to photograph the zone"><div data-testid="screen">identification</div></CameraPermissionGate>);

beforeEach(() => { cam.granted = false; cam.answer = true; cam.asked = 0; });
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

it('asks for the camera at the start and opens the screen when it is allowed', async () => {
  gate();
  await flush();
  expect(cam.asked).toBe(1);
  expect(q('screen')).not.toBeNull();
  expect(q('camera-gate')).toBeNull();
});

it('the access is refused: the screen does NOT open, the card says why', async () => {
  cam.answer = false;
  gate();
  await flush();
  expect(cam.asked).toBe(1);
  expect(q('screen')).toBeNull();
  expect(text('camera-gate-title')).toBe('The camera is not allowed');
  expect(text('camera-gate-text')).toContain('to photograph the zone');
});

it('Allow the camera asks again; when it is given the screen opens by itself', async () => {
  cam.answer = false;
  gate();
  await flush();
  cam.answer = true;
  await pressAsync('camera-gate-allow');
  await flush();
  expect(cam.asked).toBe(2);
  expect(q('screen')).not.toBeNull();
});

it('Open the settings goes to the settings of the application', async () => {
  const open = jest.fn(async () => undefined);
  (Linking as any).openSettings = open; // react-native-web has none
  cam.answer = false;
  gate();
  await flush();
  await pressAsync('camera-gate-settings');
  expect(open).toHaveBeenCalledTimes(1);
  expect(q('screen')).toBeNull();
});

it('a camera that is already allowed opens the screen at once and asks nothing', async () => {
  cam.granted = true;
  gate();
  await flush();
  expect(cam.asked).toBe(0);
  expect(q('screen')).not.toBeNull();
});
