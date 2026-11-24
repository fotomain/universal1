// Identification: 1 ID card or passport? -> 2 photo of the machine readable zone -> 3 text recognised on the phone, values confirmed -> 4 NFC scan.
// Step 4 is the ID reader (../iddocread) unchanged, started with the confirmed values. Plan + decisions: documentation/PASSPORT_1ST_PHOTO_2ND_SCAN.html.
// Everything (values, text, photo) is wiped when the screen is left.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import IdCardReader from '../iddocread/IdCardReader';
import { normalizeStateCode } from '../iddocread/countries';
import DocumentTypeStep from './DocumentTypeStep';
import MrzConfirmStep from './MrzConfirmStep';
import MrzPhotoStep from './MrzPhotoStep';
import { ConfirmedValues, EMPTY_VALUES, Recognition } from './identificationTypes';
import { aiPossible, recognizeTextWithAi } from './aiRecognize';
import { recognitionFromAi } from './aiResult';
import { hasValues } from './confirmedValues';
import { useIsSignedIn } from '../../common/useWriteMediaPost';
import { loadLastDocumentType, saveLastDocumentType } from './lastDocumentType';
import type { ExpectedDocument } from './mrzFromText';
import { suppressBackgroundNfc } from '../nfcSuppress';

export type FlowStep = 'type' | 'photo' | 'confirm' | 'scan';

export default function IdentificationFlow() {
  const theme = useTheme();
  const [step, setStep] = useState<FlowStep>('type');
  const [docType, setDocType] = useState<'ID' | 'PASSPORT'>('ID');
  const [last, setLast] = useState<ExpectedDocument>(undefined);
  const [recognition, setRecognition] = useState<Recognition | null>(null);
  const [values, setValues] = useState<ConfirmedValues | null>(null);
  /** a new recognition replaces the editable values of the confirm step */
  const [version, setVersion] = useState(0);
  const signedIn = useIsSignedIn();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    void loadLastDocumentType().then(setLast);
  }, []);

  // the ID card touching the phone anywhere in this flow must not open the NFC screen (background tag)
  useFocusEffect(useCallback(() => suppressBackgroundNfc(), []));

  // the page starts at the top: the screen stays mounted in the Drawer, and after a reading the ID reader had scrolled it down to the "Create media post" button;
  // the wiped flow is short again, but the old scroll position stayed -> an EMPTY screen (seen on Android, 2026-11-23)
  const scrollToTop = useCallback(() => scrollRef.current?.scrollTo?.({ y: 0, animated: false }), []);

  // leaving the screen wipes everything; coming back starts at the top
  useFocusEffect(
    useCallback(() => {
      scrollToTop();
      return () => {
        setStep('type');
        setRecognition(null);
        setValues(null);
        scrollToTop();
      };
    }, [scrollToTop]),
  );

  // every step starts at the top (the scan step scrolls by itself once the reading is finished)
  useEffect(() => {
    scrollToTop();
  }, [step, scrollToTop]);

  /** the confirm step's button: Google AI extracts the values from the text this phone recognised */
  const askAi = async () => {
    if (!recognition) return;
    try {
      const fromText = recognitionFromAi(await recognizeTextWithAi(recognition.lines, docType), docType, 'text');
      setRecognition(hasValues(fromText.values) ? { ...fromText, lines: recognition.lines, notes: ['Google AI read the text that this phone recognised (no picture was sent).', ...fromText.notes] } : { ...recognition, notes: [...recognition.notes, ...fromText.notes] });
    } catch (e: any) {
      setRecognition({ ...recognition, notes: [...recognition.notes, `Google AI (text): ${e?.message ?? 'failed'}.`] });
    }
    setVersion((v) => v + 1);
  };

  const choose = (t: 'ID' | 'PASSPORT') => {
    setDocType(t);
    void saveLastDocumentType(t);
    setStep('photo');
  };

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container} testID="identification">
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }} testID="ident-progress">
        Step {{ type: 1, photo: 2, confirm: 3, scan: 4 }[step]} of 4 · {{ type: 'Document', photo: 'Photo', confirm: 'Check the values', scan: 'Scan the document' }[step]}
      </Text>
      {step === 'type' && <DocumentTypeStep last={last} onChoose={choose} onType={() => { setRecognition({ source: 'typed', lines: [], result: null, values: { ...EMPTY_VALUES }, confidence: 'unchecked', notes: [] }); setStep('confirm'); }} />}
      {step === 'photo' && (
        <MrzPhotoStep
          documentType={docType}
          onRecognized={(r) => { setRecognition(r); setStep('confirm'); }}
          onBack={() => setStep('type')}
        />
      )}
      {step === 'confirm' && (
        <MrzConfirmStep
          key={version}
          recognition={recognition}
          onAskAi={aiPossible(signedIn) ? askAi : undefined}
          onContinue={(v) => { setValues(v); setStep('scan'); }}
          onRetake={() => setStep('photo')}
          onBack={() => setStep('type')}
        />
      )}
      {step === 'scan' && values && (
        <View style={styles.scan}>
          <Pressable onPress={() => setStep('confirm')} accessibilityRole="link" hitSlop={8} style={styles.back} testID="ident-scan-back">
            <Text variant="labelLarge" style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>{'\u2190 Back to the values'}</Text>
          </Pressable>
          <IdCardReader
            embedded
            autoStart
            scrollRef={scrollRef}
            initialForm={{ documentNumber: values.documentNumber, birthDate: values.birthDate, expiryDate: values.expiryDate, can: values.can, country: values.country ? normalizeStateCode(values.country) : '' }}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // flexGrow + center: a short step (the first question) stands in the middle of the screen; a long one simply scrolls from the top
  container: { flexGrow: 1, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 12 },
  scan: { width: '100%', alignItems: 'center', gap: 8 },
  back: { alignSelf: 'center', paddingVertical: 2 },
});
