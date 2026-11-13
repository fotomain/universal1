// Video recorder of iOS and Android: react-native-vision-camera (hardware H.264 into an mp4 file).
// The web twin is RecordVideo.web.tsx.
//
// The sound switch ("Sound on" / "Sound off") works while the video is being recorded. Vision Camera fixes the sound of a recording when
// it starts (the camera session is configured with or without the microphone), so switching it on or off during the
// recording ends the current part and starts the next part with the new setting (about SEGMENT_GAP_MS is not recorded).
// All parts are kept as ONE media post (mediaSegments) that the player plays one after the other.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';
import { ButtonPrimaryApp, ButtonSecondaryApp, SwitchApp, showErrorModal } from '../common';
import RecordingResult from './RecordingResult';
import { useSaveRecording } from './useSaveRecording';
import { useRecordVideoSettings } from './useRecordVideoSettings';
import RecordVideoSettingsPanel from './RecordVideoSettingsPanel';
import { LiveDateTimeOverStamp } from './DateTimeOverStamp';
import type { RecordingPost, RecordingSegment } from './mediaPost';
import type { RecordVideoProps } from './recordVideoTypes';
import { formatDuration } from './mediaSource';
import { PartClock } from './dateTimeOver';

export type { RecordVideoProps };

/** the camera session is rebuilt when the sound is switched: wait for it before the next part starts */
export const SEGMENT_GAP_MS = 700;

type Phase = 'idle' | 'recording' | 'paused' | 'switching' | 'saving' | 'saved';

