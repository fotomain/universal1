import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    Platform,
    Share,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
    Provider as PaperProvider,
    MD3LightTheme,
    Appbar,
    Card,
    Text,
    Button,
    IconButton,
    TextInput,
    FAB,
    Portal,
    Dialog,
    ActivityIndicator,
    Snackbar,
    Avatar,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import {
    ReceiveDraggableFilesComponent,
    type DroppedFileItem,
    SpeedDialFAB,
} from '../../components/common';


// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const userGUID = '88888999999';
const SHOP_IMAGES_FOLDER_NAME = 'dataset_shop_images';
const TREND_IMAGES_FOLDER_NAME = 'dataset_trend_images';

let ENV_VARS = {
    FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '1CSG6zHm5Dof61lDMngp5rcmxQZXp1pWb',
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_PLACEHOLDER',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_PLACEHOLDER',
    REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || 'GOOGLE_REFRESH_TOKEN_PLACEHOLDER',
};

try {
    const env = require('@env');
    ENV_VARS = {
        FOLDER_ID: env.GOOGLE_DRIVE_FOLDER_ID || ENV_VARS.FOLDER_ID,
        CLIENT_ID: env.GOOGLE_CLIENT_ID || ENV_VARS.CLIENT_ID,
        CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || ENV_VARS.CLIENT_SECRET,
        REFRESH_TOKEN: env.GOOGLE_REFRESH_TOKEN || ENV_VARS.REFRESH_TOKEN,
    };
} catch (e) {
    // Fallback to process.env or defaults
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

// ============================================================================
// TYPES
// ============================================================================

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    webViewLink?: string;
    webContentLink?: string;
}

interface UserFolderHierarchy {
    userRootId: string;
    shopImagesId: string;
    trendImagesId: string;
}

// ============================================================================
// MODAL: AskBeforeDeleteGoogleFile
// ============================================================================

interface AskBeforeDeleteProps {
    visible: boolean;
    file: DriveFile | null;
    onDismiss: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

const AskBeforeDeleteGoogleFile: React.FC<AskBeforeDeleteProps> = ({
                                                                       visible,
                                                                       file,
                                                                       onDismiss,
                                                                       onConfirm,
                                                                       isDeleting,
                                                                   }) => {
    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss} style={styles.deleteDialog}>
                <View style={styles.deleteHeaderIconWrapper}>
                    <Avatar.Icon
                        size={52}
                        icon="trash-can-outline"
                        style={{ backgroundColor: '#FCE8E6' }}
                        color="#D93025"
                    />
                </View>
                <Dialog.Title style={styles.deleteTitle}>Delete File?</Dialog.Title>
                <Dialog.Content>
                    <Text variant="bodyMedium" style={styles.deleteContentText}>
                        Are you sure you want to permanently remove this file from your dataset?
                    </Text>
                    <View style={styles.deleteFileNameBox}>
                        <Avatar.Icon size={24} icon="file-outline" style={{ backgroundColor: 'transparent' }} color="#5F6368" />
                        <Text variant="bodyMedium" numberOfLines={2} style={styles.deleteFileNameText}>
                            {file?.name}
                        </Text>
                    </View>
                    <Text variant="bodySmall" style={styles.deleteWarningText}>
                        This action cannot be undone.
                    </Text>
                </Dialog.Content>
                <Dialog.Actions style={styles.deleteActions}>
                    <Button onPress={onDismiss} disabled={isDeleting} textColor="#5F6368" style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button
                        mode="contained"
                        buttonColor="#D93025"
                        textColor="#FFFFFF"
                        loading={isDeleting}
                        disabled={isDeleting}
                        style={{ flex: 1 }}
                        onPress={() => {
                            void onConfirm();
                        }}
                    >
                        Delete
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

// ============================================================================
// COMPONENT: SelectFilesForGoogleDriveDNDComponent
// ============================================================================

interface DNDProps {
    label: string;
    targetFolderId: string;
    accessToken: string | null;
    disabled: boolean;
    onUploadSuccess: (filename: string) => void;
    onUploadError: (err: string) => void;
}

const SelectFilesForGoogleDriveDNDComponent: React.FC<DNDProps> = ({
                                                                       label,
                                                                       targetFolderId,
                                                                       accessToken,
                                                                       disabled,
                                                                       onUploadSuccess,
                                                                       onUploadError,
                                                                   }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const uploadFileBlob = async (fileObj: { name: string; mimeType: string; blob: Blob | File }) => {
        if (!accessToken || !targetFolderId) {
            onUploadError('Invalid session or folder');
            return;
        }
        setIsUploading(true);
        try {
            const metadata = {
                name: fileObj.name,
                mimeType: fileObj.mimeType || 'application/octet-stream',
                parents: [targetFolderId],
            };

            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }) as any);
            formData.append('file', fileObj.blob as any, fileObj.name);

