/** @jest-environment jsdom */
// VideoPlayerView of iOS / Android (expo-video + our buttons). The web twin is tested in videoPlayerViewWeb.test.tsx.
import React from 'react';
import { act } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { cleanup, flush, q, render, text } from './mediaUiTestKit';
import uxuiReducer from '../../kit8/redux/uxuiSlice';

const listeners: Record<string, (p?: any) => void> = {};
const player: any = {
  loop: true,
  playing: false,
  currentTime: 0,
  duration: 0,
  timeUpdateEventInterval: 0,
  play: jest.fn(() => { player.playing = true; }),
  pause: jest.fn(() => { player.playing = false; }),
  replay: jest.fn(),
  addListener: jest.fn((name: string, cb: (p?: any) => void) => { listeners[name] = cb; return { remove: jest.fn() }; }),
};
const mockUseVideoPlayer = jest.fn((source: any, setup: (p: any) => void) => { setup(player); return player; });
jest.mock('expo-video', () => {
  const R = require('react');
  return {
    useVideoPlayer: (s: any, setup: any) => mockUseVideoPlayer(s, setup),
    VideoView: (props: any) => R.createElement('div', { 'data-testid': 'expo-video-view', 'data-controls': String(props.nativeControls) }),
  };
});

import VideoPlayerView from '../../kit8/ui/components/media/VideoPlayerView';

const mount = (extra: Partial<React.ComponentProps<typeof VideoPlayerView>> = {}) =>
  render(
    <Provider store={configureStore({ reducer: { uxuiState: uxuiReducer } })}>
      <VideoPlayerView uri="file:///data/a.mp4" {...extra} />
    </Provider>,
  );
const emit = (name: string, payload?: any) => act(() => listeners[name](payload));
const press = (id: string) => act(() => { (q(id) as any).click(); });

beforeEach(() => {
  Object.assign(player, { loop: true, playing: false, currentTime: 0, duration: 0, timeUpdateEventInterval: 0 });
});
afterEach(() => { cleanup(); jest.clearAllMocks(); });

it('plays the uri without the native controls (ours are over it), starts by itself when asked', async () => {
  mount({ autoPlay: true });
  await flush();
  expect(mockUseVideoPlayer.mock.calls[0][0]).toEqual({ uri: 'file:///data/a.mp4' });
  expect(player.play).toHaveBeenCalledTimes(1);
  expect(player.loop).toBe(false);
  expect(player.timeUpdateEventInterval).toBe(0.25);
  expect(q('expo-video-view')?.getAttribute('data-controls')).toBe('false');
  expect(q('video-controls')).not.toBeNull();
});

it('stopped: the big Play button is there and starts the video; playing: it is gone', async () => {
  mount();
  await flush();
  expect(q('video-big-play')).not.toBeNull();
  press('video-big-play');
  expect(player.play).toHaveBeenCalledTimes(1);
  emit('playingChange', { isPlaying: true });
  expect(q('video-big-play')).toBeNull();
  press('video-play-pause');
  expect(player.pause).toHaveBeenCalledTimes(1);
  emit('playingChange', { isPlaying: false });
  expect(q('video-big-play')).not.toBeNull();
});

it('shows the time and the length; the - / + buttons move the player', async () => {
  mount();
  await flush();
  emit('sourceLoad', { duration: 120 });
  emit('timeUpdate', { currentTime: 30 });
  expect(text('video-time-current')).toBe('0:30');
  expect(text('video-time-total')).toBe('2:00');
  player.currentTime = 30;
  press('video-rewind-forward');
  expect(player.currentTime).toBe(35);
  press('video-rewind-back');
  press('video-rewind-back');
  expect(player.currentTime).toBe(25);
});

it('the end of the file: tells MediaPlayer, offers Play again, and Play starts from the beginning', async () => {
  const onEnd = jest.fn();
  mount({ onEnd });
  await flush();
  emit('playingChange', { isPlaying: true });
  emit('playToEnd');
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(text('video-big-play')).toBe('replay');
  press('video-big-play');
  expect(player.replay).toHaveBeenCalledTimes(1);
  emit('playingChange', { isPlaying: true });
  expect(q('video-big-play')).toBeNull();
});

it('tells the errors of the player', async () => {
  const onError = jest.fn();
  mount({ onError });
  await flush();
  emit('statusChange', { status: 'readyToPlay' });
  expect(onError).not.toHaveBeenCalled();
  emit('statusChange', { status: 'error', error: { message: 'Source error' } });
  expect(onError).toHaveBeenCalledWith('Source error');
  emit('statusChange', { status: 'error' });
  expect(onError).toHaveBeenLastCalledWith('The video could not be played.');
});
