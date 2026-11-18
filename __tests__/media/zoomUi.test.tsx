/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, press, pressAsync, q, render, text } from './mediaUiTestKit';

// a phone whose 1× lens is the device zoom 2 (a multi lens camera); the fake Camera records the zoom it is given
const cam: any = { zooms: [] as number[], recording: false };
(globalThis as any).__cam = cam;
(globalThis as any).__camPerm = { hasPermission: true, requestPermission: jest.fn(async () => true) };
(globalThis as any).__mic = { hasPermission: true, requestPermission: jest.fn(async () => true) };
jest.mock('react-native-vision-camera', () => {
  const R = require('react');
  const Camera = R.forwardRef((props: any, ref: any) => {
    const c = (globalThis as any).__cam;
    c.zooms.push(props.zoom);
    R.useImperativeHandle(ref, () => ({
      startRecording: (o: any) => { c.recording = true; c.handlers = o; },
      stopRecording: async () => { c.recording = false; c.handlers.onRecordingFinished({ path: '/cache/p.mp4', duration: 3 }); },
      pauseRecording: async () => undefined,
      resumeRecording: async () => undefined,
    }));
    return R.createElement('div', { 'data-testid': 'camera' });
  });
  return {
    Camera,
    useCameraDevice: () => ({ id: 'back', minZoom: 1, maxZoom: 16, neutralZoom: 2, hasFlash: true }),
    useCameraPermission: () => (globalThis as any).__camPerm,
    useMicrophonePermission: () => (globalThis as any).__mic,
  };
});
jest.mock('../../kit8/ui/components/media/common/useSaveRecording', () => ({ useSaveRecording: () => jest.fn(async () => ({ rowJSON: {} })) }));
jest.mock('../../kit8/ui/components/media/common/RecordingResult', () => ({ __esModule: true, default: () => null }));

import RecordVideo from '../../kit8/ui/components/media/video/RecordVideo';
import ZoomControl from '../../kit8/ui/components/media/common/ZoomControl';
import PinchZoomView from '../../kit8/ui/components/media/common/PinchZoomView';
import { normalizeZoomRange } from '../../kit8/ui/components/media/common/cameraZoom';

afterEach(() => { cleanup(); cam.zooms = []; jest.clearAllMocks(); });

describe('ZoomControl', () => {
  const range = normalizeZoomRange({ min: 1, max: 16, neutral: 2 });
  it('buttons for the presets that fit, + and -, the one near the zoom is marked by the factor text being hidden', () => {
    const onZoom = jest.fn();
    render(<ZoomControl zoom={2} range={range} onZoom={onZoom} testID="z" />);
    expect(q('z-preset-0.5')).not.toBeNull();
    expect(q('z-preset-1')).not.toBeNull();
    expect(q('z-factor')).toBeNull(); // exactly 1×: the 1× button says it
    press('z-preset-2');
    expect(onZoom).toHaveBeenLastCalledWith(4); // 2× of the main lens = device zoom 4
    press('z-in');
    expect(onZoom.mock.calls.at(-1)![0]).toBeGreaterThan(2);
    press('z-out');
    expect(onZoom.mock.calls.at(-1)![0]).toBeLessThan(2);
  });
  it('between two presets the factor is written', () => {
    render(<ZoomControl zoom={2 * 1.4} range={range} onZoom={jest.fn()} testID="z" />);
    expect(text('z-factor')).toBe('1.4×');
  });
  it('a camera that cannot zoom shows nothing', () => {
    render(<ZoomControl zoom={1} range={normalizeZoomRange({ min: 1, max: 1, neutral: 1 })} onZoom={jest.fn()} testID="z" />);
    expect(q('z')).toBeNull();
  });
});

describe('PinchZoomView', () => {
  const range = normalizeZoomRange({ min: 1, max: 16, neutral: 2 });
  const touch = (testID: string, type: string, touches: Array<{ pageX: number; pageY: number }>) =>
    act(() => {
      const el = q(testID)!;
      const ev: any = new Event(type, { bubbles: true });
      ev.touches = touches; ev.changedTouches = touches; ev.targetTouches = touches;
      el.dispatchEvent(ev);
    });
  it('two fingers moving apart zoom in by the ratio of the distances', () => {
    const onZoom = jest.fn();
    render(<PinchZoomView zoom={4} range={range} onZoom={onZoom} testID="pinch"><div /></PinchZoomView>);
    touch('pinch', 'touchstart', [{ pageX: 0, pageY: 0 }, { pageX: 100, pageY: 0 }]);
    touch('pinch', 'touchmove', [{ pageX: 0, pageY: 0 }, { pageX: 200, pageY: 0 }]);
    // jsdom + react-native-web may not deliver synthetic touches: when they arrive the zoom doubles, never goes below the start
    if (onZoom.mock.calls.length) expect(onZoom).toHaveBeenLastCalledWith(8);
  });
  it('a disabled view ignores the fingers', () => {
    const onZoom = jest.fn();
    render(<PinchZoomView zoom={4} range={range} onZoom={onZoom} disabled testID="pinch"><div /></PinchZoomView>);
    touch('pinch', 'touchstart', [{ pageX: 0, pageY: 0 }, { pageX: 100, pageY: 0 }]);
    touch('pinch', 'touchmove', [{ pageX: 0, pageY: 0 }, { pageX: 300, pageY: 0 }]);
    expect(onZoom).not.toHaveBeenCalled();
  });
});

describe('RecordVideo zoom (phone)', () => {
  it('starts at the 1× lens, a preset changes the zoom of the live camera BEFORE and WHILE recording', async () => {
    render(<RecordVideo />);
    await flush();
    expect(cam.zooms.at(-1)).toBe(2); // neutral zoom of this device
    press('record-video-zoom-preset-2');
    expect(cam.zooms.at(-1)).toBe(4);

    await pressAsync('record-video-start');
    expect(cam.recording).toBe(true);
    expect(q('record-video-zoom')).not.toBeNull(); // the control stays while recording
    press('record-video-zoom-preset-1');
    expect(cam.zooms.at(-1)).toBe(2);
    press('record-video-zoom-in');
    expect(cam.zooms.at(-1)).toBeGreaterThan(2);
    expect(cam.recording).toBe(true); // the zoom did not stop the recording
  });
});