            const res = await fetch(DRIVE_UPLOAD_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            onUploadSuccess(fileObj.name);
        } catch (e: any) {
            onUploadError(e.message || 'Error uploading file');
        } finally {
            setIsUploading(false);
        }
    };

    const handlePickFile = async () => {
        if (disabled || isUploading) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                type: '*/*',
                multiple: false,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;
            const asset = result.assets[0];

            const fileData = await fetch(asset.uri);
            const blob = await fileData.blob();

            await uploadFileBlob({
                name: asset.name,
                mimeType: asset.mimeType || 'application/octet-stream',
                blob,
            });
        } catch (err: any) {
            onUploadError(err.message);
        }
    };

    const webDnDProps =
        Platform.OS === 'web'
            ? {
                onDragOver: (e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!disabled) setIsHovered(true);
                },
                onDragEnter: (e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                },
                onDragLeave: (e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsHovered(false);
                },
                onDrop: async (e: any) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsHovered(false);
                    if (disabled || !e.dataTransfer?.files?.length) return;
                    const droppedFile = e.dataTransfer.files[0];
                    await uploadFileBlob({
                        name: droppedFile.name,
                        mimeType: droppedFile.type,
                        blob: droppedFile,
                    });
                },
            }
            : {};

    const isYellow = label.includes('trend') || label.includes('dataset_trend_images');
    const isGreen = label.includes('shop') || label.includes('dataset_shop_images');

    const themeColors = isYellow
        ? {
              bg: isHovered ? '#FFF2B2' : '#FEF7D2',
              border: '#E6A700',
              title: '#533F03',
              subtitle: '#786018',
              iconColor: '#B45309',
              iconBg: '#FFFFFF',
          }
        : isGreen
        ? {
              bg: isHovered ? '#D7EEDF' : '#E8F5E9',
              border: '#4CAF50',
              title: '#0E3E1E',
              subtitle: '#2E5E3E',
              iconColor: '#1B5E20',
              iconBg: '#FFFFFF',
          }
        : {
              bg: isHovered ? '#F0F4F9' : '#FFFFFF',
              border: '#E0E2EC',
              title: '#1F1F1F',
              subtitle: '#5F6368',
              iconColor: '#1A73E8',
              iconBg: '#F1F3F4',
          };

    return (
        <Card
            style={[
                styles.dndCard,
                {
                    backgroundColor: themeColors.bg,
                    borderColor: themeColors.border,
                },
                isHovered && styles.dndCardHovered,
                disabled && styles.disabledOpacity,
            ]}
            mode="outlined"
            onPress={() => {
                void handlePickFile();
            }}
            {...(webDnDProps as any)}
        >
            <Card.Content style={styles.dndContent}>
                {isUploading ? (
                    <ActivityIndicator size="small" color={themeColors.iconColor} />
                ) : (
                    <Avatar.Icon
                        size={38}
                        icon="cloud-upload-outline"
                        style={[styles.dndIcon, { backgroundColor: themeColors.iconBg }]}
                        color={themeColors.iconColor}
                    />
                )}
                <View style={styles.dndTextContainer}>
                    <Text variant="titleSmall" style={[styles.dndTitle, { color: themeColors.title }]}>
                        {label}
                    </Text>
                    <Text variant="bodySmall" style={[styles.dndSubtitle, { color: themeColors.subtitle }]}>
                        {isUploading ? 'Uploading file...' : 'Click or drop files here to upload'}
                    </Text>
                </View>
            </Card.Content>
        </Card>
    );
};

