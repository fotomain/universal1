import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Surface, Text, useTheme, Card } from 'react-native-paper';
import { ButtonPrimaryApp } from '../../../components/common';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function PlayVideoWebComponent() {
  const { videoUrl, videoGUID } = useLocalSearchParams<{ videoUrl?: string; videoGUID?: string }>();
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const url = videoUrl || 'https://www.w3schools.com/html/mov_bbb.mp4';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3}>
        <Card.Title
          title={t('screens.playVideoWeb')}
          subtitle={`GUID: ${videoGUID || 'Demo Video'}`}
          titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
        />
        <Card.Content>
          <View style={[styles.playerContainer, { backgroundColor: '#000' }]}>
            {Platform.OS === 'web' ? (
              <video
                controls
                autoPlay
                src={url}
                style={{ width: '100%', height: '100%', borderRadius: 8 }}
              />
            ) : (
              <Text style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>
                Web Video Player Preview ({url})
              </Text>
            )}
          </View>

          <View style={styles.infoBox}>
            <Text variant="bodyMedium" numberOfLines={2}>
              Origin URL: <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>{url}</Text>
            </Text>
          </View>

          <ButtonPrimaryApp
            icon="arrow-left"
            style={{ marginTop: 16 }}
            onPress={() => router.back()}
          >
            {t('screens.back')}
          </ButtonPrimaryApp>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 16,
  },
  playerContainer: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
});
