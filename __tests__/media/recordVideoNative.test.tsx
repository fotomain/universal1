/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, pressAsync, q, render, text } from './mediaUiTestKit';

// ---- react-native-vision-camera: a fake camera that records what the screen asks for
const cam: any = { start: [] as any[], stop: 0, pause: 0, resume: 0, audioProps: [] as boolean[], handlers: null as any, focusedProps: [] as boolean[] };
(globalThis as any).__cam = cam;
(globalThis as any).__mic = { hasPermission: true, requestPermission: jest.fn(async () => true) };
(globalThis as any).__camPerm = { hasPermission: true, requestPermission: jest.fn(async () => true) };
jest.mock('react-native-vision-camera', () => {
  const R = require('react');
  const Camera = R.forwardRef((props: any, ref: any) => {
    const c = (globalThis as any).__cam; // read when rendered: the imports run before this file's top-level code
    c.audioProps.push(props.audio);
    c.focusedProps.push(props.isActive);
    R.useImperativeHandle(ref, () => ({
      startRecording: (o: any) => { c.start.push(o); c.handlers = o; },
      stopRecording: async () => { c.stop += 1; c.handlers.onRecordingFinished({ path: `/cache/part${c.stop}.mp4`, duration: 2 + c.stop }); },
      pauseRecording: async () => { c.pause += 1; },
      resumeRecording: async () => { c.resume += 1; },
    }));
    return R.createElement('div', { 'data-testid': 'camera' });
  });
  return {
    Camera,
    useCameraDevice: () => ((globalThis as any).__noDevice ? undefined : { id: 'back' }),
    useCameraPermission: () => (globalThis as any).__camPerm,
    useMicrophonePermission: () => (globalThis as any).__mic,
  };
});

const mockSave = jest.fn(async (segments: any[]) => ({
  rowGUID: 'g1', rowOwnerGUID: 'u', rowParentGUID: 'empty', orderInList: 1,
  rowJSON: { mediaPostTitle: 'Video T', mediaDurationSec: 9, mediaWithAudio: segments.some((s) => s.hasAudio), mediaSegments: segments },
}));
jest.mock('../../kit8/ui/components/media/useSaveRecording', () => ({ useSaveRecording: () => mockSave }));
jest.mock('../../kit8/ui/components/media/RecordingResult', () => {
  const R = require('react');
  return { __esModule: true, default: ({ post }: any) => R.createElement('div', { 'data-testid': 'recording-result' }, post.rowJSON.mediaPostTitle) };
});

import RecordVideo, { SEGMENT_GAP_MS, toFileUri } from '../../kit8/ui/components/media/RecordVideo';

const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

beforeEach(() => {
  jest.useFakeTimers();
  Object.assign(cam, { start: [], stop: 0, pause: 0, resume: 0, audioProps: [], handlers: null, focusedProps: [] });
  (globalThis as any).__mic = { hasPermission: true, requestPermission: jest.fn(async () => true) };
  (globalThis as any).__camPerm = { hasPermission: true, requestPermission: jest.fn(async () => true) };
  (globalThis as any).__noDevice = false;
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.clearAllMocks();
});

it('toFileUri', () => {
  expect(toFileUri('/data/a.mp4')).toBe('file:///data/a.mp4');
  expect(toFileUri('file:///data/a.mp4')).toBe('file:///data/a.mp4');
});

it('record, pause, resume, stop: one mp4 with sound, saved as one part', async () => {
  render(<RecordVideo />);
  await flush();
  expect(q('camera')).not.toBeNull();
  expect(cam.focusedProps.at(-1)).toBe(true);
  expect(text('record-video-sound')).toBe('Sound on|true');

  await pressAsync('record-video-start');
  expect(cam.start).toHaveLength(1);
  expect(cam.start[0]).toMatchObject({ fileType: 'mp4', videoCodec: 'h264' });
  expect(text('record-video-time')).toContain('REC');

  await advance(3000);
  expect(text('record-video-time')).toContain('REC 0:03');

  await pressAsync('record-video-pause');
  expect(cam.pause).toBe(1);
  expect(text('record-video-time')).toContain('PAUSED');
  await advance(5000); // a paused recording does not count
  expect(text('record-video-time')).toContain('0:03');
  await pressAsync('record-video-pause');
  expect(cam.resume).toBe(1);

  await pressAsync('record-video-stop');
  await flush();
  expect(cam.stop).toBe(1);
  expect(mockSave).toHaveBeenCalledTimes(1);
  // the part also knows when it started and where it stood still (the date and time stamp of the player)
  expect(mockSave.mock.calls[0][0]).toEqual([{ uri: 'file:///cache/part1.mp4', durationSec: 3, hasAudio: true, startedAt: expect.any(String), pauses: [{ atSec: 3, lengthSec: 5 }] }]);
  // the switch "Date and time over the video" is off: the post gets no stamp
  expect(mockSave.mock.calls[0][2]).toEqual({ dateTimeOver: null });
  expect(q('recording-result')).not.toBeNull();
});

