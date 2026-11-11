// files-drive - the STORAGE PROVIDER interface (documentation/FILE_WITH_OneDrive_WBS.html, section 2.1, task OD1).
// The handler (handler.ts) and the token cache (token.ts) talk ONLY to this interface; googleProvider.ts is the Google Drive adapter (the code that was inside the handler),
// oneDriveProvider.ts (OD2) will be the Microsoft Graph one. Pure types + one error class: no network, no Deno.
export type ProviderId = 'googleDrive' | 'oneDrive';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** one answer of a storage the handler decides on by status (404 gone, 403 refused, 401 token, 413 too many ...) */
export class StorageError extends Error {
  status: number;
  reason: string;
  constructor(status: number, reason: string, message?: string) {
    super(message || `The storage answered ${status} ${reason}`.trim());
    this.status = status;
    this.reason = reason;
  }
}

/** a file or a folder, in words that every storage can fill */
export interface StorageItem {
  id: string;
  name?: string;
  isFolder: boolean;
  /** bytes; 0 for a folder or when the storage does not say */
  size: number;
  /** the folder it is in ('' = unknown) */
  parentId: string;
  /** the id of the upload that made it (Google: the property kit8Upload; OneDrive: none - the finish step is by item id) */
  uploadId?: string;
  /** the organization the item is marked for (Google: the property kit8OrganizationGUID); '' when the storage has no marks. OneDrive: '*' = the item lies under kit8root of the connected account */
  markedOrganization?: string;
  /** the address of the item in the storage's own web page (OneDrive: webUrl); '' when not known */
  webUrl?: string;
  /** a tag that changes when the bytes change (OneDrive: eTag); the finish of a REPLACE compares it (Google marks the file with the uploadId instead) */
  versionTag?: string;
}

export interface FolderMarks {
  name: string;
  description: string;
  /** the marks of the folder (Google: properties; a storage without marks ignores them) */
  marks: Record<string, string>;
}

export interface Tokens {
  accessToken: string;
  expiresInSeconds: number;
  /** a storage whose refresh token rotates (OneDrive) returns the NEW one here, and the caller saves it */
  refreshToken?: string;
  scope?: string;
}

export type CodeExchange = ({ ok: true } & Tokens & { refreshToken: string }) | { ok: false; error: string };
export type RefreshResult = ({ ok: true } & Tokens) | { ok: false; revoked: boolean; error: string; status: number };

export interface ProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export interface StorageProvider {
  id: ProviderId;
  /** the name people read: "Google Drive" / "Microsoft OneDrive" */
  title: string;

  // ---- the sign-in of the administrator (way C: once) ----------------------------------------------------------------------------------------------
  authUrl(p: { clientId: string; redirectUri: string; state: string }): string;
  exchangeCode(p: ProviderCredentials & { code: string; redirectUri: string }): Promise<CodeExchange>;
  refresh(p: ProviderCredentials & { refreshToken: string }): Promise<RefreshResult>;
  /** best effort: forget the token at the provider */
  revoke(refreshToken: string): Promise<void>;
  accountEmail(token: string): Promise<string | null>;

  // ---- folders -----------------------------------------------------------------------------------------------------------------------------------------
  /** kit8root of an organization: found again after a reconnect (never a second one), else created */
  ensureRoot(token: string, organization: string): Promise<StorageItem>;
  rootUrl(rootId: string): string;
  ensureFolder(token: string, parentId: string, step: FolderMarks): Promise<{ id: string; created: boolean }>;
  getItem(token: string, id: string): Promise<StorageItem>;
  /** the files and folders of a folder (not trashed) */
  listChildren(token: string, folderId: string): Promise<StorageItem[]>;
  /** the file a finished upload made; null = not finished. Google finds it by the upload mark; OneDrive by the item id the browser read from the last answer (checked: folder + size), else by folder + size + newest */
  findUploaded(token: string, p: { uploadId: string; itemId?: string; folderId: string; name: string; size: number }): Promise<StorageItem | null>;
  /** has the REPLACE finished: the item carries the new bytes (Google: the upload mark; OneDrive: another versionTag and the declared size) */
  isUpdateDone(item: StorageItem, p: { uploadId: string; oldVersionTag?: string; size: number }): boolean;
  /** is the item one of this organization's (the marks; a storage without marks compares the folder) */
  isOurs(item: StorageItem, organization: string): boolean;

  // ---- bytes -----------------------------------------------------------------------------------------------------------------------------------------
  /** a resumable session for a NEW file: the returned url takes the bytes with NO token */
  openUploadSession(token: string, p: { name: string; folderId: string; mime: string; size: number; uploadId: string; organization: string; origin?: string | null }): Promise<string>;
  /** a session that REPLACES the bytes of an existing file (a new version) */
  openUpdateSession(token: string, itemId: string, p: { mime: string; size: number; uploadId: string; origin?: string | null }): Promise<string>;
  openMedia(token: string, id: string, range?: string | null): Promise<Response>;

  // ---- versions, move, delete -------------------------------------------------------------------------------------------------------------------------
  /** version ids of a file, oldest first */
  versions(token: string, id: string): Promise<string[]>;
  keepVersion(token: string, id: string, versionId: string): Promise<void>;
  moveItem(token: string, id: string, newParentId: string, oldParentId: string): Promise<void>;
  /** 'gone' = it was not there any more (done) */
  deleteItem(token: string, id: string): Promise<'deleted' | 'gone'>;
  /** a folder with everything inside (Google: bottom-up; OneDrive: one call) */
  deleteTree(token: string, folderId: string): Promise<{ files: number; folders: number }>;
}
