/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, pressAsync, q, render, text } from './mediaUiTestKit';

const mockSave = jest.fn(async (segments: any[]) => ({
  rowGUID: 'g1', rowOwnerGUID: 'u', rowParentGUID: 'empty', orderInList: 1,
  rowJSON: { mediaPostTitle: 'Video W', mediaDurationSec: 3, mediaWithAudio: segments.some((s) => s.hasAudio) },
}));
jest.mock('../../kit8/ui/components/media/useSaveRecording', () => ({ useSaveRecording: () => mockSave }));
jest.mock('../../kit8/ui/components/media/RecordingResult', () => {
  const R = require('react');
  return { __esModule: true, default: ({ post }: any) => R.createElement('div', { 'data-testid': 'recording-result' }, post.rowJSON.mediaPostTitle) };
});

import RecordVideo, { pickRecorderMimeType, RECORDER_MIME_CANDIDATES } from '../../kit8/ui/components/media/RecordVideo.web';

// ---- browser fakes
class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supported = (m: string) => m === 'video/webm';
  static isTypeSupported(m: string) { return FakeRecorder.supported(m); }
  state = 'inactive';
  mimeType: string;
  ondataavailable: any; onstop: any;
  calls: string[] = [];
  constructor(public stream: any, public options?: any) { this.mimeType = options?.mimeType || ''; FakeRecorder.instances.push(this); }
  start() { this.state = 'recording'; this.calls.push('start'); }
  pause() { this.state = 'paused'; this.calls.push('pause'); }
  resume() { this.state = 'recording'; this.calls.push('resume'); }
  stop() {
    this.state = 'inactive';
    this.calls.push('stop');
    this.ondataavailable?.({ data: new Blob(['frame-data'], { type: 'video/webm' }) });
    this.onstop?.();
  }
}
const makeStream = (withAudio: boolean) => {
  const audio = withAudio ? [{ enabled: true, stop: jest.fn() }] : [];
  const video = [{ enabled: true, stop: jest.fn() }];
  return { audio, video, getAudioTracks: () => audio, getTracks: () => [...video, ...audio] };
};
let stream: ReturnType<typeof makeStream>;
let getUserMedia: jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  FakeRecorder.instances = [];
  stream = makeStream(true);
  getUserMedia = jest.fn(async () => stream);
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });
  (globalThis as any).MediaRecorder = FakeRecorder;
  // jest-expo installs a lazy global URL that is not usable here: give the component a small one
  Object.defineProperty(globalThis, 'URL', { value: { createObjectURL: jest.fn(() => 'blob:fake-1'), revokeObjectURL: jest.fn() }, configurable: true, writable: true });
  (HTMLMediaElement.prototype as any).play = jest.fn(() => Promise.resolve());
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  jest.clearAllMocks();
});
const advance = (ms: number) => act(async () => { jest.advanceTimersByTime(ms); });

describe('pickRecorderMimeType', () => {
  it('takes the first container this browser records', () => {
    expect(pickRecorderMimeType((m) => m === 'video/webm')).toBe('video/webm');
    expect(pickRecorderMimeType((m) => m.startsWith('video/mp4'))).toBe('video/mp4;codecs=avc1,mp4a.40.2'); // Safari
    expect(pickRecorderMimeType(() => true)).toBe(RECORDER_MIME_CANDIDATES[0]);
    expect(pickRecorderMimeType(() => false)).toBe('');
  });
});

