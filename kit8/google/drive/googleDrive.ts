import axios, { AxiosProgressEvent } from 'axios';
import { SystemMetaData } from '../../redux/SystemMetaData';

// Re-export everything from the base module so existing consumers are unaffected
export {
    TOKEN_ENDPOINT,
    DRIVE_API_URL,
    DRIVE_UPLOAD_URL,
    FOLDER_MIME,
    GoogleDriveCredentials,
    GoogleDriveFileInfo,
    DriveFile,
    GoogleDriveCrudSpecifics,
    generateUUID,
    getAccessToken,
} from './googleDriveBase';

import {
    DRIVE_API_URL,
    FOLDER_MIME,
    GoogleDriveCredentials,
    GoogleDriveFileInfo,
    GoogleDriveCrudSpecifics,
    generateUUID,
    getAccessToken,
} from './googleDriveBase';

import { createOnGoogleDrive } from './createOnGoogleDrive';

export { createOnGoogleDrive };

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
    const actions = crudSpecifics?.actions || entityMetaData?.actions;
    const commandRowGUID =
        crudSpecifics?.rowGUID || (crudSpecifics?.uuidFn ? crudSpecifics.uuidFn() : generateUUID());
    const rowOwnerGUID = crudSpecifics?.rowOwnerGUID || crudSpecifics?.userGUID || 'userGUID';
    const rowParentGUID = crudSpecifics?.rowParentGUID || 'Clothes1';
    const orderInList = typeof crudSpecifics?.orderInList === 'number' ? crudSpecifics.orderInList : 0;
    const commandName = crudSpecifics?.commandName || 'createFile';

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
                    afterCreateOneSuccess: () => {
                        console.log("████████ afterCreateOneSuccess1", Date.now());
                        createOnGoogleDrive(credentials, fileInfo, {
                            ...crudSpecifics,
                            rowGUID: commandRowGUID,
                            rowOwnerGUID,
                            rowParentGUID,
                            orderInList,
                            commandName,
                        });
                    },
                })
            );
        } catch (e) {
            console.error('Error dispatching createOne command:', e);
        }
    }

    // return await createOnGoogleDrive(credentials, fileInfo, crudSpecifics);
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

    let fields =
        crudSpecifics?.fields ||
        'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink), nextPageToken';
    if (!fields.includes('nextPageToken')) {
        fields = `${fields}, nextPageToken`;
    }

    const pageSize = crudSpecifics?.pageSize || 1000;
    const fetchAllPages = crudSpecifics?.fetchAllPages !== false;

    let allFiles: GoogleDriveFileInfo[] = [];
    let currentPageToken: string | undefined = crudSpecifics?.pageToken;

    do {
        let url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=${pageSize}`;
        if (crudSpecifics?.orderBy) {
            url += `&orderBy=${encodeURIComponent(crudSpecifics.orderBy)}`;
        }
        if (currentPageToken) {
            url += `&pageToken=${encodeURIComponent(currentPageToken)}`;
        }

        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: crudSpecifics?.signal,
        });

        const fetchedFiles = res.data?.files || [];
        allFiles = allFiles.concat(fetchedFiles);
        currentPageToken = res.data?.nextPageToken;

        if (!fetchAllPages || !currentPageToken) {
            break;
        }
    } while (currentPageToken && !crudSpecifics?.signal?.aborted);

    return {
        files: allFiles,
        nextPageToken: currentPageToken,
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
    createOnGoogleDrive,
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
