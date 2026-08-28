import axios, { AxiosProgressEvent } from 'axios';
import { SystemMetaData } from '../../redux/SystemMetaData';

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
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
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

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * 1. createFile - Uploads a file with metadata and binary data to Google Drive,
 * with optional Redux command tracking for SystemMetaData['googleDriveCommand'].
 */
export const createFile = async (
    credentials: GoogleDriveCredentials,
    fileInfo: GoogleDriveFileInfo,
    crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<GoogleDriveFileInfo> => {
    const dispatch = crudSpecifics?.dispatch;
    const entityName = crudSpecifics?.entityName || 'googleDriveCommand';
    const entityMetaData = SystemMetaData?.[entityName];
    const actions = entityMetaData?.actions;
    const commandRowGUID =
        crudSpecifics?.rowGUID || (crudSpecifics?.uuidFn ? crudSpecifics.uuidFn() : generateUUID());
    const rowOwnerGUID = crudSpecifics?.rowOwnerGUID || crudSpecifics?.userGUID || 'userGUID';
    const rowParentGUID = crudSpecifics?.rowParentGUID || 'Clothes1';
    const orderInList = typeof crudSpecifics?.orderInList === 'number' ? crudSpecifics.orderInList : 0;
    const commandName = crudSpecifics?.commandName || 'createFile';

    // 1. Dispatch createOne when starting upload
    if (dispatch && actions?.createOne && fileInfo) {
        try {
            dispatch(
                actions.createOne({
                    rowOwnerGUID,
                    rowParentGUID,
                    rowGUID: commandRowGUID,
                    orderInList,
                    rowJSON: {
                        googleDriveCommandName: commandName,
                        fileInfo,
                        readyToUpload: false,
                        isUploading: false,
                        uploadingProgressPercent: 0,
                        isFinished: false,
                    },
                })
            );
        } catch (e) {
            console.error('Error dispatching createOne command:', e);
        }
    }

    try {
        const token = await getAccessToken(credentials, fileInfo, crudSpecifics);
        const parentId = crudSpecifics?.parentId || (fileInfo.parents && fileInfo.parents[0]) || '';

        const metadata: Record<string, any> = {
            name: fileInfo.name || 'Untitled',
            mimeType: fileInfo.mimeType || 'application/octet-stream',
        };

        if (parentId) {
            metadata.parents = [parentId];
        } else if (fileInfo.parents && fileInfo.parents.length > 0) {
            metadata.parents = fileInfo.parents;
        }

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

        let fileBlob: any = fileInfo.blob;
        if (!fileBlob && fileInfo.uri) {
            const res = await fetch(fileInfo.uri);
            fileBlob = await res.blob();
        } else if (!fileBlob && fileInfo.base64) {
            const res = await fetch(fileInfo.base64);
            fileBlob = await res.blob();
        }

        if (fileBlob) {
            formData.append('file', fileBlob, fileInfo.name || 'file');
        }

        const res = await axios.post(DRIVE_UPLOAD_URL, formData, {
            headers: { Authorization: `Bearer ${token}` },
            signal: crudSpecifics?.signal,
            onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                if (progressEvent.total && progressEvent.total > 0) {
                    const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                    crudSpecifics?.onProgress?.(percent, progressEvent.loaded, progressEvent.total);

                    // 2. Dispatch updateOne with upload progress
                    if (dispatch && actions?.updateOne) {
                        try {
                            dispatch(
                                actions.updateOne({
                                    rowOwnerGUID,
                                    rowParentGUID,
                                    rowGUID: commandRowGUID,
                                    orderInList,
                                    rowJSON: {
                                        googleDriveCommandName: commandName,
                                        fileInfo,
                                        readyToUpload: false,
                                        isUploading: true,
                                        uploadingProgressPercent: percent,
                                        isFinished: false,
                                    },
                                })
                            );
                        } catch (e) {
                            console.error('Error dispatching updateOne progress:', e);
                        }
                    }
                }
            },
        });

        const resultFileInfo: GoogleDriveFileInfo = {
            id: res.data.id,
            name: res.data.name || fileInfo.name,
            mimeType: res.data.mimeType || fileInfo.mimeType,
            size: res.data.size || fileInfo.size,
            modifiedTime: res.data.modifiedTime,
            webViewLink: res.data.webViewLink,
            webContentLink: res.data.webContentLink,
            ...res.data,
        };

        // 3. Dispatch updateOne upon completion
        if (dispatch && actions?.updateOne) {
            try {
                dispatch(
                    actions.updateOne({
                        rowOwnerGUID,
                        rowParentGUID,
                        rowGUID: commandRowGUID,
                        orderInList,
                        rowJSON: {
                            googleDriveCommandName: commandName,
                            fileInfo: resultFileInfo,
                            readyToUpload: false,
                            isUploading: false,
                            uploadingProgressPercent: 100,
                            isFinished: true,
                        },
                    })
                );
            } catch (e) {
                console.error('Error dispatching updateOne finish:', e);
            }
        }

        return resultFileInfo;
    } catch (err: any) {
        // 4. Dispatch updateOne upon error
        if (dispatch && actions?.updateOne) {
            try {
                dispatch(
                    actions.updateOne({
                        rowOwnerGUID,
                        rowParentGUID,
                        rowGUID: commandRowGUID,
                        orderInList,
                        rowJSON: {
                            googleDriveCommandName: commandName,
                            fileInfo,
                            readyToUpload: false,
                            isUploading: false,
                            uploadingProgressPercent: 0,
                            isFinished: false,
                            error: err?.message || String(err),
                        },
                    })
                );
            } catch (e) {
                console.error('Error dispatching updateOne error:', e);
            }
        }
        throw err;
    }
};

