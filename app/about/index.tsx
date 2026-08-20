import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    ScrollView,
    Platform,
    Share, Pressable,
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
    useTheme,
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
}


// ============================================================================
// MODAL: AskBeforeDeleteGoogleFile (Reusable for Single File or Clear All)
// ============================================================================

interface AskBeforeDeleteProps {
    visible: boolean;
    file?: DriveFile | null;
    folderTitle?: string | null;
    onDismiss: () => void;
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
                    <Avatar.Icon
                        size={52}
                        icon={isFolderClear ? 'folder-remove-outline' : 'trash-can-outline'}
                        style={{ backgroundColor: '#FCE8E6' }}
                        color="#D93025"
                    />
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
                        <Avatar.Icon
                            size={24}
                            icon={isFolderClear ? 'folder-image' : 'file-outline'}
                            style={{ backgroundColor: 'transparent' }}
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
    onUploadSuccess,
    onUploadError,
    variant,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const buttonDropRef = useRef<View>(null);

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

    const uploadMultipleFiles = async (
        files: Array<{ name: string; mimeType?: string; blob?: Blob | File; uri?: string; base64?: string }>
    ) => {
        if (!accessToken || !targetFolderId || files.length === 0) return;
        setIsUploading(true);
        setUploadProgress(0);
        try {
            const totalFiles = files.length;
            let lastFileName = '';

            for (let i = 0; i < totalFiles; i++) {
                const fileObj = files[i];
                await new Promise<void>(async (resolve, reject) => {
                    try {
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

                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', DRIVE_UPLOAD_URL);
                        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

                        xhr.upload.onprogress = (event) => {
                            if (event.lengthComputable && event.total > 0) {
                                const fileFraction = event.loaded / event.total;
                                const overallPercent = Math.min(
                                    99,
                                    Math.round(((i + fileFraction) / totalFiles) * 100)
                                );
                                setUploadProgress(overallPercent);
                            }
                        };

                        xhr.onload = () => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
                                lastFileName = fileObj.name;
                                resolve();
                            } else {
                                reject(new Error(`Upload failed with status ${xhr.status}`));
                            }
                        };

                        xhr.onerror = () => reject(new Error('Network error during upload'));
                        xhr.send(formData);
                    } catch (err) {
                        reject(err);
                    }
                });
            }

