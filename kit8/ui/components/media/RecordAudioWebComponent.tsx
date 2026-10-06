import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Surface, Text, useTheme, Card, IconButton } from 'react-native-paper';
import { ButtonPrimaryApp } from '../common';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function RecordAudioWebComponent() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [sec, setSec] = useState(0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3}>
        <Card.Title
          title={t('screens.recordAudioWeb')}
          titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
        />
        <Card.Content style={{ alignItems: 'center' }}>
          <Surface style={[styles.audioWaveBox, { backgroundColor: theme.colors.primaryContainer }]} elevation={2}>
            <IconButton icon="microphone" size={48} iconColor={theme.colors.onPrimaryContainer} />
            <Text variant="titleMedium" style={{ color: theme.colors.onPrimaryContainer, marginTop: 8 }}>
              {isRecording ? `Recording... ${sec}s` : 'Press Microphone to Record Audio'}
            </Text>
          </Surface>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            {!isRecording ? (
              <ButtonPrimaryApp icon="microphone" color={theme.colors.error} onPress={() => setIsRecording(true)}>
                Start Audio Record
              </ButtonPrimaryApp>
            ) : (
              <ButtonPrimaryApp icon="stop" color={theme.colors.primary} onPress={() => setIsRecording(false)}>
                Stop & Save Audio
              </ButtonPrimaryApp>
            )}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 500, borderRadius: 16 },
  audioWaveBox: { width: '100%', height: 200, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
