// The ID card / passport reader screen (route /media/nfc/iddocread). The user gives the password of the document (CAN, or the MRZ values), holds the
// document to the back of the phone, and sees what the chip says. NOTHING is stored or sent unless the user presses "Create media post" (IdCardPostOffer: the owner's name + the document number); the data lives in the state of this screen and is
// wiped by Clear and when the screen is left.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { ButtonPrimaryApp, ButtonSecondaryApp, TextInputApp } from '../../../common';
import { countryName, normalizeStateCode } from './countries';
import { countryNote, GENERAL_LIMITS, PASSPORT_NOTE } from './countryNotes';
import type { IdDocument, ReadOptions } from './emrtd';
import { isoDepSupported } from './idTransport';
import { fullDate, isValidYyMmDd, MrzAccess, parseMrz, toYyMmDd, accessFromMrz } from './mrz';
import IdCardPostOffer from './IdCardPostOffer';
import ReadFromDocumentButton from './ReadFromDocumentButton';
import type { ProbeResult } from './probe';
import { useIdReader } from './useIdReader';
import { suppressBackgroundNfc } from '../nfcSuppress';
import { scrollNodeIntoView } from './scrollToNode';
import { useFaceImage } from './useFaceImage';

export interface IdForm {
  country: string;
  can: string;
  documentNumber: string;
  birthDate: string;
  expiryDate: string;
  mrzLines: string;
}

export const EMPTY_FORM: IdForm = { country: '', can: '', documentNumber: '', birthDate: '', expiryDate: '', mrzLines: '' };

/** what the form gives the reader, or the reasons it cannot read yet */
export function formToOptions(form: IdForm): { options: Omit<ReadOptions, 'onStep'> | null; problems: string[] } {
  const problems: string[] = [];
  const options: Omit<ReadOptions, 'onStep'> = {};
  const can = form.can.replace(/\s/g, '');
  if (can) {
    if (!/^\d{4,8}$/.test(can)) problems.push('The CAN is 6 digits (printed on the card).');
    else options.can = can;
  }
  const number = form.documentNumber.trim();
  const dob = toYyMmDd(form.birthDate);
  const doe = toYyMmDd(form.expiryDate);
  const anyMrz = number || form.birthDate.trim() || form.expiryDate.trim();
  if (anyMrz) {
    if (!number) problems.push('Enter the document number.');
    if (!isValidYyMmDd(dob)) problems.push('The date of birth is not a date (DD.MM.YYYY).');
    if (!isValidYyMmDd(doe)) problems.push('The date of expiry is not a date (DD.MM.YYYY).');
    if (number && isValidYyMmDd(dob) && isValidYyMmDd(doe)) options.mrz = { documentNumber: number.toUpperCase().replace(/\s/g, ''), birthDate: dob, expiryDate: doe } as MrzAccess;
  }
  // nothing typed is fine: the document is looked at without a password
  return { options: problems.length ? null : options, problems };
}

/** pasted MRZ lines fill the number and the dates (and the country) */
export function applyMrzLines(form: IdForm, lines: string): IdForm {
  const mrz = parseMrz(lines);
  if (!mrz) return { ...form, mrzLines: lines };
  const a = accessFromMrz(mrz);
  return {
    ...form, mrzLines: lines, documentNumber: a.documentNumber.replace(/</g, ''), birthDate: fullDate(a.birthDate, 'birth').split('-').reverse().join('.'),
    expiryDate: fullDate(a.expiryDate, 'expiry').split('-').reverse().join('.'), country: normalizeStateCode(mrz.issuingState) === 'D' ? 'DEU' : form.country || mrz.issuingState,
  };
}

const ICON: Record<string, string> = { ok: '✓', fail: '✗', run: '…', skip: '–', info: 'i' };

