// AssistantNavigationBar - the top of every assistant screen: a back arrow, the title, "Save and exit", the NAVIGATION LINE (one chip per step: done / current / still to do;
// a step already seen can be pressed to go back to it) and a progress bar. React Native Paper (MD3 theme of the app).
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, IconButton, ProgressBar, Surface, Text, useTheme } from 'react-native-paper';
import { pmT } from '../../../../pm/i18n/pmT';

export interface AssistantNavStep {
  id: string;
  /** English; translated here */
  label: string;
  state: 'done' | 'current' | 'todo';
  /** may be pressed (a step already seen) */
  enabled: boolean;
}

export interface AssistantNavigationBarProps {
  title: string;
  subtitle?: string;
  steps: AssistantNavStep[];
  onBack: () => void;
  onJump: (id: string) => void;
  /** "Save and exit": the answers are kept for the next run */
  onExit?: () => void;
  testID?: string;
}

export default function AssistantNavigationBar({ title, subtitle, steps, onBack, onJump, onExit, testID = 'assistant-nav' }: AssistantNavigationBarProps) {
  const theme = useTheme();
  const done = steps.filter((s) => s.state === 'done').length;
  const progress = steps.length > 0 ? Math.min(1, (done + (steps.some((s) => s.state === 'current') ? 0.5 : 0)) / steps.length) : 0;
  return (
    <Surface elevation={1} style={[styles.bar, { backgroundColor: theme.colors.surface }]} testID={testID}>
      <View style={styles.top}>
        <IconButton icon="arrow-left" onPress={onBack} testID="assistant-back" accessibilityLabel={pmT('Back')} />
        <View style={styles.titleBox}>
          <Text variant="titleMedium" numberOfLines={1} testID="assistant-title">
            {pmT(title)}
          </Text>
          {!!subtitle && (
            <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
              {subtitle}
            </Text>
          )}
        </View>
        {!!onExit && <IconButton icon="content-save-outline" onPress={onExit} testID="assistant-exit" accessibilityLabel={pmT('Save and exit')} />}
      </View>
      {steps.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} testID="assistant-steps">
          {steps.map((s, i) => (
            <Chip
              key={s.id}
              testID={`assistant-step-${s.id}`}
              compact
              selected={s.state === 'current'}
              icon={s.state === 'done' ? 'check' : undefined}
              disabled={!s.enabled}
              onPress={() => onJump(s.id)}
              style={styles.chip}
              accessibilityState={{ selected: s.state === 'current', disabled: !s.enabled }}
            >
              {`${i + 1}. ${pmT(s.label)}`}
            </Chip>
          ))}
        </ScrollView>
      )}
      {steps.length > 0 && <ProgressBar progress={progress} testID="assistant-progress" />}
    </Surface>
  );
}

const styles = StyleSheet.create({
  bar: { paddingTop: 4 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  titleBox: { flex: 1, paddingHorizontal: 4 },
  chips: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  chip: { marginRight: 6 },
});
