// Scan a QR code or a barcode - iOS and Android: react-native-vision-camera `useCodeScanner` (the codes are read by the camera framework:
// AVFoundation on iOS, ML Kit on Android - no frame processor, no extra package). The web twin is ScanCodes.web.tsx (BarcodeDetector).
// While the camera sees a code the screen shows its result (ScanResultCard); "Scan again" goes back to the camera.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { ButtonSecondaryApp } from '../../common';
import ZoomControl from '../common/ZoomControl';
import PinchZoomView from '../common/PinchZoomView';
import { canZoom, clampZoom, normalizeZoomRange } from '../common/cameraZoom';
import ScanResultCard from './ScanResultCard';
import { normalizeCodeType, SCAN_CODE_TYPES, ScanResult, shouldAcceptScan } from './scanModel';

export default function ScanCodes() {
  const theme = useTheme();
  const camera = useRef<Camera>(null);
  const permission = useCameraPermission();
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const device = useCameraDevice(position);
  const [focused, setFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const last = useRef<ScanResult | null>(null);
  /** a result is on the screen: a frame that was already on its way must not replace it */
  const shown = useRef(false);
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

  const scanner = useCodeScanner({
    codeTypes: [...SCAN_CODE_TYPES],
    onCodeScanned: (codes) => {
      if (shown.current) return;
      const first = codes.find((c) => c.value);
      if (!first?.value) return;
      const next = { value: first.value, type: normalizeCodeType(first.type) };
      const now = Date.now();
      if (!shouldAcceptScan(last.current, next, now)) return;
      last.current = { ...next, at: now };
      shown.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setResult({ ...next, at: now });
    },
  });

  const scanning = !result && focused && permission.hasPermission && !!device;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="scan-codes">
        <Card.Content style={styles.content}>
          <Surface style={styles.preview} elevation={2}>
            {!permission.hasPermission ? (
              <View style={styles.center}>
                <Text style={styles.light}>The camera is not allowed.</Text>
                <ButtonSecondaryApp onPress={() => permission.requestPermission()} testID="scan-allow">
                  Allow the camera
                </ButtonSecondaryApp>
              </View>
            ) : !device ? (
              <View style={styles.center}>
                <Text style={styles.light} testID="scan-nodevice">No camera was found on this device.</Text>
              </View>
            ) : (
              <PinchZoomView style={StyleSheet.absoluteFill} zoom={zoom} range={zoomRange} onZoom={(z) => setZoom(clampZoom(z, zoomRange))} disabled={!canZoom(zoomRange)}>
                <Camera
                  ref={camera}
                  style={StyleSheet.absoluteFill}
                  device={device}
                  isActive={focused && !result}
                  codeScanner={scanner}
                  zoom={clampZoom(zoom, zoomRange)}
                  torch={torch && device.hasTorch ? 'on' : 'off'}
                />
              </PinchZoomView>
            )}
            {scanning && <View pointerEvents="none" style={[styles.frame, { borderColor: theme.colors.primary }]} testID="scan-frame" />}
          </Surface>
          <View style={styles.row}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }} testID="scan-hint">
              {result ? 'Code read.' : 'Point the camera at a QR code or a barcode.'}
            </Text>
            {!!device?.hasTorch && <IconButton icon={torch ? 'flashlight' : 'flashlight-off'} onPress={() => setTorch((t) => !t)} accessibilityLabel="Torch" testID="scan-torch" />}
            <IconButton icon="camera-flip-outline" onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))} accessibilityLabel="Switch camera" testID="scan-flip" />
          </View>
          {!result && !!device && permission.hasPermission && <ZoomControl zoom={zoom} range={zoomRange} onZoom={(z) => setZoom(clampZoom(z, zoomRange))} testID="scan-zoom" />}
        </Card.Content>
      </Card>
      {result && <ScanResultCard result={result} onScanAgain={() => { last.current = null; shown.current = false; setResult(null); }} />}
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
  frame: { position: 'absolute', top: '22%', left: '16%', right: '16%', bottom: '22%', borderWidth: 3, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
});
