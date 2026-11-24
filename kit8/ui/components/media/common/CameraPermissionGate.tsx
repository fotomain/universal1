// A screen that cannot work without the camera (Identification: the photo of the document comes first) asks for the camera access AT THE START and shows its
// content only when the access is given. Denied = a card with "Allow the camera" / "Open the settings" and NOTHING of the screen behind it.
// The question waits until the hamburger menu has settled (useDrawerSettled): the Android dialog must not freeze the closing menu. Mounted by app/media/nfc/identification
// (inside RecordingSignInGate: a guest is asked to sign in first). Coming back from the system settings with the access given opens the screen by itself.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useCameraPermission } from 'react-native-vision-camera';
import { ButtonPrimaryApp, ButtonSecondaryApp } from '../../common';
import { useDrawerSettled } from './useDrawerSettled';
import type { CameraPermissionGateProps } from './cameraPermissionGateTypes';

export type { CameraPermissionGateProps };

export default function CameraPermissionGate({ reason, children }: CameraPermissionGateProps) {
  const theme = useTheme();
  const permission = useCameraPermission();
  const menuSettled = useDrawerSettled();
  const [asked, setAsked] = useState(false);
  const asking = useRef(false);

  const ask = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    try {
      await permission.requestPermission();
    } finally {
      asking.current = false;
      setAsked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission.requestPermission]);

  // at the start: ask once, when the menu is out of the way
  useEffect(() => {
    if (menuSettled && !permission.hasPermission && !asked) void ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuSettled]);

  // back from the system settings: ask again (a refusal for good answers at once, a given access opens the screen)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && !permission.hasPermission && asked) void ask();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission.hasPermission, asked, ask]);

  if (permission.hasPermission) return <>{children}</>;
  return (
    <ScrollView contentContainerStyle={styles.content} testID="camera-gate">
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Card.Content style={styles.body}>
          {asked ? (
            <>
              <Text variant="titleLarge" testID="camera-gate-title">The camera is not allowed</Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }} testID="camera-gate-text">
                {`This screen needs the camera ${reason}. Allow the camera and the screen opens by itself; if the system no longer asks, open the settings of the application and allow the camera there.`}
              </Text>
              <View style={styles.buttons}>
                <ButtonPrimaryApp onPress={() => void ask()} testID="camera-gate-allow">Allow the camera</ButtonPrimaryApp>
                <ButtonSecondaryApp onPress={() => void Linking.openSettings()} testID="camera-gate-settings">Open the settings</ButtonSecondaryApp>
              </View>
            </>
          ) : (
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }} testID="camera-gate-asking">Asking for the camera…</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, flexGrow: 1, justifyContent: 'center' },
  card: { borderRadius: 16 },
  body: { gap: 12 },
  buttons: { gap: 8 },
});
