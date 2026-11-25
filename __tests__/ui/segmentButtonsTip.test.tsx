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
