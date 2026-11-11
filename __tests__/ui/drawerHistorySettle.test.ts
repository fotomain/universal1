/** @jest-environment jsdom */
import { afterNextPopState, isDrawerOpenInHistory, isFirefoxWeb } from '../../kit8/ui/components/drawerHistorySettle';

describe('drawerHistorySettle (Firefox: close the drawer, navigate after the popstate)', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('sees the open drawer entry in the history of the drawer state', () => {
    expect(isDrawerOpenInHistory({ history: [{ type: 'route', key: 'home' }, { type: 'drawer', status: 'open' }] })).toBe(true);
    expect(isDrawerOpenInHistory({ history: [{ type: 'route', key: 'home' }] })).toBe(false);
    expect(isDrawerOpenInHistory(undefined)).toBe(false);
  });

  it('detects Firefox by the user agent', () => {
    const ua = jest.spyOn(window.navigator, 'userAgent', 'get');
    ua.mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0');
    expect(isFirefoxWeb()).toBe(true);
    ua.mockReturnValue('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130.0 Safari/537.36');
    expect(isFirefoxWeb()).toBe(false);
    ua.mockRestore();
  });

  it('runs the callback once, after the popstate', () => {
    jest.useFakeTimers();
    const then = jest.fn();
    afterNextPopState(then);
    expect(then).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('popstate'));
    expect(then).not.toHaveBeenCalled(); // after the other listeners of the same event
    jest.runOnlyPendingTimers();
    expect(then).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('popstate'));
    jest.runOnlyPendingTimers();
    expect(then).toHaveBeenCalledTimes(1);
  });

  it('runs the callback after the timeout when no popstate comes', () => {
    jest.useFakeTimers();
    const then = jest.fn();
    afterNextPopState(then, 500);
    jest.advanceTimersByTime(501);
    jest.runOnlyPendingTimers();
    expect(then).toHaveBeenCalledTimes(1);
  });
});
