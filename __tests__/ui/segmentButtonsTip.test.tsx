/** @jest-environment jsdom */
// SegmentButtonsApp: a drawn segment with `tip` hands the hover tip to the shared PM tooltip (hover on the web, long press on a phone).
import { cleanupUI, q, renderUI } from '../pm/ui/pmUiTestKit';
import { SegmentButtonsApp } from '../../kit8/ui/components/common/SegmentButtonsApp';

const mockTip = jest.fn((text: string | undefined, _scope?: string) => ({ accessibilityHint: text }));
jest.mock('../../kit8/pm/inner/tooltip/PMTooltip', () => ({ usePMTip: (t: string | undefined, s?: string) => mockTip(t, s) }));

afterEach(() => cleanupUI());

test('each drawn segment asks for its own tip in the app layer', () => {
  const React = require('react');
  renderUI(React.createElement(SegmentButtonsApp, { testID: 'seg', value: 'a', onValueChange: () => {}, buttons: [{ value: 'a', label: 'A', tip: 'A: first' }, { value: 'b', label: 'B', tip: 'B: second' }, { value: 'c', label: 'C' }] }));
  expect(q('seg-a')).toBeTruthy();
  expect(mockTip).toHaveBeenCalledWith('A: first', 'app');
  expect(mockTip).toHaveBeenCalledWith('B: second', 'app');
  expect(mockTip).toHaveBeenCalledWith(undefined, 'app');
});

describe('onInfo: right click, double click, double touch, long press on a button', () => {
  const mount = (onInfo: any) => {
    const React = require('react');
    renderUI(React.createElement(SegmentButtonsApp, { testID: 'seg', value: 'a', onValueChange: () => {}, onInfo, buttons: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }] }));
  };
  const fire = (id: string, type: string) => { const el = q(id)!; const e = new MouseEvent(type, { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };

  test('a right click on a button asks for its info (and the browser menu is not shown); a click on the track does not', () => {
    const onInfo = jest.fn();
    mount(onInfo);
    const e = fire('seg-b', 'contextmenu');
    expect(onInfo).toHaveBeenCalledWith('b');
    expect(e.defaultPrevented).toBe(true);
    onInfo.mockClear();
    fire('seg', 'contextmenu');
    expect(onInfo).not.toHaveBeenCalled();
  });

  test('a double click on a button asks for its info; a single click does not', () => {
    const onInfo = jest.fn();
    mount(onInfo);
    fire('seg-c', 'click');
    expect(onInfo).not.toHaveBeenCalled();
    fire('seg-c', 'dblclick');
    expect(onInfo).toHaveBeenCalledWith('c');
  });

  test('without onInfo nothing listens: a right click is left to the browser', () => {
    const React = require('react');
    renderUI(React.createElement(SegmentButtonsApp, { testID: 'seg', value: 'a', onValueChange: () => {}, buttons: [{ value: 'a', label: 'A' }] }));
    expect(fire('seg-a', 'contextmenu').defaultPrevented).toBe(false);
  });
});
