// The shape both NFC readers (nfcReader.ts: iOS / Android, nfcReader.web.ts: Web NFC) give back. Own file: the two readers have the same
// name for the bundler, so one cannot import the other's types.
export type NfcAvailability = 'unsupported' | 'disabled' | 'ready';

export interface NfcReaderHandle {
  stop: () => Promise<void>;
}
