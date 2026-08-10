import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Surface, Text, Button, useTheme, Card } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function PlayVideoNativeComponent() {
  const { videoUrl } = useLocalSearchParams<{ videoUrl?: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3}>
        <Card.Title
          title={t('screens.playVideoNative')}
          titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
        />
        <Card.Content>
          <Surface style={[styles.player, { backgroundColor: '#000' }]} elevation={2}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>
              Native Video Player: {videoUrl || 'file:///storage/emulated/0/Download/kit8video_sample.mp4'}
            </Text>
          </Surface>

          <Button mode="contained-tonal" icon="arrow-left" style={{ marginTop: 16 }} onPress={() => router.back()}>
            {t('screens.back')}
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  player: { width: '100%', height: 300, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
