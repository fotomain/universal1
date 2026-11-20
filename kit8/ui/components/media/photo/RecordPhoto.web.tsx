// Web twin of RecordPhoto.tsx: getUserMedia + a canvas. The look chosen before the shot is shown LIVE on the preview (CSS filter of
// photoFilters.ts) and baked into the file by the same colour matrix as on the phone (applyPhotoFilter.web.ts). Zoom: the hardware zoom
// of the camera when it has one, else the middle of the picture is cut out (digital zoom, also in the file).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { ButtonPrimaryApp, showErrorModal } from '../../common';
import ZoomControl from '../common/ZoomControl';
import { torchIcon, torchLabel } from '../common/cameraTorch';
import { useWebTorch } from '../common/useWebTorch';
import { useRecordVideoSettings } from '../video/useRecordVideoSettings';
import { clampZoom, digitalCropRect, webZoomCapability, WebZoomCapability } from '../common/cameraZoom';
import PhotoFilterStrip from './PhotoFilterStrip';
import PhotoReview, { ShotPhoto } from './PhotoReview';
import { applyPhotoFilter } from './applyPhotoFilter.web';
import { DEFAULT_PHOTO_FILTER, filterById } from './photoFilters';
import type { RecordPhotoProps } from './recordPhotoTypes';

export type { RecordPhotoProps };

export default function RecordPhoto({ onSaved }: RecordPhotoProps) {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState('');
  const [filterId, setFilterId] = useState(DEFAULT_PHOTO_FILTER);
  const [zoomCap, setZoomCap] = useState<WebZoomCapability | null>(null);
  const [zoom, setZoom] = useState(1);
  const [taking, setTaking] = useState(false);
  const [shot, setShot] = useState<ShotPhoto | null>(null);
  // the flashlight = a permanent light, the same remembered choice as the video screen
  const { settings: cameraSettings, change: changeCameraSettings } = useRecordVideoSettings();
  const torchOn = cameraSettings.recordTorchEnabled;
  const [streamVersion, setStreamVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser cannot use the camera (needs https or localhost).');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        setStreamVersion((v) => v + 1);
        const cap = webZoomCapability(stream.getVideoTracks()[0], true);
        setZoomCap(cap);
        setZoom(cap?.range.neutral ?? 1);
        setCameraError('');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      } catch (e: any) {
        if (!cancelled) setCameraError(String(e?.message || 'The camera is not allowed or not found.'));
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

  // the preview element is created again after "Retake"
  useEffect(() => {
    if (!shot && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => undefined);
    }
  }, [shot]);

  const torch = useWebTorch(() => streamRef.current?.getVideoTracks?.()[0], torchOn, streamVersion);

  const changeZoom = (value: number) => {
    if (!zoomCap) return;
    const next = clampZoom(value, zoomCap.range);
    setZoom(next);
    if (zoomCap.hardware) void streamRef.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ zoom: next } as any] }).catch(() => undefined);
  };

  const take = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || taking) return;
    setTaking(true);
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot take a photo.');
      const digital = !!zoomCap && !zoomCap.hardware && zoom > 1;
      if (digital) {
        const r = digitalCropRect(w, h, zoom);
        ctx.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
      } else {
        ctx.drawImage(video, 0, 0, w, h);
      }
      const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be made.'))), 'image/jpeg', 0.95));
      setShot({ uri: URL.createObjectURL(blob), width: w, height: h, zoomFactor: zoomCap ? zoom / zoomCap.range.neutral : 1 });
    } catch (e) {
      showErrorModal(e, 'Take photo');
    } finally {
      setTaking(false);
    }
  };

  if (shot) {
    return <PhotoReview shot={shot} initialFilterId={filterId} apply={applyPhotoFilter} onRetake={() => setShot(null)} onSaved={onSaved} />;
  }

  const digital = !!zoomCap && !zoomCap.hardware && zoom > 1;
  const live = filterById(filterId).css;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="record-photo">
        <Card.Content style={styles.content}>
          <Surface style={styles.preview} elevation={2}>
            {cameraError ? (
              <View style={styles.center}>
                <Text style={styles.light} testID="record-photo-error">{cameraError}</Text>
              </View>
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: live === 'none' ? undefined : live,
                  transform: `${facing === 'user' ? 'scaleX(-1) ' : ''}${digital ? `scale(${zoom})` : ''}`.trim() || undefined,
                }}
              />
            )}
          </Surface>
          <View style={styles.row}>
            <ButtonPrimaryApp icon="photo_camera" onPress={take} disabled={!!cameraError || taking} loading={taking} testID="record-photo-shutter">
              Take photo
            </ButtonPrimaryApp>
            <View style={styles.rowIcons}>
              {torch.available && <IconButton icon={torchIcon(torchOn && torch.lit)} onPress={() => changeCameraSettings({ recordTorchEnabled: !torchOn })} accessibilityLabel={torchLabel(torchOn && torch.lit)} testID="record-photo-torch" />}
              <IconButton icon="camera-flip-outline" onPress={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} accessibilityLabel="Switch camera" testID="record-photo-flip" />
            </View>
          </View>
          {!cameraError && zoomCap && <ZoomControl zoom={zoom} range={zoomCap.range} onZoom={changeZoom} testID="record-photo-zoom" />}
          <PhotoFilterStrip value={filterId} onChange={setFilterId} testID="record-photo-filters" />
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  content: { paddingTop: 16, gap: 4 },
  preview: { width: '100%', height: 420, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  light: { color: '#fff', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  rowIcons: { flexDirection: 'row', alignItems: 'center' },
});
