// What Google AI said about a photo of a document -> the values for the confirm step. Pure.
// The model reads text, but a language model can invent a character: the zone it returns goes through the SAME repair + check digits as the text of this
// phone's recognition (mrzFromText); the printed fields are only a second opinion. A value that passed its check digits is trusted, the others are shown as such.
import type { AiDocument } from '../../../../../../supabase/functions/identification-recognize/handler';
import { countryName } from '../iddocread/countries';
import { isoToDdmmyyyy, valuesOf } from './confirmedValues';
import { ConfirmedValues, EMPTY_VALUES, Recognition } from './identificationTypes';
import { ExpectedDocument, mrzFromText } from './mrzFromText';

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function recognitionFromAi(doc: AiDocument, expected?: ExpectedDocument, via: 'photo' | 'text' = 'photo'): Recognition {
  const notes: string[] = [];
  const result = doc.mrzLines.length ? mrzFromText(doc.mrzLines, expected) : null;
  const fields: ConfirmedValues = {
    documentNumber: (doc.documentNumber ?? '').replace(/</g, ''),
    birthDate: isoToDdmmyyyy(doc.dateOfBirth),
    expiryDate: isoToDdmmyyyy(doc.dateOfExpiry),
    country: doc.issuingCountry ?? '',
    can: doc.can ?? '',
  };
  const fieldsComplete = !!fields.documentNumber && !!fields.birthDate && !!fields.expiryDate;

  let values: ConfirmedValues = { ...EMPTY_VALUES };
  let confidence: Recognition['confidence'] = 'unchecked';
  if (result && result.confidence === 'checked') {
    values = valuesOf(result);
    confidence = 'checked';
    // a second opinion: the printed fields against the zone
    const z = values;
    if (fields.documentNumber && norm(fields.documentNumber) !== norm(z.documentNumber)) notes.push(`Google AI read the printed number as ${fields.documentNumber}, the zone says ${z.documentNumber}: compare with the document.`);
    if (fields.birthDate && fields.birthDate !== z.birthDate) notes.push(`Google AI read the printed date of birth as ${fields.birthDate}, the zone says ${z.birthDate}.`);
    if (fields.expiryDate && fields.expiryDate !== z.expiryDate) notes.push(`Google AI read the printed date of expiry as ${fields.expiryDate}, the zone says ${z.expiryDate}.`);
  } else if (fieldsComplete) {
    values = { ...fields };
    confidence = 'fields';
    notes.push(result ? 'The zone read by Google AI did not pass its check digits, so the printed fields are shown: compare each value with the document.' : 'No machine readable zone was read: the values come from the printed fields, which have no check digits. Compare each value with the document.');
  } else if (result) {
    values = valuesOf(result);
    confidence = result.confidence;
  } else {
    notes.push(doc.notes ? `Google AI: ${doc.notes}` : 'Google AI found no machine readable zone in the photo.');
  }
  if (doc.quality === 'poor' && doc.notes && !notes.some((n) => n.includes(doc.notes as string))) notes.push(`Picture quality is poor: ${doc.notes}`);
  if (!values.country) values.country = result?.mrz.issuingState ?? fields.country;
  values.can = fields.can;
  if (values.can) {
    notes.push(`Google AI found a CAN (${values.can}) printed on the document: it is used to open the chip, check it.`);
  } else if (doc.canCandidate) {
    // a lone 6 digit number without a label (the front of a Latvian ID card has one): maybe the CAN. Filled in; if it is not the CAN the reader falls back to the number and the dates.
    values.can = doc.canCandidate;
    notes.push(`A number printed without a label (${doc.canCandidate}) may be the CAN: it is filled in, check it. If it is not the CAN the scan uses the document number and the dates.`);
  }

  const m = result?.mrz;
  const printed = m
    ? { name: `${m.surname}${m.givenNames ? `, ${m.givenNames}` : ''}`, nationality: countryName(m.nationality), sex: m.sex }
    : doc.surname || doc.givenNames
      ? { name: [doc.surname, doc.givenNames].filter(Boolean).join(', '), nationality: countryName(doc.nationality), sex: doc.sex ?? '' }
      : undefined;
  return { source: via === 'text' ? 'ai-text' : 'ai', lines: doc.mrzLines, result, values, confidence, notes, printed };
}
