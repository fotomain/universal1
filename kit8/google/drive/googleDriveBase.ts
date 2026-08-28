import axios, { AxiosProgressEvent } from 'axios';

// ============================================================================
// CONSTANTS & ENDPOINTS
// ============================================================================

export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface GoogleDriveCredentials {
    accessToken?: string | null;
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    tokenEndpoint?: string;
}

export interface GoogleDriveFileInfo {
    id?: string;
    name?: string;
    mimeType?: string;
    parents?: string[];
    blob?: Blob | File | null;
    uri?: string;
    base64?: string;
    size?: number | string;
    path?: string;
    modifiedTime?: string;
    webViewLink?: string;
    webContentLink?: string;
    [key: string]: any;
}

export type DriveFile = GoogleDriveFileInfo;

export interface GoogleDriveCrudSpecifics {
    parentId?: string;
    folderPath?: string | string[]; // Single path 'user/sub' or array ['user', 'sub']
    findIfExists?: boolean; // If true, searches existing folder instead of creating duplicates
    signal?: AbortSignal;
    onProgress?: (progressPercent: number, currentOrLoaded?: number, total?: number) => void;
    fields?: string;
    orderBy?: string;
    pageSize?: number;
    pageToken?: string;
    q?: string;
    newName?: string; // For renaming or updating
    trashed?: boolean;
    batchFiles?: GoogleDriveFileInfo[];
    // Redux / Entity command tracking parameters:
    dispatch?: any;
    rowOwnerGUID?: string;
    userGUID?: string;
    rowParentGUID?: string;
    rowGUID?: string;
    orderInList?: number;
    entityName?: string;
    actions?: any;
    commandName?: string;
    uuidFn?: () => string;
    [key: string]: any;
}

// ============================================================================
// HELPERS
// ============================================================================

export const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

// ============================================================================
// CORE AUTH HELPER
// ============================================================================

/**
 * Retrieves a valid access token. Uses provided accessToken or exchanges refreshToken.
 */
export const getAccessToken = async (
    credentials?: GoogleDriveCredentials,
    _fileInfo?: GoogleDriveFileInfo,
    _crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<string> => {
    if (credentials?.accessToken) {
        return credentials.accessToken;
    }

    const clientId = credentials?.clientId || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = credentials?.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
    const refreshToken = credentials?.refreshToken || process.env.GOOGLE_REFRESH_TOKEN || '';
    const tokenEndpoint = credentials?.tokenEndpoint || TOKEN_ENDPOINT;

    if (!refreshToken) {
        throw new Error('Google Drive refresh token is missing.');
    }

    const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }).toString(),
    });

    const data = await response.json();
    if (!response.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || 'Failed to obtain Google Drive access token');
    }

    return data.access_token;
};
