// Step 2 + 3: take a photo of the document (no strict frame: the whole document, anywhere in the picture) and read it.
//   * Google AI (Gemini), only when the user switched "Read with Google AI" on: the photo is sent to Google, the answer is checked with the check digits of the zone;
//   * this phone's text recognition (Google ML Kit / Apple Vision through expo-mlkit-ocr) otherwise, and as the fallback when Google AI fails.
// The photo is made upright and smaller (expo-image-manipulator), read, and DELETED at once: it is never shown in a list or saved.
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { ButtonPrimaryApp, ButtonSecondaryApp, SwitchApp, showErrorModal } from '../../../common';
import PinchZoomView from '../../common/PinchZoomView';
import ZoomControl from '../../common/ZoomControl';
import { canZoom, clampZoom, normalizeZoomRange } from '../../common/cameraZoom';
import { toFileUri } from '../../common/mediaSource';
import { useIsSignedIn } from '../../common/useWriteMediaPost';
import { aiConfig, aiPossible, recognizeTextWithAi, recognizeWithAi } from './aiRecognize';
import { loadAiConsent, loadAiTextConsent, saveAiConsent, saveAiTextConsent } from './aiConsent';
import { recognitionFromAi } from './aiResult';
import { hasValues, valuesOf } from './confirmedValues';
import type { MrzPhotoStepProps, Recognition } from './identificationTypes';
import { mrzFromText } from './mrzFromText';
import { ocrAvailable, recognizeLines } from './ocrEngine';

export type { Recognition, MrzPhotoStepProps };

/** the longest side of the photo given to the engines (a 12 MP photo is slow and no better) */
export const OCR_MAX_SIDE = 2000;

async function deleteQuietly(uri: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { File } = require('expo-file-system');
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}

/** this phone's recognition of the text lines as a Recognition */
export function deviceRecognition(lines: string[], documentType: 'ID' | 'PASSPORT'): Recognition {
  const result = mrzFromText(lines, documentType);
  const m = result?.mrz;
  return {
    source: 'device', lines, result, values: valuesOf(result), confidence: result ? result.confidence : 'unchecked', notes: [],
    printed: m ? { name: `${m.surname}${m.givenNames ? `, ${m.givenNames}` : ''}`, nationality: m.nationality, sex: m.sex } : undefined,
  };
}

