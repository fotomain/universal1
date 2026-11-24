// PersonDocumentDataInput - the inputs of a person's ID CARD / PASSPORT in the Add form (origin types personIDCard, personPassport): the SAME data a scan gives
// (surname, given names, sex, date and place of birth, nationality, personal number, address, document number, issuing state, dates, issued by), and the OWNER PHOTO:
// "Attach photo" picks a picture (web: file dialog, phone: the picker), it is made a small JPEG, shown here, saved in the post and uploaded to the file storage of the organization
// (identification/idcard | passport/<post>). Presentational: the values live in CreateListElementForm. Model: personDocumentInputModel.ts.
import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import TextInputApp from '../../common/TextInputApp';
import TextAreaApp from '../../common/TextAreaApp';
import SelectorFromApp from '../../common/SelectorFromApp';
import DateInputApp from '../../common/date_input/DateInputApp';
import ButtonSecondaryApp from '../../common/ButtonSecondaryApp';
import ButtonTextApp from '../../common/ButtonTextApp';
import { countryName } from '../../media/nfc/iddocread/countries';
import { formatDmy, parseDmy, PersonDocumentErrors, PersonDocumentInput, personKindFolder, PersonPhoto, PersonSex, SEX_OPTIONS } from './personDocumentInputModel';
import { pickPersonPhoto } from './personPhoto';

export interface PersonDocumentDataInputProps {
  kind: 'idCard' | 'passport';
  value: PersonDocumentInput;
  onChange: (patch: Partial<PersonDocumentInput>) => void;
  photo: PersonPhoto | null;
  onPhotoChange: (photo: PersonPhoto | null) => void;
  /** shown under the inputs that are wrong (the form shows them after the first press of Add) */
  errors?: PersonDocumentErrors;
  /** replaceable for tests */
  pickPhoto?: typeof pickPersonPhoto;
  testID?: string;
}

function Section({ title, testID }: { title: string; testID: string }) {
  const theme = useTheme();
  return <Text variant="titleSmall" style={[styles.section, { color: theme.colors.primary }]} testID={testID}>{title}</Text>;
}

