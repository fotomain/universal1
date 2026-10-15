/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, press, q, render, text } from './mediaUiTestKit';

// ---- expo-audio: a fake player the test can drive
const player: any = { play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(async () => undefined) };
let status: any;
(globalThis as any).__audioPlayer = player;
jest.mock('expo-audio', () => ({
  useAudioPlayer: (source: any) => { (globalThis as any).__audioSource = source; return (globalThis as any).__audioPlayer; },
  useAudioPlayerStatus: () => (globalThis as any).__audioStatus,
  setAudioModeAsync: jest.fn(async () => undefined),
}));

import AudioPlayerView, { AUDIO_LOAD_TIMEOUT_MS } from '../../kit8/ui/components/media/AudioPlayerView';

const base = { isLoaded: true, playing: false, didJustFinish: false, currentTime: 0, duration: 100, error: null };
const setStatus = (s: any) => { status = { ...base, ...s }; (globalThis as any).__audioStatus = status; };

beforeEach(() => { jest.useFakeTimers(); setStatus({}); });
afterEach(() => { cleanup(); jest.useRealTimers(); jest.clearAllMocks(); });

it('hands the uri to expo-audio and starts by itself once loaded', async () => {
  render(<AudioPlayerView uri="https://a/1.mp3" autoPlay />);
  await flush();
  expect((globalThis as any).__audioSource).toEqual({ uri: 'https://a/1.mp3' });
  expect(player.play).toHaveBeenCalledTimes(1);
});

it('without autoPlay it waits; the button plays and pauses', async () => {
  render(<AudioPlayerView uri="https://a/1.mp3" />);
  await flush();
  expect(player.play).not.toHaveBeenCalled();
  expect(text('audio-player-state')).toBe('Paused');
  press('audio-player-toggle');
  expect(player.play).toHaveBeenCalledTimes(1);
  cleanup();
  setStatus({ playing: true, currentTime: 10 });
  render(<AudioPlayerView uri="https://a/1.mp3" />);
  await flush();
  expect(text('audio-player-state')).toBe('Playing');
  press('audio-player-toggle');
  expect(player.pause).toHaveBeenCalledTimes(1);
});

it('while loading: Loading…, the buttons do nothing', async () => {
  setStatus({ isLoaded: false });
  render(<AudioPlayerView uri="https://a/1.mp3" autoPlay />);
  await flush();
  expect(text('audio-player-state')).toBe('Loading…');
  expect(player.play).not.toHaveBeenCalled();
});

it('after the end a press starts again from the beginning; onEnd is told once', async () => {
  const onEnd = jest.fn();
  setStatus({ didJustFinish: true, currentTime: 100 });
  render(<AudioPlayerView uri="https://a/1.mp3" onEnd={onEnd} />);
  await flush();
  expect(onEnd).toHaveBeenCalledTimes(1);
  press('audio-player-toggle');
  expect(player.seekTo).toHaveBeenCalledWith(0);
  expect(player.play).toHaveBeenCalled();
});

it('skips 10 seconds back and forward', async () => {
  setStatus({ currentTime: 30 });
  render(<AudioPlayerView uri="https://a/1.mp3" />);
  await flush();
  const buttons = document.querySelectorAll('[aria-label]');
  expect(buttons.length).toBeGreaterThanOrEqual(0);
  const texts = Array.from(document.querySelectorAll('div,span')).filter((e) => e.children.length === 0);
  const back = texts.find((e) => e.textContent === 'rewind-10')!.parentElement!;
  const fwd = texts.find((e) => e.textContent === 'fast-forward-10')!.parentElement!;
  act(() => (back as any).click());
  expect(player.seekTo).toHaveBeenLastCalledWith(20);
  act(() => (fwd as any).click());
  expect(player.seekTo).toHaveBeenLastCalledWith(40);
});

it('reports an error of the player, and a file that never loads', async () => {
  const onError = jest.fn();
  setStatus({ error: 'Source error' });
  render(<AudioPlayerView uri="https://a/1.mp3" onError={onError} />);
  await flush();
  expect(onError).toHaveBeenCalledWith('Source error');
  cleanup();

  onError.mockClear();
  setStatus({ isLoaded: false });
  render(<AudioPlayerView uri="https://a/never.mp3" onError={onError} />);
  await act(async () => { jest.advanceTimersByTime(AUDIO_LOAD_TIMEOUT_MS + 10); });
  expect(onError).toHaveBeenCalledWith('The audio could not be loaded.');
  expect(q('audio-player-view')).not.toBeNull();
});
