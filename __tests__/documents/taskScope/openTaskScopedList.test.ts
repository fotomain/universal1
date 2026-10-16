/** @jest-environment jsdom */
// "Go to" lists: a NEW browser window on the web, the router on iOS / Android (and when the browser blocks the window).
import { Platform } from 'react-native';
import { openTaskScopedList } from '../../../kit8/documents/taskScope/openTaskScopedList';

const scope = { taskGUID: 't 1', taskLineGUID: 'l1' };
const realOS = Platform.OS;
afterEach(() => { (Platform as any).OS = realOS; jest.restoreAllMocks(); });

describe('openTaskScopedList', () => {
  it('web: window.open(_blank) with the scope in the query, the router is not used', () => {
    (Platform as any).OS = 'web';
    const open = jest.spyOn(window, 'open').mockReturnValue({} as any);
    const router = { push: jest.fn() };
    openTaskScopedList('/pm/fact/list', scope, router);
    expect(open).toHaveBeenCalledWith('/pm/fact/list?taskGUID=t%201&taskLineGUID=l1', '_blank');
    expect(router.push).not.toHaveBeenCalled();
  });
  it('web, window blocked: the same window', () => {
    (Platform as any).OS = 'web';
    jest.spyOn(window, 'open').mockReturnValue(null);
    const router = { push: jest.fn() };
    openTaskScopedList('/pm/fact/list', scope, router);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pm/fact/list', params: { taskGUID: 't 1', taskLineGUID: 'l1' } });
  });
  it('native: the router', () => {
    (Platform as any).OS = 'ios';
    const open = jest.spyOn(window, 'open');
    const router = { push: jest.fn() };
    openTaskScopedList('/pm/vendor-invoice/list', { taskGUID: 'a', taskLineGUID: '' }, router);
    expect(open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith({ pathname: '/pm/vendor-invoice/list', params: { taskGUID: 'a' } });
  });
});