export default function PersonDocumentDataInput({ kind, value: v, onChange, photo, onPhotoChange, errors = {}, pickPhoto = pickPersonPhoto, testID = 'person-input' }: PersonDocumentDataInputProps) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [photoProblem, setPhotoProblem] = useState('');
  const isPassport = kind === 'passport';
  const text = (key: keyof PersonDocumentInput) => (t: string) => onChange({ [key]: t } as Partial<PersonDocumentInput>);
  const upper = (key: keyof PersonDocumentInput, max = 0) => (t: string) => onChange({ [key]: (max ? t.slice(0, max) : t).toUpperCase() } as Partial<PersonDocumentInput>);

  const attach = async () => {
    setBusy(true);
    setPhotoProblem('');
    try {
      const p = await pickPhoto();
      if (p) onPhotoChange(p);
    } catch (e: any) {
      setPhotoProblem(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const date = (key: 'birthDate' | 'issueDate' | 'expiryDate', label: string) => (
    <DateInputApp testID={`${testID}-${key}`} label={label} value={v[key]} placeholder="DD.MM.YYYY" parse={parseDmy} format={formatDmy} error={errors[key]}
      onChangeText={text(key)} onSelectDate={(d) => { if (d) onChange({ [key]: formatDmy(d) } as Partial<PersonDocumentInput>); }} />
  );
  // undefined, never '': an empty string in `helperText` would be drawn as a text node inside a View ("Unexpected text node")
  const stateHint = (code: string): string | undefined => (code.trim() ? countryName(code) : undefined);

  return (
    <View testID={testID} style={styles.box}>
      <Section testID={`${testID}-section-owner`} title="Owner" />
      <TextInputApp testID={`${testID}-surname`} label="Surname" value={v.surname} onChangeText={upper('surname')} autoCapitalize="characters" autoFocus errorCheck={() => errors.surname ?? null} />
      <TextInputApp testID={`${testID}-givenNames`} label="Given names" value={v.givenNames} onChangeText={upper('givenNames')} autoCapitalize="characters" errorCheck={() => errors.givenNames ?? null} />
      <SelectorFromApp<PersonSex> testID={`${testID}-sex`} label="Sex" value={v.sex} onValueChange={(sex) => onChange({ sex })} options={SEX_OPTIONS} />
      {date('birthDate', 'Date of birth')}
      <TextInputApp testID={`${testID}-placeOfBirth`} label="Place of birth" value={v.placeOfBirth} onChangeText={text('placeOfBirth')} />
      <TextInputApp testID={`${testID}-nationality`} label="Nationality (3 letters, e.g. LVA)" value={v.nationality} onChangeText={upper('nationality', 3)} autoCapitalize="characters"
        helperText={stateHint(v.nationality)} errorCheck={() => errors.nationality ?? null} />
      <TextInputApp testID={`${testID}-personalNumber`} label="Personal number" value={v.personalNumber} onChangeText={text('personalNumber')} />
      <TextAreaApp testID={`${testID}-address`} label="Address" value={v.address} onChangeText={text('address')} numberOfLines={2} />

      <Section testID={`${testID}-section-document`} title={isPassport ? 'Passport' : 'ID card'} />
      <TextInputApp testID={`${testID}-documentNumber`} label="Document number" value={v.documentNumber} onChangeText={upper('documentNumber')} autoCapitalize="characters" errorCheck={() => errors.documentNumber ?? null} />
      <TextInputApp testID={`${testID}-issuingState`} label="Issuing state (3 letters, e.g. LVA)" value={v.issuingState} onChangeText={upper('issuingState', 3)} autoCapitalize="characters"
        helperText={stateHint(v.issuingState)} errorCheck={() => errors.issuingState ?? null} />
      {date('issueDate', 'Date of issue')}
      {date('expiryDate', 'Valid until')}
      <TextInputApp testID={`${testID}-issuedBy`} label="Issued by" value={v.issuedBy} onChangeText={text('issuedBy')} />
      <TextAreaApp testID={`${testID}-notes`} label="Notes" value={v.notes} onChangeText={text('notes')} numberOfLines={2} />

      <Section testID={`${testID}-section-photo`} title="Photo of the document" />
      <View style={styles.photoRow}>
        <View style={[styles.photoBox, { backgroundColor: theme.colors.surfaceVariant }]}>
          {photo ? <Image source={{ uri: photo.dataUri }} style={styles.photo} resizeMode="contain" testID={`${testID}-photo`} />
            : <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }} testID={`${testID}-no-photo`}>No photo</Text>}
        </View>
        <View style={styles.photoButtons}>
          <ButtonSecondaryApp testID={`${testID}-attach`} icon="attach_file" onPress={attach} disabled={busy}>{busy ? 'Reading the picture…' : photo ? 'Replace photo' : 'Attach photo'}</ButtonSecondaryApp>
          {photo ? <ButtonTextApp testID={`${testID}-remove-photo`} icon="delete" title="Remove photo" onPress={() => { setPhotoProblem(''); onPhotoChange(null); }} /> : null}
        </View>
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }} testID={`${testID}-photo-hint`}>
        {`The photo is saved with the post and uploaded to the file storage of the organization (identification/${personKindFolder(kind)}).`}
      </Text>
      {photoProblem ? <Text variant="bodySmall" style={{ color: theme.colors.error }} testID={`${testID}-photo-problem`}>{photoProblem}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 2 },
  section: { marginTop: 10, marginBottom: 2 },
  photoRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginVertical: 4 },
  photoBox: { width: 96, height: 124, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoButtons: { flex: 1, alignItems: 'flex-start', gap: 4 },
});
