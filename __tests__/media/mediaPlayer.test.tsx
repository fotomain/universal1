/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { cleanup, flush, press, pressAsync, q, render, text } from './mediaUiTestKit';

// the platform players are stubs: they show what MediaPlayer hands them and let the test end the file
const mockViews: Array<{ kind: string; props: any }> = [];
jest.mock('../../kit8/ui/components/media/AudioPlayerView', () => {
  const R = require('react');
  return { __esModule: true, default: (props: any) => { (mockViews as any).push({ kind: 'audio', props }); return R.createElement('div', { 'data-testid': 'audio-view', 'data-uri': props.uri, 'data-autoplay': String(props.autoPlay) }); } };
});
jest.mock('../../kit8/ui/components/media/VideoPlayerView', () => {
  const R = require('react');
  return { __esModule: true, default: (props: any) => { (mockViews as any).push({ kind: 'video', props }); return R.createElement('div', { 'data-testid': 'video-view', 'data-uri': props.uri, 'data-autoplay': String(props.autoPlay) }); } };
});
const mockResolve = jest.fn(async (uri: string) => (uri.startsWith('kit8media://') ? 'blob:resolved-' + uri.slice(12) : uri));
jest.mock('../../kit8/ui/components/media/mediaFileStore', () => ({ resolveMediaUri: (u: string) => mockResolve(u) }));

import MediaPlayer from '../../kit8/ui/components/media/MediaPlayer';
import MediaPlayerModal from '../../kit8/ui/components/media/MediaPlayerModal';
import MediaPlayerScreen from '../../kit8/ui/components/media/MediaPlayerScreen';