/**
 * 2. createFolder - Creates or finds folders, supporting subfolders and nested paths
 */
export const createFolder = async (
    credentials: GoogleDriveCredentials,
    fileInfo: GoogleDriveFileInfo,
    crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<GoogleDriveFileInfo> => {
    const token = await getAccessToken(credentials, fileInfo, crudSpecifics);

    // Extract path hierarchy if specified (e.g. ['user123', 'dataset_shop_images'] or 'user123/dataset_shop_images')
    let pathSegments: string[] = [];
    if (crudSpecifics?.folderPath) {
        if (Array.isArray(crudSpecifics.folderPath)) {
            pathSegments = crudSpecifics.folderPath;
        } else if (typeof crudSpecifics.folderPath === 'string') {
            pathSegments = crudSpecifics.folderPath.split('/').filter(Boolean);
        }
    } else if (fileInfo.path && fileInfo.path.includes('/')) {
        pathSegments = fileInfo.path.split('/').filter(Boolean);
    } else if (fileInfo.name) {
        pathSegments = [fileInfo.name];
    }

    let currentParentId = crudSpecifics?.parentId || (fileInfo.parents && fileInfo.parents[0]) || 'root';
    let lastFolder: GoogleDriveFileInfo = { id: currentParentId, name: '', mimeType: FOLDER_MIME };

    const findIfExists = crudSpecifics?.findIfExists !== false;
    const segments = pathSegments.length > 0 ? pathSegments : [fileInfo.name || 'New Folder'];

    for (let i = 0; i < segments.length; i++) {
        const segName = segments[i];

        if (findIfExists) {
            const escapedName = segName.replace(/'/g, "\\'");
            const parentQuery = currentParentId === 'root' ? "'root' in parents" : `'${currentParentId}' in parents`;
            const q = `${parentQuery} and name = '${escapedName}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
            const searchUrl = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=files(id, name, mimeType, parents)`;

            const searchRes = await fetch(searchUrl, {
                headers: { Authorization: `Bearer ${token}` },
                signal: crudSpecifics?.signal,
            });

            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.files && searchData.files.length > 0) {
                    lastFolder = searchData.files[0];
                    currentParentId = lastFolder.id!;
                    continue;
                }
            }
        }

        // Folder not found or findIfExists is false — create new folder
        const createRes = await fetch(DRIVE_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: segName,
                mimeType: FOLDER_MIME,
                parents: currentParentId === 'root' ? undefined : [currentParentId],
            }),
            signal: crudSpecifics?.signal,
        });

        const createData = await createRes.json();
        if (!createRes.ok) {
            throw new Error(createData.error?.message || `Could not create folder: ${segName}`);
        }

        lastFolder = {
            id: createData.id,
            name: createData.name || segName,
            mimeType: FOLDER_MIME,
            parents: [currentParentId],
            ...createData,
        };
        currentParentId = lastFolder.id!;
    }

    return lastFolder;
};

