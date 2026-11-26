// The system font of the browser for the canvases (task tree, estimate grid) - Settings -> Dashboards, web only.
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ButtonSecondaryApp from '../components/common/ButtonSecondaryApp';
import { captureSystemFont, clearSystemFont, getSystemFontSnapshot, isSystemFontCaptureSupported, loadStoredSystemFont, subscribeSystemFont } from '../../pm/skia/systemFontWeb';

const CAPTURE_REASONS: Record<string, string> = {
  unsupported: 'This browser (Safari, Firefox) cannot give its system font to a page, and the San Francisco licence forbids shipping it. The tree, the grid and the Gantt chart use Inter, the closest open font. Chrome and Edge can use the real one.',
  denied: 'The browser did not allow the fonts. Press the button again and choose Allow. Until then Inter is used.',
  notfound: 'No usual system font was found on this computer. Inter is used.',
  failed: 'The font could not be copied. Inter is used.',
};
/** Web only. The task tree and the estimate grid are drawn on a canvas that cannot use the system font by itself: the browser copies it once (a click + its permission) and the copy is kept in this browser. */
export function SystemFontForCanvases({ web = Platform.OS === 'web' }: { web?: boolean }) {
  const { themeColors: c } = useDesignSystem();
  const font = useSyncExternalStore(subscribeSystemFont, getSystemFontSnapshot, () => null);
  const [message, setMessage] = useState('');
  useEffect(() => { void loadStoredSystemFont(); }, []);
  if (!web) return null;
  const supported = isSystemFontCaptureSupported();
  const status = font ? `The tree and the estimate grid use ${font.family} (copied from this computer, kept in this browser).` : supported ? 'Not copied yet: the tree, the grid and the Gantt chart use Inter. Press the button and choose Allow to use the font of this computer.' : CAPTURE_REASONS.unsupported;
  return (
    <View style={{ marginBottom: 10 }} testID="settings-system-font-canvas">
      <Text style={{ color: c.text, fontWeight: '600', marginBottom: 4 }}>System font in the tree and the grid</Text>
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 13, marginBottom: 6 }} testID="settings-system-font-status">{message || status}</Text>
      {supported && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <ButtonSecondaryApp testID="settings-system-font-copy" onPress={async () => {
            const r = await captureSystemFont();
            setMessage(r.ok ? '' : CAPTURE_REASONS[r.reason]);
          }}>{font ? 'Copy again' : 'Use the system font of this computer'}</ButtonSecondaryApp>
          {!!font && <ButtonSecondaryApp testID="settings-system-font-clear" onPress={async () => { await clearSystemFont(); setMessage(''); }}>Forget it</ButtonSecondaryApp>}
        </View>
      )}
    </View>
  );
}