export default function MrzPhotoStep({ documentType, onRecognized, onBack, recognize = recognizeLines, aiRecognize = recognizeWithAi, aiTextRecognize = (lines, type) => recognizeTextWithAi(lines, type) }: MrzPhotoStepProps) {
  const theme = useTheme();
  const camera = React.useRef<Camera>(null);
  const permission = useCameraPermission();
  const device = useCameraDevice('back');
  const signedIn = useIsSignedIn();
  const [focused, setFocused] = useState(true);
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState<'' | 'photo' | 'ocr' | 'ai'>('');
  const [aiOn, setAiOn] = useState(false);
  /** the recognised TEXT goes to Google AI by itself when this phone finds no valid zone (no picture is sent) */
  const [aiTextOn, setAiTextOn] = useState(true);
  const canAi = aiPossible(signedIn);
  const zoomRange = normalizeZoomRange({ min: device?.minZoom, max: device?.maxZoom, neutral: device?.neutralZoom });
  const [zoom, setZoom] = useState(zoomRange.neutral);
  useEffect(() => {
    setZoom(zoomRange.neutral);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.id]);
  useEffect(() => {
    void loadAiConsent().then(setAiOn);
    void loadAiTextConsent().then(setAiTextOn);
  }, []);
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

  const switchAiText = (on: boolean) => {
    setAiTextOn(on);
    void saveAiTextConsent(on);
  };

  const switchAi = (on: boolean) => {
    setAiOn(on);
    void saveAiConsent(on);
  };

  // the camera must stay ON while the photo is being taken (switching it off then = "Camera is closed"); it stops only while the text is read
  const take = async () => {
    if (!camera.current || busy) return;
    setBusy('photo');
    const files: string[] = [];
    try {
      const photo = await camera.current.takePhoto({ flash: 'off', enableShutterSound: true });
      files.push(toFileUri(photo.path));
      // upright (the camera file carries its rotation as a note) and not bigger than the engines need
      const small = await manipulateAsync(files[0], [{ resize: { width: OCR_MAX_SIDE } }], { compress: 0.85, format: SaveFormat.JPEG, base64: aiOn && canAi });
      files.push(small.uri);

      let recognition: Recognition | null = null;
      const notes: string[] = [];
      let aiFailed = false;
      if (aiOn && canAi && small.base64) {
        setBusy('ai');
        try {
          recognition = recognitionFromAi(await aiRecognize({ image: small.base64, mime: 'image/jpeg', documentType }), documentType);
        } catch (e: any) {
          notes.push(`Google AI: ${e?.message ?? 'failed'}. Read on this phone instead.`);
          aiFailed = true;
        }
        if (recognition && !hasValues(recognition.values) && !recognition.result) {
          // Google AI found nothing usable: give this phone's recognition a chance too
          notes.push(...recognition.notes);
          recognition = null;
        }
      }
      if (!recognition) {
        setBusy('ocr');
        const lines = await recognize(small.uri);
        recognition = deviceRecognition(lines, documentType);
        // this phone found no checked zone (the FRONT of an ID card has none): Google AI extracts the values from the recognised TEXT, automatically (no picture is sent)
        if (canAi && (aiOn || aiTextOn) && !aiFailed && lines.length && recognition.confidence !== 'checked') {
          setBusy('ai');
          try {
            const fromText = recognitionFromAi(await aiTextRecognize(lines, documentType), documentType, 'text');
            if (hasValues(fromText.values)) recognition = { ...fromText, lines, notes: ['Google AI read the text that this phone recognised (no picture was sent).', ...fromText.notes] };
            else notes.push(...fromText.notes);
          } catch (e: any) {
            notes.push(`Google AI (text): ${e?.message ?? 'failed'}.`);
          }
        }
      }
      recognition.notes = [...notes, ...recognition.notes];
      onRecognized(recognition);
    } catch (e) {
      showErrorModal(e, 'Read the photo');
    } finally {
      // the photo of an identity document is never kept
      await Promise.all(files.map(deleteQuietly));
      setBusy('');
    }
  };

  const ready = permission.hasPermission && !!device;
  const where = documentType === 'ID' ? 'Back of the ID card' : 'Photo page of the passport';
  return (
    <View style={styles.container} testID="ident-photo-root">
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="ident-step-photo">
        <Card.Content style={styles.content}>
          <Text variant="titleMedium">Photo of the document</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID="ident-photo-hint">
            {where}: hold the phone above the document, keep it flat and in good light, without glare. The whole document may be anywhere in the picture. The back of an ID card has the zone; the front also works with Google AI.
          </Text>
          {!aiOn && !ocrAvailable() && <Text variant="bodySmall" style={{ color: theme.colors.error }} testID="ident-ocr-missing">Text recognition is not available on this device: take the photo anyway or type the values.</Text>}
          <Surface style={styles.preview} elevation={2}>
            {!permission.hasPermission ? (
              <View style={styles.center}>
                <Text style={styles.light}>The camera is not allowed.</Text>
                <ButtonSecondaryApp onPress={() => permission.requestPermission()} testID="ident-allow">Allow the camera</ButtonSecondaryApp>
              </View>
            ) : !device ? (
              <View style={styles.center}><Text style={styles.light} testID="ident-nodevice">No camera was found on this device.</Text></View>
            ) : (
              <PinchZoomView style={StyleSheet.absoluteFill} zoom={zoom} range={zoomRange} onZoom={(z) => setZoom(clampZoom(z, zoomRange))} disabled={!canZoom(zoomRange)}>
                <Camera ref={camera} style={StyleSheet.absoluteFill} device={device} isActive={focused && busy !== 'ocr' && busy !== 'ai'} photo zoom={clampZoom(zoom, zoomRange)} torch={torch && device.hasTorch ? 'on' : 'off'} />
              </PinchZoomView>
            )}
          </Surface>
          {ready && <ZoomControl zoom={zoom} range={zoomRange} onZoom={(z) => setZoom(clampZoom(z, zoomRange))} testID="ident-zoom" />}
          <View style={styles.row}>
            <ButtonPrimaryApp icon="photo_camera" onPress={take} disabled={!ready || !!busy} loading={!!busy} testID="ident-take">
              {busy === 'ai' ? 'Google AI is reading…' : busy === 'ocr' ? 'Reading the text…' : 'Take photo'}
            </ButtonPrimaryApp>
            {!!device?.hasTorch && <IconButton icon={torch ? 'flashlight' : 'flashlight-off'} onPress={() => setTorch((t) => !t)} accessibilityLabel="Torch" testID="ident-torch" />}
          </View>
          <SwitchApp label="Read with Google AI" value={aiOn && canAi} onValueChange={switchAi} disabled={!canAi || !!busy} testID="ident-ai-switch" />
          <SwitchApp label="Let Google AI read the recognised text by itself" value={aiTextOn && canAi} onValueChange={switchAiText} disabled={!canAi || !!busy} testID="ident-ai-text-switch" />
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} testID="ident-ai-text-note">
            {!canAi
              ? 'Needs the Google AI key in the app or a signed-in user.'
              : aiTextOn
                ? 'On: when this phone finds no valid zone (the FRONT of an ID card has none), the recognised TEXT (names, numbers, dates) is sent to Google AI automatically - no picture.'
                : 'Off: the text stays on this phone; the button on the next screen can still ask Google AI.'}
          </Text>
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} testID="ident-ai-note">
            {!canAi
              ? 'Google AI needs the key in the app (.env GOOGLE_AI_API_KEY) or a signed-in user. The photo is read on this phone.'
              : aiOn
                ? "The photo is SENT to Google's Gemini API to read the text, then deleted here. Google's terms for the API apply."
                : 'Off: the photo is read on this phone only and never leaves it.'}
          </Text>
          <ButtonSecondaryApp onPress={onBack} disabled={!!busy} testID="ident-photo-back">Back</ButtonSecondaryApp>
        </Card.Content>
      </Card>
    </View>
  );
}

export { aiConfig };

const styles = StyleSheet.create({
  // no ScrollView of its own: the flow scrolls (a nested one took the width of its content and ran out of the screen)
  container: { width: '100%', alignItems: 'center' },
  card: { width: '100%', maxWidth: 640, borderRadius: 16, overflow: 'hidden' },
  content: { gap: 10 },
  preview: { width: '100%', aspectRatio: 3 / 4, maxHeight: 460, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  light: { color: '#fff', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
