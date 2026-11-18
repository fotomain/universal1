// ExpertTipCard - what the "expert" says on a step: the tip (why a project manager asks this now) and the notes of the answers so far
// (error = blocks Next, warning = advice, info). React Native Paper.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, HelperText, Text, useTheme } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';
import type { AssistantNote } from '../model/assistantModel';

export default function ExpertTipCard({ tip, notes, testID = 'assistant-expert' }: { tip: string; notes: AssistantNote[]; testID?: string }) {
  const theme = useTheme();
  return (
    <Card mode="contained" style={[styles.card, { backgroundColor: theme.colors.secondaryContainer }]} testID={testID}>
      <Card.Content>
        <Text variant="labelLarge" style={{ color: theme.colors.onSecondaryContainer }}>
          {pmT('Expert advice')}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSecondaryContainer, marginTop: 4 }} testID={`${testID}-tip`}>
          {pmT(tip)}
        </Text>
        {notes.length > 0 && (
          <View style={styles.notes}>
            {notes.map((n, i) => (
              <HelperText key={`${n.level}-${i}`} type={n.level === 'error' ? 'error' : 'info'} visible padding="none" testID={`${testID}-note-${n.level}`} style={n.level === 'warning' ? { color: theme.colors.tertiary } : undefined}>
                {`${n.level === 'error' ? '⛔ ' : n.level === 'warning' ? '⚠ ' : 'ℹ '}${pmT(n.text)}`}
              </HelperText>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  notes: { marginTop: 8 },
});
