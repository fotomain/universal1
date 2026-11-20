// The last choice of step 1 (ID card or passport) is remembered on this device only. Never fails: a device without storage just forgets.
import type { ExpectedDocument } from './mrzFromText';

const KEY = 'kit8.identification.documentType';

export async function loadLastDocumentType(): Promise<ExpectedDocument> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const storage = require('@react-native-async-storage/async-storage').default;
    const v = await storage.getItem(KEY);
    return v === 'ID' || v === 'PASSPORT' ? v : undefined;
  } catch {
    return undefined;
  }
}

export async function saveLastDocumentType(value: 'ID' | 'PASSPORT'): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await require('@react-native-async-storage/async-storage').default.setItem(KEY, value);
  } catch {
    // nothing to keep it in
  }
}