it('the sound switch DURING the recording ends the part and starts the next one with the new setting', async () => {
  render(<RecordVideo />);
  await flush();
  await pressAsync('record-video-start');
  expect(cam.audioProps.at(-1)).toBe(true);
  await advance(1000);

  await pressAsync('record-video-sound'); // sound off, while recording
  expect(cam.stop).toBe(1); // the first part was ended
  expect(cam.start).toHaveLength(1); // the next one starts after the camera session was rebuilt
  expect(cam.audioProps.at(-1)).toBe(false);
  expect(q('record-video-hint')).not.toBeNull();
  await advance(SEGMENT_GAP_MS);
  expect(cam.start).toHaveLength(2);
  expect(text('record-video-sound')).toBe('Sound off|false');

  await pressAsync('record-video-sound'); // sound on again
  await advance(SEGMENT_GAP_MS);
  expect(cam.start).toHaveLength(3);
  expect(cam.audioProps.at(-1)).toBe(true);

  await pressAsync('record-video-stop');
  await flush();
  expect(cam.stop).toBe(3);
  const saved = mockSave.mock.calls[0][0];
  expect(saved.map((s: any) => [s.uri, s.hasAudio])).toEqual([
    ['file:///cache/part1.mp4', true],
    ['file:///cache/part2.mp4', false],
    ['file:///cache/part3.mp4', true],
  ]);
});

it('the switch before the recording only changes the setting of the first part', async () => {
  render(<RecordVideo />);
  await flush();
  await pressAsync('record-video-sound');
  expect(cam.stop).toBe(0);
  expect(cam.audioProps.at(-1)).toBe(false);
  await pressAsync('record-video-start');
  await pressAsync('record-video-stop');
  await flush();
  expect(mockSave.mock.calls[0][0]).toEqual([expect.objectContaining({ hasAudio: false })]);
});

it('switching the sound on asks for the microphone; refused = stays off', async () => {
  (globalThis as any).__mic = { hasPermission: false, requestPermission: jest.fn(async () => false) };
  render(<RecordVideo withAudio={false} />);
  await flush();
  await pressAsync('record-video-sound');
  expect((globalThis as any).__mic.requestPermission).toHaveBeenCalled();
  expect((globalThis as any).__showError).toHaveBeenCalledWith(expect.stringContaining('microphone'), 'Record video');
  expect(text('record-video-sound')).toBe('Sound off|false');
});

it('no camera device (a simulator): says so and cannot start', async () => {
  (globalThis as any).__noDevice = true;
  render(<RecordVideo />);
  await flush();
  expect(text('record-video-nodevice')).toContain('No camera');
  await pressAsync('record-video-start');
  expect(cam.start).toHaveLength(0);
});

it('camera not allowed: offers to allow it', async () => {
  (globalThis as any).__camPerm = { hasPermission: false, requestPermission: jest.fn(async () => false) };
  render(<RecordVideo />);
  await flush();
  expect(q('camera')).toBeNull();
  await pressAsync('record-video-allow');
  expect((globalThis as any).__camPerm.requestPermission).toHaveBeenCalled();
});

it('stops by itself at the time limit', async () => {
  render(<RecordVideo maxDurationSec={2} />);
  await flush();
  await pressAsync('record-video-start');
  await advance(2600);
  await flush();
  expect(cam.stop).toBe(1);
  expect(mockSave).toHaveBeenCalledTimes(1);
});

describe('date and time over the video (documentation/CAMERA_DATE_TIME.html)', () => {
  afterEach(() => { (globalThis as any).__recordVideoSettings = undefined; });

  it('off by default: no stamp over the preview; the gear opens the panel with the radio disabled', async () => {
    render(<RecordVideo />);
    await flush();
    expect(q('record-video-datetime')).toBeNull();
    expect(q('record-video-settings-panel')).toBeNull();
    await pressAsync('record-video-settings-button');
    expect(text('record-video-datetime-switch')).toBe('Date and time over the video|false');
    expect(text('record-video-datetime-position-bottomRight')).toBe('Bottom Right|true|off'); // chosen, disabled while the switch is off

    await pressAsync('record-video-datetime-switch');
    expect(q('record-video-datetime')).not.toBeNull();
    expect(text('record-video-datetime')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(text('record-video-datetime-position-topLeft')).toBe('Top Left|false|on');
    await pressAsync('record-video-datetime-position-topLeft');
    expect(q('record-video-datetime')!.getAttribute('aria-label')).toBe('Date and time topLeft');

    await pressAsync('record-video-settings-reset');
    expect(q('record-video-datetime')).toBeNull();
  });

  it('on: the file is recorded as before, the post says "not in the picture" + the corner; locked while recording', async () => {
    (globalThis as any).__recordVideoSettings = { recordDateTimeOverEnabled: true, recordDateTimeOverPosition: 'topRight' };
    render(<RecordVideo />);
    await flush();
    expect(q('record-video-datetime')).not.toBeNull();
    await pressAsync('record-video-settings-button');
    await pressAsync('record-video-start');
    expect(cam.start[0]).toMatchObject({ fileType: 'mp4', videoCodec: 'h264' });

    // locked: neither the switch nor the radio changes anything while the recording runs
    await pressAsync('record-video-datetime-switch');
    await pressAsync('record-video-datetime-position-bottomLeft');
    expect(text('record-video-datetime-switch')).toBe('Date and time over the video|true');
    expect(q('record-video-datetime')!.getAttribute('aria-label')).toBe('Date and time topRight');

    await advance(2000);
    await pressAsync('record-video-stop');
    await flush();
    expect(mockSave.mock.calls[0][2]).toEqual({ dateTimeOver: { position: 'topRight', burnedIn: false } });
    expect(mockSave.mock.calls[0][0][0].startedAt).toEqual(expect.any(String));
    expect(mockSave.mock.calls[0][0][0].pauses).toBeUndefined();
  });

  it('the time badge leaves the top left corner when the stamp stands there', async () => {
    (globalThis as any).__recordVideoSettings = { recordDateTimeOverEnabled: true, recordDateTimeOverPosition: 'topLeft' };
    render(<RecordVideo />);
    await flush();
    await pressAsync('record-video-start');
    expect(q('record-video-badge-right')).not.toBeNull();
    expect(q('record-video-badge')).toBeNull();
  });
});
