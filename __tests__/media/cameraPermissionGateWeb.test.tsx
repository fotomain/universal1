/** @jest-environment jsdom */
// The web twin of the camera gate must not load react-native-vision-camera (it throws in a browser) and opens the screen at once.
import React from 'react';
import { cleanup, q, render } from './mediaUiTestKit';

const mockVision = jest.fn();
jest.mock('react-native-vision-camera', () => { mockVision(); throw new Error('VisionCamera currently does not work on web.'); });

import CameraPermissionGate from '../../kit8/ui/components/media/common/CameraPermissionGate.web';

afterEach(() => cleanup());

it('shows the screen without touching vision camera', () => {
  render(<CameraPermissionGate reason="to photograph"><div data-testid="screen">identification</div></CameraPermissionGate>);
  expect(q('screen')).toBeTruthy();
  expect(mockVision).not.toHaveBeenCalled();
});
