import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    FlatList,
    Platform,
    Dimensions,
    Share,
    Linking,
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
    Menu,
    Divider,
    Searchbar,
    ActivityIndicator,
    Snackbar,
    Avatar,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const userGUID = '88888999999';
const SHOP_IMAGES_FOLDER_NAME = 'dataset_shop_images';
const TREND_IMAGES_FOLDER_NAME = 'dataset_trend_images';
const HIDDEN_FOLDERS = [SHOP_IMAGES_FOLDER_NAME, TREND_IMAGES_FOLDER_NAME];

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
    // Use fallback or process.env
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
// REUSABLE COMPONENT: SelectFilesForGoogleDriveDNDComponent
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
            onUploadError('Invalid session or target folder');
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

    // Web drag and drop listeners
    const webDnDProps =
        Platform.OS === 'web'
            ? {
                onDragOver: (e: any) => {
                    e.preventDefault();
                    if (!disabled) setIsHovered(true);
                },
                onDragLeave: (e: any) => {
                    e.preventDefault();
                    setIsHovered(false);
                },
                onDrop: async (e: any) => {
                    e.preventDefault();
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

    return (
        <Card
            style={[
                styles.dndCard,
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
                    <ActivityIndicator size="small" color="#1A73E8" />
                ) : (
                    <Avatar.Icon size={36} icon="cloud-upload-outline" style={styles.dndIcon} />
                )}
                <View style={styles.dndTextContainer}>
                    <Text variant="titleSmall" style={styles.dndTitle}>
                        {label}
                    </Text>
                    <Text variant="bodySmall" style={styles.dndSubtitle}>
                        {isUploading ? 'Uploading to Drive...' : 'Click or Drag & Drop file here'}
                    </Text>
                </View>
            </Card.Content>
        </Card>
    );
};

// ============================================================================
// ASK BEFORE DELETE MODAL COMPONENT
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
                <View style={styles.deleteHeaderIcon}>
                    <Avatar.Icon size={48} icon="trash-can-outline" style={{ backgroundColor: '#FCE8E6' }} color="#D93025" />
                </View>
                <Dialog.Title style={styles.deleteTitle}>Delete File?</Dialog.Title>
                <Dialog.Content>
                    <Text variant="bodyMedium" style={styles.deleteContentText}>
                        Are you sure you want to permanently delete{' '}
                        <Text style={{ fontWeight: 'bold' }}>"{file?.name}"</Text> from Google Drive?
                    </Text>
                </Dialog.Content>
                <Dialog.Actions style={styles.deleteActions}>
                    <Button onPress={onDismiss} disabled={isDeleting} textColor="#5F6368">
                        Cancel
                    </Button>
                    <Button
                        mode="contained"
                        buttonColor="#D93025"
                        textColor="#FFFFFF"
                        loading={isDeleting}
                        disabled={isDeleting}
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
// TOP CRUD PANEL COMPONENT
// ============================================================================

interface TopCrudProps {
    folders: UserFolderHierarchy | null;
    accessToken: string | null;
    disabled: boolean;
    onSuccess: (filename: string) => void;
    onError: (err: string) => void;
    onRefresh: () => void;
}

const TopCrudPanelGoogleDrive: React.FC<TopCrudProps> = ({
                                                             folders,
                                                             accessToken,
                                                             disabled,
                                                             onSuccess,
                                                             onError,
                                                             onRefresh,
                                                         }) => {
    return (
        <Card style={styles.topPanelCard} mode="elevated">
            <Card.Content>
                <View style={styles.topPanelHeader}>
                    <View>
                        <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                            Dataset Quick Uploads
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#5F6368' }}>
                            User GUID: {userGUID}
                        </Text>
                    </View>
                    <IconButton
                        icon="refresh"
                        size={20}
                        disabled={disabled}
                        onPress={() => {
                            void onRefresh();
                        }}
                    />
                </View>
                <View style={styles.dndRow}>
                    <View style={styles.dndCol}>
                        <SelectFilesForGoogleDriveDNDComponent
                            label="dataset_shop_images"
                            targetFolderId={folders?.shopImagesId || ''}
                            accessToken={accessToken}
                            disabled={disabled || !folders?.shopImagesId}
                            onUploadSuccess={onSuccess}
                            onUploadError={onError}
                        />
                    </View>
                    <View style={styles.dndCol}>
                        <SelectFilesForGoogleDriveDNDComponent
                            label="dataset_trend_images"
                            targetFolderId={folders?.trendImagesId || ''}
                            accessToken={accessToken}
                            disabled={disabled || !folders?.trendImagesId}
                            onUploadSuccess={onSuccess}
                            onUploadError={onError}
                        />
                    </View>
                </View>
            </Card.Content>
        </Card>
    );
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function App() {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState<boolean>(true);
    const [userFolders, setUserFolders] = useState<UserFolderHierarchy | null>(null);

    const [files, setFiles] = useState<DriveFile[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [menuAnchor, setMenuAnchor] = useState<{ [key: string]: boolean }>({});

    const [isRenameDialogVisible, setIsRenameDialogVisible] = useState<boolean>(false);
    const [renameInput, setRenameInput] = useState<string>('');
    const [fileToRename, setFileToRename] = useState<DriveFile | null>(null);

    const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
    const [previewContent, setPreviewContent] = useState<string>('');
    const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

    const [snackbarMsg, setSnackbarMsg] = useState<string>('');
    const [isFabOpen, setIsFabOpen] = useState<boolean>(false);

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
    // AUTO CREATE SUBFOLDERS ON INITIALIZATION
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

    const createSubfolders = useCallback(
        async (token: string) => {
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
                setSnackbarMsg(`Setup folders error: ${err.message}`);
                return null;
            } finally {
                setIsInitializing(false);
            }
        },
        []
    );

    // Initialize Auth & Subfolder creation
    useEffect(() => {
        (async () => {
            const token = await getValidAccessToken();
            if (token) {
                const hierarchy = await createSubfolders(token);
                if (hierarchy) {
                    void fetchFiles(hierarchy.userRootId, '', token);
                }
            }
        })();
    }, [getValidAccessToken, createSubfolders]);

    // ============================================================================
    // GOOGLE DRIVE FILE CRUD
    // ============================================================================

    const fetchFiles = useCallback(
        async (folderId?: string, query: string = '', tokenOverride?: string) => {
            const activeFolderId = folderId || userFolders?.userRootId;
            const token = tokenOverride || accessToken;
            if (!token || !activeFolderId) return;

            setIsLoading(true);
            try {
                let q = `'${activeFolderId}' in parents and trashed = false`;
                if (query.trim().length > 0) {
                    q = `name contains '${query.trim()}' and trashed = false and '${activeFolderId}' in parents`;
                }

                const fields = 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)';
                const url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(
                    fields
                )}&orderBy=folder,name`;

                let res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (res.status === 401) {
                    const freshToken = await getValidAccessToken();
                    if (!freshToken) return;
                    res = await fetch(url, {
                        headers: { Authorization: `Bearer ${freshToken}` },
                    });
                }

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error?.message || 'Failed to fetch items');
                }

                const data = await res.json();
                // Exclude dataset_shop_images and dataset_trend_images from view
                const visibleFiles = (data.files || []).filter(
                    (file: DriveFile) => !HIDDEN_FOLDERS.includes(file.name)
                );
                setFiles(visibleFiles);
            } catch (err: any) {
                setSnackbarMsg(err.message);
            } finally {
                setIsLoading(false);
            }
        },
        [accessToken, userFolders, getValidAccessToken]
    );

    // Upload Local File to user root
    const handleUploadFileToRoot = async () => {
        if (!accessToken || !userFolders?.userRootId || isInitializing) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                type: '*/*',
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;
            const asset = result.assets[0];

            setIsLoading(true);
            const metadata = {
                name: asset.name,
                mimeType: asset.mimeType || 'application/octet-stream',
                parents: [userFolders.userRootId],
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

            if (!res.ok) throw new Error('Failed to upload file');
            setSnackbarMsg(`Uploaded "${asset.name}" successfully!`);
            void fetchFiles();
        } catch (e: any) {
            setSnackbarMsg(`Upload failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Rename
    const handleRename = async () => {
        if (!fileToRename || !renameInput.trim() || !accessToken) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${DRIVE_API_URL}/${fileToRename.id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: renameInput.trim() }),
            });

            if (!res.ok) throw new Error('Failed to rename');
            setSnackbarMsg('Renamed successfully');
            setIsRenameDialogVisible(false);
            setFileToRename(null);
            void fetchFiles();
        } catch (e: any) {
            setSnackbarMsg(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Delete
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
            void fetchFiles();
        } catch (e: any) {
            setSnackbarMsg(`Error: ${e.message}`);
        } finally {
            setIsDeleting(false);
        }
    };

    // Download
    const handleDownloadFile = async (file: DriveFile) => {
        if (!accessToken) return;
        try {
            const url = `${DRIVE_API_URL}/${file.id}?alt=media`;
            if (Platform.OS === 'web') {
                const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
                const blob = await res.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                a.remove();
            } else {
                if (file.webContentLink) {
                    await Linking.openURL(file.webContentLink);
                } else {
                    await Linking.openURL(url);
                }
            }
            setSnackbarMsg(`Downloading "${file.name}"...`);
        } catch (e: any) {
            setSnackbarMsg(`Download failed: ${e.message}`);
        }
    };

    // Share
    const handleShareFile = async (file: DriveFile) => {
        const shareUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
        try {
            if (Platform.OS === 'web') {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareUrl);
                    setSnackbarMsg('Share link copied to clipboard!');
                } else {
                    prompt('Copy Drive file share link:', shareUrl);
                }
            } else {
                await Share.share({
                    message: `Check out "${file.name}" on Google Drive: ${shareUrl}`,
                    url: shareUrl,
                });
            }
        } catch (e: any) {
            setSnackbarMsg(`Share error: ${e.message}`);
        }
    };

    // Preview
    const handlePreviewFile = async (file: DriveFile) => {
        setPreviewFile(file);
        setIsPreviewLoading(true);
        try {
            const res = await fetch(`${DRIVE_API_URL}/${file.id}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) throw new Error('Cannot load text content');
            const text = await res.text();
            setPreviewContent(text);
        } catch (e: any) {
            setPreviewContent(`(Preview unavailable for binary/media files: ${e.message})`);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const formatBytes = (bytes?: string) => {
        if (!bytes) return '—';
        const num = parseInt(bytes, 10);
        if (isNaN(num)) return '—';
        if (num < 1024) return `${num} B`;
        if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
        return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    };

    const renderFileIcon = (mimeType: string) => {
        if (mimeType.includes('image')) return 'file-image';
        if (mimeType.includes('pdf')) return 'file-pdf-box';
        if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'file-excel';
        if (mimeType.includes('text')) return 'file-document-outline';
        return 'file-outline';
    };

    const isGlobalDisabled = isInitializing || !accessToken;

    return (
        <SafeAreaProvider>
            <PaperProvider theme={MD3LightTheme}>
                <SafeAreaView style={styles.container}>
                    {/* Header */}
                    <Appbar.Header elevated mode="small">
                        <Appbar.Content
                            title="Google Drive Manager"
                            subtitle={isInitializing ? 'Setting up folders...' : `GUID: ${userGUID}`}
                        />
                        <Appbar.Action
                            icon="refresh"
                            disabled={isGlobalDisabled}
                            onPress={() => {
                                void fetchFiles(userFolders?.userRootId, searchQuery);
                            }}
                        />
                    </Appbar.Header>

                    <View style={styles.mainWrapper}>
                        {/* Top CRUD Panel */}
                        <TopCrudPanelGoogleDrive
                            folders={userFolders}
                            accessToken={accessToken}
                            disabled={isGlobalDisabled}
                            onSuccess={(filename) => {
                                setSnackbarMsg(`Uploaded "${filename}" successfully!`);
                            }}
                            onError={(err) => setSnackbarMsg(err)}
                            onRefresh={() => {
                                void fetchFiles();
                            }}
                        />

                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Searchbar
                                placeholder="Search files..."
                                onChangeText={setSearchQuery}
                                value={searchQuery}
                                disabled={isGlobalDisabled}
                                onSubmitEditing={() => {
                                    void fetchFiles(userFolders?.userRootId, searchQuery);
                                }}
                                onClearIconPress={() => {
                                    setSearchQuery('');
                                    void fetchFiles(userFolders?.userRootId, '');
                                }}
                                style={styles.searchbar}
                            />
                        </View>

                        {/* Content Listing */}
                        {isInitializing || (isLoading && files.length === 0) ? (
                            <View style={styles.centerContainer}>
                                <ActivityIndicator size="large" />
                                <Text style={styles.loadingText}>
                                    {isInitializing ? 'Creating and syncing subfolders...' : 'Loading files...'}
                                </Text>
                            </View>
                        ) : files.length === 0 ? (
                            <View style={styles.centerContainer}>
                                <Avatar.Icon size={64} icon="file-search-outline" />
                                <Text variant="titleMedium" style={{ marginTop: 12 }}>
                                    No files found
                                </Text>
                                <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                                    Use the quick upload dropzones or the upload button on the bottom left.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={files}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.listContent}
                                renderItem={({ item }) => {
                                    const menuVisible = !!menuAnchor[item.id];

                                    return (
                                        <Card
                                            style={styles.fileCard}
                                            mode="elevated"
                                            onPress={() => {
                                                void handlePreviewFile(item);
                                            }}
                                        >
                                            <Card.Title
                                                title={item.name}
                                                titleNumberOfLines={1}
                                                subtitle={`${formatBytes(item.size)} • ${
                                                    item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString() : ''
                                                }`}
                                                left={(props) => (
                                                    <Avatar.Icon
                                                        {...props}
                                                        icon={renderFileIcon(item.mimeType)}
                                                        style={{ backgroundColor: '#F1F3F4' }}
                                                        color="#5F6368"
                                                    />
                                                )}
                                                right={(props) => (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <IconButton
                                                            {...props}
                                                            icon="download-outline"
                                                            disabled={isGlobalDisabled}
                                                            onPress={() => {
                                                                void handleDownloadFile(item);
                                                            }}
                                                        />
                                                        <IconButton
                                                            {...props}
                                                            icon="share-variant-outline"
                                                            disabled={isGlobalDisabled}
                                                            onPress={() => {
                                                                void handleShareFile(item);
                                                            }}
                                                        />
                                                        <Menu
                                                            visible={menuVisible}
                                                            onDismiss={() =>
                                                                setMenuAnchor((prev) => ({ ...prev, [item.id]: false }))
                                                            }
                                                            anchor={
                                                                <IconButton
                                                                    {...props}
                                                                    icon="dots-vertical"
                                                                    disabled={isGlobalDisabled}
                                                                    onPress={() =>
                                                                        setMenuAnchor((prev) => ({
                                                                            ...prev,
                                                                            [item.id]: true,
                                                                        }))
                                                                    }
                                                                />
                                                            }
                                                        >
                                                            <Menu.Item
                                                                onPress={() => {
                                                                    setMenuAnchor((prev) => ({ ...prev, [item.id]: false }));
                                                                    setFileToRename(item);
                                                                    setRenameInput(item.name);
                                                                    setIsRenameDialogVisible(true);
                                                                }}
                                                                leadingIcon="rename-box"
                                                                title="Rename"
                                                            />
                                                            <Divider />
                                                            <Menu.Item
                                                                onPress={() => {
                                                                    setMenuAnchor((prev) => ({ ...prev, [item.id]: false }));
                                                                    setFileToDelete(item);
                                                                }}
                                                                leadingIcon="delete"
                                                                title="Delete"
                                                                titleStyle={{ color: 'red' }}
                                                            />
                                                        </Menu>
                                                    </View>
                                                )}
                                            />
                                        </Card>
                                    );
                                }}
                            />
                        )}

                        {/* Left-Aligned Floating Action Button */}
                        <View style={styles.fabLeftContainer}>
                            <FAB
                                icon="upload"
                                label="Upload File"
                                disabled={isGlobalDisabled}
                                style={[styles.leftFab, isGlobalDisabled && styles.disabledOpacity]}
                                onPress={() => {
                                    void handleUploadFileToRoot();
                                }}
                            />
                        </View>
                    </View>

                    {/* ================================================================ */}
                    {/* DIALOGS & MODALS */}
                    {/* ================================================================ */}

                    {/* Ask Before Delete Modal */}
                    <AskBeforeDeleteGoogleFile
                        visible={!!fileToDelete}
                        file={fileToDelete}
                        onDismiss={() => setFileToDelete(null)}
                        onConfirm={confirmDelete}
                        isDeleting={isDeleting}
                    />

                    {/* Rename Dialog */}
                    <Portal>
                        <Dialog
                            visible={isRenameDialogVisible}
                            onDismiss={() => setIsRenameDialogVisible(false)}
                        >
                            <Dialog.Title>Rename File</Dialog.Title>
                            <Dialog.Content>
                                <TextInput
                                    label="New Name"
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

                    {/* Preview Dialog */}
                    <Portal>
                        <Dialog
                            visible={!!previewFile}
                            onDismiss={() => {
                                setPreviewFile(null);
                                setPreviewContent('');
                            }}
                            style={{ maxHeight: Dimensions.get('window').height * 0.8 }}
                        >
                            <Dialog.Title>{previewFile?.name}</Dialog.Title>
                            <Dialog.ScrollArea>
                                <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
                                    {isPreviewLoading ? (
                                        <ActivityIndicator size="small" />
                                    ) : (
                                        <Text style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }}>
                                            {previewContent}
                                        </Text>
                                    )}
                                </ScrollView>
                            </Dialog.ScrollArea>
                            <Dialog.Actions>
                                <Button
                                    onPress={() => {
                                        setPreviewFile(null);
                                        setPreviewContent('');
                                    }}
                                >
                                    Close
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
    mainWrapper: {
        flex: 1,
        maxWidth: 960,
        width: '100%',
        alignSelf: 'center',
    },
    topPanelCard: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 6,
        backgroundColor: '#FFFFFF',
    },
    topPanelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    dndRow: {
        flexDirection: 'row',
        gap: 12,
        flexWrap: 'wrap',
    },
    dndCol: {
        flex: 1,
        minWidth: 260,
    },
    dndCard: {
        backgroundColor: '#FAFAFA',
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: '#C4C7C5',
        borderRadius: 8,
    },
    dndCardHovered: {
        borderColor: '#1A73E8',
        backgroundColor: '#E8F0FE',
    },
    dndContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    dndIcon: {
        backgroundColor: '#E8F0FE',
        marginRight: 10,
    },
    dndTextContainer: {
        flex: 1,
    },
    dndTitle: {
        fontWeight: '600',
        color: '#1F1F1F',
    },
    dndSubtitle: {
        color: '#747775',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 6,
    },
    searchbar: {
        elevation: 1,
        backgroundColor: '#FFFFFF',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100,
    },
    fileCard: {
        marginVertical: 4,
        backgroundColor: '#FFFFFF',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        color: '#666',
    },
    disabledOpacity: {
        opacity: 0.5,
    },
    fabLeftContainer: {
        position: 'absolute',
        left: 20,
        bottom: 24,
        zIndex: 10,
    },
    leftFab: {
        backgroundColor: '#1A73E8',
    },
    deleteDialog: {
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
    },
    deleteHeaderIcon: {
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
    },
    deleteActions: {
        justifyContent: 'center',
        paddingBottom: 16,
        paddingHorizontal: 16,
        gap: 12,
    },
});
