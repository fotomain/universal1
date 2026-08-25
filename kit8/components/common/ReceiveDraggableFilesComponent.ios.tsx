import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme, Text, Avatar } from 'react-native-paper';
import { ViewDrop, MapKeysMultiItems, type FileInfo, type AvAssetType } from 'react-native-viewdrop-ios';
import type { ReceiveDraggableFilesProps, DroppedFileItem } from './ReceiveDraggableFilesComponent.types';

export const ReceiveDraggableFilesComponent: React.FC<ReceiveDraggableFilesProps> = ({
    folderName,
    isHovered = false,
    onFilesDropped,
    onDragEnter,
    onDragLeave,
    style,
}) => {
    const theme = useTheme();
    const [isInternalHovered, setIsInternalHovered] = useState(false);
    const activeHover = isHovered || isInternalHovered;

    const handleFileItemsReceived = (data: Record<MapKeysMultiItems, FileInfo[]>) => {
        setIsInternalHovered(false);
        const collected: DroppedFileItem[] = [];

        if (data[MapKeysMultiItems.file]) {
            data[MapKeysMultiItems.file].forEach((f) => {
                collected.push({
                    name: f.fileName,
                    uri: f.fileUrl,
                    mimeType: f.typeIdentifier || 'application/octet-stream',
                });
            });
        }
        if (data[MapKeysMultiItems.image]) {
            data[MapKeysMultiItems.image].forEach((f) => {
                collected.push({
                    name: f.fileName,
                    uri: f.fileUrl,
                    mimeType: 'image/jpeg',
                });
            });
        }
        if (data[MapKeysMultiItems.video]) {
            data[MapKeysMultiItems.video].forEach((f) => {
                collected.push({
                    name: f.fileName,
                    uri: f.fileUrl,
                    mimeType: 'video/mp4',
                });
            });
        }
        if (data[MapKeysMultiItems.audio]) {
            data[MapKeysMultiItems.audio].forEach((f) => {
                collected.push({
                    name: f.fileName,
                    uri: f.fileUrl,
                    mimeType: 'audio/mpeg',
                });
            });
        }

        if (collected.length > 0) {
            onFilesDropped(collected);
        }
    };

    const handleSingleFileReceived = (fileInfo: FileInfo) => {
        setIsInternalHovered(false);
        onFilesDropped([
            {
                name: fileInfo.fileName,
                uri: fileInfo.fileUrl,
                mimeType: fileInfo.typeIdentifier || 'application/octet-stream',
            },
        ]);
    };

    const handleSingleImageReceived = (imageUri: string) => {
        setIsInternalHovered(false);
        const filename = imageUri.split('/').pop() || `image_${Date.now()}.jpg`;
        onFilesDropped([
            {
                name: filename,
                uri: imageUri,
                mimeType: 'image/jpeg',
            },
        ]);
    };

    const handleSingleVideoReceived = (videoInfo: AvAssetType) => {
        setIsInternalHovered(false);
        onFilesDropped([
            {
                name: videoInfo.fileName || `video_${Date.now()}.mp4`,
                uri: videoInfo.fullUrl,
                mimeType: 'video/mp4',
            },
        ]);
    };

    const handleSingleAudioReceived = (audioInfo: AvAssetType) => {
        setIsInternalHovered(false);
        onFilesDropped([
            {
                name: audioInfo.fileName || `audio_${Date.now()}.mp3`,
                uri: audioInfo.fullUrl,
                mimeType: 'audio/mpeg',
            },
        ]);
    };

    return (
        <ViewDrop
            style={[
                styles.container,
                {
                    backgroundColor: activeHover ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                    borderColor: activeHover ? theme.colors.primary : theme.colors.outline,
                },
                style,
            ]}
            isEnableMultiDropping={true}
            allowPartialDrop={true}
            onDropItemDetected={() => {
                setIsInternalHovered(true);
                onDragEnter?.();
            }}
            onFileItemsReceived={handleFileItemsReceived}
            onFileReceived={handleSingleFileReceived}
            onImageReceived={handleSingleImageReceived}
            onVideoReceived={handleSingleVideoReceived}
            onAudioReceived={handleSingleAudioReceived}
        >
            <View style={styles.content}>
                <View
                    style={[
                        styles.iconCircle,
                        {
                            backgroundColor: activeHover ? theme.colors.surface : theme.colors.surfaceVariant,
                            shadowColor: theme.colors.shadow,
                        },
                    ]}
                >
                    <Avatar.Icon
                        size={56}
                        icon="tray-arrow-down"
                        style={{ backgroundColor: 'transparent' }}
                        color={theme.colors.primary}
                    />
                </View>

                <Text
                    variant="titleMedium"
                    style={[
                        styles.title,
                        { color: activeHover ? theme.colors.onPrimaryContainer : theme.colors.onSurface },
                    ]}
                >
                    Drop files to upload to {folderName}
                </Text>

                <Text
                    variant="bodyMedium"
                    style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                >
                    Release to automatically upload • iOS ViewDrop
                </Text>

                <View
                    style={[
                        styles.badge,
                        {
                            backgroundColor: theme.colors.surface,
                            borderColor: theme.colors.outlineVariant,
                        },
                    ]}
                >
                    <Avatar.Icon
                        size={18}
                        icon="apple"
                        style={{ backgroundColor: 'transparent' }}
                        color={theme.colors.primary}
                    />
                    <Text
                        variant="labelSmall"
                        style={[styles.badgeText, { color: theme.colors.primary }]}
                    >
                        MD3 iOS Drop Zone Active
                    </Text>
                </View>
            </View>
        </ViewDrop>
    );
};

export default ReceiveDraggableFilesComponent;

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        borderWidth: 2,
        borderStyle: 'dashed',
        paddingVertical: 28,
        paddingHorizontal: 20,
        marginVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 180,
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        marginBottom: 14,
    },
    title: {
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 14,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
    },
    badgeText: {
        fontWeight: '600',
    },
});