function Row({ label, value, testID }: { label: string; value?: string; testID?: string }) {
  const theme = useTheme();
  if (!value) return null;
  return (
    <View style={styles.row} testID={testID}>
      <Text variant="labelMedium" style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text variant="bodyLarge" selectable style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export { useFaceImage };

export function DocumentView({ doc }: { doc: IdDocument }) {
  const theme = useTheme();
  const m = doc.mrz;
  const face = useFaceImage(doc.photo);
  const photoOk = !!face.uri;
  const bad = doc.integrity?.results.filter((r) => r.ok === false) ?? [];
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="id-document">
      <Card.Content>
        <Text variant="labelLarge" style={{ color: bad.length ? theme.colors.error : theme.colors.primary }} testID="id-document-head">
          {countryName(m?.issuingState)} · {m?.documentCode || 'document'} · opened with {doc.protocol}
        </Text>
        {photoOk && <Image source={{ uri: face.uri }} style={styles.photo} resizeMode="contain" testID="id-photo" />}
        {!!doc.photo && face.converting && <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID="id-photo-converting">Preparing the photo (JPEG 2000)…</Text>}
        {!!doc.photo && !photoOk && !face.converting && <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID="id-photo-jp2">The face image is JPEG 2000 and could not be converted for this phone; it is kept in the file storage.</Text>}
        <Row label="Surname" value={m?.surname} testID="id-surname" />
        <Row label="Given names" value={m?.givenNames} />
        <Row label="Document number" value={m?.documentNumber.value} />
        <Row label="Nationality" value={m ? countryName(m.nationality) : ''} />
        <Row label="Date of birth" value={m ? fullDate(m.birthDate.value, 'birth') : ''} />
        <Row label="Sex" value={m?.sex} />
        <Row label="Date of expiry" value={m ? fullDate(m.expiryDate.value, 'expiry') : ''} />
        <Row label="Optional data" value={m?.optionalData} />
        {m && <Row label="MRZ check digits" value={m.allValid ? 'all correct' : 'one is wrong'} testID="id-checkdigits" />}
        <Row label="Personal number" value={doc.details?.personalNumber} />
        <Row label="Place of birth" value={doc.details?.placeOfBirth.join(', ')} />
        <Row label="Address" value={doc.details?.address.join(', ')} />
        <Row label="Telephone" value={doc.details?.telephone} />
        <Row label="Profession" value={doc.details?.profession} />
        <Row label="Issued by" value={doc.document?.issuingAuthority} />
        <Row label="Date of issue" value={doc.document?.dateOfIssue} />
        <Row label="Serial number" value={doc.document?.serialNumber} />
        {doc.integrity && (
          <Text variant="bodyMedium" style={{ color: bad.length ? theme.colors.error : theme.colors.onSurfaceVariant, marginTop: 10 }} testID="id-integrity">
            {bad.length ? `NOT matching the signed hashes: ${bad.map((b) => `DG${b.dg}`).join(', ')}` : `Data groups match the signed hashes (${doc.integrity.algorithm}): ${doc.integrity.results.map((r) => `DG${r.dg}`).join(', ')}`}
          </Text>
        )}
        {doc.warnings.map((w, i) => (
          <Text key={i} variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }} testID={`id-warning-${i}`}>{w}</Text>
        ))}
      </Card.Content>
    </Card>
  );
}

/** what the document said without a password */
export function ProbeReport({ probe, needsPassword }: { probe: ProbeResult; needsPassword: boolean }) {
  const theme = useTheme();
  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="id-probe">
      <Card.Content style={styles.content}>
        <Text variant="labelLarge" style={{ color: needsPassword ? theme.colors.tertiary : theme.colors.primary }} testID="id-probe-kind">
          {probe.kind === 'travel-document' ? 'Travel document (passport / ID card)' : probe.kind === 'bank-card' ? 'Payment card' : probe.kind === 'eid-only' ? 'Card with national applications' : 'Unknown card'}
        </Text>
        {probe.lines.map((l, i) => <Text key={i} variant="bodyMedium" testID={`id-probe-line-${i}`}>{l}</Text>)}
        {probe.applications.map((a, i) => (
          <Text key={a.aid} variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID={`id-probe-app-${i}`}>
            • {a.name || a.label || 'application'} ({a.aid})
          </Text>
        ))}
      </Card.Content>
    </Card>
  );
}