const lastView = () => mockViews[mockViews.length - 1];
const typeInto = (testID: string, value: string) =>
  act(() => {
    const el = q(testID) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

afterEach(() => {
  cleanup();
  mockViews.length = 0;
  (globalThis as any).__params = undefined;
  jest.clearAllMocks();
});

describe('MediaPlayer', () => {
  it('a remote address plays by itself', async () => {
    render(<MediaPlayer kind="video" source="https://example.com/a.mp4" />);
    await flush();
    expect(q('video-view')?.getAttribute('data-uri')).toBe('https://example.com/a.mp4');
    expect(q('video-view')?.getAttribute('data-autoplay')).toBe('true');
    expect(q('audio-view')).toBeNull();
  });

  it('audio kind uses the audio view; autoPlay=false waits for the user', async () => {
    render(<MediaPlayer kind="audio" source="file:///data/a.m4a" autoPlay={false} />);
    await flush();
    expect(q('audio-view')?.getAttribute('data-uri')).toBe('file:///data/a.m4a');
    expect(q('audio-view')?.getAttribute('data-autoplay')).toBe('false');
  });

  it('without a source it asks for one and shows no player', async () => {
    render(<MediaPlayer kind="audio" />);
    await flush();
    expect(q('audio-view')).toBeNull();
    expect(text('media-player-empty')).toContain('Enter an address or choose a audio file');
    expect(q('media-source-input')).not.toBeNull();
  });

  it('plays the address the user typed, and says so for a bad one', async () => {
    render(<MediaPlayer kind="video" />);
    await flush();
    typeInto('media-source-text', 'nonsense');
    await pressAsync('media-source-play');
    expect(text('media-source-problem')).toContain('Enter an https:// address');
    expect(q('video-view')).toBeNull();

    typeInto('media-source-text', 'https://cdn.example.com/clip.mp4');
    await pressAsync('media-source-play');
    await flush();
    expect(q('video-view')?.getAttribute('data-uri')).toBe('https://cdn.example.com/clip.mp4');
    expect(q('video-view')?.getAttribute('data-autoplay')).toBe('true');
    expect(q('media-source-problem')).toBeNull();
  });

  it('plays the file the user picked', async () => {
    (globalThis as any).__pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/pick.mp3', name: 'pick.mp3' }] });
    render(<MediaPlayer kind="audio" />);
    await flush();
    await pressAsync('media-source-choose');
    await flush();
    expect((globalThis as any).__pick).toHaveBeenCalledWith(expect.objectContaining({ type: 'audio/*', copyToCacheDirectory: true }));
    expect(q('audio-view')?.getAttribute('data-uri')).toBe('file:///cache/pick.mp3');
  });

  it('a cancelled picker changes nothing', async () => {
    (globalThis as any).__pick.mockResolvedValue({ canceled: true, assets: null });
    render(<MediaPlayer kind="video" />);
    await flush();
    await pressAsync('media-source-choose');
    await flush();
    expect(q('video-view')).toBeNull();
  });

  it('warns when a video file is given to the audio player (and still tries)', async () => {
    render(<MediaPlayer kind="audio" />);
    await flush();
    typeInto('media-source-text', 'https://cdn.example.com/clip.mp4');
    await pressAsync('media-source-play');
    expect(text('media-source-problem')).toContain('looks like video');
    await flush();
    expect(q('audio-view')?.getAttribute('data-uri')).toBe('https://cdn.example.com/clip.mp4');
  });

  it('a list is played one after the other, then onEnded', async () => {
    const onEnded = jest.fn();
    render(<MediaPlayer kind="video" source={['https://a/1.mp4', 'https://a/2.mp4']} autoPlay={false} onEnded={onEnded} />);
    await flush();
    expect(text('media-player-queue')).toBe('Part 1 of 2');
    expect(q('video-view')?.getAttribute('data-uri')).toBe('https://a/1.mp4');
    await act(async () => lastView().props.onEnd());
    await flush();
    expect(text('media-player-queue')).toBe('Part 2 of 2');
    expect(q('video-view')?.getAttribute('data-uri')).toBe('https://a/2.mp4');
    expect(q('video-view')?.getAttribute('data-autoplay')).toBe('true'); // the next part starts by itself even when the first did not
    expect(onEnded).not.toHaveBeenCalled();
    await act(async () => lastView().props.onEnd());
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('a recording stored by the app is resolved before it is played', async () => {
    render(<MediaPlayer kind="video" source="kit8media://kit8video_1.webm" />);
    await flush();
    expect(mockResolve).toHaveBeenCalledWith('kit8media://kit8video_1.webm');
    expect(q('video-view')?.getAttribute('data-uri')).toBe('blob:resolved-kit8video_1.webm');
  });

  it('shows the error of the player', async () => {
    render(<MediaPlayer kind="video" source="https://a/x.mp4" showSourceInput={false} />);
    await flush();
    expect(q('media-source-input')).toBeNull();
    await act(async () => lastView().props.onError('The video could not be played.'));
    expect(text('media-player-error')).toBe('The video could not be played.');
  });

  it('a new source prop replaces the old one', async () => {
    render(<MediaPlayer kind="audio" source="https://a/1.mp3" />);
    await flush();
    cleanup();
    render(<MediaPlayer kind="audio" source="https://a/2.mp3" />);
    await flush();
    expect(q('audio-view')?.getAttribute('data-uri')).toBe('https://a/2.mp3');
  });
});

describe('MediaPlayerModal', () => {
  it('opens, plays by itself, hides the address field, closes', async () => {
    const onDismiss = jest.fn();
    render(<MediaPlayerModal visible kind="video" source="https://a/m.mp4" onDismiss={onDismiss} />);
    await flush();
    expect(q('video-view')?.getAttribute('data-uri')).toBe('https://a/m.mp4');
    expect(q('video-view')?.getAttribute('data-autoplay')).toBe('true');
    expect(q('media-source-input')).toBeNull();
    press('media-player-modal-close');
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed (the sound stops)', async () => {
    render(<MediaPlayerModal visible={false} kind="audio" source="https://a/m.mp3" onDismiss={jest.fn()} />);
    await flush();
    expect(q('audio-view')).toBeNull();
  });
});

describe('MediaPlayerScreen (the route)', () => {
  it('?url=…&autoPlay=false', async () => {
    (globalThis as any).__params = { url: 'https://a/r.mp3', autoPlay: 'false' };
    render(<MediaPlayerScreen kind="audio" />);
    await flush();
    expect(q('audio-view')?.getAttribute('data-uri')).toBe('https://a/r.mp3');
    expect(q('audio-view')?.getAttribute('data-autoplay')).toBe('false');
  });

  it('?url=<JSON list>', async () => {
    (globalThis as any).__params = { url: JSON.stringify(['https://a/1.mp4', 'https://a/2.mp4']) };
    render(<MediaPlayerScreen kind="video" />);
    await flush();
    expect(text('media-player-queue')).toBe('Part 1 of 2');
  });

  it('no parameters = the user chooses', async () => {
    render(<MediaPlayerScreen kind="video" />);
    await flush();
    expect(q('media-source-input')).not.toBeNull();
    expect(q('video-view')).toBeNull();
  });
});
