// Take a photo - iOS and Android: react-native-vision-camera (zoom, flash, front / back camera). The web twin is RecordPhoto.web.tsx.
// The look (black and white modes, colour looks: photoFilters.ts) is chosen before the shot and changed after it (PhotoReview). The
// live picture of the camera is not filtered on a phone (Vision Camera filters live only with a frame processor); the photo is.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { ButtonPrimaryApp, ButtonSecondaryApp, showErrorModal } from '../../common';
import ZoomControl from '../common/ZoomControl';
import PinchZoomView from '../common/PinchZoomView';
import { canZoom, clampZoom, factorOf, normalizeZoomRange } from '../common/cameraZoom';
import { toFileUri } from '../common/mediaSource';
import { nativeTorchProp, torchIcon, torchLabel } from '../common/cameraTorch';
import { useRecordVideoSettings } from '../video/useRecordVideoSettings';
import PhotoFilterStrip from './PhotoFilterStrip';
import PhotoReview, { ShotPhoto } from './PhotoReview';
import { applyPhotoFilter } from './applyPhotoFilter';
import { DEFAULT_PHOTO_FILTER } from './photoFilters';
import type { RecordPhotoProps } from './recordPhotoTypes';

export type { RecordPhotoProps };

type Flash = 'off' | 'on' | 'auto';
const NEXT_FLASH: Record<Flash, Flash> = { off: 'auto', auto: 'on', on: 'off' };
const FLASH_ICON: Record<Flash, string> = { off: 'flash-off', auto: 'flash-auto', on: 'flash' };

export default function RecordPhoto({ onSaved }: RecordPhotoProps) {
  const theme = useTheme();
  const camera = React.useRef<Camera>(null);
  const permission = useCameraPermission();
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(position);
  // the flashlight = a permanent light (the Flash button below fires once at the shutter); the same remembered choice as the video screen
  const { settings: cameraSettings, change: changeCameraSettings } = useRecordVideoSettings();
  const torchOn = cameraSettings.recordTorchEnabled;
  const [focused, setFocused] = useState(true);
  const [flash, setFlash] = useState<Flash>('off');
  const [filterId, setFilterId] = useState(DEFAULT_PHOTO_FILTER);
  const [taking, setTaking] = useState(false);
  const [shot, setShot] = useState<ShotPhoto | null>(null);
  const zoomRange = normalizeZoomRange({ min: device?.minZoom, max: device?.maxZoom, neutral: device?.neutralZoom });
  const [zoom, setZoom] = useState(zoomRange.neutral);
  useEffect(() => {
    setZoom(zoomRange.neutral);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.id]);

  // the screen stays mounted in the drawer: the camera works only while the screen is shown
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    if (!permission.hasPermission) void permission.requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const take = async () => {
    if (!camera.current || taking) return;
    setTaking(true);
    try {
      const photo = await camera.current.takePhoto({ flash: device?.hasFlash ? flash : 'off', enableShutterSound: true });
      // the file has the sensor's sideways size + a note "turn it": the real size is known after PhotoReview made it upright
      setShot({ uri: toFileUri(photo.path), width: photo.width, height: photo.height, zoomFactor: factorOf(zoom, zoomRange) });
    } catch (e) {
      showErrorModal(e, 'Take photo');
    } finally {
      setTaking(false);
    }
  };

  if (shot) {
    return <PhotoReview shot={shot} initialFilterId={filterId} apply={applyPhotoFilter} onRetake={() => setShot(null)} onSaved={onSaved} />;
  }

  const ready = permission.hasPermission && !!device;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="record-photo">
        <Card.Content style={styles.content}>
          <Surface style={styles.preview} elevation={2}>
            {!permission.hasPermission ? (
              <View style={styles.center}>
                <Text style={styles.light}>The camera is not allowed.</Text>
                <ButtonSecondaryApp onPress={() => permission.requestPermission()} testID="record-photo-allow">
                  Allow the camera
                </ButtonSecondaryApp>
              </View>
            ) : !device ? (
              <View style={styles.center}>
                <Text style={styles.light} testID="record-photo-nodevice">No camera was found on this device.</Text>
              </View>
            ) : (
              <PinchZoomView style={StyleSheet.absoluteFill} zoom={zoom} range={zoomRange} onZoom={(z) => setZoom(clampZoom(z, zoomRange))} disabled={!canZoom(zoomRange)} testID="record-photo-pinch">
                <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={focused} photo photoQualityBalance="quality" zoom={clampZoom(zoom, zoomRange)} torch={nativeTorchProp(torchOn, device.hasTorch)} />
              </PinchZoomView>
            )}
          </Surface>
          <View style={styles.row}>
            <ButtonPrimaryApp icon="photo_camera" onPress={take} disabled={!ready || taking} loading={taking} testID="record-photo-shutter">
              Take photo
            </ButtonPrimaryApp>
            <View style={styles.rowIcons}>
              {!!device?.hasTorch && <IconButton icon={torchIcon(torchOn)} onPress={() => changeCameraSettings({ recordTorchEnabled: !torchOn })} accessibilityLabel={torchLabel(torchOn)} testID="record-photo-torch" />}
              {!!device?.hasFlash && <IconButton icon={FLASH_ICON[flash]} onPress={() => setFlash((f) => NEXT_FLASH[f])} accessibilityLabel={`Flash ${flash}`} testID="record-photo-flash" />}
              <IconButton icon="camera-flip-outline" onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))} accessibilityLabel="Switch camera" testID="record-photo-flip" />
            </View>
          </View>
          {ready && <ZoomControl zoom={zoom} range={zoomRange} onZoom={(z) => setZoom(clampZoom(z, zoomRange))} testID="record-photo-zoom" />}
          <PhotoFilterStrip value={filterId} onChange={setFilterId} testID="record-photo-filters" />
          {filterId !== 'original' && (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} testID="record-photo-filter-note">
              The look is applied to the photo after the shot; the live picture is not filtered.
            </Text>
          )}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  light: { color: '#fff', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  rowIcons: { flexDirection: 'row', alignItems: 'center' },
});
