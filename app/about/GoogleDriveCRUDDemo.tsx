import React, { useState, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    FlatList,
    Platform,
    Alert,
    Dimensions,
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
    Chip,
    Avatar,
} from 'react-native-paper';
import { SpeedDialFAB } from '../../components/common';

import * as DocumentPicker from 'expo-document-picker';

// ============================================================================
// ENV VARIABLES RESOLUTION
// ============================================================================

// Fallbacks are included to ensure seamless execution across Expo web & mobile
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
    // Uses fallback or process.env when babel plugin is bundling
}

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    modifiedTime?: string;
    parents?: string[];
}

interface BreadcrumbItem {
    id: string;
    name: string;
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function App() {
    // --- Auth & Access Token State ---
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState<boolean>(true);

    // --- Drive Navigation & State ---
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [currentFolder, setCurrentFolder] = useState<BreadcrumbItem>({
        id: ENV_VARS.FOLDER_ID,
        name: 'Root Folder',
    });
    const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
        { id: ENV_VARS.FOLDER_ID, name: 'Root Folder' },
    ]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');

    // --- Modal & Action States ---
    const [isFolderDialogVisible, setIsFolderDialogVisible] = useState<boolean>(false);
    const [folderNameInput, setFolderNameInput] = useState<string>('');

    const [isDocDialogVisible, setIsDocDialogVisible] = useState<boolean>(false);
    const [docNameInput, setDocNameInput] = useState<string>('Untitled.txt');
    const [docContentInput, setDocContentInput] = useState<string>('');
    const [editingFileId, setEditingFileId] = useState<string | null>(null);

    const [menuAnchor, setMenuAnchor] = useState<{ [key: string]: boolean }>({});

    const [isRenameDialogVisible, setIsRenameDialogVisible] = useState<boolean>(false);
    const [renameInput, setRenameInput] = useState<string>('');
    const [fileToRename, setFileToRename] = useState<DriveFile | null>(null);

    const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
    const [previewContent, setPreviewContent] = useState<string>('');
    const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

