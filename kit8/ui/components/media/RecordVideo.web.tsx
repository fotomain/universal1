// Web twin of RecordVideo.tsx: getUserMedia (camera + microphone) recorded by the browser MediaRecorder into one webm / mp4.
//
// The sound switch ("Sound on" / "Sound off") works while the video is being recorded and keeps ONE file: the microphone track stays in the
// recording, the switch enables / disables it (a disabled track records silence).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { ButtonPrimaryApp, SwitchApp, showErrorModal } from '../common';
import RecordingResult from './RecordingResult';
import { useSaveRecording } from './useSaveRecording';
import { useRecordVideoSettings } from './useRecordVideoSettings';
import RecordVideoSettingsPanel from './RecordVideoSettingsPanel';
import { LiveDateTimeOverStamp } from './DateTimeOverStamp';
import type { RecordingPost } from './mediaPost';
import { formatDuration } from './mediaSource';
import type { RecordVideoProps } from './recordVideoTypes';
import { createStampedStream, StampedStream } from './stampedStream';
import type { RecordingDateTimeOver } from './mediaPost';

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
  const { settings: recordSettings, change: changeRecordSettings, reset: resetRecordSettings } = useRecordVideoSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** the stamp of the recording that runs: fixed at Record (the settings are locked until Stop) */
  const stampOn = recordSettings.recordDateTimeOverEnabled;
  const stampPosition = recordSettings.recordDateTimeOverPosition;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const clock = useRef({ base: 0, since: 0 as number | null });
  const soundEver = useRef(false);
  /** the canvas between the camera and the recorder while the date and time are written into the picture */
  const stamped = useRef<StampedStream | null>(null);
  const recordedOver = useRef<RecordingDateTimeOver | null>(null);
  const startedAt = useRef('');

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
      stamped.current?.stop();
      stamped.current = null;
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
    setSettingsOpen(false); // the settings are locked while recording: the panel folds when Record starts
    try {
      const mimeType = pickRecorderMimeType((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m));
      // the date and time over the video: every frame goes through a canvas that draws the text (stampedStream.ts)
      stamped.current?.stop();
      stamped.current = null;
      recordedOver.current = null;
      let input: MediaStream = stream;
      if (stampOn && videoRef.current) {
        try {
          stamped.current = createStampedStream(videoRef.current, stream, stampPosition);
          input = stamped.current.stream;
          recordedOver.current = { position: stampPosition, burnedIn: true };
        } catch (e) {
          // a browser without canvas.captureStream: the video is recorded as before, without the stamp
          showErrorModal(e, 'Record video');
        }
      }
      startedAt.current = new Date().toISOString();
      const recorder = new MediaRecorder(input, mimeType ? { mimeType } : undefined);
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
    stamped.current?.stop();
    stamped.current = null;
    try {
      const blob = new Blob(chunks.current, { type: mime.split(';')[0] });
      if (!blob.size) throw new Error('Nothing was recorded.');
      const url = URL.createObjectURL(blob);
      const saved = await save([{ uri: url, durationSec, hasAudio: soundEver.current, startedAt: startedAt.current || undefined }], undefined, { dateTimeOver: recordedOver.current });
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
  const previewReady = !cameraError;
  const settingsLocked = active || phase === 'saving';
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="record-video">
        {/* no title in the card: the application bar already says "Record Video" */}
        <Card.Content style={styles.content}>
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
              <View testID={stampOn && stampPosition === 'topLeft' ? 'record-video-badge-right' : 'record-video-badge'} style={[styles.badge, stampOn && stampPosition === 'topLeft' ? styles.badgeRight : null, { backgroundColor: phase === 'paused' ? '#6b7280' : theme.colors.error }]}>
                <Text variant="labelSmall" style={styles.badgeText} testID="record-video-time">
                  {phase === 'paused' ? 'PAUSED' : 'REC'} {formatDuration(elapsed)}
                </Text>
              </View>
            )}
            {stampOn && previewReady && <LiveDateTimeOverStamp position={stampPosition} testID="record-video-datetime" />}
          </Surface>

          <View style={styles.row}>
            {!active && (
              <ButtonPrimaryApp icon="fiber_manual_record" color={theme.colors.error} onPress={start} disabled={!!cameraError || phase === 'saving'} loading={phase === 'saving'} testID="record-video-start">
                Record
              </ButtonPrimaryApp>
            )}
            <SwitchApp
              label={audioOn && hasMicrophone ? 'Sound on' : 'Sound off'}
              value={audioOn && hasMicrophone}
              onValueChange={setAudioOn}
              disabled={!hasMicrophone || phase === 'saving'}
              style={styles.sound}
              testID="record-video-sound"
            />
            <View style={styles.rowIcons}>
              <IconButton icon="camera-flip-outline" onPress={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} disabled={active || phase === 'saving'} accessibilityLabel="Switch camera" size={22} style={styles.flip} testID="record-video-flip" />
              <IconButton icon="cog-outline" onPress={() => setSettingsOpen((o) => !o)} accessibilityLabel="Record settings" size={22} style={styles.gear} testID="record-video-settings-button" />
            </View>
          </View>
          {settingsOpen && (
            <RecordVideoSettingsPanel settings={recordSettings} onChange={changeRecordSettings} onReset={resetRecordSettings} locked={settingsLocked} />
          )}
          {!hasMicrophone && !cameraError && (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} testID="record-video-nomic">
              No microphone is allowed: the video is recorded without sound.
            </Text>
          )}

          {/* Pause / Stop while a recording runs; Record itself stands in the row above, left of the sound switch */}
          {active && (
            <View style={styles.buttons}>
              <ButtonPrimaryApp icon={phase === 'paused' ? 'play_arrow' : 'pause'} onPress={pauseOrResume} testID="record-video-pause">
                {phase === 'paused' ? 'Resume' : 'Pause'}
              </ButtonPrimaryApp>
              <ButtonPrimaryApp icon="stop" onPress={stop} testID="record-video-stop">
                Stop & save
              </ButtonPrimaryApp>
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  content: { paddingTop: 16 },
  preview: { width: '100%', height: 360, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  light: { color: '#fff', textAlign: 'center' },
  badge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeRight: { left: undefined, right: 10 },
  badgeText: { color: '#fff', fontWeight: 'bold' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  rowIcons: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
  /* the gear ends at the right edge of the picture (an icon button has 8 of empty space around its sign) */
  gear: { margin: 0, marginRight: -8, marginLeft: -4 },
  /* the camera sign stands in the middle between the sound switch and the gear */
  flip: { margin: 0, marginLeft: 4 },
  /* ONE line also on a narrow phone: the switch gives way (its text may break), nothing drops to a second line */
  sound: { flexShrink: 1, marginLeft: 8 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap' },
});
