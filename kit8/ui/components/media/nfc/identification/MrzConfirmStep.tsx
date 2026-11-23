// Step 3b: the values the recognition found (or empty when typed), editable, with how far they can be trusted. The NFC scan starts only after the user confirms:
// some national cards count wrong passwords, so a wrong value must not be sent by itself.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { ButtonPrimaryApp, ButtonSecondaryApp, TextInputApp } from '../../../common';
import { isValidYyMmDd, toYyMmDd } from '../iddocread/mrz';
import { valuesOf } from './confirmedValues';
import { ConfirmedValues, EMPTY_VALUES, Recognition } from './identificationTypes';

export { valuesOf };
export type { ConfirmedValues };

export interface MrzConfirmStepProps {
  recognition: Recognition | null;
  onContinue: (v: ConfirmedValues) => void;
  onRetake: () => void;
  onBack: () => void;
  /** Google AI extracts the values from the recognised text (shown when this phone found no checked zone); the flow replaces the recognition */
  onAskAi?: () => Promise<void>;
}

const MESSAGE = {
  checked: 'All check digits of the zone agree: the values are very probably right.',
  partly: 'The three values agree with their check digits, the last check digit does not: compare with the document.',
  unchecked: 'A check digit does not agree: the recognition made a mistake. Compare each value with the document and correct it.',
  fields: 'Read from the printed fields (no check digits exist for them): compare each value with the document.',
} as const;

const SOURCE = { ai: 'Read by Google AI', 'ai-text': 'Values extracted by Google AI from the recognised text', device: 'Read on this phone', typed: 'Typed' } as const;

