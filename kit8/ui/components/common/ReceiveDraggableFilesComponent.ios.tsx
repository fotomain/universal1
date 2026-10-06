import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTheme, Text, Avatar } from 'react-native-paper';
import { ViewDrop, MapKeysMultiItems, type FileInfo, type AvAssetType } from 'react-native-viewdrop-ios';
import type { ReceiveDraggableFilesProps, DroppedFileItem } from './ReceiveDraggableFilesComponent.types';
import { pickFilesForDrop } from './pickFilesForDrop';
import ButtonApp from './ButtonApp';

export const ReceiveDraggableFilesComponent: React.FC<ReceiveDraggableFilesProps> = ({
    folderName,
    isHovered = false,
    onFilesDropped,
    onDragEnter,
    onDragLeave,
    style,
    title,
    subtitle,
    compact = false,
    pickable = false,
    pickLabel = 'Choose file…',
    accept,
    pickMimeTypes,
    disabled = false,
    testID,
    pickButtonWidth,
    pickButtonStyle,
}) => {
    const theme = useTheme();
    const [isInternalHovered, setIsInternalHovered] = useState(false);
    const activeHover = !disabled && (isHovered || isInternalHovered);
    const onPick = async () => {
        if (disabled) return;
        const files = await pickFilesForDrop({ accept, mimeTypes: pickMimeTypes });
        if (files.length) onFilesDropped(files);
    };
    const pickButton = pickable ? (
        <ButtonApp
            testID={testID ? `${testID}-pick` : undefined}
            accessibilityLabel={pickLabel}
            disabled={disabled}
            variant="outlined"
            size="small"
            width={pickButtonWidth}
            title={pickLabel}
            onPress={onPick}
            style={[{ marginVertical: 0, marginTop: 10, alignSelf: 'center' }, pickButtonStyle]}
        />
    ) : null;

    const handleFileItemsReceived = (data: Record<MapKeysMultiItems, FileInfo[]>) => {
        setIsInternalHovered(false);
        if (disabled) return;
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
        if (disabled) return;
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
            testID={testID}
            style={[
                styles.container,
                compact && styles.containerCompact,
                disabled && { opacity: 0.6 },
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
                {!compact && (
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
                )}

                <Text
                    variant="titleMedium"
                    style={[
                        styles.title,
                        { color: activeHover ? theme.colors.onPrimaryContainer : theme.colors.onSurface },
                    ]}
                >
                    {title ?? `Drop files to upload to ${folderName}`}
                </Text>

                <Text
                    variant="bodyMedium"
                    style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                >
                    {subtitle ?? 'Release to automatically upload • iOS ViewDrop'}
                </Text>

{!compact && (
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
                )}
            </View>
            {pickButton}
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
    containerCompact: {
        paddingVertical: 14,
        paddingHorizontal: 12,
        minHeight: 96,
        borderRadius: 12,
    },
    pickButton: {
        marginTop: 10,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 18,
        borderWidth: 1,
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
