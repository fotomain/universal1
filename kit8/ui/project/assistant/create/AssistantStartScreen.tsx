// AssistantStartScreen - the FIRST screen of the Create New Project Assistant: "How do you want to create the project?"
//   1. Assistant mode   - go with the assistant (the questions, step by step)
//   2. Manual input     - open the new project card (window) for input
//   3. Import Project   - open the Import New Project Assistant
// An unfinished run of the user is offered first: "Continue where you stopped".
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { pmT } from '../../../../pm/i18n/pmT';
import { assistantStepDef, type AssistantStepId } from '../model/assistantModel';
import type { AssistantSavedRun } from '../model/assistantStorage';

export interface AssistantStartScreenProps {
  saved: AssistantSavedRun | null;
  onAssistant: () => void;
  onManual: () => void;
  onImport: () => void;
  onResume: () => void;
  canCreate: boolean;
}

function Option({ id, icon, title, subtitle, onPress, disabled }: { id: string; icon: string; title: string; subtitle: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Card mode="outlined" onPress={disabled ? undefined : onPress} style={styles.card} testID={`assistant-option-${id}`} accessibilityRole="button" accessibilityLabel={pmT(title)}>
      <Card.Title
        title={pmT(title)}
        subtitle={pmT(subtitle)}
        titleVariant="titleMedium"
        subtitleNumberOfLines={2}
        left={(p) => <MaterialCommunityIcons name={icon as any} size={p.size} color={disabled ? theme.colors.onSurfaceDisabled : theme.colors.primary} />}
        right={(p) => <MaterialCommunityIcons name="chevron-right" size={p.size} color={theme.colors.onSurfaceVariant} style={{ marginRight: 12 }} />}
      />
    </Card>
  );
}

export default function AssistantStartScreen({ saved, onAssistant, onManual, onImport, onResume, canCreate }: AssistantStartScreenProps) {
  const theme = useTheme();
  const savedAt = saved ? new Date(saved.savedAt) : null;
  return (
    <View testID="assistant-start">
      <Text variant="headlineSmall" style={styles.title}>{pmT('How do you want to create the project?')}</Text>
      {saved && (
        <Card mode="contained" style={[styles.card, { backgroundColor: theme.colors.primaryContainer }]} testID="assistant-resume-card">
          <Card.Content>
            <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer }}>{pmT('Continue where you stopped')}</Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, marginTop: 4 }} testID="assistant-resume-text">
              {pmT('{{name}} - step {{step}}', { name: saved.values.name.trim() || pmT('Unnamed project'), step: pmT(assistantStepDef(saved.stepId as AssistantStepId).title) })}
              {savedAt && !Number.isNaN(savedAt.getTime()) ? ` · ${savedAt.toLocaleString()}` : ''}
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" onPress={onResume} disabled={!canCreate} testID="assistant-resume">{pmT('Continue')}</Button>
            <Button onPress={onAssistant} disabled={!canCreate} testID="assistant-resume-restart">{pmT('Start again')}</Button>
          </Card.Actions>
        </Card>
      )}
      <Option id="assistant" icon="auto-fix" title="Assistant mode" subtitle="Go with the assistant: it asks what a project manager decides first, step by step." onPress={onAssistant} disabled={!canCreate} />
      <Option id="manual" icon="form-textbox" title="Manual input" subtitle="Open the new project card and fill every field yourself." onPress={onManual} disabled={!canCreate} />
      <Option id="import" icon="file-import-outline" title="Import Project" subtitle="Create the project from a project file (project_data_….json)." onPress={onImport} disabled={!canCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 16 },
  card: { marginBottom: 12 },
});
