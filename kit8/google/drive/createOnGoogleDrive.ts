import axios, { AxiosProgressEvent } from 'axios';
import { SystemMetaData } from '../../redux/SystemMetaData';
import {
    DRIVE_UPLOAD_URL,
    GoogleDriveCredentials,
    GoogleDriveFileInfo,
    GoogleDriveCrudSpecifics,
    getAccessToken,
    generateUUID,
} from './googleDriveBase';

/**
 * Helper to convert URI, path, base64, Blob, or File into a Blob or Buffer,
 * reading from disk if necessary.
 */
export const readFileAsBlob = async (fileInfo: GoogleDriveFileInfo): Promise<any> => {
    if (fileInfo.blob) {
        return fileInfo.blob;
    }
    if (fileInfo.file) {
        return fileInfo.file;
    }

    // 1. Base64
    if (fileInfo.base64) {
        try {
            const base64Str = fileInfo.base64.includes(',')
                ? fileInfo.base64.split(',')[1]
                : fileInfo.base64;
            const mimeType = fileInfo.mimeType || 'application/octet-stream';

            if (typeof fetch === 'function') {
                const dataUrl = `data:${mimeType};base64,${base64Str}`;
                const res = await fetch(dataUrl);
                return await res.blob();
            }

            if (typeof Buffer !== 'undefined') {
                const buffer = Buffer.from(base64Str, 'base64');
                if (typeof Blob !== 'undefined') {
                    return new Blob([buffer], { type: mimeType });
                }
                return buffer;
            }
        } catch (err) {
            console.warn('Failed to parse base64 file data:', err);
        }
    }

    // 2. Local disk Path or URI
    const targetPathOrUri = fileInfo.path || fileInfo.uri;
    if (targetPathOrUri) {
        // Try reading via Node fs if available and target is a disk path
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const fs = require('fs');
                let cleanPath = targetPathOrUri;
                if (cleanPath.startsWith('file://')) {
                    cleanPath = cleanPath.replace('file://', '');
                }
                if (fs.existsSync && fs.existsSync(cleanPath)) {
                    const fileBuffer = fs.readFileSync(cleanPath);
                    const mimeType = fileInfo.mimeType || 'application/octet-stream';
                    if (typeof Blob !== 'undefined') {
                        return new Blob([fileBuffer], { type: mimeType });
                    }
                    return fileBuffer;
                }
            } catch (nodeFsErr) {
                // Ignore and fallback to fetch
            }
        }

        // Fallback to fetch (works for file://, http://, https://, data:)
        if (typeof fetch === 'function') {
            try {
                const res = await fetch(targetPathOrUri);
                if (res && res.ok) {
                    return await res.blob();
                }
            } catch (fetchErr) {
                console.warn('Fetch failed for URI/path:', targetPathOrUri, fetchErr);
            }
        }
    }

    return null;
};

/**
 * Uploads a file with metadata and binary data to Google Drive, reading files from disk/path if needed.
 */
export const createOnGoogleDrive = async (
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

        const fileBlob = await readFileAsBlob(fileInfo);
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

                    if (dispatch && actions?.updateOne) {
                        try {
                            dispatch(
                                actions.updateOne({
                                    rowGUID: commandRowGUID,
                                    field: 'uploadingProgressPercent',
                                    value: percent,
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

export default createOnGoogleDrive;
