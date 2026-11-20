// What to expect from the documents of a country. ONE rule: this reader speaks the international standard (ICAO 9303: passports of every
// state, and the ID cards that carry the same travel document application). What a state keeps behind its own national protocol
// (online identification, signing with a PIN, bank functions) is NOT readable here.
// Each note says where it comes from: `source: 'research'` = read in official / vendor pages on 2026-11-19, `'standard'` = follows from ICAO 9303,
// `'unverified'` = a reasonable expectation that was not checked with a card of this state.
import { normalizeStateCode } from './countries';

export type IdCardSupport =
  /** the ID card has the ICAO application: the reader may open it with the MRZ or the CAN */
  | 'icao'
  /** the chip data is not readable by a phone: online identification only */
  | 'online-only'
  /** the state offers its own app / SDK for the card */
  | 'own-app'
  /** not known */
  | 'check';

export interface CountryNote {
  code: string;
  idCard: IdCardSupport;
  /** what the user should know, in one or two sentences */
  text: string;
  source: 'research' | 'standard' | 'unverified';
  links: Array<{ label: string; url: string }>;
}

export const PASSPORT_NOTE = 'Passports of every state that issues an electronic passport follow ICAO 9303: open it with the three MRZ values (document number, date of birth, date of expiry) from the data page. Fingerprints and iris images are protected for the issuing state and are never read.';

const NOTES: CountryNote[] = [
  {
    code: 'LVA', idCard: 'icao', source: 'unverified',
    text: 'Latvia: the ID card (eID karte) and the passport have the MRZ on the back / data page: enter its document number, date of birth and date of expiry. As far as is known the official eParaksts mobile app uses the card by NFC with its PIN codes; PIN-protected functions (log in, e-signature) are not part of this reader. If the card does not answer, the step list shows which step failed - please report it.',
    links: [{ label: 'eParaksts', url: 'https://www.eparaksts.lv' }],
  },
  {
    code: 'DEU', idCard: 'online-only', source: 'research',
    text: 'Germany: the chip of the ID card (Personalausweis) gives its photo and address only to authorities; the online ID function works only through an eID service with the AusweisApp and the 6-digit PIN. This reader cannot read the ID card. The German passport (Reisepass) is a normal ICAO passport and can be read with the MRZ.',
    links: [{ label: 'AusweisApp SDK', url: 'https://www.ausweisapp.bund.de/en/software-development' }, { label: 'React Native wrapper', url: 'https://www.github.com/kulturpass-de/react-native-ausweisapp2-wrapper' }],
  },
  {
    code: 'EST', idCard: 'own-app', source: 'research',
    text: 'Estonia: ID cards with an NFC chip (issued after August 2021) work with the official RIA DigiDoc app; their PIN-protected functions are not read here. The ICAO travel data may be readable with the MRZ or the CAN.',
    links: [{ label: 'RIA DigiDoc', url: 'https://apps.apple.com/app/id1216104448' }, { label: 'Smart-ID NFC', url: 'https://www.smart-id.com/?p=100892' }],
  },
  {
    code: 'ESP', idCard: 'own-app', source: 'research',
    text: 'Spain: the DNI 3.0 and newer have an NFC chip; the official apps (DNIeLectura, DNIeRemote, by the Interior Ministry and the FNMT) need the DNI PIN. The ICAO travel data may be readable with the CAN / MRZ; older DNIs need a contact reader.',
    links: [{ label: 'DNIe on Android', url: 'https://androidguias.com/como-leer-el-dni-electronico-en-android-con-nfc-guia-completa-apps-y-trucos-esenciales/' }],
  },
  {
    code: 'ITA', idCard: 'own-app', source: 'research',
    text: 'Italy: the CIE (Carta d\'Identità Elettronica) has the official CieID app and SDKs for Android / iOS (log in with the 8-digit PIN). Those functions are not part of this reader; the ICAO travel data may be readable with the MRZ.',
    links: [{ label: 'CIE SDK', url: 'https://docs.italia.it/projects/cie-eid-sdk-docs/downloads/pdf/versione-corrente' }],
  },
  {
    code: 'BEL', idCard: 'check', source: 'research',
    text: 'Belgium: the eID card is used with a reader and the eID software, or through the itsme app; no official phone NFC reader app was found. The ICAO data may be readable if the card has the application.',
    links: [{ label: 'itsme', url: 'https://www.itsme-id.com/business/coverage' }],
  },
  {
    code: 'AUT', idCard: 'own-app', source: 'research',
    text: 'Austria: ID Austria is an app-based scheme (it replaced Handy-Signatur and Bürgerkarte); it does not read the card by NFC like this reader. Passports are normal ICAO passports.',
    links: [{ label: 'eID overview', url: 'https://didit.me/blog/european-eid-schemes-guide/' }],
  },
  {
    code: 'PRT', idCard: 'check', source: 'research',
    text: 'Portugal: the Cartão de Cidadão is read with a reader and the eID viewer; whether a phone can read it by NFC was not confirmed. Passports are normal ICAO passports.',
    links: [{ label: 'eID overview', url: 'https://didit.me/blog/european-eid-schemes-guide/' }],
  },
  {
    code: 'NLD', idCard: 'check', source: 'research',
    text: 'Netherlands: DigiD is the national scheme; the DigiD app reads the NFC chip of the passport or the ID card with the MRZ (the same ICAO standard as this reader).',
    links: [{ label: 'eID overview', url: 'https://didit.me/blog/european-eid-schemes-guide/' }],
  },
  { code: 'FIN', idCard: 'check', source: 'unverified', text: 'Finland: the ID card and the passport are listed as NFC readable by verification services; no official reader app was found.', links: [] },
  { code: 'SWE', idCard: 'check', source: 'unverified', text: 'Sweden: no official NFC reader app was found. Passports are normal ICAO passports.', links: [] },
  { code: 'CHE', idCard: 'check', source: 'unverified', text: 'Switzerland: nothing was found about an official NFC reader app. Passports are normal ICAO passports.', links: [] },
];

const BY_CODE: Record<string, CountryNote> = Object.fromEntries(NOTES.map((n) => [n.code, n]));

/** the note of a state (MRZ code or ISO code); a generic note when this state has no special one */
export function countryNote(code: string | undefined | null): CountryNote {
  const c = normalizeStateCode(String(code ?? ''));
  return (
    BY_CODE[c] ?? {
      code: c,
      idCard: 'check',
      source: 'standard',
      text: `${PASSPORT_NOTE} An ID card of this state can be opened only when it has the same travel document application (many European ID cards do); otherwise it keeps its data behind a national protocol that this reader does not speak.`,
      links: [],
    }
  );
}

export const COUNTRIES_WITH_NOTES = NOTES.map((n) => n.code);

/** the limits that apply to EVERY state, shown on the screen */
export const GENERAL_LIMITS: string[] = [
  'Read: the face image, the machine readable zone and - when the card has them - the additional personal and document details.',
  'Never read: fingerprints and iris images (they need a certificate of the issuing state), and anything behind a PIN (log in, e-signature, bank functions).',
  'The signature of the issuing state is not checked (no list of state certificates): the data is compared with the signed hashes, but it is not proven genuine.',
  'Nothing is stored or sent: the data lives on this screen only and is wiped when you press Clear or leave.',
];
