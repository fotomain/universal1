/** @jest-environment jsdom */
// VideoPlayerView.web: a <video> element with our buttons over it.
import React from 'react';
import { act } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { cleanup, flush, q, render, text } from './mediaUiTestKit';
import uxuiReducer from '../../kit8/redux/uxuiSlice';
import VideoPlayerView from '../../kit8/ui/components/media/VideoPlayerView.web';

const mount = (extra: Partial<React.ComponentProps<typeof VideoPlayerView>> = {}) =>
  render(
    <Provider store={configureStore({ reducer: { uxuiState: uxuiReducer } })}>
      <VideoPlayerView uri="https://example.com/a.mp4" {...extra} />
    </Provider>,
  );
const video = () => document.querySelector('video') as HTMLVideoElement;
const fire = (name: string) => act(() => { video().dispatchEvent(new Event(name)); });
const press = (id: string) => act(() => { (q(id) as any).click(); });
const setProp = (name: string, value: any) => Object.defineProperty(video(), name, { value, configurable: true, writable: true });

let play: jest.SpyInstance;
let pause: jest.SpyInstance;
beforeEach(() => {
  play = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  pause = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); });

it('has no controls of the browser (ours are over the video) and the uri', async () => {
  mount();
  await flush();
  expect(video().getAttribute('src')).toBe('https://example.com/a.mp4');
  expect(video().hasAttribute('controls')).toBe(false);
  expect(q('video-controls')).not.toBeNull();
});

it('autoPlay asks the browser to play; without it the video waits and the big Play button is shown', async () => {
  mount({ autoPlay: true });
  await flush();
  expect(play).toHaveBeenCalled();
  cleanup();
  play.mockClear();
  mount();
  await flush();
  expect(play).not.toHaveBeenCalled();
  expect(q('video-big-play')).not.toBeNull();
});

it('big Play plays; once playing it is gone and the toolbar button pauses', async () => {
  mount();
  await flush();
  setProp('paused', true);
  press('video-big-play');
  expect(play).toHaveBeenCalledTimes(1);
  fire('play');
  expect(q('video-big-play')).toBeNull();
  setProp('paused', false);
  press('video-play-pause');
  expect(pause).toHaveBeenCalledTimes(1);
  fire('pause');
  expect(q('video-big-play')).not.toBeNull();
});

it('shows the time and length, and the - / + buttons seek the video', async () => {
  mount();
  await flush();
  setProp('duration', 90);
  fire('loadedmetadata');
  setProp('currentTime', 20);
  fire('timeupdate');
  expect(text('video-time-current')).toBe('0:20');
  expect(text('video-time-total')).toBe('1:30');
  press('video-rewind-forward');
  expect(video().currentTime).toBe(25);
  press('video-rewind-back');
  press('video-rewind-back');
  expect(video().currentTime).toBe(15);
});

it('the end: tells MediaPlayer, shows replay, Play starts from 0', async () => {
  const onEnd = jest.fn();
  mount({ onEnd });
  await flush();
  fire('play');
  setProp('currentTime', 60);
  fire('ended');
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(text('video-big-play')).toBe('replay');
  press('video-big-play');
  expect(video().currentTime).toBe(0);
  expect(play).toHaveBeenCalled();
});

it('a video that cannot be played tells so', async () => {
  const onError = jest.fn();
  mount({ onError });
  await flush();
  fire('error');
  expect(onError).toHaveBeenCalledWith(expect.stringContaining('could not be played'));
});