/**
 * 3. deleteFile - Permanently deletes a file or folder by ID
 */
export const deleteFile = async (
    credentials: GoogleDriveCredentials,
    fileInfo: GoogleDriveFileInfo,
    crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<{ success: boolean; id: string }> => {
    const token = await getAccessToken(credentials, fileInfo, crudSpecifics);
    const targetId = fileInfo.id || crudSpecifics?.fileId || crudSpecifics?.id;

    if (!targetId) {
        throw new Error('File ID is required for deletion');
    }

    await axios.delete(`${DRIVE_API_URL}/${targetId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: crudSpecifics?.signal,
    });

    return { success: true, id: targetId };
};

/**
 * 4. listFiles - Queries files matching folder or custom query
 */
export const listFiles = async (
    credentials: GoogleDriveCredentials,
    fileInfo?: GoogleDriveFileInfo,
    crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<{ files: GoogleDriveFileInfo[]; nextPageToken?: string }> => {
    const token = await getAccessToken(credentials, fileInfo, crudSpecifics);
    const parentId = crudSpecifics?.parentId || fileInfo?.id || fileInfo?.parents?.[0];

    let q = crudSpecifics?.q;
    if (!q && parentId) {
        q = `'${parentId}' in parents and trashed = false`;
    } else if (!q) {
        q = 'trashed = false';
    }

    const fields =
        crudSpecifics?.fields ||
        'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink), nextPageToken';

    let url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}`;
    if (crudSpecifics?.orderBy) {
        url += `&orderBy=${encodeURIComponent(crudSpecifics.orderBy)}`;
    }
    if (crudSpecifics?.pageSize) {
        url += `&pageSize=${crudSpecifics.pageSize}`;
    }
    if (crudSpecifics?.pageToken) {
        url += `&pageToken=${encodeURIComponent(crudSpecifics.pageToken)}`;
    }

    const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: crudSpecifics?.signal,
    });

    return {
        files: res.data?.files || [],
        nextPageToken: res.data?.nextPageToken,
    };
};

/**
 * 5. getFile - Retrieves file metadata
 */
