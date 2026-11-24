// CreateListElementForm - the rules of a NEW element of a list of posts, pure (no React): the origin types, the check of the typed values, the rowJSON that is saved.
// The origin types are `DATA_ORIGIN_TYPE` (kit8/types/origin.ts): youtube, webpage, pdf, msword, msexcel, html, text and the two documents of a PERSON, personIDCard and personPassport.
import { DATA_ORIGIN_TYPE, DataOriginType } from '../../../../types/origin';
import type { ReusableTableRow, VisualColumn } from '../../table/reusable/reusableTableTypes';
import { buildPersonDocumentRowJSON, emptyPersonDocumentInput, personKindFolder, PersonDocumentErrors, PersonDocumentInput, PersonPhoto, validatePersonDocumentInput } from './personDocumentInputModel';
import { DATA_MANIPULATION_TYPE, DataManipulationType } from '../../../../types/manipulation';
import { dataManipulationVariants, getValidDataManipulations } from '../../../../types/dataManipulationVariants';

export const ELEMENT_ORIGIN_TYPES: DataOriginType[] = Object.values(DATA_ORIGIN_TYPE);

export const ORIGIN_LABEL: Record<DataOriginType, string> = {
  youtube: 'YouTube', webpage: 'Web page', pdf: 'PDF', msword: 'Word document', msexcel: 'Excel sheet', html: 'HTML', text: 'Text',
  personIDCard: 'Person - ID card', personPassport: 'Person - passport',
};

const MIME_OF_ORIGIN: Record<DataOriginType, string> = {
  youtube: 'youtube', webpage: 'text/html', pdf: 'application/pdf', msword: 'application/msword', msexcel: 'application/vnd.ms-excel',
  html: 'text/html', text: 'text/plain', personIDCard: 'application/x-person-document', personPassport: 'application/x-person-document',
};

/** the origin is a document of a person: the form asks for a name and a document number, not for an address */
export const isPersonOrigin = (origin: DataOriginType | string): boolean => origin === DATA_ORIGIN_TYPE.personIDCard || origin === DATA_ORIGIN_TYPE.personPassport;

export interface NewElementValues {
  origin: DataOriginType;
  url: string;
  /** the title of a post; the NAME of the owner for a person document */
  title: string;
  description: string;
  manipulation: DataManipulationType | '';
  /** person documents (personIDCard, personPassport): every datum of the document, as a scan gives it (PersonDocumentDataInput) */
  person: PersonDocumentInput;
  /** person documents: the owner photo (attached by the user) */
  photo: PersonPhoto | null;
}

export const emptyElementValues = (origin: DataOriginType = DATA_ORIGIN_TYPE.youtube): NewElementValues =>
  ({ origin, url: '', title: '', description: '', manipulation: defaultManipulation(origin), person: emptyPersonDocumentInput(), photo: null });

/** what may be done with the data of an origin: the matrix of kit8/types/dataManipulationVariants, all of them when the matrix has none for it (as the web form) */
export function manipulationsOf(origin: DataOriginType): DataManipulationType[] {
  if (isPersonOrigin(origin)) return [];
  const valid = getValidDataManipulations(origin, dataManipulationVariants);
  return valid.length > 0 ? valid : (Object.values(DATA_MANIPULATION_TYPE) as DataManipulationType[]);
}
export const defaultManipulation = (origin: DataOriginType): DataManipulationType | '' => manipulationsOf(origin)[0] ?? '';

export function isValidHttpUrl(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  try { const u = new URL(t); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

export interface NewElementErrors { title?: string; url?: string; person?: PersonDocumentErrors }

/** an empty object = the element may be created */
export function validateElement(values: NewElementValues): NewElementErrors {
  const errors: NewElementErrors = {};
  if (isPersonOrigin(values.origin)) {
    const person = validatePersonDocumentInput(values.person);
    if (Object.keys(person).length > 0) errors.person = person;
    return errors;
  }
  if (!values.title.trim()) errors.title = 'Title is required';
  if (!isValidHttpUrl(values.url)) errors.url = 'Invalid URL (must start with http:// or https://)';
  return errors;
}

/** the rowJSON of the new post (the same keys as the posts of the web list and the ID reader) */
export function buildElementRowJSON(values: NewElementValues, now: Date = new Date()): Record<string, any> {
  const title = values.title.trim();
  const description = values.description.trim();
  const base = { mediaPostTitle: title, mediaPostDescription: description, dataOriginName: values.origin, mediaPostMIME: MIME_OF_ORIGIN[values.origin], mediaCreatedAt: now.toISOString() };
  // a person's document: the rowJSON of the ID reader's post (every datum, the photo), see personDocumentInputModel.ts
  if (isPersonOrigin(values.origin)) return buildPersonDocumentRowJSON(values.person, values.origin === DATA_ORIGIN_TYPE.personPassport ? 'passport' : 'idCard', values.photo, now);
  const url = values.url.trim();
  return { ...base, mediaPostOrigin: url, mediaPostOriginType: url ? 'url' : 'text', ...(values.manipulation ? { dataManipulationName: values.manipulation } : {}) };
}

// ---- the three dots menu of the form: Export / Share of what is typed (the standard export + share of the lists, tableExportActions) ----
/** the typed values as the one row of a small table: what Export and Share write */
export const ELEMENT_EXPORT_COLUMNS: VisualColumn[] = [
  { key: 'origin', title: 'Origin type', type: 'text', field: 'dataOriginName' },
  { key: 'url', title: 'Origin URL', type: 'text', field: 'mediaPostOrigin' },
  { key: 'title', title: 'Title', type: 'text', field: 'mediaPostTitle' },
  { key: 'subtitle', title: 'Sub title', type: 'text', field: 'mediaPostSubTitle' },
  { key: 'description', title: 'Description', type: 'text', field: 'mediaPostDescription' },
  { key: 'manipulation', title: 'Data Manipulation', type: 'text', field: 'dataManipulationName' },
  { key: 'number', title: 'Document number', type: 'text', field: 'personDocumentNumber' },
];

export function elementExportRow(values: NewElementValues, now: Date = new Date()): ReusableTableRow {
  return { rowGUID: 'new-element', rowOwnerGUID: 'empty', rowParentGUID: 'empty', orderInList: 0, rowJSON: buildElementRowJSON(values, now) } as ReusableTableRow;
}

/** what goes with the new row but is not stored in it: the owner photo of a person document, for the file storage (the host uploads it when the post exists) */
export interface NewElementExtras { idPhoto?: { mime: string; base64: string; folder: 'idcard' | 'passport' } }
export function elementExtras(values: NewElementValues): NewElementExtras | undefined {
  if (!isPersonOrigin(values.origin) || !values.photo) return undefined;
  return { idPhoto: { mime: values.photo.mime, base64: values.photo.base64, folder: personKindFolder(values.origin === DATA_ORIGIN_TYPE.personPassport ? 'passport' : 'idCard') } };
}
