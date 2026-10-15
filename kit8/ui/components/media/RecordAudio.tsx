// Audio recorder (web + iOS + Android): expo-audio (AVAudioRecorder / MediaRecorder of Android / MediaRecorder of the browser).
// Record · Pause · Resume · Stop & save. A finished recording is kept and becomes a media post (useSaveRecording).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, ProgressBar, Surface, Text, useTheme } from 'react-native-paper';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { ButtonPrimaryApp, showErrorModal } from '../common';
import { setMediaAudioMode } from './audioMode';
import RecordingResult from './RecordingResult';
import { useSaveRecording } from './useSaveRecording';
import type { RecordingPost } from './mediaPost';
import { formatDuration } from './mediaSource';

export interface RecordAudioProps {
  /** the recording stops by itself after this time (default 1 hour) */
  maxDurationSec?: number;
  onSaved?: (post: RecordingPost) => void;
}

type Phase = 'idle' | 'recording' | 'paused' | 'saving' | 'saved';

/** metering is in dB (-160 .. 0): the level bar from -60 dB (quiet) to 0 dB (loud) */
export function meterLevel(db?: number | null): number {
  if (typeof db !== 'number' || !Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(1, (db + 60) / 60));
}

export default function RecordAudio({ maxDurationSec = 3600, onSaved }: RecordAudioProps) {
  const theme = useTheme();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 250);
  const save = useSaveRecording('audio');
  const [phase, setPhase] = useState<Phase>('idle');
  const [post, setPost] = useState<RecordingPost | null>(null);
  const lastSeconds = useRef(0);

  const seconds = state.durationMillis / 1000;
  if (phase === 'recording' || phase === 'paused') lastSeconds.current = seconds;

  const start = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showErrorModal('The microphone is not allowed. Allow it in the settings of the device or the browser.', 'Record audio');
        return;
      }
      await setMediaAudioMode(true);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (e) {
      showErrorModal(e, 'Record audio');
    }
  };

  const pauseOrResume = () => {
    if (phase === 'recording') {
      recorder.pause();
      setPhase('paused');
    } else if (phase === 'paused') {
      recorder.record();
      setPhase('recording');
    }
  };

  const stopAndSave = async () => {
    const duration = lastSeconds.current;
    setPhase('saving');
    try {
      await recorder.stop();
      await setMediaAudioMode(false);
      const uri = recorder.uri || recorder.getStatus().url;
      if (!uri) throw new Error('The recorder returned no file.');
      const saved = await save([{ uri, durationSec: duration, hasAudio: true }]);
      setPost(saved);
      setPhase('saved');
      onSaved?.(saved);
    } catch (e) {
      showErrorModal(e, 'Save audio');
      setPhase('idle');
    }
  };

  // the time limit
  useEffect(() => {
    if (phase === 'recording' && seconds >= maxDurationSec) void stopAndSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, phase, maxDurationSec]);

  if (phase === 'saved' && post) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <RecordingResult kind="audio" post={post} onRecordAgain={() => { setPost(null); setPhase('idle'); }} />
      </ScrollView>
    );
  }

  const active = phase === 'recording' || phase === 'paused';
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="record-audio">
        <Card.Title title="Record audio" titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }} />
        <Card.Content style={{ alignItems: 'center' }}>
          <Surface style={[styles.box, { backgroundColor: theme.colors.primaryContainer }]} elevation={2}>
            <IconButton icon="microphone" size={48} iconColor={phase === 'recording' ? theme.colors.error : theme.colors.onPrimaryContainer} />
            <Text variant="headlineMedium" style={{ color: theme.colors.onPrimaryContainer }} testID="record-audio-time">
              {formatDuration(seconds)}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, marginTop: 4 }} testID="record-audio-state">
              {phase === 'recording' ? 'Recording…' : phase === 'paused' ? 'Paused' : phase === 'saving' ? 'Saving…' : 'Press Record'}
            </Text>
            {active && <ProgressBar progress={meterLevel(state.metering)} color={theme.colors.error} style={styles.meter} />}
          </Surface>

          <View style={styles.buttons}>
            {!active ? (
              <ButtonPrimaryApp icon="mic" color={theme.colors.error} onPress={start} disabled={phase === 'saving'} loading={phase === 'saving'} testID="record-audio-start">
                Record
              </ButtonPrimaryApp>
            ) : (
              <>
                <ButtonPrimaryApp icon={phase === 'paused' ? 'play_arrow' : 'pause'} onPress={pauseOrResume} testID="record-audio-pause">
                  {phase === 'paused' ? 'Resume' : 'Pause'}
                </ButtonPrimaryApp>
                <ButtonPrimaryApp icon="stop" color={theme.colors.primary} onPress={stopAndSave} testID="record-audio-stop">
                  Stop & save
                </ButtonPrimaryApp>
              </>
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
  box: { width: '100%', minHeight: 220, borderRadius: 16, justifyContent: 'center', alignItems: 'center', padding: 16 },
  meter: { width: '70%', height: 8, borderRadius: 4, marginTop: 16 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 24 },
});
