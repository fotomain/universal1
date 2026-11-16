/** @jest-environment jsdom */
// An icon inside a pressable parent (the error banner of the dashboard) must be able to carry its own onPress:
// a PMTipIcon without one is a Pressable that swallows the click, so the "x" of the banner did nothing.
import './pmUiTestKit';
import React from 'react';
import { cleanupUI, press, renderUI } from './pmUiTestKit';

afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('PMTipIcon onPress', () => {
  it('calls its own onPress when it is clicked', () => {
    const { PMTipIcon } = require('../../../kit8/pm/inner/buttons/PMTipPressables');
    const onPress = jest.fn();
    renderUI(<PMTipIcon tip="Dismiss" testID="pm-error-close" name="close" onPress={onPress} />);
    press('pm-error-close');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