    // --- Feedback ---
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
                throw new Error(data.error_description || 'Unable to refresh Google access token');
            }

            setAccessToken(data.access_token);
            return data.access_token;
        } catch (err: any) {
            setSnackbarMsg(`Auth Error: ${err.message}`);
            return null;
        }
    }, []);

    // Initialize Auth on Startup
    useEffect(() => {
        (async () => {
            setIsAuthenticating(true);
            await getValidAccessToken();
            setIsAuthenticating(false);
        })();
    }, [getValidAccessToken]);

    // ============================================================================
    // CRUD OPERATIONS
    // ============================================================================

    const fetchFiles = useCallback(
        async (folderId: string, query: string = '', tokenOverride?: string) => {
            const token = tokenOverride || accessToken;
            if (!token) return;

            setIsLoading(true);
            try {
                let q = `'${folderId}' in parents and trashed = false`;
                if (query.trim().length > 0) {
                    q = `name contains '${query.trim()}' and trashed = false and '${folderId}' in parents`;
                }

                const fields = 'files(id, name, mimeType, size, modifiedTime, parents)';
                const url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(
                    fields
                )}&orderBy=folder,name`;

                let res = await fetch(url, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                // Auto-refresh token if expired (401)
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
                setFiles(data.files || []);
            } catch (err: any) {
                setSnackbarMsg(err.message);
            } finally {
                setIsLoading(false);
            }
        },
        [accessToken, getValidAccessToken]
    );

    useEffect(() => {
        if (accessToken) {
            fetchFiles(currentFolder.id, searchQuery);
        }
    }, [accessToken, currentFolder.id]);

    // 1. Create Folder
    const handleCreateFolder = async () => {
        if (!folderNameInput.trim() || !accessToken) return;
        setIsLoading(true);
        try {
            const res = await fetch(DRIVE_API_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: folderNameInput.trim(),
                    mimeType: FOLDER_MIME,
                    parents: [currentFolder.id],
                }),
            });

            if (!res.ok) throw new Error('Failed to create folder');
            setSnackbarMsg(`Folder "${folderNameInput}" created`);
            setFolderNameInput('');
            setIsFolderDialogVisible(false);
            fetchFiles(currentFolder.id);
        } catch (e: any) {
            setSnackbarMsg(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Create or Update Text Document
    const handleSaveTextDoc = async () => {
        if (!docNameInput.trim() || !accessToken) return;
        setIsLoading(true);
        try {
            const boundary = '----DriveUploadBoundary';
            const metadata = {
                name: docNameInput.trim(),
                mimeType: 'text/plain',
                ...(editingFileId ? {} : { parents: [currentFolder.id] }),
            };

            const multipartBody =
                `--${boundary}\r\n` +
                `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
                `${JSON.stringify(metadata)}\r\n` +
                `--${boundary}\r\n` +
                `Content-Type: text/plain\r\n\r\n` +
                `${docContentInput}\r\n` +
                `--${boundary}--`;

            const url = editingFileId
                ? `https://www.googleapis.com/upload/drive/v3/files/${editingFileId}?uploadType=multipart`
                : DRIVE_UPLOAD_URL;

            const res = await fetch(url, {
                method: editingFileId ? 'PATCH' : 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                },
                body: multipartBody,
            });

            if (!res.ok) throw new Error('Failed to save file');

            setSnackbarMsg(editingFileId ? 'File updated!' : 'File created!');
            setIsDocDialogVisible(false);
            setDocNameInput('Untitled.txt');
            setDocContentInput('');
            setEditingFileId(null);
            fetchFiles(currentFolder.id);
        } catch (e: any) {
            setSnackbarMsg(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // 3. Upload File
    const handleUploadFile = async () => {
        if (!accessToken) return;
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
                parents: [currentFolder.id],
            };

            const fileData = await fetch(asset.uri);
            const blob = await fileData.blob();

            const formData = new FormData();
            formData.append(
                'metadata',
                new Blob([JSON.stringify(metadata)], { type: 'application/json' }) as any
            );
            formData.append('file', blob as any, asset.name);

            const res = await fetch(DRIVE_UPLOAD_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
                body: formData,
            });

            if (!res.ok) throw new Error('Failed to upload file');

            setSnackbarMsg(`Uploaded "${asset.name}"`);
            fetchFiles(currentFolder.id);
        } catch (e: any) {
            setSnackbarMsg(`Upload failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // 4. Rename File or Folder
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

            if (!res.ok) throw new Error('Failed to rename item');
            setSnackbarMsg('Item renamed successfully');
            setIsRenameDialogVisible(false);
            setFileToRename(null);
            fetchFiles(currentFolder.id);
        } catch (e: any) {
            setSnackbarMsg(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // 5. Delete File or Folder
    const handleDelete = async (file: DriveFile) => {
        const executeDelete = async () => {
            if (!accessToken) return;
            setIsLoading(true);
            try {
                const res = await fetch(`${DRIVE_API_URL}/${file.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!res.ok) throw new Error('Failed to delete');
                setSnackbarMsg(`"${file.name}" deleted`);
                fetchFiles(currentFolder.id);
            } catch (e: any) {
                setSnackbarMsg(`Error: ${e.message}`);
            } finally {
                setIsLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`Are you sure you want to delete "${file.name}"?`)) {
                executeDelete();
            }
        } else {
            Alert.alert('Confirm Delete', `Are you sure you want to delete "${file.name}"?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: executeDelete },
            ]);
        }
    };

    // 6. Preview / Read Content
    const handlePreviewFile = async (file: DriveFile) => {
        if (file.mimeType === FOLDER_MIME) {
            setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
            setCurrentFolder({ id: file.id, name: file.name });
            return;
        }

        setPreviewFile(file);
        setIsPreviewLoading(true);
        try {
            const res = await fetch(`${DRIVE_API_URL}/${file.id}?alt=media`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!res.ok) throw new Error('Cannot load content');
            const text = await res.text();
            setPreviewContent(text);
        } catch (e: any) {
            setPreviewContent(`(Cannot preview or binary content: ${e.message})`);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    // Helper formatting
    const formatBytes = (bytes?: string) => {
        if (!bytes) return '—';
        const num = parseInt(bytes, 10);
        if (isNaN(num)) return '—';
        if (num < 1024) return `${num} B`;
        if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
        return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    };

    const renderFileIcon = (mimeType: string) => {
        if (mimeType === FOLDER_MIME) return 'folder';
        if (mimeType.includes('image')) return 'file-image';
        if (mimeType.includes('pdf')) return 'file-pdf-box';
        if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'file-excel';
        if (mimeType.includes('text')) return 'file-document-outline';
        return 'file-outline';
    };

    return (
        <SafeAreaProvider>
            <PaperProvider theme={MD3LightTheme}>
                <SafeAreaView style={styles.container}>
                    {/* Header */}
                    <Appbar.Header elevated mode="small">
                        <Appbar.Content title="Google Drive CRUD" subtitle={currentFolder.name} />
                        <Appbar.Action
                            icon="refresh"
                            onPress={() => fetchFiles(currentFolder.id, searchQuery)}
                        />
                    </Appbar.Header>

                    <View style={styles.mainWrapper}>
                        {/* Search Bar */}
                        <View style={styles.searchContainer}>
                            <Searchbar
                                placeholder="Search in this folder..."
                                onChangeText={setSearchQuery}
                                value={searchQuery}
                                onSubmitEditing={() => fetchFiles(currentFolder.id, searchQuery)}
                                onClearIconPress={() => {
                                    setSearchQuery('');
                                    fetchFiles(currentFolder.id, '');
                                }}
                                style={styles.searchbar}
                            />
                        </View>

                        {/* Breadcrumb Navigation */}
                        <View style={styles.breadcrumbContainer}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {breadcrumbs.map((crumb, index) => (
                                    <View key={crumb.id} style={styles.breadcrumbItem}>
                                        <Chip
                                            icon={index === 0 ? 'home' : 'folder-outline'}
                                            selected={index === breadcrumbs.length - 1}
                                            onPress={() => {
                                                setBreadcrumbs((prev) => prev.slice(0, index + 1));
                                                setCurrentFolder(crumb);
                                            }}
                                            style={styles.chip}
                                        >
                                            {crumb.name}
                                        </Chip>
                                        {index < breadcrumbs.length - 1 && (
                                            <Text style={styles.breadcrumbSeparator}>/</Text>
                                        )}
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Content Listing */}
                        {isAuthenticating || (isLoading && files.length === 0) ? (
                            <View style={styles.centerContainer}>
                                <ActivityIndicator size="large" />
                                <Text style={styles.loadingText}>
                                    {isAuthenticating ? 'Connecting to Drive API...' : 'Loading files...'}
                                </Text>
                            </View>
                        ) : files.length === 0 ? (
                            <View style={styles.centerContainer}>
                                <Avatar.Icon size={64} icon="folder-open-outline" />
                                <Text variant="titleMedium" style={{ marginTop: 12 }}>
                                    This folder is empty
                                </Text>
                                <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                                    Use the + button below to create files or folders.
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={files}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.listContent}
                                renderItem={({ item }) => {
                                    const isFolder = item.mimeType === FOLDER_MIME;
                                    const menuVisible = !!menuAnchor[item.id];

                                    return (
                                        <Card
                                            style={styles.fileCard}
                                            mode="elevated"
                                            onPress={() => handlePreviewFile(item)}
                                        >
                                            <Card.Title
                                                title={item.name}
                                                titleNumberOfLines={1}
                                                subtitle={`${isFolder ? 'Folder' : formatBytes(item.size)} • ${
                                                    item.modifiedTime
                                                        ? new Date(item.modifiedTime).toLocaleDateString()
                                                        : ''
                                                }`}
                                                left={(props) => (
                                                    <Avatar.Icon
                                                        {...props}
                                                        icon={renderFileIcon(item.mimeType)}
                                                        style={{
                                                            backgroundColor: isFolder ? '#E8F0FE' : '#F1F3F4',
                                                        }}
                                                        color={isFolder ? '#1A73E8' : '#5F6368'}
                                                    />
                                                )}
                                                right={(props) => (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                        <Menu
                                                            visible={menuVisible}
                                                            onDismiss={() =>
                                                                setMenuAnchor((prev) => ({ ...prev, [item.id]: false }))
                                                            }
                                                            anchor={
                                                                <IconButton
                                                                    {...props}
                                                                    icon="dots-vertical"
                                                                    onPress={() =>
                                                                        setMenuAnchor((prev) => ({
                                                                            ...prev,
                                                                            [item.id]: true,
                                                                        }))
                                                                    }
                                                                />
                                                            }
                                                        >
                                                            {!isFolder && (
                                                                <Menu.Item
                                                                    onPress={() => {
                                                                        setMenuAnchor((prev) => ({ ...prev, [item.id]: false }));
                                                                        setEditingFileId(item.id);
                                                                        setDocNameInput(item.name);
                                                                        fetch(`${DRIVE_API_URL}/${item.id}?alt=media`, {
                                                                            headers: { Authorization: `Bearer ${accessToken}` },
                                                                        })
                                                                            .then((r) => r.text())
                                                                            .then((t) => setDocContentInput(t))
                                                                            .catch(() => setDocContentInput(''));
                                                                        setIsDocDialogVisible(true);
                                                                    }}
                                                                    leadingIcon="pencil"
                                                                    title="Edit Content"
                                                                />
                                                            )}
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
                                                                    handleDelete(item);
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

                        {/* FAB Actions */}
                        <SpeedDialFAB
                            open={isFabOpen}
                            visible={!!accessToken}
                            icon="plus"
                            position="right"
                            actions={[
                                {
                                    icon: 'folder-plus',
                                    label: 'New Folder',
                                    onPress: () => setIsFolderDialogVisible(true),
                                },
                                {
                                    icon: 'file-document-plus',
                                    label: 'New Text Document',
                                    onPress: () => {
                                        setEditingFileId(null);
                                        setDocNameInput('Untitled.txt');
                                        setDocContentInput('');
                                        setIsDocDialogVisible(true);
                                    },
                                },
                                {
                                    icon: 'upload',
                                    label: 'Upload Local File',
                                    onPress: handleUploadFile,
                                },
                            ]}
                            onStateChange={({ open }) => setIsFabOpen(open)}
                        />
                    </View>

                    {/* ================================================================ */}
                    {/* DIALOGS */}
                    {/* ================================================================ */}

                    {/* 1. Folder Creation */}
                    <Portal>
                        <Dialog
                            visible={isFolderDialogVisible}
                            onDismiss={() => setIsFolderDialogVisible(false)}
                        >
                            <Dialog.Title>Create New Folder</Dialog.Title>
                            <Dialog.Content>
                                <TextInput
                                    label="Folder Name"
                                    value={folderNameInput}
                                    onChangeText={setFolderNameInput}
                                    mode="outlined"
                                    placeholder="e.g. Invoices"
                                    autoFocus
                                />
                            </Dialog.Content>
                            <Dialog.Actions>
                                <Button onPress={() => setIsFolderDialogVisible(false)}>Cancel</Button>
                                <Button onPress={handleCreateFolder}>Create</Button>
                            </Dialog.Actions>
                        </Dialog>
                    </Portal>

                    {/* 2. File Editor Dialog */}
                    <Portal>
                        <Dialog
                            visible={isDocDialogVisible}
                            onDismiss={() => setIsDocDialogVisible(false)}
                            style={{ maxHeight: Dimensions.get('window').height * 0.8 }}
                        >
                            <Dialog.Title>
                                {editingFileId ? 'Edit File' : 'New Text Document'}
                            </Dialog.Title>
                            <Dialog.ScrollArea>
                                <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
                                    <TextInput
                                        label="File Name"
                                        value={docNameInput}
                                        onChangeText={setDocNameInput}
                                        mode="outlined"
                                        style={{ marginBottom: 12 }}
                                    />
                                    <TextInput
                                        label="Content"
                                        value={docContentInput}
                                        onChangeText={setDocContentInput}
                                        mode="outlined"
                                        multiline
                                        numberOfLines={8}
                                        placeholder="Type content..."
                                    />
                                </ScrollView>
                            </Dialog.ScrollArea>
                            <Dialog.Actions>
                                <Button onPress={() => setIsDocDialogVisible(false)}>Cancel</Button>
                                <Button onPress={handleSaveTextDoc}>Save</Button>
                            </Dialog.Actions>
                        </Dialog>
                    </Portal>

                    {/* 3. Rename Dialog */}
                    <Portal>
                        <Dialog
                            visible={isRenameDialogVisible}
                            onDismiss={() => setIsRenameDialogVisible(false)}
                        >
                            <Dialog.Title>Rename Item</Dialog.Title>
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
                                <Button onPress={handleRename}>Rename</Button>
                            </Dialog.Actions>
                        </Dialog>
                    </Portal>

                    {/* 4. Preview Dialog */}
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
        maxWidth: 900,
        width: '100%',
        alignSelf: 'center',
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 6,
    },
    searchbar: {
        elevation: 2,
        backgroundColor: '#FFFFFF',
    },
    breadcrumbContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    breadcrumbItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    chip: {
        marginRight: 4,
    },
    breadcrumbSeparator: {
        marginHorizontal: 4,
        color: '#888',
        fontSize: 16,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 90,
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
});
