// The shape every storage (Google Drive, Microsoft OneDrive) fills in for the app: its name, the words it needs, its own warnings. Types only (no import), so the storage folders and
// the common code can both use it without a cycle. Where a storage differs from the other, the difference lives in its OWN folder (google/, microsoft/); the common code asks the registry
// (common/storageProviders.ts) and never tests for a storage by name.
export type FileStorageProvider = 'googleDrive' | 'oneDrive';

/** anything but 'oneDrive' is Google Drive: a project / a file row made before OneDrive has no value */
export const providerOfValue = (v: unknown): FileStorageProvider => (v === 'oneDrive' ? 'oneDrive' : 'googleDrive');

/** what the connection block shows besides the state: a warning of the storage (English; the block translates it with its params) */
export interface StorageWarning {
  id: string;
  text: string;
  params?: Record<string, string | number>;
}

/** the part of the status of the function the warnings read */
export interface StorageStatusFacts {
  state?: string;
  secretExpires?: string | null;
}

export interface StorageUi {
  id: FileStorageProvider;
  /** the name people read */
  title: string;
  /** the note under the connection block: whose storage it is, what the application may do there (English; the block translates it) */
  ownerNote: string;
  /** warnings that belong to this storage only (Microsoft: the client secret near its expiry); today = a parameter so a test does not depend on the clock */
  warnings: (status: StorageStatusFacts | null | undefined, today?: Date) => StorageWarning[];
  /** the id of the file in this storage, from a file row (Google rows: googleDriveFileId, OneDrive rows: oneDriveItemId); undefined when the row has none of this storage's (a link, or another storage's file) */
  itemIdOf: (rowJSON: Record<string, any> | null | undefined) => string | undefined;
  /** does this text of the function already carry this storage's name ("Microsoft OneDrive is not connected."): then it is shown as it is, not replaced by the fixed words of the common code */
  ownsMessage: (message: string) => boolean;
}
