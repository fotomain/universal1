import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    StyleSheet,
    View,
    FlatList,
    Platform,
    Pressable,
    ListRenderItemInfo,
} from 'react-native';
import {
    Card,
    Text,
    Button,
    ActivityIndicator,
} from 'react-native-paper';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import {
    TextInputApp,
    IconApp,
    type DroppedFileItem,
} from '../../kit8/components/common';
import {
    setShopImagesCount,
    setTrendImagesCount,
    setGoogleDriveUploading,
} from '../../kit8/redux/onTrendSlice';
import {
    googleDrive,
    type GoogleDriveCredentials,
    type GoogleDriveFileInfo,
} from '../../kit8/google/drive/googleDrive';

// ============================================================================
// CONFIGURATION & HELPERS
// ============================================================================

const ENV_VARS = {
    FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
    REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || '',
};

const credentialsConfig: GoogleDriveCredentials = {
    clientId: ENV_VARS.CLIENT_ID,
    clientSecret: ENV_VARS.CLIENT_SECRET,
    refreshToken: ENV_VARS.REFRESH_TOKEN,
};

export type DriveFile = GoogleDriveFileInfo;

export interface PendingUploadBatch {
    sourceName: string;
    targetFolderId: string;
    targetFolderName: string;
    files: Array<{ name: string; mimeType: string; blob?: Blob | File; uri?: string; base64?: string; path?: string; size?: number }>;
    themeVariant?: 'green' | 'yellow' | 'default';
}

