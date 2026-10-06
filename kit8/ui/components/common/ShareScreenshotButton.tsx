// Small icon button for windows that cover the app bar (Project settings, Edit task, Edit dependency ...):
// "Share screenshot + JSON" of what the window shows - the JSON is uxui.currentJSON, published by the
// window with useUxuiCurrentJSON. Without a current JSON only the screenshot is shared.

import React, { useState } from 'react';
import { Pressable } from 'react-native';
import IconApp from './IconApp';
import { shareScreenshot, shareScreenshotResultText } from '../../../lib/shareScreenshot';
import { appDispatch, getUxuiState } from '../../../redux/storeRef';
import { showSnackbar } from '../../../redux/uxuiSlice';

export default function ShareScreenshotButton({ color, size = 20, testID = 'share-screenshot-json' }: { color: string; size?: number; testID?: string }) {
  const [busy, setBusy] = useState(false);
  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const withJSON = !!getUxuiState()?.currentJSON;
      const r = await shareScreenshot({ withJSON });
      if (r !== 'shared') appDispatch(showSnackbar(shareScreenshotResultText(r, withJSON)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Share screenshot + JSON"
      onPress={onPress}
      hitSlop={6}
      style={{ padding: 6, opacity: busy ? 0.4 : 1 }}
      {...({ title: 'Share screenshot + JSON' } as any)}
    >
      <IconApp testID={`${testID}-icon`} name="screenshot_monitor" size={size} color={color} />
    </Pressable>
  );
}
