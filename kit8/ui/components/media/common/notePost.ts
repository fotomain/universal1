// The media post that the result of a scan becomes: a QR / barcode, an NFC tag (a note: nothing to play) or a photo.
// Pure: no redux, no native module. The list (mediaPostList.ts) shows a post with no `mediaKind` as "what it is · when".
import type { RecordingPost } from './mediaPost';
import { extensionOf } from './mediaSource';

export type ResultPostSource = 'scan' | 'nfc' | 'photo' | 'idcard';

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export interface ScanPostInput {
  ownerGUID: string;
  rowGUID: string;
  /** 'web' | 'ios' | 'android' */
  platform: string;
  /** what the code says */
  value: string;
  /** 'QR code', 'EAN-13' ... (scanModel.formatLabel) */
  formatLabel: string;
  /** 'Link', 'Wi-Fi', 'Product code' ... (scanModel.classifyScan) */
  typeLabel: string;
  title?: string;
  now?: Date;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** the post of a QR code / barcode: the text of the code is the description */
export function buildScanPost(input: ScanPostInput): RecordingPost {
  const now = input.now ?? new Date();
  const value = String(input.value ?? '');
  const rowJSON: Record<string, any> = {
    mediaPostTitle: input.title?.trim() || `${input.formatLabel} ${stamp(now)}`,
    mediaPostSubTitle: `${input.formatLabel} · ${input.typeLabel}`,
    mediaPostDescription: value,
    mediaPostOrigin: /^https?:\/\//i.test(value.trim()) ? value.trim() : '',
    mediaPostOriginType: /^https?:\/\//i.test(value.trim()) ? 'link' : 'text',
    dataOriginName: 'scanner',
    mediaPlatform: input.platform,
    mediaCreatedAt: now.toISOString(),
    mediaScanFormat: input.formatLabel,
    mediaScanType: input.typeLabel,
    mediaScanValue: value,
  };
  return { rowGUID: input.rowGUID, rowOwnerGUID: input.ownerGUID || 'anon', rowParentGUID: 'empty', orderInList: now.getTime(), rowJSON };
}

export interface NfcPostInput {
  ownerGUID: string;
  rowGUID: string;
  platform: string;
  /** the tag id as hex ('04A1B2C3'), '' when the system does not tell */
  tagId: string;
  /** one line for the list: 'NFC tag 04A1… · Link' */
  summary: string;
  /** every readable line of the tag, one per line */
  text: string;
  /** the technologies / the type of the tag ('Ndef', 'NfcA', 'MIFARE Ultralight') */
  techTypes: string[];
  title?: string;
  now?: Date;
}

/** the post of an NFC tag */
export function buildNfcPost(input: NfcPostInput): RecordingPost {
  const now = input.now ?? new Date();
  const rowJSON: Record<string, any> = {
    mediaPostTitle: input.title?.trim() || `NFC tag ${stamp(now)}`,
    mediaPostSubTitle: clip(input.summary || 'NFC tag', 120),
    mediaPostDescription: input.text,
    mediaPostOrigin: '',
    mediaPostOriginType: 'text',
    dataOriginName: 'nfc',
    mediaPlatform: input.platform,
    mediaCreatedAt: now.toISOString(),
    nfcTagId: input.tagId,
    nfcTechTypes: input.techTypes,
  };
  return { rowGUID: input.rowGUID, rowOwnerGUID: input.ownerGUID || 'anon', rowParentGUID: 'empty', orderInList: now.getTime(), rowJSON };
}

export interface PhotoPostInput {
  ownerGUID: string;
  rowGUID: string;
  platform: string;
  /** the KEPT file (mediaFileStore.persistRecording) */
  uri: string;
  width?: number;
  height?: number;
  /** the id of the filter that is baked into the file ('original' = none) */
  filterId: string;
  filterLabel: string;
  /** the zoom factor the user shot at (1 = the main lens) */
  zoomFactor?: number;
  title?: string;
  now?: Date;
}

const PHOTO_MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' };

/** the post of a photo: `mediaKind` stays empty (the player cannot play it), `mediaImageUri` is what the list draws */
export function buildPhotoPost(input: PhotoPostInput): RecordingPost {
  const now = input.now ?? new Date();
  const ext = extensionOf(input.uri) || 'jpg';
  const rowJSON: Record<string, any> = {
    mediaPostTitle: input.title?.trim() || `Photo ${stamp(now)}`,
    mediaPostSubTitle: input.filterId === 'original' ? 'Photo' : `Photo · ${input.filterLabel}`,
    mediaPostDescription: '',
    mediaPostOrigin: input.uri,
    mediaPostMIME: PHOTO_MIME[ext] || 'image/jpeg',
    mediaPostOriginType: 'file',
    dataOriginName: 'camera',
    recordingFolder: 'photo',
    mediaImageUri: input.uri,
    mediaPlatform: input.platform,
    mediaFileExtension: ext,
    mediaCreatedAt: now.toISOString(),
    photoFilter: input.filterId,
  };
  if (input.width && input.height) {
    rowJSON.photoWidth = input.width;
    rowJSON.photoHeight = input.height;
  }
  if (input.zoomFactor && Math.abs(input.zoomFactor - 1) > 0.05) rowJSON.photoZoomFactor = Math.round(input.zoomFactor * 10) / 10;
  return { rowGUID: input.rowGUID, rowOwnerGUID: input.ownerGUID || 'anon', rowParentGUID: 'empty', orderInList: now.getTime(), rowJSON };
}

export interface IdCardPostInput {
  ownerGUID: string;
  rowGUID: string;
  platform: string;
  /** the owner of the document as printed in the zone: 'JURIJS TERENTJEVS' (given names first) */
  ownerName: string;
  /** the document number */
  documentNumber: string;
  /** the document code of the zone: 'P', 'PA' = passport, 'I', 'ID' = ID card */
  documentCode?: string;
  nationality?: string;
  /** DD.MM.YYYY */
  expiryDate?: string;
  /** EVERY datum of the document (label + value, empty ones left out; idCardFields): they become the description of the post and `idCardFields` */
  fields?: Array<{ label: string; value: string }>;
  /** the owner photo of the chip as a data address (`data:image/jpeg;base64,...`), only for a format the phone can draw (JPEG); it is what the list shows */
  photoDataUri?: string;
  title?: string;
  now?: Date;
}

/** a photo bigger than this stays out of the post (the file storage has it anyway): a chip photo is 5-30 KB */
export const ID_POST_PHOTO_MAX_CHARS = 400_000;

/** 'Passport' for a code that starts with P, else 'ID card' */
export const idDocumentKind = (documentCode?: string): string => (/^P/i.test((documentCode ?? '').trim()) ? 'Passport' : 'ID card');

/** the folder under identification/ in the file storage: 'passport' for a code that starts with P, else 'idcard' */
export const idDocumentFolder = (documentCode?: string): 'idcard' | 'passport' => (idDocumentKind(documentCode) === 'Passport' ? 'passport' : 'idcard');

/**
 * The post of an ID card / passport that was read (made only when the user presses "Create media post"). The list shows the TITLE (the name of the
 * owner), the sub title ('ID card · No. PA3626350 · when'), ALL the data of the document (`fields`: the description, one line each) and the owner photo
 * (`photoDataUri` -> `mediaImageUri`, the same key a photo post uses). The photo of ANY format also goes to the file storage (IdCardPostOffer).
 */
export function buildIdCardPost(input: IdCardPostInput): RecordingPost {
  const now = input.now ?? new Date();
  const kind = idDocumentKind(input.documentCode);
  const name = input.ownerName.trim();
  const number = input.documentNumber.trim();
  const fields = (input.fields ?? []).filter((f) => f && f.label && f.value);
  const description = fields.length
    ? fields.map((f) => `${f.label}: ${f.value}`).join('\n')
    : [`Owner: ${name || '-'}`, `Number: ${number || '-'}`, input.nationality ? `Nationality: ${input.nationality}` : '', input.expiryDate ? `Valid until: ${input.expiryDate}` : '']
        .filter(Boolean)
        .join('\n');
  const rowJSON: Record<string, any> = {
    mediaPostTitle: input.title?.trim() || name || `${kind} ${stamp(now)}`,
    mediaPostSubTitle: `${kind}${number ? ` · No. ${number}` : ''}`,
    mediaPostDescription: description,
    mediaPostOrigin: '',
    mediaPostOriginType: 'text',
    dataOriginName: 'idreader',
    mediaPlatform: input.platform,
    mediaCreatedAt: now.toISOString(),
    idCardOwnerName: name,
    idCardNumber: number,
    idCardKind: kind,
    // the folder of the owner photo in the file storage: identification/<idCardFolder>/<this post's guid>.<ext> (files_authorize reads it)
    idCardFolder: idDocumentFolder(input.documentCode),
  };
  if (fields.length) rowJSON.idCardFields = fields;
  if (input.photoDataUri && /^data:image\/(jpeg|png);base64,/i.test(input.photoDataUri) && input.photoDataUri.length <= ID_POST_PHOTO_MAX_CHARS) {
    rowJSON.mediaImageUri = input.photoDataUri;
    rowJSON.mediaPostMIME = input.photoDataUri.slice(5, input.photoDataUri.indexOf(';'));
  }
  return { rowGUID: input.rowGUID, rowOwnerGUID: input.ownerGUID || 'anon', rowParentGUID: 'empty', orderInList: now.getTime(), rowJSON };
}