export const formatBytes = (bytes?: string | number) => {
    if (bytes === undefined || bytes === null || bytes === '') return '—';
    const num = typeof bytes === 'number' ? bytes : parseInt(bytes, 10);
    if (isNaN(num) || num < 0) return '—';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

// Helper to extract files & subdirectories recursively from DragEvent DataTransfer on Web
async function extractFilesAndFoldersFromDataTransfer(
    dataTransfer: DataTransfer
): Promise<{
    folderName: string;
    files: Array<{ name: string; mimeType: string; blob: Blob | File; path?: string; size?: number }>;
    isFolder: boolean;
}> {
    const items = dataTransfer.items;
    const fileList: Array<{ name: string; mimeType: string; blob: Blob | File; path?: string; size?: number }> = [];
    let detectedFolderName = 'Dropped Files';
    let isFolder = false;

    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === 'function') {
        const entries: any[] = [];
        for (let i = 0; i < items.length; i++) {
            const entry = (items[i] as any).webkitGetAsEntry();
            if (entry) {
                entries.push(entry);
                if (entry.isDirectory) {
                    isFolder = true;
                    if (detectedFolderName === 'Dropped Files') {
                        detectedFolderName = entry.name;
                    }
                }
            }
        }

        async function readEntry(entry: any, path = ''): Promise<void> {
            if (entry.isFile) {
                await new Promise<void>((resolve) => {
                    entry.file(
                        (file: File) => {
                            fileList.push({
                                name: file.name,
                                mimeType: file.type || 'application/octet-stream',
                                blob: file,
                                path: path ? `${path}/${file.name}` : file.name,
                                size: file.size,
                            });
                            resolve();
                        },
                        () => resolve()
                    );
                });
            } else if (entry.isDirectory) {
                isFolder = true;
                const dirReader = entry.createReader();
                const readAllEntries = async (): Promise<any[]> => {
                    const allEntries: any[] = [];
                    const readBatch = async (): Promise<any[]> => {
                        return new Promise((resolve) => {
                            dirReader.readEntries(
                                (results: any[]) => resolve(results),
                                () => resolve([])
                            );
                        });
                    };
                    let batch: any[] = await readBatch();
                    while (batch.length > 0) {
                        allEntries.push(...batch);
                        batch = await readBatch();
                    }
                    return allEntries;
                };

                const childEntries = await readAllEntries();
                for (const child of childEntries) {
                    await readEntry(child, path ? `${path}/${entry.name}` : entry.name);
                }
            }
        }

        for (const entry of entries) {
            await readEntry(entry);
        }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
        for (let i = 0; i < dataTransfer.files.length; i++) {
            const file = dataTransfer.files[i];
            fileList.push({
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                blob: file,
                size: file.size,
            });
        }
    }

    return { folderName: detectedFolderName, files: fileList, isFolder };
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface ListFilesForGoogleDriveDNDProps {
    title: string;
    folderId: string;
    accessToken: string | null;
    disabled: boolean;
    onFilesLoaded?: (count: number) => void;
    onRequestApproval?: (batch: PendingUploadBatch) => void;
    onRenamePress: (file: DriveFile) => void;
    onDeletePress: (file: DriveFile) => void;
    onSharePress: (file: DriveFile) => void;
    onClearAll?: () => void;
    onUploadSuccess: (filename: string) => void;
    onUploadError: (err: string) => void;
}

// ============================================================================
// MAIN COMPONENT: ListFilesForGoogleDriveDNDComponent
// ============================================================================

export const ListFilesForGoogleDriveDNDComponent: React.FC<ListFilesForGoogleDriveDNDProps> = ({
    title,
    folderId,
    accessToken,
    disabled,
    onFilesLoaded,
    onRequestApproval,
    onRenamePress,
    onDeletePress,
    onSharePress,
    onClearAll,
    onUploadSuccess,
    onUploadError,
}) => {
    const [folderFiles, setFolderFiles] = useState<DriveFile[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [isDragOver, setIsDragOver] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);
    const [uploadStatusText, setUploadStatusText] = useState<string>('');
    const listUploadAbortControllerRef = useRef<AbortController | null>(null);
    const dropContainerRef = useRef<View>(null);
    const dispatch = useDispatch();

    // Keep Redux counts in sync
    useEffect(() => {
        if (title.includes('shop') || title.includes('dataset_shop_images')) {
            dispatch(setShopImagesCount(folderFiles.length));
        } else if (title.includes('trend') || title.includes('dataset_trend_images')) {
            dispatch(setTrendImagesCount(folderFiles.length));
        }
    }, [folderFiles.length, title, dispatch]);

    useEffect(() => {
        dispatch(setGoogleDriveUploading(isUploading));
    }, [isUploading, dispatch]);

    // Client-side search filtering
    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return folderFiles;
        const query = searchQuery.trim().toLowerCase();
        return folderFiles.filter((f) => (f.name || '').toLowerCase().includes(query));
    }, [folderFiles, searchQuery]);

    // Fetch all files from Google Drive folder (with full pagination)
    const fetchFolderFiles = useCallback(async () => {
        if (!accessToken || !folderId) return;
        setLoading(true);
        try {
            const { files } = await googleDrive.listFiles(
                { accessToken, ...credentialsConfig },
                {},
                {
                    parentId: folderId,
                    fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink)',
                    orderBy: 'name',
                    pageSize: 1000,
                    fetchAllPages: true,
                }
            );
            const driveFiles: DriveFile[] = files || [];
            setFolderFiles(driveFiles);
            onFilesLoaded?.(driveFiles.length);
        } catch (err: any) {
            onUploadError(err.message || 'Failed to list files');
        } finally {
            setLoading(false);
        }
    }, [accessToken, folderId, onUploadError, onFilesLoaded]);

    useEffect(() => {
        if (folderId && accessToken) {
            void fetchFolderFiles();
        }
    }, [folderId, accessToken, fetchFolderFiles]);

    const handleCancelUpload = () => {
        if (listUploadAbortControllerRef.current) {
            listUploadAbortControllerRef.current.abort();
        }
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatusText('');
        onUploadError('Upload cancelled');
        void fetchFolderFiles();
    };

    const processAndUploadFiles = async (filesList: DroppedFileItem[]) => {
        if (!accessToken || !folderId || filesList.length === 0) return;
        setIsUploading(true);
        setUploadProgress(0);
        const controller = new AbortController();
        listUploadAbortControllerRef.current = controller;

        try {
            const totalFiles = filesList.length;
            let lastFileName = '';

            for (let i = 0; i < totalFiles; i++) {
                if (controller.signal.aborted) break;
                const fileItem = filesList[i];
                setUploadStatusText(`Uploading "${fileItem.name}" (${i + 1}/${totalFiles})`);

                await googleDrive.createFile(
                    { accessToken, ...credentialsConfig },
                    fileItem,
                    {
                        parentId: folderId,
                        signal: controller.signal,
                        dispatch,
                        rowOwnerGUID: 'userGUID',
                        rowParentGUID: 'Clothes1',
                        orderInList: i,
                        onProgress: (percent) => {
                            const fileFraction = percent / 100;
                            const overallPercent = Math.min(
                                99,
                                Math.round(((i + fileFraction) / totalFiles) * 100)
                            );
                            setUploadProgress(overallPercent);
                        },
                    }
                );

                lastFileName = fileItem.name;
                setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                onUploadSuccess(fileItem.name);
            }

            if (!controller.signal.aborted) {
                setUploadProgress(100);
                setUploadStatusText('Upload completed!');
                setTimeout(() => {
                    setIsUploading(false);
                    setUploadProgress(0);
                    setUploadStatusText('');
                    void fetchFolderFiles();
                }, 300);
            }
        } catch (e: any) {
            setIsUploading(false);
            setUploadProgress(0);
            setUploadStatusText('');
            if (axios.isCancel(e) || e.name === 'CanceledError' || controller.signal.aborted) {
                onUploadError('Upload cancelled');
            } else {
                onUploadError(e.message || 'Error during drop upload');
            }
            void fetchFolderFiles();
        }
    };

    // Attach DOM drag listeners directly to the container on Web
    useEffect(() => {
        if (Platform.OS !== 'web' || !dropContainerRef.current) return;
        const domNode = (dropContainerRef.current as any) as HTMLElement;
        if (!domNode || typeof domNode.addEventListener !== 'function') return;

        let counter = 0;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter++;
            if (!disabled) {
                setIsDragOver(true);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            if (!isDragOver && !disabled) {
                setIsDragOver(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter--;
            if (counter <= 0) {
                counter = 0;
                setIsDragOver(false);
            }
        };

        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter = 0;
            setIsDragOver(false);
            if (disabled || !e.dataTransfer) return;

            const { folderName, files } = await extractFilesAndFoldersFromDataTransfer(e.dataTransfer);
            if (!files.length) return;

            if (onRequestApproval) {
                onRequestApproval({
                    sourceName: folderName,
                    targetFolderId: folderId,
                    targetFolderName: title,
                    files,
                    themeVariant: title.includes('shop') ? 'green' : 'yellow',
                });
            } else {
                await processAndUploadFiles(files);
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
    }, [disabled, isDragOver]);

    // Render individual file item using FlatList
    const renderFileItem = useCallback(
        ({ item: file }: ListRenderItemInfo<DriveFile>) => (
            <Card key={file.id} style={styles.innerFileCard} mode="outlined">
                <View style={styles.fileCardRow}>
                    <View style={[styles.fileCardIconBox, { backgroundColor: '#F1F3F4' }]}>
                        <IconApp
                            name={file.mimeType && file.mimeType.includes('image') ? 'image' : 'description'}
                            size={22}
                            color="#5F6368"
                        />
                    </View>
                    <View style={styles.fileDetails}>
                        <Text variant="bodyMedium" numberOfLines={1} style={{ fontWeight: '500' }}>
                            {file.name}
                        </Text>
                        <Text variant="labelSmall" style={{ color: '#747775' }}>
                            {formatBytes(file.size)} • {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                        </Text>
                    </View>
                    <View style={styles.actionButtonsRow}>
                        <Pressable
                            disabled={disabled}
                            onPress={() => onRenamePress(file)}
                            style={({ pressed }) => [
                                styles.fileActionBtn,
                                { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Rename file"
                        >
                            <IconApp name="edit" size={20} color="#5F6368" />
                        </Pressable>
                        <Pressable
                            disabled={disabled}
                            onPress={() => onSharePress(file)}
                            style={({ pressed }) => [
                                styles.fileActionBtn,
                                { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Share file"
                        >
                            <IconApp name="share" size={20} color="#5F6368" />
                        </Pressable>
                        <Pressable
                            disabled={disabled}
                            onPress={() => onDeletePress(file)}
                            style={({ pressed }) => [
                                styles.fileActionBtn,
                                { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Delete file"
                        >
                            <IconApp name="delete" size={20} color="#D93025" />
                        </Pressable>
                    </View>
                </View>
            </Card>
        ),
        [disabled, onRenamePress, onSharePress, onDeletePress]
    );

    const keyExtractor = useCallback(
        (item: DriveFile, index: number) => item.id || `${item.name}-${index}`,
        []
    );

    // List Header Component
    const renderListHeader = useMemo(
        () => (
            <View style={{ marginBottom: 8 }}>
                {/* Search, Count Badge & Refresh Row */}
                <View style={styles.listHeaderRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                        <TextInputApp
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder={`Search ${title} by filename...`}
                            leftIcon="search"
                            disabled={disabled || loading}
                            style={styles.searchTextInput}
                        />
                    </View>
                    <View style={styles.badgeCount}>
                        <Text variant="labelSmall" style={{ fontWeight: 'bold', color: '#1F1F1F' }}>
                            {searchQuery ? `${filteredFiles.length}/${folderFiles.length}` : folderFiles.length}
                        </Text>
                    </View>
                    {onClearAll && folderFiles.length > 0 && (
                        <Pressable
                            onPress={() => {
                                onClearAll();
                            }}
                            disabled={disabled || loading || isUploading}
                            style={({ pressed }) => [
                                styles.clearAllHeaderBtn,
                                { opacity: (disabled || loading || isUploading) ? 0.4 : pressed ? 0.6 : 1 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Clear all files in ${title}`}
                            testID={`clearAllBtn-${title}`}
                        >
                            <IconApp name="delete" size={16} color="#D93025" />
                            <Text variant="labelSmall" style={styles.clearAllHeaderText}>
                                Clear all
                            </Text>
                        </Pressable>
                    )}
                    <Pressable
                        onPress={() => {
                            void fetchFolderFiles();
                        }}
                        disabled={disabled || loading}
                        style={({ pressed }) => [
                            styles.iconActionBtn,
                            { opacity: (disabled || loading) ? 0.4 : pressed ? 0.6 : 1 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Refresh files"
                    >
                        <IconApp name="refresh" size={20} color="#5F6368" />
                    </Pressable>
                </View>

                {/* Uploading Status & Progress Bar */}
                {isUploading && (
                    <View style={styles.listUploadingCard}>
                        <View style={styles.listUploadingHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                <ActivityIndicator size="small" color="#1A73E8" style={{ marginRight: 8 }} />
                                <Text variant="bodySmall" numberOfLines={1} style={{ fontWeight: '600', color: '#1F1F1F', flex: 1 }}>
                                    {uploadStatusText || 'Uploading to Drive...'}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.listUploadPercentBadge}>
                                    <Text variant="labelSmall" style={styles.listUploadPercentText}>
                                        {uploadProgress}%
                                    </Text>
                                </View>
                                <Pressable
                                    style={styles.cancelUploadPill}
                                    onPress={handleCancelUpload}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancel active upload"
                                >
                                    <IconApp
                                        name="cancel"
                                        size={14}
                                        color="#D93025"
                                    />
                                    <Text variant="labelSmall" style={styles.cancelUploadPillText}>
                                        Cancel
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.listUploadSliderTrack}>
                            <View
                                style={[
                                    styles.listUploadSliderFill,
                                    {
                                        width: `${Math.max(uploadProgress, 4)}%`,
                                    },
                                ]}
                            />
                        </View>
                    </View>
                )}

                {/* Drag Over Overlay */}
                {isDragOver && (
                    <View style={styles.listDragOverOverlay} pointerEvents="none">
                        <View style={[styles.modalHeaderIconCircle, { backgroundColor: title.includes('shop') ? '#E8F5E9' : '#FEF7D2' }]}>
                            <IconApp
                                name="folder_zip"
                                size={32}
                                color={title.includes('shop') ? '#1B5E20' : '#B45309'}
                            />
                        </View>
                        <Text variant="titleMedium" style={{ fontWeight: '700', color: title.includes('shop') ? '#1B5E20' : '#B45309', marginTop: 10 }}>
                            Drop folder or files to add
                        </Text>
                        <Text variant="bodySmall" style={{ color: '#5F6368', marginTop: 4 }}>
                            Review & approve additions to "{title}"
                        </Text>
                    </View>
                )}
            </View>
        ),
        [
            searchQuery,
            title,
            disabled,
            loading,
            filteredFiles.length,
            folderFiles.length,
            fetchFolderFiles,
            isUploading,
            uploadStatusText,
            uploadProgress,
            isDragOver,
        ]
    );

    // List Empty Component
    const renderListEmpty = useMemo(() => {
        if (loading) {
            return <ActivityIndicator size="small" style={{ marginVertical: 24 }} />;
        }
        if (folderFiles.length === 0) {
            return (
                <View style={styles.emptyDropPrompt}>
                    <IconApp name="upload_file" size={36} color="#9AA0A6" />
                    <Text variant="bodySmall" style={{ color: '#5F6368', marginTop: 4 }}>
                        No files yet. Drag files over this zone to trigger instant upload.
                    </Text>
                </View>
            );
        }
        if (filteredFiles.length === 0) {
            return (
                <View style={styles.emptySearchPrompt}>
                    <IconApp name="find_in_page" size={36} color="#9AA0A6" />
                    <Text variant="bodySmall" style={{ color: '#5F6368', marginTop: 4, textAlign: 'center' }}>
                        No files matching "{searchQuery}"
                    </Text>
                    <Button mode="text" compact onPress={() => setSearchQuery('')} textColor="#1A73E8" style={{ marginTop: 4 }}>
                        Clear search
                    </Button>
                </View>
            );
        }
        return null;
    }, [loading, folderFiles.length, filteredFiles.length, searchQuery]);

    return (
        <View ref={dropContainerRef} style={{ width: '100%' }}>
            <Card
                style={[
                    styles.listContainerCard,
                    disabled && styles.disabledOpacity,
                ]}
                mode="elevated"
            >
                <Card.Content>
                    <FlatList
                        data={filteredFiles}
                        renderItem={renderFileItem}
                        keyExtractor={keyExtractor}
                        ListHeaderComponent={renderListHeader}
                        ListEmptyComponent={renderListEmpty}
                        initialNumToRender={15}
                        maxToRenderPerBatch={20}
                        windowSize={7}
                        removeClippedSubviews={Platform.OS !== 'web'}
                        scrollEnabled={false}
                        contentContainerStyle={{ flexGrow: 1 }}
                    />
                </Card.Content>
            </Card>
        </View>
    );
};

export default ListFilesForGoogleDriveDNDComponent;

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    listContainerCard: {
        marginTop: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    disabledOpacity: {
        opacity: 0.5,
    },
    listHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    searchTextInput: {
        backgroundColor: '#F8F9FA',
    },
    badgeCount: {
        backgroundColor: '#E0E2EC',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 8,
    },
    iconActionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
    },
    clearAllHeaderBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFCDD2',
        marginLeft: 6,
    },
    clearAllHeaderText: {
        color: '#D93025',
        fontWeight: '700',
        fontSize: 11,
        marginLeft: 3,
    },
    listUploadingCard: {
        backgroundColor: '#E8F0FE',
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#D2E3FC',
    },
    listUploadingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    listUploadPercentBadge: {
        backgroundColor: '#1A73E8',
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
        marginRight: 6,
    },
    listUploadPercentText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 10,
    },
    cancelUploadPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FCE8E6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FAD2CF',
        cursor: 'pointer',
    },
    cancelUploadPillText: {
        color: '#D93025',
        fontWeight: '600',
        fontSize: 10,
        marginLeft: 2,
    },
    listUploadSliderTrack: {
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
    },
    listUploadSliderFill: {
        height: '100%',
        backgroundColor: '#1A73E8',
        borderRadius: 2,
    },
    listDragOverOverlay: {
        borderWidth: 2,
        borderColor: '#1A73E8',
        borderStyle: 'dashed',
        borderRadius: 12,
        backgroundColor: 'rgba(232, 240, 254, 0.9)',
        paddingVertical: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 8,
    },
    modalHeaderIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyDropPrompt: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
        borderWidth: 1,
        borderColor: '#E0E2EC',
        borderStyle: 'dashed',
        borderRadius: 8,
        marginTop: 8,
    },
    emptySearchPrompt: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 24,
    },
    innerFileCard: {
        backgroundColor: '#FFFFFF',
        marginBottom: 8,
        borderRadius: 8,
    },
    fileCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    fileCardIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fileDetails: {
        flex: 1,
        marginLeft: 12,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    fileActionBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 2,
    },
});