export const getFile = async (
    credentials: GoogleDriveCredentials,
    fileInfo: GoogleDriveFileInfo,
    crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<GoogleDriveFileInfo> => {
    const token = await getAccessToken(credentials, fileInfo, crudSpecifics);
    const targetId = fileInfo.id || crudSpecifics?.fileId;
    if (!targetId) throw new Error('File ID is required');

    const fields =
        crudSpecifics?.fields ||
        'id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, parents';

    const res = await axios.get(`${DRIVE_API_URL}/${targetId}?fields=${encodeURIComponent(fields)}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: crudSpecifics?.signal,
    });

    return res.data;
};

/**
 * 6. updateFile / renameFile - Renames or updates metadata of an existing file
 */
export const updateFile = async (
    credentials: GoogleDriveCredentials,
    fileInfo: GoogleDriveFileInfo,
    crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<GoogleDriveFileInfo> => {
    const token = await getAccessToken(credentials, fileInfo, crudSpecifics);
    const targetId = fileInfo.id || crudSpecifics?.fileId;
    if (!targetId) throw new Error('File ID is required for update');

    const newName = crudSpecifics?.newName || fileInfo.name;
    const body: Record<string, any> = {};
    if (newName) body.name = newName;

    const res = await axios.patch(`${DRIVE_API_URL}/${targetId}`, body, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        signal: crudSpecifics?.signal,
    });

    return res.data;
};

export const renameFile = updateFile;

/**
 * 7. createBatchFiles - Uploads multiple files sequentially with progress reporting
 */
export const createBatchFiles = async (
    credentials: GoogleDriveCredentials,
    fileInfo: GoogleDriveFileInfo,
    crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<GoogleDriveFileInfo[]> => {
    const files = crudSpecifics?.batchFiles || (fileInfo as any).files || [];
    const parentId = crudSpecifics?.parentId || fileInfo.id || fileInfo.parents?.[0] || '';
    const uploadedResults: GoogleDriveFileInfo[] = [];
    const totalFiles = files.length;

    for (let i = 0; i < totalFiles; i++) {
        if (crudSpecifics?.signal?.aborted) break;
        const currentFile = files[i];

        const uploaded = await createFile(
            credentials,
            currentFile,
            {
                ...crudSpecifics,
                parentId,
                orderInList: typeof crudSpecifics?.orderInList === 'number' ? crudSpecifics.orderInList + i : i,
                onProgress: (filePercent) => {
                    if (crudSpecifics?.onProgress) {
                        const overallPercent = Math.min(
                            99,
                            Math.round(((i + filePercent / 100) / totalFiles) * 100)
                        );
                        crudSpecifics.onProgress(overallPercent, i + 1, totalFiles);
                    }
                },
            }
        );

        uploadedResults.push(uploaded);
        if (crudSpecifics?.onProgress) {
            const overallPercent = Math.round(((i + 1) / totalFiles) * 100);
            crudSpecifics.onProgress(overallPercent, i + 1, totalFiles);
        }
    }

    return uploadedResults;
};

/**
 * 8. deleteFolderContents - Clears all files inside a folder with progress tracking
 */
export const deleteFolderContents = async (
    credentials: GoogleDriveCredentials,
    fileInfo: GoogleDriveFileInfo,
    crudSpecifics?: GoogleDriveCrudSpecifics
): Promise<{ deletedCount: number }> => {
    const folderId = fileInfo.id || crudSpecifics?.parentId;
    if (!folderId) throw new Error('Folder ID is required to delete folder contents');

    if (crudSpecifics?.onProgress) {
        crudSpecifics.onProgress(10, 0, 0);
    }

    const { files } = await listFiles(
        credentials,
        {},
        {
            parentId: folderId,
            fields: 'files(id, name)',
            signal: crudSpecifics?.signal,
        }
    );

    let count = 0;
    const total = files.length;

    if (total === 0) {
        if (crudSpecifics?.onProgress) {
            crudSpecifics.onProgress(100, 0, 0);
        }
        return { deletedCount: 0 };
    }

    for (let i = 0; i < total; i++) {
        if (crudSpecifics?.signal?.aborted) break;
        const f = files[i];
        await deleteFile(credentials, { id: f.id, name: f.name }, { signal: crudSpecifics?.signal });
        count++;
        if (crudSpecifics?.onProgress) {
            const percent = Math.min(100, Math.round(((i + 1) / total) * 100));
            crudSpecifics.onProgress(percent, i + 1, total);
        }
    }

    return { deletedCount: count };
};

export const clearFolder = deleteFolderContents;

// ============================================================================
// DEFAULT EXPORT / UNIFIED OBJECT
// ============================================================================

export const googleDrive = {
    getAccessToken,
    createFile,
    createFolder,
    deleteFile,
    listFiles,
    getFile,
    updateFile,
    renameFile,
    createBatchFiles,
    deleteFolderContents,
    clearFolder,
};

export default googleDrive;
