// Web twin of ScanCodes.tsx: getUserMedia + the browser `BarcodeDetector` (Chrome, Edge, Safari 17+; Firefox has none - the screen says so).
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import ZoomControl from '../common/ZoomControl';
import { clampZoom, webZoomCapability, WebZoomCapability } from '../common/cameraZoom';
import ScanResultCard from './ScanResultCard';
import { normalizeCodeType, ScanResult, shouldAcceptScan } from './scanModel';

export const SCAN_INTERVAL_MS = 200;

/** the detector of this browser, or null (a browser without BarcodeDetector cannot scan) */
export async function createDetector(): Promise<{ detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string; format: string }>> } | null> {
  const Detector = (globalThis as any).BarcodeDetector;
  if (!Detector) return null;
  let formats: string[] | undefined;
  try {
    formats = await Detector.getSupportedFormats?.();
  } catch {
    formats = undefined;
  }
  return new Detector(formats?.length ? { formats } : undefined);
}

export default function ScanCodes() {
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const last = useRef<ScanResult | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [zoomCap, setZoomCap] = useState<WebZoomCapability | null>(null);
  const [zoom, setZoom] = useState(1);

  // camera
  useEffect(() => {
    let cancelled = false;
    const open = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use the camera (needs https or localhost).');
        return;
      }
      if (!(globalThis as any).BarcodeDetector) {
        setError('This browser cannot read QR codes and barcodes. Use Chrome, Edge or Safari 17+, or the phone app.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        const cap = webZoomCapability(stream.getVideoTracks()[0], false); // only a real (hardware) zoom helps a detector
        setZoomCap(cap);
        setZoom(cap?.range.neutral ?? 1);
        setError('');
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || 'The camera is not allowed or not found.'));
      }
    };
    void open();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    },
    [],
  );

  // detector loop
  useEffect(() => {
    if (result || error) return undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let detector: Awaited<ReturnType<typeof createDetector>> = null;
    const tick = async () => {
      const video = videoRef.current;
      try {
        if (!detector) detector = await createDetector();
        if (detector && video && video.readyState >= 2) {
          const codes = await detector.detect(video);
          const first = codes.find((c) => c.rawValue);
          if (first && !stopped) {
            const next = { value: first.rawValue, type: normalizeCodeType(first.format) };
            const now = Date.now();
            if (shouldAcceptScan(last.current, next, now)) {
              last.current = { ...next, at: now };
              setResult({ ...next, at: now });
              return;
            }
          }
        }
      } catch {
        // a frame that cannot be read: the next one
      }
      if (!stopped) timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };
    timer = setTimeout(tick, SCAN_INTERVAL_MS);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [result, error]);

  // the preview element is created again after "Scan again"
  useEffect(() => {
    if (!result && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => undefined);
    }
  }, [result]);

  const changeZoom = (value: number) => {
    if (!zoomCap) return;
    const next = clampZoom(value, zoomCap.range);
    setZoom(next);
    void streamRef.current?.getVideoTracks()[0]?.applyConstraints({ advanced: [{ zoom: next } as any] }).catch(() => undefined);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="scan-codes">
        <Card.Content style={styles.content}>
          <Surface style={styles.preview} elevation={2}>
            {error ? (
              <View style={styles.center}>
                <Text style={styles.light} testID="scan-error">{error}</Text>
              </View>
            ) : (
              <video ref={videoRef} muted playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facing === 'user' ? 'scaleX(-1)' : undefined }} />
            )}
            {!error && !result && <View pointerEvents="none" style={[styles.frame, { borderColor: theme.colors.primary }]} testID="scan-frame" />}
          </Surface>
          <View style={styles.row}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, flex: 1 }} testID="scan-hint">
              {result ? 'Code read.' : 'Point the camera at a QR code or a barcode.'}
            </Text>
            <IconButton icon="camera-flip-outline" onPress={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} accessibilityLabel="Switch camera" testID="scan-flip" />
          </View>
          {!error && !result && zoomCap && <ZoomControl zoom={zoom} range={zoomCap.range} onZoom={changeZoom} testID="scan-zoom" />}
        </Card.Content>
      </Card>
      {result && <ScanResultCard result={result} onScanAgain={() => { last.current = null; setResult(null); }} />}
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
  frame: { position: 'absolute', top: '22%', left: '16%', right: '16%', bottom: '22%', borderWidth: 3, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
});