export default function MrzConfirmStep({ recognition, onContinue, onRetake, onBack, onAskAi }: MrzConfirmStepProps) {
  const theme = useTheme();
  const initial: ConfirmedValues = recognition?.values ?? { ...EMPTY_VALUES };
  const [v, setV] = useState<ConfirmedValues>(initial);
  const [showLines, setShowLines] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [asking, setAsking] = useState(false);
  const valid = v.documentNumber.trim().length >= 3 && isValidYyMmDd(toYyMmDd(v.birthDate)) && isValidYyMmDd(toYyMmDd(v.expiryDate)) && (!v.can || /^\d{4,8}$/.test(v.can));
  const m = recognition?.result?.mrz;
  const mark = (ok: boolean | null | undefined, edited: boolean) => (edited ? ' ✎' : ok === true ? ' ✓' : ok === false ? ' ✗' : '');
  const lines = recognition?.lines ?? [];
  // Google AI was asked by itself after the photo and failed: said in the main line, not only behind "more..."
  const aiTextFailure = (recognition?.notes ?? []).find((n) => n.startsWith('Google AI (text):'));
  // always visible while there is recognised text (a device or a text-AI recognition): to ask again after a failure, or to check a zone that passed
  const canAsk = !!onAskAi && !!recognition && (recognition.source === 'device' || recognition.source === 'ai-text') && lines.length > 0;
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="ident-step-confirm">
      <Card.Content style={styles.content}>
        <Text variant="titleMedium">Check the values</Text>
        {/* the info texts: ONE line (the main message) + "more…"; the source and the notes show after the press */}
        {(() => {
          const main = recognition && (recognition.values.documentNumber || recognition.result) ? (
            <Text variant="bodySmall" style={[styles.flex, { color: recognition.confidence === 'checked' ? theme.colors.primary : theme.colors.error }]} numberOfLines={showInfo ? undefined : 1} testID="ident-confidence">{MESSAGE[recognition.confidence]}</Text>
          ) : (
            <Text variant="bodySmall" style={[styles.flex, { color: theme.colors.onSurfaceVariant }]} numberOfLines={showInfo ? undefined : 1} testID="ident-no-zone">
              {recognition && recognition.source !== 'typed' && aiTextFailure ? `${aiTextFailure} Press "Ask Google AI to read the recognised text" below to try again, retake the photo, or type the values.` : recognition && recognition.source !== 'typed' ? 'No machine readable zone was found in the photo (this may be the FRONT of the card: the zone is on the back). Retake the photo of the back, ask Google AI to read the text below, or type the values.' : 'Type the three values printed in the machine readable zone.'}
            </Text>
          );
          const hasSource = !!recognition && recognition.source !== 'typed';
          const notes = recognition?.notes ?? [];
          const hasMore = hasSource || notes.length > 0;
          return (
            <View style={{ gap: 4 }}>
              {showInfo && hasSource && <Text variant="labelMedium" style={{ color: theme.colors.primary }} testID="ident-source">{SOURCE[recognition!.source as keyof typeof SOURCE]}</Text>}
              <View style={styles.infoRow}>
                {main}
                {hasMore && !showInfo && (
                  <Pressable onPress={() => setShowInfo(true)} accessibilityRole="button" hitSlop={8} testID="ident-info-more"><Text variant="labelMedium" style={{ color: theme.colors.primary }}>more...</Text></Pressable>
                )}
              </View>
              {showInfo && notes.map((n, i) => <Text key={i} variant="bodySmall" style={{ color: theme.colors.tertiary }} testID={`ident-note-${i}`}>{n}</Text>)}
              {showInfo && hasMore && (
                <Pressable onPress={() => setShowInfo(false)} accessibilityRole="button" hitSlop={8} testID="ident-info-less"><Text variant="labelMedium" style={{ color: theme.colors.primary }}>less</Text></Pressable>
              )}
            </View>
          );
        })()}
        <TextInputApp label={`Document number${mark(m?.documentNumber.valid, v.documentNumber !== initial.documentNumber)}`} value={v.documentNumber} onChangeText={(t: string) => setV({ ...v, documentNumber: t.toUpperCase().replace(/\s/g, '') })} autoCapitalize="characters" testID="ident-number" />
        <TextInputApp label={`Date of birth (DD.MM.YYYY)${mark(m?.birthDate.valid, v.birthDate !== initial.birthDate)}`} value={v.birthDate} onChangeText={(t: string) => setV({ ...v, birthDate: t })} testID="ident-birth" />
        <TextInputApp label={`Date of expiry (DD.MM.YYYY)${mark(m?.expiryDate.valid, v.expiryDate !== initial.expiryDate)}`} value={v.expiryDate} onChangeText={(t: string) => setV({ ...v, expiryDate: t })} testID="ident-expiry" />
        <TextInputApp label="CAN (6 digits on the front of some ID cards, optional)" value={v.can} onChangeText={(t: string) => setV({ ...v, can: t.replace(/[^\d]/g, '').slice(0, 8) })} keyboardType="numeric" testID="ident-can" />
        {recognition?.printed && (
          <View testID="ident-printed">
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Printed on the document (not verified by the chip)</Text>
            <Text variant="bodyMedium">{recognition.printed.name} · {recognition.printed.nationality} · {recognition.printed.sex || '-'}</Text>
          </View>
        )}
        {canAsk && (
          <View style={{ gap: 4 }}>
            <ButtonPrimaryApp icon="auto_awesome" onPress={async () => { setAsking(true); try { await onAskAi!(); } finally { setAsking(false); } }} loading={asking} disabled={asking} testID="ident-ask-ai">
              {recognition?.source === 'ai-text' ? 'Ask Google AI again to read the recognised text' : 'Ask Google AI to read the recognised text'}
            </ButtonPrimaryApp>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} testID="ident-ask-ai-note">The recognised text below (names, numbers, dates) is SENT to Google; no picture is sent.</Text>
          </View>
        )}
        {!!lines.length && <ButtonSecondaryApp onPress={() => setShowLines((s) => !s)} testID="ident-lines-toggle">{showLines ? 'Hide' : 'Show'} recognised text</ButtonSecondaryApp>}
        {showLines && lines.map((l, i) => <Text key={i} variant="bodySmall" style={styles.mono} testID={`ident-line-${i}`}>{l}</Text>)}
        <ButtonPrimaryApp icon="nfc" onPress={() => onContinue(v)} disabled={!valid} testID="ident-continue">Continue to the scan</ButtonPrimaryApp>
        <View style={styles.row}>
          <ButtonSecondaryApp icon="photo_camera" onPress={onRetake} testID="ident-retake">Retake photo</ButtonSecondaryApp>
          <ButtonSecondaryApp onPress={onBack} testID="ident-confirm-back">Back</ButtonSecondaryApp>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  content: { gap: 8 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  infoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  flex: { flex: 1 },
  mono: { fontFamily: 'monospace' },
});
