import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, ScrollView } from 'react-native';
import { Surface, Text, useTheme, IconButton, TextInput, Switch, Portal, Modal } from 'react-native-paper';
import { ButtonPrimaryApp } from '../common';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { ActiveUserState } from '../../redux/activeUserSlice';

export interface RecordVideoWebComponentProps {
  withAudio?: boolean;
  maxDuration?: number;
  videoQualityData?: string;
}

export default function RecordVideoWebComponent(props: RecordVideoWebComponentProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation();
  const searchParams = useLocalSearchParams<{ withAudio?: string; maxDuration?: string; videoQualityData?: string }>();
  const activeUserState = useSelector((state: any) => state.activeUserState as ActiveUserState);

  const isAudioEnabled = props.withAudio ?? (searchParams.withAudio !== 'false');
  const maxDurationSec = props.maxDuration || Number(searchParams.maxDuration) || 300;
  const qualityData = props.videoQualityData || searchParams.videoQualityData || '1080p';

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100); // 100% to 300%
  const [isBWFilter, setIsBWFilter] = useState(false);
  const [continueInBackground, setContinueInBackground] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [currentVideoGUID, setCurrentVideoGUID] = useState<string | null>(null);

  // Web Streams & MediaRecorder
  const videoRef = useRef<any>(null);
  const canvasRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<any>(null);

  // Generate UUID
  const generateUUID = () => {
    return 'f' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
  };

  // Start Camera Stream on Web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: isAudioEnabled,
      }).then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }).catch(err => {
        console.warn('Media Device Error:', err);
      });
    }

    // Window Unload Data Loss Prevention
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecording) {
        stopAndSaveRecording();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if (Platform.OS === 'web') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      if (Platform.OS === 'web') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isAudioEnabled]);

  // Canvas draw loop for B&W filter, Zoom, and Background Recording
  useEffect(() => {
    let active = true;
    const drawCanvas = () => {
      if (!active) return;
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx && video.readyState === 4) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;

          ctx.filter = isBWFilter ? 'grayscale(100%)' : 'none';

          // Apply Zoom
          const scale = zoomLevel / 100;
          const sw = canvas.width / scale;
          const sh = canvas.height / scale;
          const sx = (canvas.width - sw) / 2;
          const sy = (canvas.height - sh) / 2;

          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        }
      }
      if (continueInBackground || !document.hidden) {
        animFrameRef.current = requestAnimationFrame(drawCanvas);
      } else {
        setTimeout(() => requestAnimationFrame(drawCanvas), 200);
      }
    };

    drawCanvas();
    return () => { active = false; };
  }, [zoomLevel, isBWFilter, continueInBackground]);

  // Start Recording
  const handleStartRecord = () => {
    const videoGUID = generateUUID();
    setCurrentVideoGUID(videoGUID);
    recordedChunksRef.current = [];
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);

    const listOwnerGUID = activeUserState?.activeUserGUID || 'anon';
    const newOrderInList = Date.now();

    const rowJSON = {
      videoGUID,
      videoIPAddress: '127.0.0.1',
      videoGPSData: '56.9496,24.1052', // Default coords
      videoTimeStampStart: new Date().toISOString(),
      videoQualityData: qualityData,
      withAudio: isAudioEnabled,
      percentageVideoUploadedToGoogleDrive: 0,
    };

    // Optimistic saga createOne action
    dispatch({
      type: 'reusable/createOneRequest',
      payload: {
        entityName: 'mediaPostReusable',
        item: {
          rowOwnerGUID: listOwnerGUID,
          orderInList: newOrderInList,
          rowJSON,
        },
      },
    });

    if (Platform.OS === 'web' && canvasRef.current) {
      try {
        const stream = canvasRef.current.captureStream(30);
        const options = { mimeType: 'video/webm;codecs=vp9,opus' };
        const recorder = new (window as any).MediaRecorder(stream, options);

        recorder.ondataavailable = (e: any) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (e) {
        console.warn('Canvas stream capture error:', e);
      }
    }

    setIsRecording(true);
    setIsPaused(false);

    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        if (prev >= maxDurationSec) {
          stopAndSaveRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  // Pause / Resume Recording
  const handleTogglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  // Stop & Save Recording & Start Upload
  const stopAndSaveRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    setIsPaused(false);

    const finishTime = new Date().toISOString();
    const duration = elapsedSeconds;
    const sizeMb = ((recordedChunksRef.current.reduce((acc, c) => acc + c.size, 0)) / (1024 * 1024)).toFixed(2);

    startGoogleDriveUpload(currentVideoGUID || generateUUID(), finishTime, duration, Number(sizeMb));
  };

  // One Button: Stop, Save & Start New Record
  const handleStopSaveAndStartNew = () => {
    stopAndSaveRecording();
    setTimeout(() => {
      handleStartRecord();
    }, 1500);
  };

  // Google Drive Upload Simulation with 3s progress saga updates
  const startGoogleDriveUpload = (videoGUID: string, finishTime: string, durationSec: number, sizeMb: number) => {
    setUploadProgress(0);
    let progress = 0;
    const listOwnerGUID = activeUserState?.activeUserGUID || 'anon';

    const interval = setInterval(() => {
      progress += 25;
      setUploadProgress(progress);

      // Dispatch saga updateOne to update percentageVideoUploadedToGoogleDrive
      dispatch({
        type: 'reusable/updateOneRequest',
        payload: {
          entityName: 'mediaPostReusable',
          rowGUID: videoGUID,
          item: {
            rowJSON: {
              videoGUID,
              percentageVideoUploadedToGoogleDrive: progress,
              videoTimeStampFinish: finishTime,
              videoDuration: durationSec,
              videoSizeMb: sizeMb,
            },
          },
        },
      });

      if (progress >= 100) {
        clearInterval(interval);
        const driveFileName = `kit8video_${videoGUID}.mp4`;
        const driveURL = `https://drive.google.com/file/d/${videoGUID}/view`;

        // Update mediaPostOrigin with Drive link
        dispatch({
          type: 'reusable/updateOneRequest',
          payload: {
            entityName: 'mediaPostReusable',
            rowGUID: videoGUID,
            item: {
              mediaPostOrigin: driveURL,
              rowJSON: {
                videoGUID,
                driveFileName,
                percentageVideoUploadedToGoogleDrive: 100,
                mediaPostOrigin: driveURL,
              },
            },
          },
        });

        // Navigate automatically to posts/mediapostcrud
        setTimeout(() => {
          router.push('/posts/mediapostcrud' as any);
        }, 500);
      }
    }, 3000);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3}>
        {/* Header Bar */}
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', color: theme.colors.primary }}>
            Web Video Recorder ({isAudioEnabled ? 'With Audio' : 'No Audio'})
          </Text>
          {isRecording && (
            <Surface style={[styles.recBadge, { backgroundColor: theme.colors.error }]} elevation={1}>
              <Text variant="labelSmall" style={{ color: '#fff', fontWeight: 'bold' }}>
                REC {elapsedSeconds}s
              </Text>
            </Surface>
          )}
        </View>

        {/* Video Canvas Container */}
        <View style={[styles.videoBox, { backgroundColor: '#000' }]}>
          <video
            ref={videoRef}
            style={{ display: 'none' }}
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            style={styles.canvas}
          />
        </View>

        {/* MD3 Controls Overlay / Dashboard */}
        <View style={styles.controlsGrid}>
          {/* Zoom Controls */}
          <View style={styles.row}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>
              Zoom: {zoomLevel}%
            </Text>
            <IconButton
              icon="magnify-minus-outline"
              size={20}
              onPress={() => setZoomLevel(prev => Math.max(100, prev - 25))}
            />
            <TextInput
              mode="outlined"
              dense
              value={String(zoomLevel)}
              onChangeText={val => {
                const num = parseInt(val, 10);
                if (!isNaN(num)) setZoomLevel(Math.min(300, Math.max(100, num)));
              }}
              style={styles.zoomInput}
              keyboardType="numeric"
            />
            <IconButton
              icon="magnify-plus-outline"
              size={20}
              onPress={() => setZoomLevel(prev => Math.min(300, prev + 25))}
            />
          </View>

          {/* Options Switches */}
          <View style={styles.row}>
            <View style={styles.switchRow}>
              <Text variant="bodySmall">B&W Filter</Text>
              <Switch value={isBWFilter} onValueChange={setIsBWFilter} />
            </View>
            <View style={styles.switchRow}>
              <Text variant="bodySmall">Bg Recording</Text>
              <Switch value={continueInBackground} onValueChange={setContinueInBackground} />
            </View>
          </View>

          {/* Primary Action Buttons */}
          <View style={styles.buttonRow}>
            {!isRecording ? (
              <ButtonPrimaryApp icon="record-rec" onPress={handleStartRecord} color={theme.colors.error}>
                Start Recording
              </ButtonPrimaryApp>
            ) : (
              <>
                <ButtonPrimaryApp icon={isPaused ? "play" : "pause"} onPress={handleTogglePause}>
                  {isPaused ? "Resume" : "Pause"}
                </ButtonPrimaryApp>
                <ButtonPrimaryApp icon="stop" onPress={stopAndSaveRecording} color={theme.colors.primary}>
                  Stop & Save
                </ButtonPrimaryApp>
              </>
            )}
          </View>

          {isRecording && (
            <View style={{ marginTop: 8 }}>
              <ButtonPrimaryApp icon="refresh" onPress={handleStopSaveAndStartNew}>
                Stop, Save & Start New Record
              </ButtonPrimaryApp>
            </View>
          )}

          {/* Upload Progress Modal / Bar */}
          {uploadProgress !== null && (
            <Surface style={[styles.progressBox, { backgroundColor: theme.colors.secondaryContainer }]} elevation={1}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSecondaryContainer, fontWeight: 'bold' }}>
                Uploading to Google Drive (KIT8VIDEO)... {uploadProgress}%
              </Text>
            </Surface>
          )}
        </View>
      </Surface>
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
    overflow: 'hidden',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  videoBox: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  controlsGrid: {
    marginTop: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zoomInput: {
    width: 60,
    height: 36,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    gap: 8,
  },
  progressBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
