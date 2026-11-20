// Types shared by the identification steps and by MrzPhotoStep.tsx / MrzPhotoStep.web.tsx (the two files have the same name for the bundler:
// one cannot import the other's types).
import type { ExpectedDocument, MrzConfidence, MrzFromText } from './mrzFromText';

/** the values the confirm step shows and the scan step starts with */
export interface ConfirmedValues {
  documentNumber: string;
  /** DD.MM.YYYY */
  birthDate: string;
  expiryDate: string;
  /** the issuing state of the zone ('' when typed) */
  country: string;
  /** the card access number (6 digits printed on the front of some ID cards), '' when unknown */
  can: string;
}

export const EMPTY_VALUES: ConfirmedValues = { documentNumber: '', birthDate: '', expiryDate: '', country: '', can: '' };

/** what a recognition found, whoever made it (this phone's text recognition or Google AI) */
export interface Recognition {
  source: 'device' | 'ai' | 'ai-text' | 'typed';
  /** the text lines the engine saw / the zone lines Google AI returned (shown on the confirm step, wiped with the flow) */
  lines: string[];
  /** the zone parsed with its check digits, when a zone was found */
  result: MrzFromText | null;
  /** what the confirm step starts with */
  values: ConfirmedValues;
  /** checked / partly / unchecked = by the check digits of the zone; fields = read from printed fields (Google AI), no check digits exist for them */
  confidence: MrzConfidence | 'fields';
  /** words for the user: what differed, what to compare */
  notes: string[];
  /** the printed name, nationality and sex (not verified by the chip) */
  printed?: { name: string; nationality: string; sex: string };
}

export interface MrzPhotoStepProps {
  documentType: Exclude<ExpectedDocument, undefined>;
  onRecognized: (r: Recognition) => void;
  onBack: () => void;
  /** replaceable for tests: this phone's text recognition */
  recognize?: (uri: string) => Promise<string[]>;
  /** replaceable for tests: Google AI extracts the values from the recognised TEXT (no picture is sent) */
  aiTextRecognize?: (lines: string[], documentType: 'ID' | 'PASSPORT') => Promise<import('../../../../../../supabase/functions/identification-recognize/handler').AiDocument>;
  /** replaceable for tests: Google AI reads the photo */
  aiRecognize?: (input: { image: string; mime: string; documentType: 'ID' | 'PASSPORT' }) => Promise<import('../../../../../../supabase/functions/identification-recognize/handler').AiDocument>;
}