export const toFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function RecordVideo({ maxDurationSec = 3600, withAudio = true, onSaved }: RecordVideoProps) {
  const theme = useTheme();
  const save = useSaveRecording('video');
  const { settings: recordSettings, change: changeRecordSettings, reset: resetRecordSettings } = useRecordVideoSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** the stamp of the recording that runs: fixed at Record (the settings are locked until Stop) */
  const stampOn = recordSettings.recordDateTimeOverEnabled;
  const stampPosition = recordSettings.recordDateTimeOverPosition;
  const camera = useRef<Camera>(null);
  const cameraPermission = useCameraPermission();
  const micPermission = useMicrophonePermission();
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(position);
  const [focused, setFocused] = useState(true);
  const [audioOn, setAudioOn] = useState(withAudio);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [post, setPost] = useState<RecordingPost | null>(null);

  const segments = useRef<RecordingSegment[]>([]);
  const segmentHasAudio = useRef(false);
  /** when the part that is being recorded started and where it was paused (the date and time stamp of the player) */
  const partClock = useRef<PartClock | null>(null);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);
  const clock = useRef({ base: 0, since: 0 as number | null });

  const elapsedMs = () => clock.current.base + (clock.current.since ? Date.now() - clock.current.since : 0);

  // the screen stays mounted in the drawer: the camera works only while the screen is shown
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!cameraPermission.hasPermission) void cameraPermission.requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the clock
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'switching') return undefined;
    const timer = setInterval(() => setElapsed(Math.floor(elapsedMs() / 1000)), 250);
    return () => clearInterval(timer);
  }, [phase]);

  const beginPart = (withSound: boolean) => {
    segmentHasAudio.current = withSound;
    const part = new PartClock(Date.now());
    partClock.current = part;
    camera.current?.startRecording({
      fileType: 'mp4',
      videoCodec: 'h264',
      onRecordingFinished: (video) => {
        segments.current.push({ uri: toFileUri(video.path), durationSec: video.duration, hasAudio: segmentHasAudio.current, ...part.toPart() });
        pending.current?.resolve();
        pending.current = null;
      },
      onRecordingError: (error) => {
        if (pending.current) {
          pending.current.reject(error);
          pending.current = null;
        } else {
          showErrorModal(error, 'Record video');
          setPhase('idle');
        }
      },
    });
  };

  const endPart = () =>
    new Promise<void>((resolve, reject) => {
      pending.current = { resolve, reject };
      camera.current?.stopRecording().catch(reject);
    });

  const ensureMicrophone = async (): Promise<boolean> => {
    if (micPermission.hasPermission) return true;
    const granted = await micPermission.requestPermission();
    if (!granted) showErrorModal('The microphone is not allowed. Allow it in the settings of the device.', 'Record video');
    return granted;
  };

  const start = async () => {
    if (!cameraPermission.hasPermission && !(await cameraPermission.requestPermission())) {
      showErrorModal('The camera is not allowed. Allow it in the settings of the device.', 'Record video');
      return;
    }
    const hadMicrophone = micPermission.hasPermission;
    const sound = audioOn && (await ensureMicrophone());
    if (audioOn && !sound) setAudioOn(false);
    // the permission was given just now: the camera session needs a moment to take the microphone
    if (sound && !hadMicrophone) await sleep(SEGMENT_GAP_MS);
    segments.current = [];
    clock.current = { base: 0, since: Date.now() };
    setElapsed(0);
    beginPart(sound);
    setPhase('recording');
  };

  const pauseOrResume = async () => {
    try {
      if (phase === 'recording') {
        await camera.current?.pauseRecording();
        partClock.current?.pause(Date.now());
        clock.current = { base: elapsedMs(), since: null };
        setPhase('paused');
      } else if (phase === 'paused') {
        await camera.current?.resumeRecording();
        partClock.current?.resume(Date.now());
        clock.current = { base: clock.current.base, since: Date.now() };
        setPhase('recording');
      }
    } catch (e) {
      showErrorModal(e, 'Record video');
    }
  };

  /** the switch: before the recording only the setting; during the recording a new part with the new setting */
  const onAudioSwitch = async (next: boolean) => {
    if (next && !(await ensureMicrophone())) return;
    if (phase !== 'recording') {
      setAudioOn(next);
      return;
    }
    setPhase('switching');
    try {
      await endPart();
      setAudioOn(next);
      await sleep(SEGMENT_GAP_MS);
      beginPart(next);
      setPhase('recording');
    } catch (e) {
      showErrorModal(e, 'Record video');
      await finishAndSave();
    }
  };

  const finishAndSave = async () => {
    setPhase('saving');
    clock.current = { base: elapsedMs(), since: null };
    try {
      if (pending.current === null && (phase === 'recording' || phase === 'paused' || phase === 'switching')) {
        // a part is still being recorded
        if (camera.current) await endPart().catch(() => undefined);
      }
      if (!segments.current.length) throw new Error('Nothing was recorded.');
      // the file has no stamp: the player of the app draws it from the times of the parts
      const saved = await save(segments.current, undefined, { dateTimeOver: stampOn ? { position: stampPosition, burnedIn: false } : null });
      setPost(saved);
      setPhase('saved');
      onSaved?.(saved);
    } catch (e) {
      showErrorModal(e, 'Save video');
      setPhase('idle');
    }
  };

  useEffect(() => {
    if (phase === 'recording' && elapsed >= maxDurationSec) void finishAndSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase, maxDurationSec]);

  if (phase === 'saved' && post) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <RecordingResult kind="video" post={post} onRecordAgain={() => { setPost(null); setPhase('idle'); setElapsed(0); }} />
      </ScrollView>
    );
  }

  const active = phase === 'recording' || phase === 'paused' || phase === 'switching';
  const sound = audioOn && micPermission.hasPermission;
  const previewReady = cameraPermission.hasPermission && !!device;
  const settingsLocked = active || phase === 'saving';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="record-video">
        {/* no title in the card: the application bar already says "Record Video" */}
        <Card.Content style={styles.content}>
          <Surface style={styles.preview} elevation={2}>
            {!cameraPermission.hasPermission ? (
              <View style={styles.center}>
                <Text style={styles.light}>The camera is not allowed.</Text>
                <ButtonSecondaryApp onPress={() => cameraPermission.requestPermission()} testID="record-video-allow">
                  Allow the camera
                </ButtonSecondaryApp>
              </View>
            ) : !device ? (
              <View style={styles.center}>
                <Text style={styles.light} testID="record-video-nodevice">No camera was found on this device.</Text>
              </View>
            ) : (
              <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={focused} video audio={sound} />
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
              <ButtonPrimaryApp icon="fiber_manual_record" color={theme.colors.error} onPress={start} disabled={!device || phase === 'saving'} loading={phase === 'saving'} testID="record-video-start">
                Record
              </ButtonPrimaryApp>
            )}
            <SwitchApp
              label={sound ? 'Sound on' : 'Sound off'}
              value={audioOn}
              onValueChange={onAudioSwitch}
              disabled={phase === 'paused' || phase === 'switching' || phase === 'saving'}
              style={styles.sound}
              testID="record-video-sound"
            />
            <View style={styles.rowIcons}>
              <IconButton
                icon="camera-flip"
                onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))}
                disabled={active || phase === 'saving'}
                accessibilityLabel="Switch camera"
                size={22} style={styles.flip} testID="record-video-flip"
              />
              <IconButton icon="cog" onPress={() => setSettingsOpen((o) => !o)} accessibilityLabel="Record settings" size={22} style={styles.gear} testID="record-video-settings-button" />
            </View>
          </View>
          {settingsOpen && (
            <RecordVideoSettingsPanel settings={recordSettings} onChange={changeRecordSettings} onReset={resetRecordSettings} locked={settingsLocked} />
          )}
          {active && (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} testID="record-video-hint">
              Switching the sound starts a new part of the recording (about a second between the parts is not recorded).
            </Text>
          )}

          {/* Pause / Stop while a recording runs; Record itself stands in the row above, left of the sound switch */}
          {active && (
            <View style={styles.buttons}>
              <ButtonPrimaryApp icon={phase === 'paused' ? 'play_arrow' : 'pause'} onPress={pauseOrResume} disabled={phase === 'switching'} testID="record-video-pause">
                {phase === 'paused' ? 'Resume' : 'Pause'}
              </ButtonPrimaryApp>
              <ButtonPrimaryApp icon="stop" onPress={finishAndSave} disabled={phase === 'switching'} testID="record-video-stop">
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
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
