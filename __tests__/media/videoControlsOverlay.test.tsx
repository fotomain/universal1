/** @jest-environment jsdom */
import React from 'react';
import { act } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { cleanup, q, render, text } from './mediaUiTestKit';
import uxuiReducer, { setPlayVideoSettings } from '../../kit8/redux/uxuiSlice';
import VideoControlsOverlay from '../../kit8/ui/components/media/VideoControlsOverlay';

// ---- a store with the real uxuiState, a 300 px wide video
let store: ReturnType<typeof makeStore>;
const makeStore = () => configureStore({ reducer: { uxuiState: uxuiReducer } });
const props = { onTogglePlay: jest.fn(), onSeekTo: jest.fn() };

function mount(extra: Partial<React.ComponentProps<typeof VideoControlsOverlay>> = {}) {
  render(
    <Provider store={store}>
      <VideoControlsOverlay playing={false} currentTime={30} duration={100} {...props} {...extra} />
    </Provider>,
  );
}
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });
const toolbarHidden = () => q('video-controls-toolbar')!.getAttribute('aria-hidden') === 'true';

/** a click at x on the tap surface; pointer = what the browser says it was */
function click(testID: string, x: number, pointerType: 'mouse' | 'touch' = 'mouse') {
  const el = q(testID)!;
  const event = new MouseEvent('click', { bubbles: true, clientX: x });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => { el.dispatchEvent(event); });
}
const tap = (x: number, pointer: 'mouse' | 'touch' = 'mouse') => click('video-tap-surface', x, pointer);
const move = () => act(() => { q('video-tap-surface')!.dispatchEvent(new MouseEvent('mousemove', { bubbles: true })); });
const press = (testID: string) => act(() => { (q(testID) as any).click(); });

beforeEach(() => {
  jest.useFakeTimers();
  store = makeStore();
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 300, bottom: 170, width: 300, height: 170, x: 0, y: 0, toJSON: () => ({}) } as any);
  jest.clearAllMocks();
});
afterEach(() => { cleanup(); jest.useRealTimers(); jest.restoreAllMocks(); });

describe('the buttons appear and disappear', () => {
  it('shown at the start, hidden after hideButtonsAfter = 2.5 seconds', () => {
    mount();
    expect(toolbarHidden()).toBe(false);
    advance(2400);
    expect(toolbarHidden()).toBe(false);
    advance(200);
    expect(toolbarHidden()).toBe(true);
  });

  it('a mouse move shows them again, and the countdown starts again', () => {
    mount();
    advance(3000);
    expect(toolbarHidden()).toBe(true);
    move();
    expect(toolbarHidden()).toBe(false);
    advance(2000);
    move(); // still moving: stays
    advance(2000);
    expect(toolbarHidden()).toBe(false);
    advance(600);
    expect(toolbarHidden()).toBe(true);
  });

  it('one touch shows them (and does not play / pause)', () => {
    mount();
    advance(3000);
    expect(toolbarHidden()).toBe(true);
    tap(150, 'touch');
    expect(toolbarHidden()).toBe(false);
    advance(500);
    expect(props.onTogglePlay).not.toHaveBeenCalled();
  });

  it('follows PlayVideoSettings.hideButtonsAfter', () => {
    store.dispatch(setPlayVideoSettings({ hideButtonsAfter: 6 }));
    mount();
    advance(5900);
    expect(toolbarHidden()).toBe(false);
    advance(200);
    expect(toolbarHidden()).toBe(true);
  });
});

describe('- N s / + N s buttons (PlayVideoSettings.rewindSecondsValue = 5)', () => {
  it('say the seconds and jump', () => {
    mount();
    expect(text('video-rewind-back')).toContain('-5 s');
    expect(text('video-rewind-forward')).toContain('+5 s');
    press('video-rewind-back');
    expect(props.onSeekTo).toHaveBeenLastCalledWith(25);
    press('video-rewind-forward');
    expect(props.onSeekTo).toHaveBeenLastCalledWith(35);
  });

  it('follow the setting, and stay inside the video', () => {
    store.dispatch(setPlayVideoSettings({ rewindSecondsValue: 40 }));
    mount();
    expect(text('video-rewind-back')).toContain('-40 s');
    press('video-rewind-back');
    expect(props.onSeekTo).toHaveBeenLastCalledWith(0);
    press('video-rewind-forward');
    expect(props.onSeekTo).toHaveBeenLastCalledWith(70);
    cleanup();
    mount({ currentTime: 90 });
    press('video-rewind-forward');
    expect(props.onSeekTo).toHaveBeenLastCalledWith(100);
  });

  it('pressing a button keeps the buttons shown', () => {
    mount();
    advance(2000);
    press('video-rewind-forward');
    advance(2000);
    expect(toolbarHidden()).toBe(false);
  });
});

