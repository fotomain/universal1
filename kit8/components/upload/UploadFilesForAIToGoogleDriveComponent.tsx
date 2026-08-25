import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    Platform,
    Share,
    Pressable,
} from 'react-native';
import axios, { AxiosProgressEvent } from 'axios';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
    Provider as PaperProvider,
    MD3LightTheme,
    Appbar,
    Card,
    Text,
    Button,
    TextInput,
    Portal,
    Dialog,
    ActivityIndicator,
    Snackbar,
} from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import {
    ReceiveDraggableFilesComponent,
    type DroppedFileItem,
    SpeedDialFAB,
    TextInputApp,
    IconApp,
} from '../common';
import { useDispatch } from 'react-redux';
import {
    setShopImagesCount,
    setTrendImagesCount,
    setGoogleDriveUploading,
} from '../../redux/onTrendSlice';

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const SHOP_IMAGES_FOLDER_NAME = 'dataset_shop_images';
const TREND_IMAGES_FOLDER_NAME = 'dataset_trend_images';

// Hardcoded safe fallbacks to prevent process.env / @env crashes
const ENV_VARS = {
    FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '1CSG6zHm5Dof61lDMngp5rcmxQZXp1pWb',
    CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_PLACEHOLDER',
    CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'GOOGLE_CLIENT_SECRET_PLACEHOLDER',
    REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN || 'GOOGLE_REFRESH_TOKEN_PLACEHOLDER',
};

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export const formatBytes = (bytes?: string | number) => {
    if (bytes === undefined || bytes === null || bytes === '') return '—';
    const num = typeof bytes === 'number' ? bytes : parseInt(bytes, 10);
    if (isNaN(num) || num < 0) return '—';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    if (num < 1024 * 1024 * 1024) return `${(num / (1024 * 1024)).toFixed(1)} MB`;
    return `${(num / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

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

export interface DroppedFilePayload {
    name: string;
    mimeType?: string;
    uri?: string;
    blob?: Blob | File;
    size?: number;
    path?: string;
}

export interface PendingUploadBatch {
    sourceName: string;
    targetFolderId: string;
    targetFolderName: string;
    files: Array<{ name: string; mimeType: string; blob?: Blob | File; uri?: string; base64?: string; path?: string; size?: number }>;
    themeVariant?: 'green' | 'yellow' | 'default';
}

// Helper to extract files & subdirectories recursively from DragEvent DataTransfer
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
// MODAL: AskBeforeDeleteGoogleFile (Reusable for Single File or Clear All)
// ============================================================================

interface AskBeforeDeleteProps {
    visible: boolean;
    file?: DriveFile | null;
    folderTitle?: string | null;
    onDismiss: () => void;
    onCancel?: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    deleteProgress: number;
    deleteStatusText?: string;
}

const AskBeforeDeleteGoogleFile: React.FC<AskBeforeDeleteProps> = ({
    visible,
    file,
    folderTitle,
    onDismiss,
    onCancel,
    onConfirm,
    isDeleting,
    deleteProgress,
    deleteStatusText,
}) => {
    const isFolderClear = !!folderTitle;

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={isDeleting ? undefined : onDismiss} style={styles.deleteDialog}>
                <View style={styles.deleteHeaderIconWrapper}>
                    <View style={[styles.modalHeaderIconCircle, { backgroundColor: '#FCE8E6' }]}>
                        <IconApp
                            name={isFolderClear ? 'folder_off' : 'delete'}
                            size={28}
                            color="#D93025"
                        />
                    </View>
                </View>
                <Dialog.Title style={styles.deleteTitle}>
                    {isFolderClear ? `Clear all files?` : 'Delete File?'}
                </Dialog.Title>
                <Dialog.Content>
                    <Text variant="bodyMedium" style={styles.deleteContentText}>
                        {isFolderClear
                            ? `Are you sure you want to permanently delete all files in "${folderTitle}"?`
                            : 'Are you sure you want to permanently remove this file from your dataset?'}
                    </Text>
                    <View style={styles.deleteFileNameBox}>
                        <IconApp
                            name={isFolderClear ? 'folder' : 'description'}
                            size={22}
                            color="#5F6368"
                        />
                        <Text variant="bodyMedium" numberOfLines={2} style={styles.deleteFileNameText}>
                            {isFolderClear ? folderTitle : file?.name}
                        </Text>
                    </View>
                    <Text variant="bodySmall" style={styles.deleteWarningText}>
                        {isFolderClear
                            ? 'This action will permanently delete all files in this dataset folder and cannot be undone.'
                            : 'This action cannot be undone.'}
                    </Text>

                    {/* Deletion Progress & Percentage Slider during deletion */}
                    {isDeleting && (
                        <View style={styles.deleteProgressContainer}>
                            <View style={styles.deleteProgressHeader}>
                                <Text variant="labelMedium" numberOfLines={1} style={styles.deleteStatusText}>
                                    {deleteStatusText || 'Deleting files...'}
                                </Text>
                                <View style={styles.deletePercentBadge}>
                                    <Text variant="labelMedium" style={styles.deletePercentText}>
                                        {deleteProgress}%
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.deleteSliderTrack}>
                                <View
                                    style={[
                                        styles.deleteSliderFill,
                                        {
                                            width: `${Math.max(deleteProgress, 5)}%`,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    )}
                </Dialog.Content>
                <Dialog.Actions style={styles.deleteActions}>
                    <Button
                        onPress={isDeleting ? (onCancel || onDismiss) : onDismiss}
                        textColor={isDeleting ? '#D93025' : '#5F6368'}
                        style={{ flex: 1 }}
                        icon={isDeleting ? () => <IconApp name="cancel" size={18} color="#D93025" /> : undefined}
                    >
                        {isDeleting ? 'Cancel Deletion' : 'Cancel'}
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
                        {isDeleting
                            ? `Deleting (${deleteProgress}%)`
                            : isFolderClear
                            ? 'Clear all'
                            : 'Delete'}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

// ============================================================================
// MODAL: ApproveAdditionsModal (Custom Nice Modal to Approve Uploads)
// ============================================================================

interface ApproveAdditionsProps {
    visible: boolean;
    batch: PendingUploadBatch | null;
    isUploading: boolean;
    uploadProgress: number;
    uploadStatusText?: string;
    onDismiss: () => void;
    onCancel?: () => void;
    onApprove: () => void;
}

const ApproveAdditionsModal: React.FC<ApproveAdditionsProps> = ({
    visible,
    batch,
    isUploading,
    uploadProgress,
    uploadStatusText,
    onDismiss,
    onCancel,
    onApprove,
}) => {
    if (!batch) return null;

    const isGreen = batch.themeVariant === 'green' || batch.targetFolderName.includes('shop');
    const isYellow = batch.themeVariant === 'yellow' || batch.targetFolderName.includes('trend');

    const themeColors = isGreen
        ? {
              iconColor: '#1B5E20',
              iconBg: '#E8F5E9',
              btnColor: '#2E7D32',
          }
        : isYellow
        ? {
              iconColor: '#B45309',
              iconBg: '#FEF7D2',
              btnColor: '#D97706',
          }
        : {
              iconColor: '#1A73E8',
              iconBg: '#E8F0FE',
              btnColor: '#1A73E8',
          };

    const totalBytes = batch.files.reduce((acc, f) => acc + (f.blob ? (f.blob as any).size || 0 : (f.size || 0)), 0);

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={isUploading ? undefined : onDismiss} style={styles.approveDialog}>
                <View style={styles.approveHeaderIconWrapper}>
                    <View style={[styles.modalHeaderIconCircle, { backgroundColor: themeColors.iconBg }]}>
                        <IconApp
                            name="drive_folder_upload"
                            size={28}
                            color={themeColors.iconColor}
                        />
                    </View>
                </View>
                <Dialog.Title style={styles.approveTitle}>
                    Approve Additions
                </Dialog.Title>
                <Dialog.Content style={{ maxHeight: 420 }}>
                    <Text variant="bodyMedium" style={styles.approveContentText}>
                        Review files before adding them to <Text style={{ fontWeight: 'bold', color: themeColors.iconColor }}>"{batch.targetFolderName}"</Text>:
                    </Text>

                    {/* Batch Summary Card */}
                    <View style={[styles.batchSummaryBox, { backgroundColor: themeColors.iconBg }]}>
                        <IconApp
                            name="folder"
                            size={26}
                            color={themeColors.iconColor}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text variant="titleSmall" numberOfLines={1} style={{ fontWeight: '700', color: '#1F1F1F' }}>
                                {batch.sourceName}
                            </Text>
                            <Text variant="bodySmall" style={{ color: '#5F6368' }}>
                                {batch.files.length} file{batch.files.length !== 1 ? 's' : ''} • {formatBytes(totalBytes)}
                            </Text>
                        </View>
                    </View>

                    {/* Scrollable File Preview List */}
                    <Text variant="labelMedium" style={{ fontWeight: '700', color: '#5F6368', marginTop: 12, marginBottom: 6 }}>
                        Files ({batch.files.length}):
                    </Text>
                    <ScrollView style={styles.approveFilesScroll} nestedScrollEnabled>
                        {batch.files.map((file, idx) => (
                            <View key={`${file.name}-${idx}`} style={styles.approveFileRow}>
                                <View style={[styles.filePreviewIconBox, { backgroundColor: themeColors.iconBg }]}>
                                    <IconApp
                                        name={file.mimeType.includes('image') ? 'image' : 'description'}
                                        size={18}
                                        color={themeColors.iconColor}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text variant="bodySmall" numberOfLines={1} style={{ fontWeight: '500' }}>
                                        {file.path || file.name}
                                    </Text>
                                    <Text variant="labelSmall" style={{ color: '#747775' }}>
                                        {file.blob ? formatBytes((file.blob as any).size) : file.size ? formatBytes(file.size) : ''}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* Progress Slider during upload */}
                    {isUploading && (
                        <View style={styles.approveProgressContainer}>
                            <View style={styles.approveProgressHeader}>
                                <Text variant="labelMedium" numberOfLines={1} style={styles.approveStatusText}>
                                    {uploadStatusText || `Uploading... ${uploadProgress}%`}
                                </Text>
                                <View style={[styles.approvePercentBadge, { backgroundColor: themeColors.btnColor }]}>
                                    <Text variant="labelMedium" style={styles.approvePercentText}>
                                        {uploadProgress}%
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.approveSliderTrack}>
                                <View
                                    style={[
                                        styles.approveSliderFill,
                                        {
                                            width: `${Math.max(uploadProgress, 4)}%`,
                                            backgroundColor: themeColors.btnColor,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    )}
                </Dialog.Content>

                <Dialog.Actions style={styles.approveActions}>
                    <Button
                        onPress={isUploading ? (onCancel || onDismiss) : onDismiss}
                        textColor={isUploading ? '#D93025' : '#5F6368'}
                        style={{ flex: 1 }}
                        icon={isUploading ? () => <IconApp name="cancel" size={18} color="#D93025" /> : undefined}
                    >
                        {isUploading ? 'Cancel Upload' : 'Cancel'}
                    </Button>
                    <Button
                        mode="contained"
                        buttonColor={themeColors.btnColor}
                        textColor="#FFFFFF"
                        loading={isUploading}
                        disabled={isUploading}
                        icon={() => <IconApp name="cloud_upload" size={18} color="#FFFFFF" />}
                        style={{ flex: 1.4 }}
                        onPress={() => {
                            void onApprove();
                        }}
                    >
                        {isUploading
                            ? `Uploading (${uploadProgress}%)`
                            : `Upload (${batch.files.length})`}
                    </Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

// ============================================================================
// DND PICKER BUTTON: SelectFilesForGoogleDriveDNDComponent (Accordion Header + Drop)
// ============================================================================

interface SelectFilesDNDProps {
    label: string;
    targetFolderId: string;
    accessToken: string | null;
    disabled: boolean;
    isExpanded: boolean;
    fileCount?: number;
    onToggleExpand: () => void;
    onClearAll?: () => void;
    onRequestApproval?: (batch: PendingUploadBatch) => void;
    onUploadSuccess: (filename: string) => void;
    onUploadError: (err: string) => void;
    variant?: 'green' | 'yellow' | 'default';
}

const SelectFilesForGoogleDriveDNDComponent: React.FC<SelectFilesDNDProps> = ({
    label,
    targetFolderId,
    accessToken,
    disabled,
    isExpanded,
    fileCount,
    onToggleExpand,
    onClearAll,
    onRequestApproval,
    onUploadSuccess,
    onUploadError,
    variant,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const buttonDropRef = useRef<View>(null);
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setGoogleDriveUploading(isUploading));
    }, [isUploading, dispatch]);

    const isYellow = variant === 'yellow' || (!variant && (label.includes('trend') || label.includes('dataset_trend_images')));
    const isGreen = variant === 'green' || (!variant && (label.includes('shop') || label.includes('dataset_shop_images')));

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

    const uploadAbortControllerRef = useRef<AbortController | null>(null);

    const handleCancelUpload = (e?: any) => {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (uploadAbortControllerRef.current) {
            uploadAbortControllerRef.current.abort();
        }
        setIsUploading(false);
        setUploadProgress(0);
        onUploadError('Upload cancelled');
    };

    const uploadMultipleFiles = async (
        files: Array<{ name: string; mimeType?: string; blob?: Blob | File; uri?: string; base64?: string }>
    ) => {
        if (!accessToken || !targetFolderId || files.length === 0) return;
        setIsUploading(true);
        setUploadProgress(0);
        const controller = new AbortController();
        uploadAbortControllerRef.current = controller;

        try {
            const totalFiles = files.length;
            let lastFileName = '';

            for (let i = 0; i < totalFiles; i++) {
                if (controller.signal.aborted) break;
                const fileObj = files[i];

                const metadata = {
                    name: fileObj.name,
                    mimeType: fileObj.mimeType || 'application/octet-stream',
                    parents: [targetFolderId],
                };

                const formData = new FormData();
                formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

                let fileBlob: any = fileObj.blob;
                if (!fileBlob && fileObj.uri) {
                    const res = await fetch(fileObj.uri);
                    fileBlob = await res.blob();
                } else if (!fileBlob && fileObj.base64) {
                    const res = await fetch(fileObj.base64);
                    fileBlob = await res.blob();
                }

                formData.append('file', fileBlob, fileObj.name);

                await axios.post(DRIVE_UPLOAD_URL, formData, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    signal: controller.signal,
                    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                        if (progressEvent.total && progressEvent.total > 0) {
                            const fileFraction = progressEvent.loaded / progressEvent.total;
                            const overallPercent = Math.min(
                                99,
                                Math.round(((i + fileFraction) / totalFiles) * 100)
                            );
                            setUploadProgress(overallPercent);
                        }
                    },
                });

                lastFileName = fileObj.name;
                setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
            }

            if (!controller.signal.aborted) {
                setUploadProgress(100);
                setTimeout(() => {
                    onUploadSuccess(totalFiles > 1 ? `${totalFiles} files` : lastFileName);
                    setIsUploading(false);
                    setUploadProgress(0);
                }, 300);
            }
        } catch (e: any) {
            setIsUploading(false);
            setUploadProgress(0);
            if (axios.isCancel(e) || e.name === 'CanceledError' || controller.signal.aborted) {
                onUploadError('Upload cancelled');
            } else {
                onUploadError(e.message || 'Error uploading file(s)');
            }
        }
    };

    const handlePickFile = async () => {
        if (disabled || isUploading) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
                type: '*/*',
                multiple: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) return;

            const fileItems = await Promise.all(
                result.assets.map(async (asset) => {
                    const fileData = await fetch(asset.uri);
                    const blob = await fileData.blob();
                    return {
                        name: asset.name,
                        mimeType: asset.mimeType || 'application/octet-stream',
                        blob,
                        size: asset.size,
                    };
                })
            );

            if (fileItems.length > 1 && onRequestApproval) {
                onRequestApproval({
                    sourceName: `${fileItems.length} Selected Files`,
                    targetFolderId,
                    targetFolderName: label.replace('Add ', ''),
                    files: fileItems,
                    themeVariant: variant,
                });
            } else {
                await uploadMultipleFiles(fileItems);
            }
        } catch (err: any) {
            onUploadError(err.message);
        }
    };

    // User can select a folder on the button
    const handlePickFolder = () => {
        if (disabled || isUploading) return;
        if (Platform.OS === 'web') {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.setAttribute('webkitdirectory', '');
            input.setAttribute('directory', '');
            input.onchange = (e: any) => {
                const files = Array.from(e.target.files as FileList);
                if (!files.length) return;
                let folderName = 'Selected Folder';
                if ((files[0] as any).webkitRelativePath) {
                    const parts = (files[0] as any).webkitRelativePath.split('/');
                    if (parts.length > 1) folderName = parts[0];
                }
                const fileItems = files.map((f: File) => ({
                    name: f.name,
                    mimeType: f.type || 'application/octet-stream',
                    blob: f,
                    path: (f as any).webkitRelativePath || f.name,
                    size: f.size,
                }));

                if (onRequestApproval) {
                    onRequestApproval({
                        sourceName: folderName,
                        targetFolderId,
                        targetFolderName: label.replace('Add ', ''),
                        files: fileItems,
                        themeVariant: variant,
                    });
                } else {
                    void uploadMultipleFiles(fileItems);
                }
            };
            input.click();
        } else {
            void handlePickFile();
        }
    };

    // Attach native DOM drag & drop listeners directly to the button container on Web
    useEffect(() => {
        if (Platform.OS !== 'web' || !buttonDropRef.current) return;
        const domNode = (buttonDropRef.current as any) as HTMLElement;
        if (!domNode || typeof domNode.addEventListener !== 'function') return;

        let counter = 0;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter++;
            if (!disabled) {
                setIsHovered(true);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            if (!isHovered && !disabled) {
                setIsHovered(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter--;
            if (counter <= 0) {
                counter = 0;
                setIsHovered(false);
            }
        };

        const handleDrop = async (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter = 0;
            setIsHovered(false);
            if (disabled || !e.dataTransfer) return;

            // User can drag folder or multiple files:
            const { folderName, files } = await extractFilesAndFoldersFromDataTransfer(e.dataTransfer);
            if (!files.length) return;

            if (onRequestApproval) {
                onRequestApproval({
                    sourceName: folderName,
                    targetFolderId,
                    targetFolderName: label.replace('Add ', ''),
                    files,
                    themeVariant: variant,
                });
            } else {
                await uploadMultipleFiles(files);
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
    }, [disabled, isHovered, accessToken, targetFolderId, onRequestApproval]);

    const buttonIcon = isHovered
        ? 'download'
        : isGreen
        ? 'storefront'
        : isYellow
        ? 'trending_up'
        : 'cloud_upload';

    return (
        <View ref={buttonDropRef} style={{ width: '100%' }}>
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
            >
                <Card.Content style={styles.dndContent}>
                    {/* Left Touchable: File Pick & Drop Target */}
                    <Pressable
                        style={styles.dndLeftTouchable}
                        onPress={() => {
                            void handlePickFile();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${label}. Click to pick file or drop files here`}
                    >
                        <View
                            style={[
                                styles.iconBadge,
                                {
                                    backgroundColor: themeColors.iconBg,
                                    borderColor: isHovered ? themeColors.border : themeColors.border + '50',
                                },
                            ]}
                        >
                            {isUploading ? (
                                <ActivityIndicator size="small" color={themeColors.iconColor} />
                            ) : (
                                <IconApp
                                    name={buttonIcon}
                                    size={24}
                                    color={themeColors.iconColor}
                                />
                            )}
                        </View>
                        <View style={styles.dndTextContainer}>
                            <View style={styles.titleRow}>
                                <Text variant="titleSmall" style={[styles.dndTitle, { color: themeColors.title }]}>
                                    {label}
                                </Text>
                                {isUploading && (
                                    <View style={[styles.percentBadge, { backgroundColor: themeColors.iconBg, borderColor: themeColors.border + '70' }]}>
                                        <Text variant="labelSmall" style={[styles.percentText, { color: themeColors.iconColor }]}>
                                            {uploadProgress}%
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.subtitleRow}>
                                <Text variant="bodySmall" style={[styles.dndSubtitle, { color: themeColors.subtitle }]}>
                                    {isUploading
                                        ? `Uploading to Drive... ${uploadProgress}%`
                                        : isHovered
                                        ? '📥 Drop files here to upload instantly'
                                        : 'Click or drop files here to upload'}
                                </Text>
                                {isUploading && (
                                    <Pressable
                                        style={styles.cancelUploadPill}
                                        onPress={handleCancelUpload}
                                        accessibilityRole="button"
                                        accessibilityLabel="Cancel upload"
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
                                )}
                            </View>

                            {/* Progress Slider Bar */}
                            {isUploading && (
                                <View style={styles.sliderContainer}>
                                    <View style={styles.sliderTrack}>
                                        <View
                                            style={[
                                                styles.sliderFill,
                                                {
                                                    width: `${Math.max(uploadProgress, 4)}%`,
                                                    backgroundColor: themeColors.iconColor,
                                                },
                                            ]}
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                    </Pressable>

                    {/* Right Action Cluster: Clear All (if files exist) + Select Folder Icon Only + Accordion Chevron */}
                    <View style={styles.dndRightActions}>
                        {onClearAll && typeof fileCount === 'number' && fileCount > 0 && (
                            <Pressable
                                style={({ pressed }) => [
                                    styles.clearAllInsideBtn,
                                    {
                                        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
                                    },
                                ]}
                                disabled={disabled || isUploading}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onClearAll();
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`Clear all files in ${label}`}
                            >
                                <IconApp
                                    name="delete"
                                    size={16}
                                    color="#D93025"
                                />
                                <Text variant="labelSmall" style={styles.clearAllText}>
                                    Clear all
                                </Text>
                            </Pressable>
                        )}

                        {/* Select Folder Icon Only Button (1st at left of accordion icon) */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.folderIconBtn,
                                {
                                    backgroundColor: pressed ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                                    borderColor: 'rgba(0, 0, 0, 0.08)',
                                    opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
                                },
                            ]}
                            disabled={disabled || isUploading}
                            onPress={(e) => {
                                e.stopPropagation();
                                handlePickFolder();
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Select folder to upload into ${label}`}
                        >
                            <IconApp
                                name="drive_folder_upload"
                                size={22}
                                color={themeColors.iconColor}
                            />
                        </Pressable>

                        {/* Right Accordion Chevron Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.chevronContainer,
                                {
                                    backgroundColor: isExpanded ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                                    borderColor: isExpanded ? themeColors.border : 'rgba(0, 0, 0, 0.06)',
                                    opacity: pressed ? 0.7 : 1,
                                    cursor: 'pointer',
                                },
                            ]}
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                onToggleExpand();
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={isExpanded ? `Hide ${label} list` : `Show ${label} list`}
                        >
                            <IconApp
                                name="chevron_forward"
                                size={24}
                                color={themeColors.iconColor}
                                style={{ transform: [{ rotate: isExpanded ? '-90deg' : '90deg' }] }}
                            />
                        </Pressable>
                    </View>
                </Card.Content>
            </Card>
        </View>
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
    onFilesLoaded?: (count: number) => void;
    onRequestApproval?: (batch: PendingUploadBatch) => void;
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
    onFilesLoaded,
    onRequestApproval,
    onRenamePress,
    onDeletePress,
    onSharePress,
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
    const dragCounter = useRef(0);
    const listUploadAbortControllerRef = useRef<AbortController | null>(null);
    const dispatch = useDispatch();

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

    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) return folderFiles;
        const query = searchQuery.trim().toLowerCase();
        return folderFiles.filter((f) => f.name.toLowerCase().includes(query));
    }, [folderFiles, searchQuery]);

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
            const files: DriveFile[] = data.files || [];
            setFolderFiles(files);
            onFilesLoaded?.(files.length);
        } catch (err: any) {
            onUploadError(err.message);
        } finally {
            setLoading(false);
        }
    }, [accessToken, folderId, title, onUploadError, onFilesLoaded]);

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

                const metadata = {
                    name: fileItem.name,
                    mimeType: fileItem.mimeType || 'application/octet-stream',
                    parents: [folderId],
                };

                const formData = new FormData();
                formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

                if (fileItem.blob) {
                    formData.append('file', fileItem.blob, fileItem.name);
                } else if (fileItem.uri) {
                    const fileData = await fetch(fileItem.uri);
                    const blob = await fileData.blob();
                    formData.append('file', blob, fileItem.name);
                } else if (fileItem.base64) {
                    const fileData = await fetch(fileItem.base64);
                    const blob = await fileData.blob();
                    formData.append('file', blob, fileItem.name);
                }

                await axios.post(DRIVE_UPLOAD_URL, formData, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    signal: controller.signal,
                    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                        if (progressEvent.total && progressEvent.total > 0) {
                            const fileFraction = progressEvent.loaded / progressEvent.total;
                            const overallPercent = Math.min(
                                99,
                                Math.round(((i + fileFraction) / totalFiles) * 100)
                            );
                            setUploadProgress(overallPercent);
                        }
                    },
                });

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

    const dropContainerRef = useRef<View>(null);

    // Attach robust DOM drag listeners directly to the container on Web (supports Firefox, Chrome, Safari on Mac)
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

                {isDragOver ? (
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
                ) : loading ? (
                    <ActivityIndicator size="small" style={{ marginVertical: 18 }} />
                ) : folderFiles.length === 0 ? (
                    <View style={styles.emptyDropPrompt}>
                        <IconApp name="upload_file" size={36} color="#9AA0A6" />
                        <Text variant="bodySmall" style={{ color: '#5F6368', marginTop: 4 }}>
                            No files yet. Drag files over this zone to trigger instant upload.
                        </Text>
                    </View>
                ) : filteredFiles.length === 0 ? (
                    <View style={styles.emptySearchPrompt}>
                        <IconApp name="find_in_page" size={36} color="#9AA0A6" />
                        <Text variant="bodySmall" style={{ color: '#5F6368', marginTop: 4, textAlign: 'center' }}>
                            No files matching "{searchQuery}"
                        </Text>
                        <Button mode="text" compact onPress={() => setSearchQuery('')} textColor="#1A73E8" style={{ marginTop: 4 }}>
                            Clear search
                        </Button>
                    </View>
                ) : (
                    <View style={{ marginTop: 6 }}>
                        {filteredFiles.map((file) => (
                            <Card key={file.id} style={styles.innerFileCard} mode="outlined">
                                <View style={styles.fileCardRow}>
                                    <View style={[styles.fileCardIconBox, { backgroundColor: '#F1F3F4' }]}>
                                        <IconApp
                                            name={file.mimeType.includes('image') ? 'image' : 'description'}
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
                        ))}
                    </View>
                )}
            </Card.Content>
        </Card>
    </View>
    );
};

// ============================================================================
// MAIN COMPONENT: UploadFilesForAIToGoogleDriveComponent
// ============================================================================

export interface UploadFilesForAIToGoogleDriveComponentProps {
    userGUID?: string;
}

export function UploadFilesForAIToGoogleDriveComponent({
    userGUID = '88888999999',
}: UploadFilesForAIToGoogleDriveComponentProps) {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState<boolean>(true);
    const [userFolders, setUserFolders] = useState<UserFolderHierarchy | null>(null);

    const [isRenameDialogVisible, setIsRenameDialogVisible] = useState<boolean>(false);
    const [renameInput, setRenameInput] = useState<string>('');
    const [fileToRename, setFileToRename] = useState<DriveFile | null>(null);

    const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
    const [folderToClear, setFolderToClear] = useState<{ id: string; title: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [deleteProgress, setDeleteProgress] = useState<number>(0);
    const [deleteStatusText, setDeleteStatusText] = useState<string>('');

    // Approval Modal State for Folder / Batch uploads
    const [pendingUploadBatch, setPendingUploadBatch] = useState<PendingUploadBatch | null>(null);
    const [isBatchUploading, setIsBatchUploading] = useState<boolean>(false);
    const [batchUploadProgress, setBatchUploadProgress] = useState<number>(0);
    const [batchUploadStatusText, setBatchUploadStatusText] = useState<string>('');

    // File count state to show/hide "Clear all" inside buttons
    const [shopFilesCount, setShopFilesCount] = useState<number>(0);
    const [trendFilesCount, setTrendFilesCount] = useState<number>(0);

    const [refreshSeed, setRefreshSeed] = useState<number>(0);
    const [snackbarMsg, setSnackbarMsg] = useState<string>('');
    const [isFabOpen, setIsFabOpen] = useState<boolean>(false);

    const dispatch = useDispatch();

    // Sync file counts & uploading status to Redux onTrendState
    useEffect(() => {
        dispatch(setShopImagesCount(shopFilesCount));
    }, [shopFilesCount, dispatch]);

    useEffect(() => {
        dispatch(setTrendImagesCount(trendFilesCount));
    }, [trendFilesCount, dispatch]);

    useEffect(() => {
        dispatch(setGoogleDriveUploading(isBatchUploading));
    }, [isBatchUploading, dispatch]);

    // Accordion State: Lists hidden by default
    const [isShopListExpanded, setIsShopListExpanded] = useState<boolean>(false);
    const [isTrendListExpanded, setIsTrendListExpanded] = useState<boolean>(false);

    // Fetch folder counts so Clear all visibility is accurate even before expanding
    const fetchFolderCounts = useCallback(async () => {
        if (!accessToken || !userFolders) return;
        try {
            if (userFolders.shopImagesId) {
                const q = `'${userFolders.shopImagesId}' in parents and trashed = false`;
                const url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=files(id)`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
                if (res.ok) {
                    const data = await res.json();
                    setShopFilesCount((data.files || []).length);
                }
            }
            if (userFolders.trendImagesId) {
                const q = `'${userFolders.trendImagesId}' in parents and trashed = false`;
                const url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=files(id)`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
                if (res.ok) {
                    const data = await res.json();
                    setTrendFilesCount((data.files || []).length);
                }
            }
        } catch (e) {
            console.error('Error fetching folder counts', e);
        }
    }, [accessToken, userFolders]);

    useEffect(() => {
        if (accessToken && userFolders) {
            void fetchFolderCounts();
        }
    }, [fetchFolderCounts, refreshSeed, accessToken, userFolders]);

    // Global Drag Interceptor for Web Browsers (Prevents browser from opening dragged files outside dropzone)
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

    // Token refresh logic
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

    // Folder creation logic
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
    }, [userGUID]);

    useEffect(() => {
        (async () => {
            const token = await getValidAccessToken();
            if (token) {
                await createSubfolders(token);
            }
        })();
    }, [getValidAccessToken, createSubfolders]);

    // Upload helper for FAB speed dial
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
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', blob, asset.name);

            const res = await fetch(DRIVE_UPLOAD_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            setSnackbarMsg(`Uploaded "${asset.name}" to ${folderTitle}!`);
            if (folderTitle.includes('shop')) {
                setIsShopListExpanded(true);
            } else if (folderTitle.includes('trend')) {
                setIsTrendListExpanded(true);
            }
            setRefreshSeed((prev) => prev + 1);
        } catch (e: any) {
            setSnackbarMsg(`Upload error: ${e.message}`);
        }
    };

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

    const deleteAbortControllerRef = useRef<AbortController | null>(null);
    const batchUploadAbortControllerRef = useRef<AbortController | null>(null);

    const handleCancelDelete = () => {
        if (deleteAbortControllerRef.current) {
            deleteAbortControllerRef.current.abort();
        }
        setIsDeleting(false);
        setDeleteProgress(0);
        setDeleteStatusText('');
        setSnackbarMsg('Deletion cancelled');
        setFileToDelete(null);
        setFolderToClear(null);
        setRefreshSeed((prev) => prev + 1);
        void fetchFolderCounts();
    };

    const handleCancelBatchUpload = () => {
        if (batchUploadAbortControllerRef.current) {
            batchUploadAbortControllerRef.current.abort();
        }
        setIsBatchUploading(false);
        setBatchUploadProgress(0);
        setBatchUploadStatusText('');
        setPendingUploadBatch(null);
        setSnackbarMsg('Upload cancelled');
        setRefreshSeed((prev) => prev + 1);
        void fetchFolderCounts();
    };

    const confirmDelete = async () => {
        if ((!fileToDelete && !folderToClear) || !accessToken) return;
        setIsDeleting(true);
        setDeleteProgress(0);
        setDeleteStatusText('Connecting to Google Drive...');
        const controller = new AbortController();
        deleteAbortControllerRef.current = controller;

        try {
            if (folderToClear) {
                setDeleteStatusText(`Listing files in "${folderToClear.title}"...`);
                setDeleteProgress(10);

                const q = `'${folderToClear.id}' in parents and trashed = false`;
                const fields = 'files(id, name)';
                const url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}`;
                const res = await axios.get(url, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    signal: controller.signal,
                });
                const files: DriveFile[] = res.data?.files || [];

                if (files.length === 0) {
                    setDeleteProgress(100);
                    setDeleteStatusText('Folder is already empty');
                } else {
                    for (let i = 0; i < files.length; i++) {
                        if (controller.signal.aborted) break;
                        const f = files[i];
                        const currentPercent = Math.round(((i + 1) / files.length) * 100);
                        setDeleteStatusText(`Deleting "${f.name}" (${i + 1}/${files.length})`);
                        await axios.delete(`${DRIVE_API_URL}/${f.id}`, {
                            headers: { Authorization: `Bearer ${accessToken}` },
                            signal: controller.signal,
                        });
                        setDeleteProgress(currentPercent);
                    }
                }

                if (!controller.signal.aborted) {
                    setDeleteStatusText('Done! Folder cleared.');
                    setDeleteProgress(100);

                    setTimeout(() => {
                        setSnackbarMsg(`Cleared all files from "${folderToClear.title}" (${files.length} deleted)`);
                        if (folderToClear.title.includes('shop')) {
                            setShopFilesCount(0);
                        } else if (folderToClear.title.includes('trend')) {
                            setTrendFilesCount(0);
                        }
                        setFolderToClear(null);
                        setIsDeleting(false);
                        setDeleteProgress(0);
                        setDeleteStatusText('');
                        setRefreshSeed((prev) => prev + 1);
                    }, 400);
                }
            } else if (fileToDelete) {
                setDeleteStatusText(`Deleting "${fileToDelete.name}"...`);
                setDeleteProgress(40);
                await axios.delete(`${DRIVE_API_URL}/${fileToDelete.id}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    signal: controller.signal,
                });

                if (!controller.signal.aborted) {
                    setDeleteProgress(100);
                    setDeleteStatusText('File deleted!');

                    setTimeout(() => {
                        setSnackbarMsg(`"${fileToDelete.name}" deleted`);
                        setFileToDelete(null);
                        setIsDeleting(false);
                        setDeleteProgress(0);
                        setDeleteStatusText('');
                        setRefreshSeed((prev) => prev + 1);
                        void fetchFolderCounts();
                    }, 400);
                }
            }
        } catch (e: any) {
            setIsDeleting(false);
            setDeleteProgress(0);
            setDeleteStatusText('');
            if (axios.isCancel(e) || e.name === 'CanceledError' || controller.signal.aborted) {
                setSnackbarMsg('Deletion cancelled');
                setFileToDelete(null);
                setFolderToClear(null);
                setRefreshSeed((prev) => prev + 1);
                void fetchFolderCounts();
            } else {
                setSnackbarMsg(`Delete failed: ${e.message}`);
            }
        }
    };

    const handleShareFile = async (file: DriveFile) => {
        try {
            const url = file.webViewLink || file.webContentLink;
            if (url) {
                await Share.share({
                    title: file.name,
                    message: `Check out ${file.name} on Google Drive: ${url}`,
                    url: url,
                });
            } else {
                setSnackbarMsg(`Link for "${file.name}" is not public yet.`);
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
                        <Pressable
                            disabled={isGlobalDisabled}
                            onPress={() => {
                                setRefreshSeed((prev) => prev + 1);
                            }}
                            style={({ pressed }) => [
                                styles.headerActionBtn,
                                { opacity: isGlobalDisabled ? 0.4 : pressed ? 0.6 : 1 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Refresh datasets"
                        >
                            <IconApp name="refresh" size={22} color="#1F1F1F" />
                        </Pressable>
                    </Appbar.Header>

                    <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
                        {/* Top Info Banner */}
                        <Card style={styles.bannerCard} mode="outlined">
                            <Card.Content style={styles.bannerContent}>
                                <View style={[styles.bannerIconBox, { backgroundColor: '#E8F0FE' }]}>
                                    <IconApp name="account_circle" size={26} color="#1A73E8" />
                                </View>
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
                                        isExpanded={isShopListExpanded}
                                        fileCount={shopFilesCount}
                                        onToggleExpand={() => setIsShopListExpanded((prev) => !prev)}
                                        onClearAll={() => {
                                            if (userFolders?.shopImagesId) {
                                                setFolderToClear({
                                                    id: userFolders.shopImagesId,
                                                    title: 'dataset_shop_images',
                                                });
                                            }
                                        }}
                                        onRequestApproval={(batch) => setPendingUploadBatch(batch)}
                                        onUploadSuccess={(fname) => {
                                            setSnackbarMsg(`Uploaded "${fname}" to dataset_shop_images!`);
                                            setIsShopListExpanded(true);
                                            setRefreshSeed((prev) => prev + 1);
                                        }}
                                        onUploadError={(err) => setSnackbarMsg(err)}
                                    />
                                    {isShopListExpanded && (
                                        <ListFilesForGoogleDriveDNDComponent
                                            key={`shop-list-${refreshSeed}`}
                                            title="dataset_shop_images"
                                            folderId={userFolders?.shopImagesId || ''}
                                            accessToken={accessToken}
                                            disabled={isGlobalDisabled || !userFolders?.shopImagesId}
                                            onFilesLoaded={(count) => setShopFilesCount(count)}
                                            onRequestApproval={(batch) => setPendingUploadBatch(batch)}
                                            onRenamePress={(file) => {
                                                setFileToRename(file);
                                                setRenameInput(file.name);
                                                setIsRenameDialogVisible(true);
                                            }}
                                            onDeletePress={(file) => setFileToDelete(file)}
                                            onSharePress={handleShareFile}
                                            onUploadSuccess={(fname) => {
                                                setSnackbarMsg(`Uploaded "${fname}" to dataset_shop_images`);
                                                setIsShopListExpanded(true);
                                                setRefreshSeed((prev) => prev + 1);
                                            }}
                                            onUploadError={(err) => setSnackbarMsg(err)}
                                        />
                                    )}
                                </View>

                                {/* SECTION 2: dataset_trend_images */}
                                <View style={styles.sectionBlock}>
                                    <SelectFilesForGoogleDriveDNDComponent
                                        label="Add dataset_trend_images"
                                        targetFolderId={userFolders?.trendImagesId || ''}
                                        accessToken={accessToken}
                                        disabled={isGlobalDisabled || !userFolders?.trendImagesId}
                                        isExpanded={isTrendListExpanded}
                                        fileCount={trendFilesCount}
                                        onToggleExpand={() => setIsTrendListExpanded((prev) => !prev)}
                                        onClearAll={() => {
                                            if (userFolders?.trendImagesId) {
                                                setFolderToClear({
                                                    id: userFolders.trendImagesId,
                                                    title: 'dataset_trend_images',
                                                });
                                            }
                                        }}
                                        onRequestApproval={(batch) => setPendingUploadBatch(batch)}
                                        onUploadSuccess={(fname) => {
                                            setSnackbarMsg(`Uploaded "${fname}" to dataset_trend_images!`);
                                            setIsTrendListExpanded(true);
                                            setRefreshSeed((prev) => prev + 1);
                                        }}
                                        onUploadError={(err) => setSnackbarMsg(err)}
                                    />
                                    {isTrendListExpanded && (
                                        <ListFilesForGoogleDriveDNDComponent
                                            key={`trend-list-${refreshSeed}`}
                                            title="dataset_trend_images"
                                            folderId={userFolders?.trendImagesId || ''}
                                            accessToken={accessToken}
                                            disabled={isGlobalDisabled || !userFolders?.trendImagesId}
                                            onFilesLoaded={(count) => setTrendFilesCount(count)}
                                            onRequestApproval={(batch) => setPendingUploadBatch(batch)}
                                            onRenamePress={(file) => {
                                                setFileToRename(file);
                                                setRenameInput(file.name);
                                                setIsRenameDialogVisible(true);
                                            }}
                                            onDeletePress={(file) => setFileToDelete(file)}
                                            onSharePress={handleShareFile}
                                            onUploadSuccess={(fname) => {
                                                setSnackbarMsg(`Uploaded "${fname}" to dataset_trend_images`);
                                                setIsTrendListExpanded(true);
                                                setRefreshSeed((prev) => prev + 1);
                                            }}
                                            onUploadError={(err) => setSnackbarMsg(err)}
                                        />
                                    )}
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

                    {/* Custom Reusable Nice Modal: AskBeforeDeleteGoogleFile */}
                    <AskBeforeDeleteGoogleFile
                        visible={!!fileToDelete || !!folderToClear}
                        file={fileToDelete}
                        folderTitle={folderToClear?.title}
                        onDismiss={() => {
                            setFileToDelete(null);
                            setFolderToClear(null);
                        }}
                        onCancel={handleCancelDelete}
                        onConfirm={confirmDelete}
                        isDeleting={isDeleting}
                        deleteProgress={deleteProgress}
                        deleteStatusText={deleteStatusText}
                    />

                    {/* Custom Nice Modal: ApproveAdditionsModal for Folder / Batch Additions */}
                    <ApproveAdditionsModal
                        visible={!!pendingUploadBatch}
                        batch={pendingUploadBatch}
                        isUploading={isBatchUploading}
                        uploadProgress={batchUploadProgress}
                        uploadStatusText={batchUploadStatusText}
                        onDismiss={() => {
                            setPendingUploadBatch(null);
                            setIsBatchUploading(false);
                            setBatchUploadProgress(0);
                            setBatchUploadStatusText('');
                        }}
                        onCancel={handleCancelBatchUpload}
                        onApprove={async () => {
                            if (!pendingUploadBatch || !accessToken) return;
                            setIsBatchUploading(true);
                            setBatchUploadProgress(0);
                            const controller = new AbortController();
                            batchUploadAbortControllerRef.current = controller;

                            try {
                                const files = pendingUploadBatch.files;
                                const targetId = pendingUploadBatch.targetFolderId;
                                const total = files.length;
                                let lastFileName = '';

                                for (let i = 0; i < total; i++) {
                                    if (controller.signal.aborted) break;
                                    const fileObj = files[i];
                                    setBatchUploadStatusText(`Uploading "${fileObj.name}" (${i + 1}/${total})`);

                                    const metadata = {
                                        name: fileObj.name,
                                        mimeType: fileObj.mimeType || 'application/octet-stream',
                                        parents: [targetId],
                                    };

                                    const formData = new FormData();
                                    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

                                    let fileBlob: any = fileObj.blob;
                                    if (!fileBlob && fileObj.uri) {
                                        const res = await fetch(fileObj.uri);
                                        fileBlob = await res.blob();
                                    } else if (!fileBlob && fileObj.base64) {
                                        const res = await fetch(fileObj.base64);
                                        fileBlob = await res.blob();
                                    }

                                    formData.append('file', fileBlob, fileObj.name);

                                    await axios.post(DRIVE_UPLOAD_URL, formData, {
                                        headers: { Authorization: `Bearer ${accessToken}` },
                                        signal: controller.signal,
                                        onUploadProgress: (progressEvent: AxiosProgressEvent) => {
                                            if (progressEvent.total && progressEvent.total > 0) {
                                                const fraction = progressEvent.loaded / progressEvent.total;
                                                const overall = Math.min(99, Math.round(((i + fraction) / total) * 100));
                                                setBatchUploadProgress(overall);
                                            }
                                        },
                                    });

                                    lastFileName = fileObj.name;
                                    setBatchUploadProgress(Math.round(((i + 1) / total) * 100));
                                }

                                if (!controller.signal.aborted) {
                                    setBatchUploadProgress(100);
                                    setBatchUploadStatusText('All files uploaded successfully!');
                                    setTimeout(() => {
                                        setSnackbarMsg(`Uploaded ${total} file(s) from "${pendingUploadBatch.sourceName}"!`);
                                        if (pendingUploadBatch.targetFolderName.includes('shop')) {
                                            setIsShopListExpanded(true);
                                        } else if (pendingUploadBatch.targetFolderName.includes('trend')) {
                                            setIsTrendListExpanded(true);
                                        }
                                        setPendingUploadBatch(null);
                                        setIsBatchUploading(false);
                                        setBatchUploadProgress(0);
                                        setBatchUploadStatusText('');
                                        setRefreshSeed((prev) => prev + 1);
                                    }, 300);
                                }
                            } catch (e: any) {
                                setIsBatchUploading(false);
                                setBatchUploadProgress(0);
                                setBatchUploadStatusText('');
                                if (axios.isCancel(e) || e.name === 'CanceledError' || controller.signal.aborted) {
                                    setPendingUploadBatch(null);
                                    setSnackbarMsg('Upload cancelled');
                                    setRefreshSeed((prev) => prev + 1);
                                    void fetchFolderCounts();
                                } else {
                                    setSnackbarMsg(`Upload error: ${e.message}`);
                                }
                            }
                        }}
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

export default UploadFilesForAIToGoogleDriveComponent;

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
    bannerIconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    sectionsContainer: {
        gap: 20,
    },
    sectionBlock: {
        marginBottom: 16,
    },
    sectionTopHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
        paddingHorizontal: 2,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionHeadingText: {
        fontWeight: '700',
        marginLeft: 8,
    },
    dndCard: {
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderRadius: 14,
        overflow: 'hidden',
    },
    dndCardHovered: {
        borderColor: '#1A73E8',
        backgroundColor: '#E8F0FE',
    },
    dndContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    dndLeftTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        cursor: 'pointer',
    },
    iconBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        borderWidth: 1,
    },
    dndTextContainer: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dndTitle: {
        fontWeight: '700',
        fontSize: 15,
    },
    percentBadge: {
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 1,
        marginLeft: 8,
        borderWidth: 1,
    },
    percentText: {
        fontWeight: 'bold',
        fontSize: 11,
    },
    dndSubtitle: {
        marginTop: 2,
    },
    sliderContainer: {
        marginTop: 6,
        width: '100%',
    },
    sliderTrack: {
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        borderRadius: 2,
    },
    dndRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
    },
    clearAllInsideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FCE8E6',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        marginRight: 8,
        borderWidth: 1,
        borderColor: '#FAD2CF',
    },
    clearAllText: {
        color: '#D93025',
        fontWeight: '700',
        fontSize: 11,
        marginLeft: 4,
    },
    chevronContainer: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    disabledOpacity: {
        opacity: 0.5,
    },
    centerLoading: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    listContainerCard: {
        marginTop: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
    },
    listSectionTitle: {
        fontWeight: 'bold',
        fontSize: 15,
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
    headerActionBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    fileActionBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 2,
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
    modalHeaderIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filePreviewIconBox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
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
    deleteProgressContainer: {
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#FCE8E6',
        borderWidth: 1,
        borderColor: '#FAD2CF',
    },
    deleteProgressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    deleteStatusText: {
        color: '#1F1F1F',
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    deletePercentBadge: {
        backgroundColor: '#D93025',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    deletePercentText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 11,
    },
    deleteSliderTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F5C2C7',
        overflow: 'hidden',
    },
    deleteSliderFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: '#D93025',
    },
    approveDialog: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        maxWidth: 520,
        width: '92%',
        alignSelf: 'center',
        paddingTop: 8,
    },
    approveHeaderIconWrapper: {
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 4,
    },
    approveTitle: {
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 20,
        color: '#1F1F1F',
    },
    approveContentText: {
        color: '#444746',
        textAlign: 'center',
        marginBottom: 12,
    },
    batchSummaryBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        marginBottom: 8,
    },
    approveFilesScroll: {
        maxHeight: 160,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        padding: 8,
        borderWidth: 1,
        borderColor: '#E0E2EC',
    },
    approveFileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: '#EEEEEE',
    },
    approveProgressContainer: {
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#F0F4F9',
        borderWidth: 1,
        borderColor: '#D3E3FD',
    },
    approveProgressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    approveStatusText: {
        color: '#1F1F1F',
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    approvePercentBadge: {
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    approvePercentText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 11,
    },
    approveSliderTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E0E2EC',
        overflow: 'hidden',
    },
    approveSliderFill: {
        height: '100%',
        borderRadius: 3,
    },
    approveActions: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 8,
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cancelUploadPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FFCDD2',
        marginLeft: 8,
    },
    cancelUploadPillText: {
        color: '#D93025',
        fontWeight: '700',
        fontSize: 10,
        marginLeft: 2,
    },
    folderIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        borderWidth: 1,
    },
    listUploadingCard: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#F0F4F9',
        borderWidth: 1,
        borderColor: '#D3E3FD',
        marginBottom: 10,
    },
    listUploadingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    listUploadPercentBadge: {
        backgroundColor: '#1A73E8',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
        marginRight: 6,
    },
    listUploadPercentText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 10,
    },
    listUploadSliderTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E0E2EC',
        overflow: 'hidden',
    },
    listUploadSliderFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: '#1A73E8',
    },
    uploadingNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        borderRadius: 6,
        marginBottom: 8,
    },
    listDragOverOverlay: {
        borderWidth: 2,
        borderColor: '#1A73E8',
        borderStyle: 'dashed',
        borderRadius: 12,
        backgroundColor: '#F0F4F9',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        paddingHorizontal: 16,
        marginVertical: 8,
    },
    listHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    searchTextInput: {
        marginBottom: 0,
    },
    emptySearchPrompt: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        marginVertical: 4,
    },
    listFolderIcon: {
        marginRight: 8,
    },
});
