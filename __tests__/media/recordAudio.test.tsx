/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, pressAsync, q, render, text } from './mediaUiTestKit';

const rec: any = { prepared: 0, recorded: 0, paused: 0, stopped: 0, uri: null as string | null, state: { isRecording: false, durationMillis: 0, metering: -30, url: null } };
(globalThis as any).__rec = rec;
(globalThis as any).__recPerm = { granted: true };
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  requestRecordingPermissionsAsync: async () => (globalThis as any).__recPerm,
  setAudioModeAsync: jest.fn(async () => undefined),
  useAudioRecorder: () => {
    const r = (globalThis as any).__rec;
    return {
      get uri() { return r.uri; },
      prepareToRecordAsync: async () => { r.prepared += 1; },
      record: () => { r.recorded += 1; r.state.isRecording = true; },
      pause: () => { r.paused += 1; },
      stop: async () => { r.stopped += 1; r.uri = 'file:///cache/rec.m4a'; },
      getStatus: () => r.state,
    };
  },
  useAudioRecorderState: () => (globalThis as any).__rec.state,
}));
const mockSave = jest.fn(async (segments: any[]) => ({
  rowGUID: 'g', rowOwnerGUID: 'u', rowParentGUID: 'empty', orderInList: 1, rowJSON: { mediaPostTitle: 'Audio T', mediaDurationSec: segments[0].durationSec },
}));
jest.mock('../../kit8/ui/components/media/useSaveRecording', () => ({ useSaveRecording: () => mockSave }));
jest.mock('../../kit8/ui/components/media/RecordingResult', () => {
  const R = require('react');
  return { __esModule: true, default: ({ post }: any) => R.createElement('div', { 'data-testid': 'recording-result' }, post.rowJSON.mediaPostTitle) };
});

import RecordAudio, { meterLevel } from '../../kit8/ui/components/media/RecordAudio';

beforeEach(() => {
  Object.assign(rec, { prepared: 0, recorded: 0, paused: 0, stopped: 0, uri: null, state: { isRecording: false, durationMillis: 0, metering: -30, url: null } });
  (globalThis as any).__recPerm = { granted: true };
});
afterEach(() => { cleanup(); jest.clearAllMocks(); });

it('meterLevel maps dB to 0..1', () => {
  expect(meterLevel(-160)).toBe(0);
  expect(meterLevel(-60)).toBe(0);
  expect(meterLevel(-30)).toBe(0.5);
  expect(meterLevel(0)).toBe(1);
  expect(meterLevel(10)).toBe(1);
  expect(meterLevel(undefined)).toBe(0);
});

it('record, pause, resume, stop & save: the file of the recorder becomes a post', async () => {
  render(<RecordAudio />);
  await flush();
  expect(text('record-audio-state')).toBe('Press Record');
  await pressAsync('record-audio-start');
  expect(rec.prepared).toBe(1);
  expect(rec.recorded).toBe(1);
  expect(text('record-audio-state')).toBe('Recording…');

  rec.state = { ...rec.state, durationMillis: 7400 };
  await pressAsync('record-audio-pause');
  expect(rec.paused).toBe(1);
  expect(text('record-audio-state')).toBe('Paused');
  expect(text('record-audio-time')).toBe('0:07');
  await pressAsync('record-audio-pause'); // resume
  expect(rec.recorded).toBe(2);

  rec.state = { ...rec.state, durationMillis: 0 }; // some platforms reset the clock on stop
  await pressAsync('record-audio-stop');
  await flush();
  expect(rec.stopped).toBe(1);
  expect(mockSave).toHaveBeenCalledWith([{ uri: 'file:///cache/rec.m4a', durationSec: 7.4, hasAudio: true }]);
  expect(q('recording-result')).not.toBeNull();
});

it('the microphone refused: an error, nothing is recorded', async () => {
  (globalThis as any).__recPerm = { granted: false };
  render(<RecordAudio />);
  await flush();
  await pressAsync('record-audio-start');
  expect(rec.recorded).toBe(0);
  expect((globalThis as any).__showError).toHaveBeenCalledWith(expect.stringContaining('microphone'), 'Record audio');
  expect(text('record-audio-state')).toBe('Press Record');
});

it('a save that fails shows the error and goes back to Record (nothing half-saved)', async () => {
  mockSave.mockRejectedValueOnce(new Error('disk full'));
  render(<RecordAudio />);
  await flush();
  await pressAsync('record-audio-start');
  rec.state = { ...rec.state, durationMillis: 1000 };
  await pressAsync('record-audio-stop');
  await flush();
  expect((globalThis as any).__showError).toHaveBeenCalledWith(expect.objectContaining({ message: 'disk full' }), 'Save audio');
  expect(text('record-audio-state')).toBe('Press Record');
  expect(q('recording-result')).toBeNull();
});

it('stops by itself at the time limit', async () => {
  render(<RecordAudio maxDurationSec={5} />);
  await flush();
  rec.state = { ...rec.state, durationMillis: 5200 }; // the recorder reports more than the limit as soon as it runs
  await pressAsync('record-audio-start');
  await flush();
  expect(rec.stopped).toBe(1);
  expect(mockSave).toHaveBeenCalledTimes(1);
});