describe('double touch / double click at the left or right part of the video', () => {
  it('right part: + N seconds, with "+5 s" on the video', () => {
    mount();
    tap(250, 'touch');
    advance(100);
    tap(250, 'touch');
    expect(props.onSeekTo).toHaveBeenCalledTimes(1);
    expect(props.onSeekTo).toHaveBeenLastCalledWith(35);
    expect(text('video-seek-flash')).toContain('+5 s');
  });

  it('left part: - N seconds, with a mouse too', () => {
    mount();
    tap(40);
    advance(100);
    tap(40);
    expect(props.onSeekTo).toHaveBeenLastCalledWith(25);
    expect(text('video-seek-flash')).toContain('-5 s');
    expect(props.onTogglePlay).not.toHaveBeenCalled();
  });

  it('more touches in a row go on and add up: +5, +10', () => {
    mount();
    tap(250, 'touch');
    advance(100);
    tap(250, 'touch');
    advance(100);
    tap(250, 'touch');
    expect(props.onSeekTo).toHaveBeenCalledTimes(2);
    expect(text('video-seek-flash')).toContain('+10 s');
    advance(1000);
    expect(q('video-seek-flash')).toBeNull();
  });

  it('two touches too far apart are two single touches', () => {
    mount();
    tap(250, 'touch');
    advance(600);
    tap(250, 'touch');
    expect(props.onSeekTo).not.toHaveBeenCalled();
  });

  it('the middle part: a double touch plays / pauses', () => {
    mount();
    tap(150, 'touch');
    advance(100);
    tap(150, 'touch');
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
    expect(props.onSeekTo).not.toHaveBeenCalled();
  });

  it('follows the setting', () => {
    store.dispatch(setPlayVideoSettings({ rewindSecondsValue: 15 }));
    mount();
    tap(250, 'touch');
    advance(100);
    tap(250, 'touch');
    expect(props.onSeekTo).toHaveBeenLastCalledWith(45);
  });
});

describe('a click of a mouse', () => {
  it('plays / pauses after the double click window', () => {
    mount();
    tap(150);
    expect(props.onTogglePlay).not.toHaveBeenCalled();
    advance(350);
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('a double click seeks and does NOT play / pause', () => {
    mount();
    tap(250);
    advance(100);
    tap(250);
    advance(1000);
    expect(props.onTogglePlay).not.toHaveBeenCalled();
    expect(props.onSeekTo).toHaveBeenCalledTimes(1);
  });
});

describe('the big transparent Play button', () => {
  it('is over the video while it is stopped, and plays', () => {
    mount({ playing: false });
    expect(q('video-big-play')).not.toBeNull();
    press('video-big-play');
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('is there even when the other buttons are hidden', () => {
    mount({ playing: false });
    advance(3000);
    expect(toolbarHidden()).toBe(true);
    expect(q('video-big-play')).not.toBeNull();
  });

  it('is gone while the video plays; the toolbar button pauses', () => {
    mount({ playing: true });
    expect(q('video-big-play')).toBeNull();
    expect(text('video-play-pause')).toBe('pause');
    press('video-play-pause');
    expect(props.onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('after the end it offers to play again', () => {
    mount({ playing: false, ended: true });
    expect(text('video-big-play')).toBe('replay');
    expect(text('video-play-pause')).toBe('replay');
  });
});

describe('the progress bar', () => {
  it('shows the times and seeks where it is clicked', () => {
    mount({ currentTime: 65, duration: 125 });
    expect(text('video-time-current')).toBe('1:05');
    expect(text('video-time-total')).toBe('2:05');
    click('video-seek-bar', 150);
    expect(props.onSeekTo).toHaveBeenLastCalledWith(62.5);
  });
});

describe('the settings button', () => {
  it('opens the panel, the steppers change uxuiState, reset puts the defaults back', () => {
    mount();
    expect(q('video-settings-panel')).toBeNull();
    press('video-settings-button');
    expect(q('video-settings-panel')).not.toBeNull();
    expect(text('video-settings-hide-value')).toBe('2.5 s');
    expect(text('video-settings-rewind-value')).toBe('5 s');

    press('video-settings-hide-plus');
    expect(store.getState().uxuiState.PlayVideoSettings.hideButtonsAfter).toBe(3);
    expect(text('video-settings-hide-value')).toBe('3 s');
    press('video-settings-rewind-plus');
    press('video-settings-rewind-plus');
    expect(store.getState().uxuiState.PlayVideoSettings.rewindSecondsValue).toBe(7);
    expect(text('video-rewind-forward')).toContain('+7 s');
    press('video-settings-rewind-minus');
    expect(text('video-settings-rewind-value')).toBe('6 s');

    press('video-settings-reset');
    expect(store.getState().uxuiState.PlayVideoSettings).toEqual({ hideButtonsAfter: 2.5, rewindSecondsValue: 5 });
    press('video-settings-button');
    expect(q('video-settings-panel')).toBeNull();
  });

  it('the Close button (bottom right, next to Reset at the bottom left) closes the panel', () => {
    mount();
    press('video-settings-button');
    expect(q('video-settings-reset')).not.toBeNull();
    press('video-settings-close');
    expect(q('video-settings-panel')).toBeNull();
  });

  it('keeps the buttons shown while the panel is open', () => {
    mount();
    press('video-settings-button');
    advance(10000);
    expect(toolbarHidden()).toBe(false);
    press('video-settings-button'); // closed: the countdown starts
    advance(2600);
    expect(toolbarHidden()).toBe(true);
  });

  it('cannot leave the limits', () => {
    mount();
    press('video-settings-button');
    for (let i = 0; i < 30; i++) press('video-settings-rewind-minus');
    expect(store.getState().uxuiState.PlayVideoSettings.rewindSecondsValue).toBe(1);
    for (let i = 0; i < 30; i++) press('video-settings-hide-plus');
    expect(store.getState().uxuiState.PlayVideoSettings.hideButtonsAfter).toBe(10);
  });
});