            setUploadProgress(100);
            setTimeout(() => {
                onUploadSuccess(totalFiles > 1 ? `${totalFiles} files` : lastFileName);
                setIsUploading(false);
                setUploadProgress(0);
            }, 300);
        } catch (e: any) {
            setIsUploading(false);
            setUploadProgress(0);
            onUploadError(e.message || 'Error uploading file(s)');
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
                    };
                })
            );

            await uploadMultipleFiles(fileItems);
        } catch (err: any) {
            onUploadError(err.message);
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
            if (disabled || !e.dataTransfer?.files?.length) return;

            const files = Array.from(e.dataTransfer.files);
            const fileItems = files.map((f) => ({
                name: f.name,
                mimeType: f.type || 'application/octet-stream',
                blob: f,
            }));
            await uploadMultipleFiles(fileItems);
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
    }, [disabled, isHovered, accessToken, targetFolderId]);

    const buttonIcon = isHovered
        ? 'tray-arrow-down'
        : isGreen
        ? 'store-plus'
        : isYellow
        ? 'trending-up'
        : 'cloud-upload-outline';

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
                                <Avatar.Icon
                                    size={26}
                                    icon={buttonIcon}
                                    color={themeColors.iconColor}
                                    style={{ backgroundColor: 'transparent' }}
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

                            <Text variant="bodySmall" style={[styles.dndSubtitle, { color: themeColors.subtitle }]}>
                                {isUploading
                                    ? `Uploading to Drive... ${uploadProgress}%`
                                    : isHovered
                                    ? '📥 Drop files here to upload instantly'
                                    : 'Click or drop files here to upload'}
                            </Text>

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

                    {/* Right Action Cluster: Clear All inside Button (only visible if list is not empty) + Accordion Chevron */}
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
                                <Avatar.Icon
                                    size={18}
                                    icon="trash-can-outline"
                                    color="#D93025"
                                    style={{ backgroundColor: 'transparent' }}
                                />
                                <Text variant="labelSmall" style={styles.clearAllText}>
                                    Clear all
                                </Text>
                            </Pressable>
                        )}

                        {/* Right Accordion Chevron Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.chevronContainer,
                                {
                                    backgroundColor: isExpanded ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.03)',
                                    borderColor: isExpanded ? themeColors.border : 'rgba(0, 0, 0, 0.06)',
                                    opacity: pressed ? 0.7 : 1,
                                },
                            ]}
                            onPress={onToggleExpand}
                            accessibilityRole="button"
                            accessibilityLabel={isExpanded ? `Hide ${label} list` : `Show ${label} list`}
                        >
                            <Avatar.Icon
                                size={26}
                                icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                                color={themeColors.iconColor}
                                style={{ backgroundColor: 'transparent' }}
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
    onRenamePress,
    onDeletePress,
    onSharePress,
    onUploadSuccess,
    onUploadError,
}) => {
    const [folderFiles, setFolderFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isDragOver, setIsDragOver] = useState<boolean>(false);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const dragCounter = useRef(0);

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

    const processAndUploadFiles = async (filesList: DroppedFileItem[]) => {
        if (!accessToken || !folderId) return;
        setIsUploading(true);
        try {
            for (const fileItem of filesList) {
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

                const res = await fetch(DRIVE_UPLOAD_URL, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: formData,
                });

                if (!res.ok) throw new Error(`Upload failed for ${fileItem.name}`);
                onUploadSuccess(fileItem.name);
            }
            void fetchFolderFiles();
        } catch (e: any) {
            onUploadError(e.message || 'Error during drop upload');
        } finally {
            setIsUploading(false);
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
            if (disabled || !e.dataTransfer?.files?.length) return;

            const files = Array.from(e.dataTransfer.files);
            const items: DroppedFileItem[] = files.map((file) => ({
                name: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                blob: file,
            }));
            await processAndUploadFiles(items);
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
                            Uploading files to Drive...
                        </Text>
                    </View>
                )}

                {isDragOver ? (
                    <ReceiveDraggableFilesComponent
                        folderName={title}
                        isHovered={isDragOver}
                        onDragEnter={() => setIsDragOver(true)}
                        onDragLeave={() => {
                            dragCounter.current = 0;
                            setIsDragOver(false);
                        }}
                        onFilesDropped={(files) => {
                            setIsDragOver(false);
                            dragCounter.current = 0;
                            void processAndUploadFiles(files);
                        }}
                    />
                ) : loading ? (
                    <ActivityIndicator size="small" style={{ marginVertical: 18 }} />
                ) : folderFiles.length === 0 ? (
                    <View style={styles.emptyDropPrompt}>
                        <Avatar.Icon size={36} icon="file-upload-outline" style={{ backgroundColor: 'transparent' }} color="#9AA0A6" />
                        <Text variant="bodySmall" style={{ color: '#5F6368', marginTop: 4 }}>
                            No files yet. Drag files over this zone to trigger instant upload.
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
    const [folderToClear, setFolderToClear] = useState<{ id: string; title: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [deleteProgress, setDeleteProgress] = useState<number>(0);
    const [deleteStatusText, setDeleteStatusText] = useState<string>('');

    // File count state to show/hide "Clear all" inside buttons
    const [shopFilesCount, setShopFilesCount] = useState<number>(0);
    const [trendFilesCount, setTrendFilesCount] = useState<number>(0);

    const [refreshSeed, setRefreshSeed] = useState<number>(0);
    const [snackbarMsg, setSnackbarMsg] = useState<string>('');
    const [isFabOpen, setIsFabOpen] = useState<boolean>(false);

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
    }, []);

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

    const confirmDelete = async () => {
        if ((!fileToDelete && !folderToClear) || !accessToken) return;
        setIsDeleting(true);
        setDeleteProgress(0);
        setDeleteStatusText('Connecting to Google Drive...');
        try {
            if (folderToClear) {
                setDeleteStatusText(`Listing files in "${folderToClear.title}"...`);
                setDeleteProgress(10);

                const q = `'${folderToClear.id}' in parents and trashed = false`;
                const fields = 'files(id, name)';
                const url = `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
                if (!res.ok) throw new Error(`Failed to list files in ${folderToClear.title}`);
                const data = await res.json();
                const files: DriveFile[] = data.files || [];

                if (files.length === 0) {
                    setDeleteProgress(100);
                    setDeleteStatusText('Folder is already empty');
                } else {
                    for (let i = 0; i < files.length; i++) {
                        const f = files[i];
                        const currentPercent = Math.round(((i + 1) / files.length) * 100);
                        setDeleteStatusText(`Deleting "${f.name}" (${i + 1}/${files.length})`);
                        await fetch(`${DRIVE_API_URL}/${f.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${accessToken}` },
                        });
                        setDeleteProgress(currentPercent);
                    }
                }

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
            } else if (fileToDelete) {
                setDeleteStatusText(`Deleting "${fileToDelete.name}"...`);
                setDeleteProgress(40);
                const res = await fetch(`${DRIVE_API_URL}/${fileToDelete.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (!res.ok) throw new Error('Failed to delete file');
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
        } catch (e: any) {
            setIsDeleting(false);
            setDeleteProgress(0);
            setDeleteStatusText('');
            setSnackbarMsg(`Delete failed: ${e.message}`);
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
                        onConfirm={confirmDelete}
                        isDeleting={isDeleting}
                        deleteProgress={deleteProgress}
                        deleteStatusText={deleteStatusText}
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
        borderRadius: 12,
        marginVertical: 4,
    },
    dndCardHovered: {
        borderWidth: 2,
    },
    dndContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    dndLeftTouchable: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingVertical: 2,
        paddingRight: 6,
    },
    iconBadge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        marginRight: 14,
        marginLeft: 2,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
    },
    chevronContainer: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        borderWidth: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    percentBadge: {
        borderRadius: 6,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 1,
        marginLeft: 8,
    },
    percentText: {
        fontWeight: '700',
        fontSize: 11,
    },
    sliderContainer: {
        marginTop: 6,
        width: '100%',
    },
    sliderTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        borderRadius: 3,
    },
    dndRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 6,
    },
    clearAllInsideBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: 'rgba(217, 48, 37, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(217, 48, 37, 0.2)',
        marginRight: 6,
    },
    deleteProgressContainer: {
        marginTop: 14,
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#FFF8F7',
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
    deleteProgressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    deleteStatusText: {
        color: '#5F6368',
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
        backgroundColor: '#FFEBEE',
        overflow: 'hidden',
    },
    deleteSliderFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: '#D93025',
    },
    clearAllText: {
        color: '#D93025',
        fontWeight: '600',
        fontSize: 11,
        marginLeft: 2,
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
        minHeight: 140,
    },
    receiveDropContainer: {
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
        paddingVertical: 32,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 8,
    },
    receiveTitle: {
        marginTop: 12,
        fontWeight: 'bold',
        textAlign: 'center',
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
