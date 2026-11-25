/** @jest-environment jsdom */
// The screenshot button of the windows (Project settings ...) has the app's own tip, in the scope given by the window.
import React from 'react';
import { cleanupUI, q, renderUI } from './pmUiTestKit';

const mockTip = jest.fn((text: string, scope?: string) => ({ accessibilityHint: text, 'data-scope': scope } as any));
jest.mock('../../../kit8/pm/inner/tooltip/PMTooltip', () => ({ usePMTip: (t: string, s?: string) => mockTip(t, s), PMTooltipLayer: () => null }));
jest.mock('../../../kit8/lib/shareScreenshot', () => ({ shareScreenshot: jest.fn(), shareScreenshotResultText: jest.fn() }));

import ShareScreenshotButton from '../../../kit8/ui/components/common/ShareScreenshotButton';

afterEach(() => { cleanupUI(); mockTip.mockClear(); });

it('asks the tip "Share screenshot + JSON" in the scope of the window', () => {
  renderUI(<ShareScreenshotButton color="#000" testID="share-x" tipScope="modal" />);
  expect(q('share-x')).toBeTruthy();
  expect(mockTip).toHaveBeenCalledWith('Share screenshot + JSON', 'modal');
});

it('default scope is the screen', () => {
  renderUI(<ShareScreenshotButton color="#000" />);
  expect(mockTip).toHaveBeenCalledWith('Share screenshot + JSON', 'screen');
});
