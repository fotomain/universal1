import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { Surface, Text, Button, useTheme, Card, IconButton, Switch } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { ActiveUserState } from '../../redux/activeUserSlice';

export default function RecordVideoNativeComponent() {
  const router = useRouter();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation();
  const searchParams = useLocalSearchParams<{ withAudio?: string; saveToDownloads?: string }>();
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);

  const isAudioEnabled = searchParams.withAudio !== 'false';
  const saveToDownloads = searchParams.saveToDownloads !== 'false';

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentGUID, setCurrentGUID] = useState('');

  const handleStartRecordNative = () => {
    const videoGUID = 'v-native-' + Date.now();
    setCurrentGUID(videoGUID);
    setIsRecording(true);
    setElapsedSeconds(0);

    // Dispatch optimistic creation
    dispatch({
      type: 'reusable/createOneRequest',
      payload: {
        entityName: 'mediaPostReusable',
        item: {
          mediaPostOwnerGUID: activeUserState?.activeUserGUID || 'anon',
          orderInList: Date.now(),
          mediaPostJSON: {
            videoGUID,
            isNative: true,
            storageLocation: saveToDownloads ? 'Downloads & Secure App Storage' : 'Secure App Storage',
            withAudio: isAudioEnabled,
            percentageVideoUploadedToGoogleDrive: 0,
          },
        },
      },
    });
  };

  const handleStopRecordNative = () => {
    setIsRecording(false);
    // Simulate upload and storage
    dispatch({
      type: 'reusable/updateOneRequest',
      payload: {
        entityName: 'mediaPostReusable',
        mediaPostGUID: currentGUID,
        item: {
          mediaPostOrigin: `file:///storage/emulated/0/Download/kit8video_${currentGUID}.mp4`,
          mediaPostJSON: {
            videoGUID: currentGUID,
            percentageVideoUploadedToGoogleDrive: 100,
            nativeFileSaved: true,
          },
        },
      },
    });

    router.push('/posts/mediapostcrud' as any);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3}>
        <Card.Title
          title={t('screens.recordVideoNative')}
          subtitle="Vision Camera Native Module"
          titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
        />
        <Card.Content>
          <Surface style={[styles.cameraPreview, { backgroundColor: '#121212' }]} elevation={2}>
            <Text style={{ color: '#fff', textAlign: 'center', marginTop: 120 }}>
              {isRecording ? `[REC ${elapsedSeconds}s] react-native-vision-camera Recording...` : 'Camera Viewport'}
            </Text>
          </Surface>

          <View style={styles.controls}>
            <Text variant="bodySmall" style={{ marginBottom: 8, color: theme.colors.onSurfaceVariant }}>
              Storage Mode: {saveToDownloads ? 'App Secure Catalog & Downloads' : 'App Secure Catalog Only'}
            </Text>

            {!isRecording ? (
              <Button mode="contained" icon="camera" buttonColor={theme.colors.error} onPress={handleStartRecordNative}>
                Start Native Recording
              </Button>
            ) : (
              <Button mode="contained" icon="stop" buttonColor={theme.colors.primary} onPress={handleStopRecordNative}>
                Stop & Save Native Post
              </Button>
            )}
          </View>
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
  cameraPreview: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    justifyContent: 'center',
    marginBottom: 16,
  },
  controls: {
    alignItems: 'center',
    gap: 8,
  },
});
