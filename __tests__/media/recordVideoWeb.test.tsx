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
const fakeRecorderStop = FakeRecorder.prototype.stop;
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
    expect(text('record-video-sound')).toBe('Sound on|true');

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
    expect(segments).toEqual([{ uri: 'blob:fake-1', durationSec: 2, hasAudio: true, startedAt: expect.any(String) }]);
    // the switch "Date and time over the video" is off: the camera stream itself is recorded, the post gets no stamp
    expect(FakeRecorder.instances[0].stream).toBe(stream);
    expect(mockSave.mock.calls[0][2]).toEqual({ dateTimeOver: null });
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
    expect(text('record-video-sound')).toBe('Sound off|false');
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

describe('RecordVideo (web): date and time over the video', () => {
  let drawn: string[];
  let canvasTrack: { stop: jest.Mock };
  let canvasStream: any;
  beforeEach(() => {
    FakeRecorder.prototype.stop = fakeRecorderStop; // the test before replaces it
    drawn = [];
    canvasTrack = { stop: jest.fn() };
    const added: any[] = [];
    canvasStream = { added, addTrack: (t: any) => added.push(t), getVideoTracks: () => [canvasTrack] };
    (stream as any).getVideoTracks = () => [{ getSettings: () => ({ width: 1280, height: 720 }) }];
    getUserMedia.mockImplementation(async () => { (stream as any).getVideoTracks = () => [{ getSettings: () => ({ width: 1280, height: 720 }) }]; return stream; });
    const ctx: any = { drawImage: jest.fn(), fillText: (t: string, x: number, y: number) => drawn.push(`${t}@${x},${y}`), save: jest.fn(), restore: jest.fn() };
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx);
    (HTMLCanvasElement.prototype as any).captureStream = jest.fn(() => canvasStream);
  });
  afterEach(() => {
    (globalThis as any).__recordVideoSettings = undefined;
    delete (HTMLCanvasElement.prototype as any).captureStream;
    jest.restoreAllMocks();
  });

  it('on: the recorder gets the canvas stream (frames + text) with the SAME microphone track; the post says "in the picture"', async () => {
    (globalThis as any).__recordVideoSettings = { recordDateTimeOverEnabled: true, recordDateTimeOverPosition: 'bottomRight' };
    render(<RecordVideo />);
    await flush();
    expect(q('record-video-datetime')).not.toBeNull();

    await pressAsync('record-video-start');
    expect(FakeRecorder.instances[0].stream).toBe(canvasStream);
    expect(canvasStream.added).toEqual(stream.audio);
    // bottom right of 1280 x 720: 3 % and 4 % from the edges
    expect(drawn[0]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}@1242,691$/);

    const before = drawn.length;
    await advance(1000); // no frame callback in jsdom: the timer draws
    expect(drawn.length).toBeGreaterThan(before + 20);

    await pressAsync('record-video-sound'); // the switch still acts on the microphone track
    expect(stream.audio[0].enabled).toBe(false);

    await pressAsync('record-video-stop');
    await flush();
    expect(canvasTrack.stop).toHaveBeenCalled();
    expect(mockSave.mock.calls[0][2]).toEqual({ dateTimeOver: { position: 'bottomRight', burnedIn: true } });
    const after = drawn.length;
    await advance(1000); // stopped: nothing is drawn any more
    expect(drawn.length).toBe(after);
  });

  it('a browser without canvas.captureStream records as before and says so', async () => {
    delete (HTMLCanvasElement.prototype as any).captureStream;
    (globalThis as any).__recordVideoSettings = { recordDateTimeOverEnabled: true, recordDateTimeOverPosition: 'topLeft' };
    render(<RecordVideo />);
    await flush();
    await pressAsync('record-video-start');
    expect(FakeRecorder.instances[0].stream).toBe(stream);
    expect((globalThis as any).__showError).toHaveBeenCalled();
    await pressAsync('record-video-stop');
    await flush();
    expect(mockSave.mock.calls[0][2]).toEqual({ dateTimeOver: null });
  });
});
