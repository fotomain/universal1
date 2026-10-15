import { doubleTapZone, isRepeatedTap, progressOf, seekTarget, TAP_WINDOW_MS, timeAtPosition } from '../../kit8/ui/components/media/videoControlsLogic';

describe('doubleTapZone: left 40 %, middle 20 %, right 40 %', () => {
  it.each([
    [0, 'left'], [119, 'left'], [120, 'center'], [150, 'center'], [180, 'center'], [181, 'right'], [300, 'right'],
  ])('x=%s of 300 -> %s', (x, zone) => expect(doubleTapZone(x as number, 300)).toBe(zone));
  it('a video that is not measured yet is the middle', () => {
    expect(doubleTapZone(10, 0)).toBe('center');
    expect(doubleTapZone(NaN, 300)).toBe('center');
  });
});

describe('isRepeatedTap', () => {
  it('the second touch within the window', () => {
    expect(isRepeatedTap(null, 1000)).toBe(false);
    expect(isRepeatedTap(1000, 1000 + TAP_WINDOW_MS)).toBe(true);
    expect(isRepeatedTap(1000, 1000 + TAP_WINDOW_MS + 1)).toBe(false);
    expect(isRepeatedTap(2000, 1000)).toBe(false); // the clock went back
  });
});

describe('seekTarget keeps the time inside the video', () => {
  it('forward and back', () => {
    expect(seekTarget(10, 5, 100)).toBe(15);
    expect(seekTarget(10, -5, 100)).toBe(5);
  });
  it('not before 0, not after the end', () => {
    expect(seekTarget(3, -5, 100)).toBe(0);
    expect(seekTarget(98, 5, 100)).toBe(100);
  });
  it('an unknown duration has no end; a broken time is 0', () => {
    expect(seekTarget(10, 5, 0)).toBe(15);
    expect(seekTarget(10, 5, NaN)).toBe(15);
    expect(seekTarget(NaN, 5, 100)).toBe(5);
  });
});

describe('progress bar', () => {
  it('progressOf', () => {
    expect(progressOf(25, 100)).toBe(0.25);
    expect(progressOf(150, 100)).toBe(1);
    expect(progressOf(5, 0)).toBe(0);
    expect(progressOf(NaN, 100)).toBe(0);
  });
  it('timeAtPosition', () => {
    expect(timeAtPosition(150, 300, 200)).toBe(100);
    expect(timeAtPosition(-20, 300, 200)).toBe(0);
    expect(timeAtPosition(999, 300, 200)).toBe(200);
    expect(timeAtPosition(10, 0, 200)).toBe(0);
  });
});
