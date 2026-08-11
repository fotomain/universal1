import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Surface, Text, useTheme, Card, IconButton } from 'react-native-paper';
import { ButtonPrimaryApp } from '../../../components/common';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function RecordAudioNativeComponent() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3}>
        <Card.Title
          title={t('screens.recordAudioNative')}
          titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
        />
        <Card.Content style={{ alignItems: 'center' }}>
          <Surface style={[styles.box, { backgroundColor: theme.colors.tertiaryContainer }]} elevation={2}>
            <IconButton icon="microphone-settings" size={48} iconColor={theme.colors.onTertiaryContainer} />
            <Text variant="titleMedium" style={{ color: theme.colors.onTertiaryContainer, marginTop: 8 }}>
              {isRecording ? 'Native Audio Recording...' : 'Native Audio Recorder (iOS / Android)'}
            </Text>
          </Surface>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            {!isRecording ? (
              <ButtonPrimaryApp icon="microphone" color={theme.colors.error} onPress={() => setIsRecording(true)}>
                Start Native Audio
              </ButtonPrimaryApp>
            ) : (
              <ButtonPrimaryApp icon="stop" color={theme.colors.primary} onPress={() => setIsRecording(false)}>
                Stop & Save Native Audio
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
  box: { width: '100%', height: 200, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
