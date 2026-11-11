// The registry of the storages: the common code asks it for the words and the warnings of a storage, so a third storage is one new folder + one line here. The pieces of the two storages
// that exist are in google/googleStorage.ts and microsoft/microsoftStorage.ts.
import { GOOGLE_STORAGE } from '../google/googleStorage';
import { MICROSOFT_STORAGE } from '../microsoft/microsoftStorage';
import { providerOfValue, type FileStorageProvider, type StorageUi } from './storageTypes';

/** the storages in the order of the radio set: 1. Google Drive, 2. Microsoft OneDrive */
export const STORAGES: StorageUi[] = [GOOGLE_STORAGE, MICROSOFT_STORAGE];

const BY_ID: Record<FileStorageProvider, StorageUi> = { googleDrive: GOOGLE_STORAGE, oneDrive: MICROSOFT_STORAGE };

/** the storage of an id (anything but 'oneDrive' is Google Drive) */
export const storageUiOf = (provider: unknown): StorageUi => BY_ID[providerOfValue(provider)];

/** the id of the file of a row in ITS storage (whichever it is); undefined for a link */
export const fileItemIdOf = (rowJSON: Record<string, any> | null | undefined): string | undefined => {
  for (const st of STORAGES) {
    const id = st.itemIdOf(rowJSON);
    if (id) return id;
  }
  return undefined;
};

export const FILE_STORAGE_PROVIDERS: { id: FileStorageProvider; title: string }[] = STORAGES.map((s) => ({ id: s.id, title: s.title }));
export const providerTitleOf = (provider: FileStorageProvider | string | null | undefined): string => storageUiOf(provider).title;
