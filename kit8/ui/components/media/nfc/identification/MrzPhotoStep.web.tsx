// Web: no camera step yet (no text recognition in the browser, and no NFC either): type the values.
import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { ButtonPrimaryApp, ButtonSecondaryApp } from '../../../common';
import { EMPTY_VALUES, MrzPhotoStepProps, Recognition } from './identificationTypes';

export type { Recognition, MrzPhotoStepProps };
export const OCR_MAX_SIDE = 2000;

export default function MrzPhotoStep({ onBack, onRecognized }: MrzPhotoStepProps) {
  const theme = useTheme();
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="ident-step-photo">
      <Card.Content style={{ gap: 10 }}>
        <Text variant="titleMedium">Photo of the document</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }} testID="ident-web-note">
          A browser cannot take this photo yet, and cannot read the chip over NFC. Use the phone app, or type the values.
        </Text>
        <ButtonPrimaryApp onPress={() => onRecognized({ source: 'typed', lines: [], result: null, values: { ...EMPTY_VALUES }, confidence: 'unchecked', notes: [] })} testID="ident-web-type">Type the values</ButtonPrimaryApp>
        <ButtonSecondaryApp onPress={onBack} testID="ident-photo-back">Back</ButtonSecondaryApp>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({ card: { width: '100%', maxWidth: 640, borderRadius: 16 } });