// ============================================================================
// COMPONENT: ListFilesForGoogleDriveDNDComponent
// ============================================================================

interface ListFilesDNDProps {
    title: string;
    folderId: string;
    accessToken: string | null;
    disabled: boolean;
    onRenamePress: (file: DriveFile) => void;
    onDeletePress: (file: DriveFile) => void;
    onSharePress: (file: DriveFile) => void;
    onUploadSuccess: (filename: string) => void;
    onUploadError: (err: string) => void;
}

const ListFilesForGoogleDriveDNDComponent: React.FC<ListFilesDNDProps> = ({
                                                                              title,
                                                                              folderId,
                                                                              accessToken,
                                                                              disabled,
                                                                              onRenamePress,
                                                                              onDeletePress,
                                                                              onSharePress,
                                                                              onUploadSuccess,
                                                                              onUploadError,
                                                                          }) => {
    const [folderFiles, setFolderFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isDropZoneActive, setIsDropZoneActive] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);

    const fetchFolderFiles = useCallback(async () => {
        if (!accessToken || !folderId) return;
        setLoading(true);
        try {
            const q = `'${folderId}' in parents and trashed = false`;
            const fields = 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)';
            const url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&orderBy=name`;

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) throw new Error(`Failed to load ${title}`);
            const data = await res.json();
            setFolderFiles(data.files || []);
        } catch (err: any) {
            onUploadError(err.message);
        } finally {
            setLoading(false);
        }
    }, [accessToken, folderId, title, onUploadError]);

    useEffect(() => {
        if (folderId && accessToken) {
            void fetchFolderFiles();
        }
    }, [folderId, accessToken, fetchFolderFiles]);

    const uploadFileBlob = async (fileObj: DroppedFileItem) => {
        if (!accessToken || !folderId) return;
        setIsUploading(true);
        try {
            const metadata = {
                name: fileObj.name,
                mimeType: fileObj.mimeType || 'application/octet-stream',
                parents: [folderId],
            };

            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }) as any);

            if (fileObj.blob) {
                formData.append('file', fileObj.blob as any, fileObj.name);
            } else if (fileObj.uri) {
                const fileData = await fetch(fileObj.uri);
                const blob = await fileData.blob();
                formData.append('file', blob, fileObj.name);
            } else if (fileObj.base64) {
                const fileData = await fetch(fileObj.base64);
                const blob = await fileData.blob();
                formData.append('file', blob, fileObj.name);
            }

            const res = await fetch(DRIVE_UPLOAD_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            onUploadSuccess(fileObj.name);
            void fetchFolderFiles();
        } catch (e: any) {
            onUploadError(e.message || 'Drop upload error');
        } finally {
            setIsUploading(false);
        }
    };

    const dropContainerRef = useRef<View>(null);

    useEffect(() => {
        if (Platform.OS !== 'web' || !dropContainerRef.current) return;
        const domNode = (dropContainerRef.current as any) as HTMLElement;
        if (!domNode || typeof domNode.addEventListener !== 'function') return;

        let counter = 0;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter++;
            if (!disabled) setIsDropZoneActive(true);
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            if (!isDropZoneActive && !disabled) setIsDropZoneActive(true);
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter--;
            if (counter <= 0) {
                counter = 0;
                setIsDropZoneActive(false);
            }
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter = 0;
            setIsDropZoneActive(false);
            if (disabled || !e.dataTransfer?.files?.length) return;
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const file = e.dataTransfer.files[i];
                void uploadFileBlob({
                    name: file.name,
                    mimeType: file.type,
                    blob: file,
                });
            }
        };

        domNode.addEventListener('dragenter', handleDragEnter);
        domNode.addEventListener('dragover', handleDragOver);
        domNode.addEventListener('dragleave', handleDragLeave);
        domNode.addEventListener('drop', handleDrop);

        return () => {
            domNode.removeEventListener('dragenter', handleDragEnter);
            domNode.removeEventListener('dragover', handleDragOver);
            domNode.removeEventListener('dragleave', handleDragLeave);
            domNode.removeEventListener('drop', handleDrop);
        };
    }, [disabled, isDropZoneActive]);

    const formatBytes = (bytes?: string) => {
        if (!bytes) return '—';
        const num = parseInt(bytes, 10);
        if (isNaN(num)) return '—';
        if (num < 1024) return `${num} B`;
        if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
        return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <View ref={dropContainerRef} style={{ width: '100%' }}>
            <Card
                style={[
                    styles.listContainerCard,
                    isDropZoneActive && styles.listDropZoneActive,
                    disabled && styles.disabledOpacity,
                ]}
                mode="elevated"
            >
            <Card.Content>
                <View style={styles.listHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Avatar.Icon size={32} icon="folder-image" style={styles.listFolderIcon} />
                        <Text variant="titleMedium" style={styles.listSectionTitle}>
                            {title}
                        </Text>
                        <View style={styles.badgeCount}>
                            <Text variant="labelSmall" style={{ fontWeight: 'bold' }}>
                                {folderFiles.length}
                            </Text>
                        </View>
                    </View>
                    <IconButton
                        icon="refresh"
                        size={18}
                        disabled={disabled || loading}
                        onPress={() => {
                            void fetchFolderFiles();
                        }}
                    />
                </View>

                {isUploading && (
                    <View style={styles.uploadingNotice}>
                        <ActivityIndicator size="small" />
                        <Text variant="bodySmall" style={{ marginLeft: 8 }}>
                            Uploading dropped file(s)...
                        </Text>
                    </View>
                )}

                {isDropZoneActive ? (
                    <ReceiveDraggableFilesComponent
                        folderName={title}
                        isHovered={isDropZoneActive}
                        onDragEnter={() => setIsDropZoneActive(true)}
                        onDragLeave={() => setIsDropZoneActive(false)}
                        onFilesDropped={(files) => {
                            setIsDropZoneActive(false);
                            files.forEach((f) => void uploadFileBlob(f));
                        }}
                    />
                ) : loading ? (
                    <ActivityIndicator size="small" style={{ marginVertical: 18 }} />
                ) : folderFiles.length === 0 ? (
                    <View style={styles.emptyDropPrompt}>
                        <Avatar.Icon size={36} icon="file-upload-outline" style={{ backgroundColor: 'transparent' }} color="#9AA0A6" />
                        <Text variant="bodySmall" style={{ color: '#5F6368', marginTop: 4 }}>
                            Drag & Drop files anywhere into this list to upload automatically.
                        </Text>
                    </View>
                ) : (
                    <View style={{ marginTop: 6 }}>
                        {folderFiles.map((file) => (
                            <Card key={file.id} style={styles.innerFileCard} mode="outlined">
                                <View style={styles.fileCardRow}>
                                    <Avatar.Icon
                                        size={36}
                                        icon={file.mimeType.includes('image') ? 'image-outline' : 'file-document-outline'}
                                        style={{ backgroundColor: '#F1F3F4' }}
                                        color="#5F6368"
                                    />
                                    <View style={styles.fileDetails}>
                                        <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '500' }}>
                                            {file.name}
                                        </Text>
                                        <Text variant="labelSmall" style={{ color: '#747775' }}>
                                            {formatBytes(file.size)} • {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                                        </Text>
                                    </View>
                                    <View style={styles.actionButtonsRow}>
                                        <IconButton
                                            icon="rename-box"
                                            size={20}
                                            disabled={disabled}
                                            onPress={() => onRenamePress(file)}
                                        />
                                        <IconButton
                                            icon="share-variant-outline"
                                            size={20}
                                            disabled={disabled}
                                            onPress={() => onSharePress(file)}
                                        />
                                        <IconButton
                                            icon="delete-outline"
                                            size={20}
                                            iconColor="#D93025"
                                            disabled={disabled}
                                            onPress={() => onDeletePress(file)}
                                        />
                                    </View>
                                </View>
                            </Card>
                        ))}
                    </View>
                )}
            </Card.Content>
        </Card>
    </View>
    );
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function App() {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState<boolean>(true);
    const [userFolders, setUserFolders] = useState<UserFolderHierarchy | null>(null);

    const [isRenameDialogVisible, setIsRenameDialogVisible] = useState<boolean>(false);
    const [renameInput, setRenameInput] = useState<string>('');
    const [fileToRename, setFileToRename] = useState<DriveFile | null>(null);

    const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const [refreshSeed, setRefreshSeed] = useState<number>(0);
    const [snackbarMsg, setSnackbarMsg] = useState<string>('');
    const [isFabOpen, setIsFabOpen] = useState<boolean>(false);

    // ============================================================================
    // GLOBAL DRAG & DROP INTERCEPTOR (Silences Firefox/Browser popups)
    // ============================================================================

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const preventBrowserFileOpen = (e: DragEvent) => {
            e.preventDefault();
        };

        window.addEventListener('dragover', preventBrowserFileOpen, false);
        window.addEventListener('drop', preventBrowserFileOpen, false);

        return () => {
            window.removeEventListener('dragover', preventBrowserFileOpen);
            window.removeEventListener('drop', preventBrowserFileOpen);
        };
    }, []);

    // ============================================================================
    // TOKEN REFRESH LOGIC
    // ============================================================================

    const getValidAccessToken = useCallback(async (): Promise<string | null> => {
        try {
            const response = await fetch(TOKEN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: ENV_VARS.CLIENT_ID,
                    client_secret: ENV_VARS.CLIENT_SECRET,
                    refresh_token: ENV_VARS.REFRESH_TOKEN,
                    grant_type: 'refresh_token',
                }).toString(),
            });

            const data = await response.json();
            if (!response.ok || !data.access_token) {
                throw new Error(data.error_description || 'Unable to refresh token');
            }

            setAccessToken(data.access_token);
            return data.access_token;
        } catch (err: any) {
            setSnackbarMsg(`Auth Error: ${err.message}`);
            return null;
        }
    }, []);

    // ============================================================================
    // SUBFOLDER INITIALIZATION
    // ============================================================================

    const getOrCreateFolder = async (folderName: string, parentId: string, token: string): Promise<string> => {
        const q = `'${parentId}' in parents and name = '${folderName}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
        const searchUrl = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=files(id, name)`;
        const searchRes = await fetch(searchUrl, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const searchData = await searchRes.json();

        if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
        }

        const createRes = await fetch(DRIVE_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: folderName,
                mimeType: FOLDER_MIME,
                parents: [parentId],
            }),
        });

        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(`Could not create folder: ${folderName}`);
        return createData.id;
    };

    const createSubfolders = useCallback(async (token: string) => {
        setIsInitializing(true);
        try {
            const userRootId = await getOrCreateFolder(userGUID, ENV_VARS.FOLDER_ID, token);
            const shopImagesId = await getOrCreateFolder(SHOP_IMAGES_FOLDER_NAME, userRootId, token);
            const trendImagesId = await getOrCreateFolder(TREND_IMAGES_FOLDER_NAME, userRootId, token);

            const hierarchy: UserFolderHierarchy = {
                userRootId,
                shopImagesId,
                trendImagesId,
            };

            setUserFolders(hierarchy);
            return hierarchy;
        } catch (err: any) {
            setSnackbarMsg(`Folder init error: ${err.message}`);
            return null;
        } finally {
            setIsInitializing(false);
        }
    }, []);

    useEffect(() => {
        (async () => {
            const token = await getValidAccessToken();
            if (token) {
                await createSubfolders(token);
            }
        })();
    }, [getValidAccessToken, createSubfolders]);

    // ============================================================================
    // UPLOAD HELPER FOR FAB ACTIONS
    // ============================================================================

    const handleUploadToTargetFolder = async (targetFolderId: string, folderTitle: string) => {
        if (!accessToken || !targetFolderId || isInitializing) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                type: '*/*',
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;
            const asset = result.assets[0];

            const metadata = {
                name: asset.name,
                mimeType: asset.mimeType || 'application/octet-stream',
                parents: [targetFolderId],
            };

            const fileData = await fetch(asset.uri);
            const blob = await fileData.blob();

            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }) as any);
            formData.append('file', blob as any, asset.name);

            const res = await fetch(DRIVE_UPLOAD_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            setSnackbarMsg(`Uploaded "${asset.name}" to ${folderTitle}!`);
            setRefreshSeed((prev) => prev + 1);
        } catch (e: any) {
            setSnackbarMsg(`Upload error: ${e.message}`);
        }
    };

    // ============================================================================
    // FILE ACTIONS
    // ============================================================================

    const handleRename = async () => {
        if (!fileToRename || !renameInput.trim() || !accessToken) return;
        try {
            const res = await fetch(`${DRIVE_API_URL}/${fileToRename.id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: renameInput.trim() }),
            });

            if (!res.ok) throw new Error('Failed to rename file');
            setSnackbarMsg('File renamed successfully');
            setIsRenameDialogVisible(false);
            setFileToRename(null);
            setRefreshSeed((prev) => prev + 1);
        } catch (e: any) {
            setSnackbarMsg(`Error: ${e.message}`);
        }
    };

    const confirmDelete = async () => {
        if (!fileToDelete || !accessToken) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`${DRIVE_API_URL}/${fileToDelete.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) throw new Error('Failed to delete');
            setSnackbarMsg(`"${fileToDelete.name}" deleted`);
            setFileToDelete(null);
            setRefreshSeed((prev) => prev + 1);
        } catch (e: any) {
            setSnackbarMsg(`Delete failed: ${e.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleShareFile = async (file: DriveFile) => {
        const shareUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
        try {
            if (Platform.OS === 'web') {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareUrl);
                    setSnackbarMsg('Share link copied to clipboard!');
                } else {
                    prompt('Share Link:', shareUrl);
                }
            } else {
                await Share.share({
                    message: `Google Drive File: ${file.name}\n${shareUrl}`,
                    url: shareUrl,
                });
            }
        } catch (e: any) {
            setSnackbarMsg(`Share error: ${e.message}`);
        }
    };

    const isGlobalDisabled = isInitializing || !accessToken;

    return (
        <SafeAreaProvider>
            <PaperProvider theme={MD3LightTheme}>
                <SafeAreaView style={styles.container}>
                    {/* Header */}
                    <Appbar.Header elevated mode="small">
                        <Appbar.Content
                            title="Google Drive Dataset Manager"
                            subtitle={isInitializing ? 'Initializing subfolders...' : `User: ${userGUID}`}
                        />
                        <Appbar.Action
                            icon="refresh"
                            disabled={isGlobalDisabled}
                            onPress={() => {
                                setRefreshSeed((prev) => prev + 1);
                            }}
                        />
                    </Appbar.Header>

                    <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
                        {/* Top Info Banner */}
                        <Card style={styles.bannerCard} mode="outlined">
                            <Card.Content style={styles.bannerContent}>
                                <Avatar.Icon size={40} icon="folder-account" style={styles.bannerIcon} />
                                <View style={{ flex: 1 }}>
                                    <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                                        Active User Workspace
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: '#5F6368' }}>
                                        User GUID: {userGUID}
                                    </Text>
                                </View>
                            </Card.Content>
                        </Card>

                        {isInitializing ? (
                            <View style={styles.centerLoading}>
                                <ActivityIndicator size="large" />
                                <Text style={{ marginTop: 12, color: '#5F6368' }}>
                                    Creating and verifying dataset subfolders...
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.sectionsContainer}>
                                {/* SECTION 1: dataset_shop_images */}
                                <View style={styles.sectionBlock}>
                                    <SelectFilesForGoogleDriveDNDComponent
                                        label="Add dataset_shop_images"
                                        targetFolderId={userFolders?.shopImagesId || ''}
                                        accessToken={accessToken}
                                        disabled={isGlobalDisabled || !userFolders?.shopImagesId}
                                        onUploadSuccess={(fname) => {
                                            setSnackbarMsg(`Uploaded "${fname}" to dataset_shop_images!`);
                                            setRefreshSeed((prev) => prev + 1);
                                        }}
                                        onUploadError={(err) => setSnackbarMsg(err)}
                                    />
                                    <ListFilesForGoogleDriveDNDComponent
                                        key={`shop-list-${refreshSeed}`}
                                        title="dataset_shop_images"
                                        folderId={userFolders?.shopImagesId || ''}
                                        accessToken={accessToken}
                                        disabled={isGlobalDisabled || !userFolders?.shopImagesId}
                                        onRenamePress={(file) => {
                                            setFileToRename(file);
                                            setRenameInput(file.name);
                                            setIsRenameDialogVisible(true);
                                        }}
                                        onDeletePress={(file) => setFileToDelete(file)}
                                        onSharePress={handleShareFile}
                                        onUploadSuccess={(fname) => {
                                            setSnackbarMsg(`Uploaded "${fname}" to dataset_shop_images`);
                                        }}
                                        onUploadError={(err) => setSnackbarMsg(err)}
                                    />
                                </View>

                                {/* SECTION 2: dataset_trend_images */}
                                <View style={styles.sectionBlock}>
                                    <SelectFilesForGoogleDriveDNDComponent
                                        label="Add dataset_trend_images"
                                        targetFolderId={userFolders?.trendImagesId || ''}
                                        accessToken={accessToken}
                                        disabled={isGlobalDisabled || !userFolders?.trendImagesId}
                                        onUploadSuccess={(fname) => {
                                            setSnackbarMsg(`Uploaded "${fname}" to dataset_trend_images!`);
                                            setRefreshSeed((prev) => prev + 1);
                                        }}
                                        onUploadError={(err) => setSnackbarMsg(err)}
                                    />
                                    <ListFilesForGoogleDriveDNDComponent
                                        key={`trend-list-${refreshSeed}`}
                                        title="dataset_trend_images"
                                        folderId={userFolders?.trendImagesId || ''}
                                        accessToken={accessToken}
                                        disabled={isGlobalDisabled || !userFolders?.trendImagesId}
                                        onRenamePress={(file) => {
                                            setFileToRename(file);
                                            setRenameInput(file.name);
                                            setIsRenameDialogVisible(true);
                                        }}
                                        onDeletePress={(file) => setFileToDelete(file)}
                                        onSharePress={handleShareFile}
                                        onUploadSuccess={(fname) => {
                                            setSnackbarMsg(`Uploaded "${fname}" to dataset_trend_images`);
                                        }}
                                        onUploadError={(err) => setSnackbarMsg(err)}
                                    />
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Left-Aligned Floating Action Button with MD3 Default Colors */}
                    <SpeedDialFAB
                        open={isFabOpen}
                        visible={!isInitializing}
                        icon="plus"
                        position="left"
                        actions={[
                            {
                                icon: 'image-plus',
                                label: 'add dataset_shop_images',
                                containerColor: '#E8F5E9',
                                color: '#1B5E20',
                                onPress: () => {
                                    if (userFolders?.shopImagesId) {
                                        void handleUploadToTargetFolder(userFolders.shopImagesId, 'dataset_shop_images');
                                    }
                                },
                            },
                            {
                                icon: 'folder-image',
                                label: 'add dataset_trend_images',
                                containerColor: '#FEF7D2',
                                color: '#B45309',
                                onPress: () => {
                                    if (userFolders?.trendImagesId) {
                                        void handleUploadToTargetFolder(userFolders.trendImagesId, 'dataset_trend_images');
                                    }
                                },
                            },
                        ]}
                        onStateChange={({ open }) => setIsFabOpen(open)}
                    />

                    {/* Custom Nice Modal: AskBeforeDeleteGoogleFile */}
                    <AskBeforeDeleteGoogleFile
                        visible={!!fileToDelete}
                        file={fileToDelete}
                        onDismiss={() => setFileToDelete(null)}
                        onConfirm={confirmDelete}
                        isDeleting={isDeleting}
                    />

                    {/* Rename File Dialog */}
                    <Portal>
                        <Dialog visible={isRenameDialogVisible} onDismiss={() => setIsRenameDialogVisible(false)}>
                            <Dialog.Title>Rename File</Dialog.Title>
                            <Dialog.Content>
                                <TextInput
                                    label="File Name"
                                    value={renameInput}
                                    onChangeText={setRenameInput}
                                    mode="outlined"
                                    autoFocus
                                />
                            </Dialog.Content>
                            <Dialog.Actions>
                                <Button onPress={() => setIsRenameDialogVisible(false)}>Cancel</Button>
                                <Button
                                    onPress={() => {
                                        void handleRename();
                                    }}
                                >
                                    Save
                                </Button>
                            </Dialog.Actions>
                        </Dialog>
                    </Portal>

                    {/* Feedback Snackbar */}
                    <Snackbar
                        visible={!!snackbarMsg}
                        onDismiss={() => setSnackbarMsg('')}
                        duration={3500}
                    >
                        {snackbarMsg}
                    </Snackbar>
                </SafeAreaView>
            </PaperProvider>
        </SafeAreaProvider>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    mainScroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 110,
        maxWidth: 960,
        width: '100%',
        alignSelf: 'center',
    },
    bannerCard: {
        backgroundColor: '#FFFFFF',
        marginBottom: 16,
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    bannerIcon: {
        marginRight: 12,
    },
    sectionsContainer: {
        gap: 20,
    },
    sectionBlock: {
        gap: 10,
    },
    dndCard: {
        backgroundColor: '#FFFFFF',
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderRadius: 8,
    },
    dndCardHovered: {
        borderWidth: 2,
    },
    dndContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    dndIcon: {
        marginRight: 12,
    },
    dndTextContainer: {
        flex: 1,
    },
    dndTitle: {
        fontWeight: '600',
    },
    dndSubtitle: {
        color: '#5F6368',
    },
    listContainerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E2EC',
    },
    listDropZoneActive: {
        borderWidth: 2,
        borderColor: '#0B57D0',
        backgroundColor: '#F0F4F9',
    },
    listHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    listFolderIcon: {
        marginRight: 8,
    },
    listSectionTitle: {
        fontWeight: '700',
    },
    badgeCount: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 8,
    },
    uploadingNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 6,
        marginBottom: 8,
    },
    emptyDropPrompt: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#DADCE0',
        borderRadius: 8,
        marginVertical: 4,
    },
    innerFileCard: {
        marginVertical: 4,
        backgroundColor: '#FAFBFD',
    },
    fileCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    fileDetails: {
        flex: 1,
        marginLeft: 12,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    centerLoading: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    disabledOpacity: {
        opacity: 0.5,
    },
    fabLeftAnchor: {
        position: 'absolute',
        left: 16,
        bottom: 16,
        zIndex: 999,
    },
    leftSpeedDial: {
        alignItems: 'flex-start',
    },
    deleteDialog: {
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        maxWidth: 440,
        alignSelf: 'center',
        width: '90%',
    },
    deleteHeaderIconWrapper: {
        alignItems: 'center',
        marginTop: 20,
    },
    deleteTitle: {
        textAlign: 'center',
        paddingTop: 8,
        fontWeight: 'bold',
    },
    deleteContentText: {
        textAlign: 'center',
        color: '#444746',
        marginBottom: 12,
    },
    deleteFileNameBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E2EC',
        marginBottom: 8,
    },
    deleteFileNameText: {
        fontWeight: '600',
        color: '#1F1F1F',
        flex: 1,
        marginLeft: 8,
    },
    deleteWarningText: {
        textAlign: 'center',
        color: '#D93025',
        fontSize: 12,
    },
    deleteActions: {
        justifyContent: 'space-between',
        paddingBottom: 16,
        paddingHorizontal: 20,
        gap: 12,
    },
});
