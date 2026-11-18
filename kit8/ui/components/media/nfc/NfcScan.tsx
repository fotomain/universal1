// The NFC screen (route /media/nfc): the reader runs while the screen is shown, every tag lands in NFCReceivedInfo.
import React, { useCallback, useState, useSyncExternalStore } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { ButtonPrimaryApp, ButtonSecondaryApp } from '../../common';
import NFCReceivedInfo from './NFCReceivedInfo';
import { clearNfcInbox, getNfcInbox, removeNfcRead, subscribeNfcInbox } from './nfcInbox';
import { useNfcReader } from './useNfcReader';

/** what the status line says */
export function nfcStatusText(state: string, needsPress: boolean, error: string): string {
  switch (state) {
    case 'checking': return 'Checking NFC…';
    case 'unsupported': return Platform.OS === 'web' ? 'This browser cannot read NFC tags. Use Chrome on an Android phone, or the phone app.' : 'This device has no NFC.';
    case 'disabled': return 'NFC is switched off. Switch it on in the settings of the phone.';
    case 'scanning': return 'Ready. Hold a tag near the back of the phone. Tags are read one after the other.';
    case 'stopped': return needsPress ? 'Press Scan, then hold the top of the phone near a tag.' : 'Stopped.';
    case 'error': return error || 'NFC could not be started.';
    default: return '';
  }
}

export default function NfcScan() {
  const theme = useTheme();
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const reader = useNfcReader(focused);
  const reads = useSyncExternalStore(subscribeNfcInbox, getNfcInbox, getNfcInbox);
  const running = reader.state === 'scanning';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="nfc-scan">
        <Card.Content>
          <Text variant="bodyLarge" testID="nfc-status">{nfcStatusText(reader.state, reader.needsPress, reader.error)}</Text>
          <View style={styles.buttons}>
            {(reader.state === 'stopped' || reader.state === 'error') && (
              <ButtonPrimaryApp icon="nfc" onPress={reader.start} testID="nfc-start">
                Scan
              </ButtonPrimaryApp>
            )}
            {running && (
              <ButtonSecondaryApp icon="stop" onPress={reader.stop} testID="nfc-stop">
                Stop
              </ButtonSecondaryApp>
            )}
            {reader.state === 'disabled' && Platform.OS === 'android' && (
              <ButtonPrimaryApp icon="settings" onPress={reader.openSettings} testID="nfc-settings">
                NFC settings
              </ButtonPrimaryApp>
            )}
          </View>
        </Card.Content>
      </Card>
      <NFCReceivedInfo reads={reads} onRemove={removeNfcRead} onClear={clearNfcInbox} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
