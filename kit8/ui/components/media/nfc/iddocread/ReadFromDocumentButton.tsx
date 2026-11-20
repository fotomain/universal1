// THE first control of the ID reader: one press, no input. It reads what the document gives freely (what it is, how it wants to be opened);
// with the password of the document typed below (CAN or MRZ values) the same button reads the whole document.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { ButtonPrimaryApp } from '../../../common';

export interface ReadFromDocumentButtonProps {
  onPress: () => void;
  busy: boolean;
  disabled?: boolean;
  /** the password fields below have a value: the button reads the whole document */
  withPassword: boolean;
}

export default function ReadFromDocumentButton({ onPress, busy, disabled, withPassword }: ReadFromDocumentButtonProps) {
  const theme = useTheme();
  return (
    <View style={styles.box} testID="id-read-box">
      <ButtonPrimaryApp icon="nfc" onPress={onPress} disabled={disabled || busy} loading={busy} testID="id-read-from-document">
        Read from document
      </ButtonPrimaryApp>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID="id-read-hint">
        {busy
          ? 'Hold the document against the back of the phone and keep it still.'
          : withPassword
            ? 'Reads the whole document with the password below.'
            : 'No input needed: hold the document against the back of the phone. Without a password you see what the document is and what it needs.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: 6 } });