describe('RecordVideo (web)', () => {
  it('records ONE file; the sound switch during the recording switches the microphone track', async () => {
    render(<RecordVideo />);
    await flush();
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: true }));
    expect(text('record-video-sound')).toBe('Record sound: on|true');

    await pressAsync('record-video-start');
    expect(FakeRecorder.instances).toHaveLength(1);
    expect(FakeRecorder.instances[0].mimeType).toBe('video/webm');
    expect(stream.audio[0].enabled).toBe(true);

    await advance(2000);
    expect(text('record-video-time')).toContain('REC 0:02');

    await pressAsync('record-video-sound'); // off, while recording: the same recorder goes on
    expect(stream.audio[0].enabled).toBe(false);
    expect(FakeRecorder.instances).toHaveLength(1);
    expect(FakeRecorder.instances[0].state).toBe('recording');
    await pressAsync('record-video-sound'); // on again
    expect(stream.audio[0].enabled).toBe(true);

    await pressAsync('record-video-stop');
    await flush();
    expect(mockSave).toHaveBeenCalledTimes(1);
    const [segments] = mockSave.mock.calls[0];
    expect(segments).toEqual([{ uri: 'blob:fake-1', durationSec: 2, hasAudio: true }]);
    expect(q('recording-result')).not.toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-1');
  });

  it('a recording whose sound stayed off is flagged without sound', async () => {
    render(<RecordVideo withAudio={false} />);
    await flush();
    expect(stream.audio[0].enabled).toBe(false);
    await pressAsync('record-video-start');
    await advance(1000);
    await pressAsync('record-video-stop');
    await flush();
    expect(mockSave.mock.calls[0][0][0].hasAudio).toBe(false);
  });

  it('turning the sound on later in the recording counts as a recording with sound', async () => {
    render(<RecordVideo withAudio={false} />);
    await flush();
    await pressAsync('record-video-start');
    await pressAsync('record-video-sound');
    expect(stream.audio[0].enabled).toBe(true);
    await pressAsync('record-video-stop');
    await flush();
    expect(mockSave.mock.calls[0][0][0].hasAudio).toBe(true);
  });

  it('pause and resume go to the recorder and stop the clock', async () => {
    render(<RecordVideo />);
    await flush();
    await pressAsync('record-video-start');
    await advance(1000);
    await pressAsync('record-video-pause');
    expect(FakeRecorder.instances[0].calls).toContain('pause');
    await advance(4000);
    await pressAsync('record-video-pause');
    expect(FakeRecorder.instances[0].calls).toContain('resume');
    await advance(1000);
    await pressAsync('record-video-stop');
    await flush();
    expect(mockSave.mock.calls[0][0][0].durationSec).toBeCloseTo(2, 0);
  });

  it('no microphone allowed: video only, the switch is disabled and says so', async () => {
    getUserMedia.mockImplementation(async (c: any) => {
      if (c.audio) throw new Error('NotAllowedError');
      return makeStream(false);
    });
    render(<RecordVideo />);
    await flush();
    expect(text('record-video-nomic')).toContain('without sound');
    expect(text('record-video-sound')).toBe('Record sound: off|false');
    await pressAsync('record-video-start');
    await pressAsync('record-video-stop');
    await flush();
    expect(mockSave.mock.calls[0][0][0].hasAudio).toBe(false);
  });

  it('no camera: the error is shown and Record is disabled', async () => {
    getUserMedia.mockRejectedValue(new Error('Requested device not found'));
    render(<RecordVideo />);
    await flush();
    expect(text('record-video-error')).toContain('Requested device not found');
    await pressAsync('record-video-start');
    expect(FakeRecorder.instances).toHaveLength(0);
  });

  it('the camera is released when the screen closes', async () => {
    render(<RecordVideo />);
    await flush();
    cleanup();
    expect(stream.video[0].stop).toHaveBeenCalled();
    expect(stream.audio[0].stop).toHaveBeenCalled();
  });

  it('an empty recording is an error, not a post', async () => {
    FakeRecorder.prototype.stop = function (this: FakeRecorder) { this.state = 'inactive'; this.onstop?.(); };
    render(<RecordVideo />);
    await flush();
    await pressAsync('record-video-start');
    await pressAsync('record-video-stop');
    await flush();
    expect(mockSave).not.toHaveBeenCalled();
    expect((globalThis as any).__showError).toHaveBeenCalled();
  });
});
