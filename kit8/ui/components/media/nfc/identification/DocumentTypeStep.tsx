// Step 1: what is it - an ID card or a passport? The answer tells the camera where the machine readable zone is and how many lines to expect.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { ButtonPrimaryApp, ButtonSecondaryApp } from '../../../common';
import type { ExpectedDocument } from './mrzFromText';

export interface DocumentTypeStepProps {
  last?: ExpectedDocument;
  onChoose: (type: 'ID' | 'PASSPORT') => void;
  /** skip the photo: type the values */
  onType: () => void;
}

export default function DocumentTypeStep({ last, onChoose, onType }: DocumentTypeStepProps) {
  const theme = useTheme();
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="ident-step-type">
      <Card.Content style={styles.content}>
        <Text variant="titleMedium">What do you want to read?</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          The machine readable zone (the lines of &lt; characters) is on the back of an ID card and on the photo page of a passport.
        </Text>
        <ButtonPrimaryApp icon="badge" onPress={() => onChoose('ID')} testID="ident-choose-id">
          ID card{last === 'ID' ? ' (last time)' : ''}
        </ButtonPrimaryApp>
        <ButtonPrimaryApp icon="book" onPress={() => onChoose('PASSPORT')} testID="ident-choose-passport">
          Passport{last === 'PASSPORT' ? ' (last time)' : ''}
        </ButtonPrimaryApp>
        <ButtonSecondaryApp onPress={onType} testID="ident-type-values">
          Type the values instead of a photo
        </ButtonSecondaryApp>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  content: { gap: 10 },
});
