// Web twin of RecordVideo.tsx: getUserMedia (camera + microphone) recorded by the browser MediaRecorder into one webm / mp4.
//
// The "Record sound" switch works while the video is being recorded and keeps ONE file: the microphone track stays in the
// recording, the switch enables / disables it (a disabled track records silence).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { ButtonPrimaryApp, SwitchApp, showErrorModal } from '../common';
import RecordingResult from './RecordingResult';
import { useSaveRecording } from './useSaveRecording';
import type { RecordingPost } from './mediaPost';
import { formatDuration } from './mediaSource';
import type { RecordVideoProps } from './recordVideoTypes';

export type { RecordVideoProps };

/** the first container / codec this browser can record (Chrome, Firefox: webm; Safari: mp4) */
export const RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
];

export function pickRecorderMimeType(isSupported: (mime: string) => boolean): string {
  return RECORDER_MIME_CANDIDATES.find((m) => isSupported(m)) || '';
}

type Phase = 'idle' | 'recording' | 'paused' | 'saving' | 'saved';

export default function RecordVideo({ maxDurationSec = 3600, withAudio = true, onSaved }: RecordVideoProps) {
  const theme = useTheme();
  const save = useSaveRecording('video');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const clock = useRef({ base: 0, since: 0 as number | null });
  const soundEver = useRef(false);

  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [hasMicrophone, setHasMicrophone] = useState(false);
  const [audioOn, setAudioOn] = useState(withAudio);
  const [cameraError, setCameraError] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [post, setPost] = useState<RecordingPost | null>(null);

  const elapsedMs = () => clock.current.base + (clock.current.since ? Date.now() - clock.current.since : 0);

  // camera + microphone (the microphone is optional: without it the switch is off and disabled)
  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser cannot use the camera (needs https or localhost).');
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
        if (!cancelled) setHasMicrophone(true);
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
          if (!cancelled) setHasMicrophone(false);
        } catch (e: any) {
          if (!cancelled) setCameraError(String(e?.message || 'The camera is not allowed or not found.'));
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      setCameraError('');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => undefined);
      }
    };
    void open();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  // the camera light goes off when the screen is closed
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [],
  );

  // the switch = the microphone track on / off, also while recording
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = audioOn;
    });
    if (audioOn && hasMicrophone && phase === 'recording') soundEver.current = true;
  }, [audioOn, hasMicrophone, phase, facing]);

  useEffect(() => {
    if (phase !== 'recording') return undefined;
    const timer = setInterval(() => setElapsed(Math.floor(elapsedMs() / 1000)), 250);
    return () => clearInterval(timer);
  }, [phase]);

  // a tab that is closed while recording asks first
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'paused') return undefined;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const start = () => {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      const mimeType = pickRecorderMimeType((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      soundEver.current = audioOn && hasMicrophone;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.current.push(e.data);
      };
      recorder.onstop = () => void onStopped(recorder.mimeType || mimeType || 'video/webm');
      recorder.start(1000);
      recorderRef.current = recorder;
      clock.current = { base: 0, since: Date.now() };
      setElapsed(0);
      setPhase('recording');
    } catch (e) {
      showErrorModal(e, 'Record video');
    }
  };

  const pauseOrResume = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (phase === 'recording') {
      recorder.pause();
      clock.current = { base: elapsedMs(), since: null };
      setPhase('paused');
    } else if (phase === 'paused') {
      recorder.resume();
      clock.current = { base: clock.current.base, since: Date.now() };
      setPhase('recording');
    }
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    clock.current = { base: elapsedMs(), since: null };
    setPhase('saving');
    recorder.stop(); // onstop -> onStopped
  };

  const onStopped = async (mime: string) => {
    const durationSec = Math.round(clock.current.base / 100) / 10;
    try {
      const blob = new Blob(chunks.current, { type: mime.split(';')[0] });
      if (!blob.size) throw new Error('Nothing was recorded.');
      const url = URL.createObjectURL(blob);
      const saved = await save([{ uri: url, durationSec, hasAudio: soundEver.current }]);
      URL.revokeObjectURL(url);
      setPost(saved);
      setPhase('saved');
      onSaved?.(saved);
    } catch (e) {
      showErrorModal(e, 'Save video');
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (phase === 'recording' && elapsed >= maxDurationSec) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase, maxDurationSec]);

  // the preview element is created again when the result card is closed
  useEffect(() => {
    if (phase === 'idle' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => undefined);
    }
  }, [phase]);

  if (phase === 'saved' && post) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <RecordingResult kind="video" post={post} onRecordAgain={() => { setPost(null); setPhase('idle'); setElapsed(0); }} />
      </ScrollView>
    );
  }

  const active = phase === 'recording' || phase === 'paused';
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="record-video">
        <Card.Title title="Record video" titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }} />
        <Card.Content>
          <Surface style={styles.preview} elevation={2}>
            {cameraError ? (
              <View style={styles.center}>
                <Text style={styles.light} testID="record-video-error">{cameraError}</Text>
              </View>
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
              />
            )}
            {active && (
              <View style={[styles.badge, { backgroundColor: phase === 'paused' ? '#6b7280' : theme.colors.error }]}>
                <Text variant="labelSmall" style={styles.badgeText} testID="record-video-time">
                  {phase === 'paused' ? 'PAUSED' : 'REC'} {formatDuration(elapsed)}
                </Text>
              </View>
            )}
          </Surface>

          <View style={styles.row}>
            <SwitchApp
              label={audioOn && hasMicrophone ? 'Record sound: on' : 'Record sound: off'}
              value={audioOn && hasMicrophone}
              onValueChange={setAudioOn}
              disabled={!hasMicrophone || phase === 'saving'}
              testID="record-video-sound"
            />
            <IconButton icon="camera-flip" onPress={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} disabled={active || phase === 'saving'} accessibilityLabel="Switch camera" testID="record-video-flip" />
          </View>
          {!hasMicrophone && !cameraError && (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} testID="record-video-nomic">
              No microphone is allowed: the video is recorded without sound.
            </Text>
          )}

          <View style={styles.buttons}>
            {!active ? (
              <ButtonPrimaryApp icon="fiber_manual_record" color={theme.colors.error} onPress={start} disabled={!!cameraError || phase === 'saving'} loading={phase === 'saving'} testID="record-video-start">
                Record
              </ButtonPrimaryApp>
            ) : (
              <>
                <ButtonPrimaryApp icon={phase === 'paused' ? 'play_arrow' : 'pause'} onPress={pauseOrResume} testID="record-video-pause">
                  {phase === 'paused' ? 'Resume' : 'Pause'}
                </ButtonPrimaryApp>
                <ButtonPrimaryApp icon="stop" onPress={stop} testID="record-video-stop">
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
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  preview: { width: '100%', height: 360, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  light: { color: '#fff', textAlign: 'center' },
  badge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap' },
});