export interface IdCardReaderProps {
  /** values to start with (the identification flow gives the ones recognised from the photo) */
  initialForm?: Partial<IdForm>;
  /** inside another scrolling screen (the identification flow): no ScrollView of its own, it takes the width of the parent */
  embedded?: boolean;
  /** the ScrollView that holds this reader when it is embedded: the screen scrolls it to the Create media post button when the reading is done */
  scrollRef?: React.RefObject<any>;
  /** the reading starts BY ITSELF when the screen opens: it waits for the document, and starts when the document is held (the button stays for a new reading) */
  autoStart?: boolean;
}

export default function IdCardReader({ initialForm, embedded, scrollRef, autoStart }: IdCardReaderProps = {}) {
  const theme = useTheme();
  const reader = useIdReader();
  const [form, setForm] = useState<IdForm>({ ...EMPTY_FORM, ...initialForm });
  const set = (patch: Partial<IdForm>) => setForm((f) => ({ ...f, ...patch }));
  const { options, problems } = useMemo(() => formToOptions(form), [form]);
  const note = form.country ? countryNote(form.country) : null;
  const supported = isoDepSupported();
  const busy = reader.state === 'reading';
  const Wrapper: any = embedded ? View : ScrollView;
  const ownScroll = useRef<any>(null);
  const wrapperProps = embedded ? { style: styles.container } : { contentContainerStyle: styles.container, ref: ownScroll };
  const offerRef = useRef<any>(null);

  // the reading is finished: scroll down to the button "Create media post" (a moment later, when the data and the photo are laid out)
  const finished = reader.state === 'done' && !!reader.document;
  useEffect(() => {
    if (!finished) return undefined;
    const timer = setTimeout(() => scrollNodeIntoView(offerRef.current, (embedded ? scrollRef?.current : ownScroll.current) ?? null), 300);
    return () => clearTimeout(timer);
  }, [finished, embedded, scrollRef]);

  // autoStart: the reading begins when the screen gets focus (it waits for the document, the first hold starts it)
  const optionsRef = useRef(options);
  optionsRef.current = options;
  useFocusEffect(
    useCallback(() => {
      if (autoStart && supported && optionsRef.current) void reader.read(optionsRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart, supported]),
  );

  // the card touching the phone here must not open the NFC screen (background tag)
  useFocusEffect(useCallback(() => suppressBackgroundNfc(), []));

  // leaving the screen wipes everything the card said
  useFocusEffect(
    useCallback(() => () => {
      reader.clear();
      setForm(EMPTY_FORM);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const clearAll = () => {
    reader.clear();
    setForm(EMPTY_FORM);
  };

  return (
    <Wrapper {...wrapperProps}>
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={3} testID="id-reader">
        <Card.Content style={styles.content}>
          {/* the FIRST control of the screen: one press, no input */}
          <ReadFromDocumentButton onPress={() => options && reader.read(options)} busy={busy} disabled={!supported || !options} withPassword={!!(options?.can || options?.mrz)} auto={autoStart} />
          {!supported && <Text variant="bodyMedium" style={{ color: theme.colors.error }} testID="id-unsupported">A browser cannot read an ID card or passport over NFC. Use the phone app.</Text>}
          <View style={styles.buttons}>
            <ButtonSecondaryApp icon="delete" onPress={clearAll} testID="id-clear">
              Clear
            </ButtonSecondaryApp>
          </View>
        </Card.Content>
      </Card>

      {reader.probe && <ProbeReport probe={reader.probe} needsPassword={reader.state === 'needs-password'} />}
      {reader.steps.length > 0 && (
        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2} testID="id-steps">
          <Card.Content>
            <Text variant="labelLarge">Steps</Text>
            {reader.steps.map((s) => (
              <Text key={s.id} variant="bodySmall" style={{ color: s.status === 'fail' ? theme.colors.error : theme.colors.onSurfaceVariant }} testID={`id-step-${s.id}`}>
                {ICON[s.status]} {s.label}{s.detail ? ` - ${s.detail}` : ''}
              </Text>
            ))}
          </Card.Content>
        </Card>
      )}
      {reader.state === 'error' && <Text variant="bodyMedium" style={[styles.error, { color: theme.colors.error }]} testID="id-error">{reader.error}</Text>}
      {reader.document && !reader.document.mrz && !reader.document.photo && !reader.document.details && !reader.document.document && (
        <Text variant="bodyMedium" style={[styles.error, { color: theme.colors.error }]} testID="id-empty-reading">
          The chip opened, but none of its files could be read (see the answers of the card in the steps above), so there is nothing to keep as a media post. Hold the document still and read it again.
        </Text>
      )}
      {reader.document && <DocumentView doc={reader.document} />}
      {/* only when the user asks: the owner's name + the document number become a media post */}
      {reader.document && <View ref={offerRef} collapsable={false} testID="id-post-anchor"><IdCardPostOffer doc={reader.document} /></View>}

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={2} testID="id-password">
        <Card.Content style={styles.content}>
          <Text variant="titleMedium" style={reader.state === 'needs-password' ? { color: theme.colors.tertiary } : undefined} testID="id-password-title">
            {reader.state === 'needs-password' ? 'This document needs its password' : 'Password of the document (only if it asks for one)'}
          </Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{PASSPORT_NOTE}</Text>
          <TextInputApp label="Issuing country (3 letters, e.g. LVA)" value={form.country} onChangeText={(t: string) => set({ country: t.toUpperCase().slice(0, 3) })} autoCapitalize="characters" testID="id-country" />
          {!!form.country && <Text variant="labelMedium" style={{ color: theme.colors.primary }} testID="id-country-name">{countryName(form.country)}</Text>}
          {note && <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID="id-country-note">{note.text}</Text>}
          <TextInputApp label="CAN (6 digits on the card, if it has one)" value={form.can} onChangeText={(t: string) => set({ can: t.replace(/[^\d]/g, '').slice(0, 8) })} keyboardType="numeric" testID="id-can" />
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>or the three values of the machine readable zone</Text>
          <TextInputApp label="Document number" value={form.documentNumber} onChangeText={(t: string) => set({ documentNumber: t.toUpperCase() })} autoCapitalize="characters" testID="id-number" />
          <TextInputApp label="Date of birth (DD.MM.YYYY)" value={form.birthDate} onChangeText={(t: string) => set({ birthDate: t })} testID="id-birth" />
          <TextInputApp label="Date of expiry (DD.MM.YYYY)" value={form.expiryDate} onChangeText={(t: string) => set({ expiryDate: t })} testID="id-expiry" />
          <TextInputApp label="or paste the MRZ lines" value={form.mrzLines} onChangeText={(t: string) => setForm((f) => applyMrzLines(f, t))} multiline numberOfLines={3} autoCapitalize="characters" testID="id-mrz-lines" />
          {problems.map((p, i) => <Text key={i} variant="bodySmall" style={{ color: theme.colors.error }} testID={`id-problem-${i}`}>{p}</Text>)}
        </Card.Content>
      </Card>

      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]} elevation={1} testID="id-limits">
        <Card.Content>
          <Text variant="labelLarge">What this reader does</Text>
          {GENERAL_LIMITS.map((l, i) => <Text key={i} variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>• {l}</Text>)}
        </Card.Content>
      </Card>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', padding: 16, alignItems: 'center', gap: 12 },
  card: { width: '100%', maxWidth: 640, borderRadius: 16 },
  content: { gap: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 6 },
  rowLabel: { width: 120 },
  rowValue: { flex: 1 },
  photo: { width: 160, height: 200, marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#00000010' },
  error: { width: '100%', maxWidth: 640 },
});
