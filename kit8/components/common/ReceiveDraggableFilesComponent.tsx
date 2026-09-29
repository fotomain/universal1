import React, { useState, useRef, useEffect } from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { useTheme, Text, Avatar } from 'react-native-paper';
import { DragDropContentView, type DropAsset } from 'expo-drag-drop-content-view';
import type { ReceiveDraggableFilesProps, DroppedFileItem } from './ReceiveDraggableFilesComponent.types';
import { pickFilesForDrop } from './pickFilesForDrop';

export const ReceiveDraggableFilesComponent: React.FC<ReceiveDraggableFilesProps> = ({
    folderName,
    isHovered = false,
    onFilesDropped,
    onDragEnter,
    onDragLeave,
    style,
    allowedMimeTypes,
    title,
    subtitle,
    compact = false,
    pickable = false,
    pickLabel = 'Choose file…',
    accept,
    pickMimeTypes,
    disabled = false,
    testID,
}) => {
    const theme = useTheme();
    const [isInternalHovered, setIsInternalHovered] = useState(false);
    const dropRef = useRef<View>(null);
    const activeHover = !disabled && (isHovered || isInternalHovered);
    const onPick = async () => {
        if (disabled) return;
        const files = await pickFilesForDrop({ accept, mimeTypes: pickMimeTypes });
        if (files.length) onFilesDropped(files);
    };
    const pickButton = pickable ? (
        <Pressable
            testID={testID ? `${testID}-pick` : undefined}
            accessibilityRole="button"
            accessibilityLabel={pickLabel}
            disabled={disabled}
            onPress={onPick}
            style={[styles.pickButton, { borderColor: theme.colors.primary, opacity: disabled ? 0.5 : 1 }]}
        >
            <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '600' }}>
                {pickLabel}
            </Text>
        </Pressable>
    ) : null;

    // Web-specific robust DOM drag-and-drop listener for Firefox / Chrome / Safari on Mac
    useEffect(() => {
        if (Platform.OS !== 'web' || !dropRef.current) return;
        const domNode = (dropRef.current as any) as HTMLElement;
        if (!domNode || typeof domNode.addEventListener !== 'function') return;

        let counter = 0;

        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter++;
            setIsInternalHovered(true);
            onDragEnter?.();
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
            if (!isInternalHovered) {
                setIsInternalHovered(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter--;
            if (counter <= 0) {
                counter = 0;
                setIsInternalHovered(false);
                onDragLeave?.();
            }
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            counter = 0;
            setIsInternalHovered(false);
            if (disabled) return;
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                const items: DroppedFileItem[] = files.map((file) => ({
                    name: file.name,
                    mimeType: file.type || 'application/octet-stream',
                    size: file.size,
                    blob: file,
                }));
                onFilesDropped(items);
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
    }, [onDragEnter, onDragLeave, onFilesDropped, disabled]);

    const handleAssetsDrop = (event: { assets: DropAsset[] }) => {
        setIsInternalHovered(false);
        if (disabled || !event?.assets?.length) return;

        const collected: DroppedFileItem[] = event.assets.map((asset) => {
            const name =
                asset.fileName ||
                (asset.uri ? asset.uri.split('/').pop()?.split('?')[0] : `file_${Date.now()}`) ||
                'dropped_file';
            return {
                name,
                uri: asset.uri,
                mimeType: asset.type || 'application/octet-stream',
                base64: asset.base64,
            };
        });

        if (collected.length > 0) {
            onFilesDropped(collected);
        }
    };

    const dropContent = (
        <View style={styles.content} pointerEvents="none">
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
                {subtitle ?? 'Release to automatically upload • MD3 Drag & Drop'}
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
                    icon={Platform.OS === 'web' ? 'web' : 'android'}
                    style={{ backgroundColor: 'transparent' }}
                    color={theme.colors.primary}
                />
                <Text
                    variant="labelSmall"
                    style={[styles.badgeText, { color: theme.colors.primary }]}
                >
                    {Platform.OS === 'web' ? 'Web Drop Zone Active' : 'MD3 Drop Zone Active'}
                </Text>
            </View>
            )}
        </View>
    );

    if (Platform.OS === 'web') {
        return (
            <View
                ref={dropRef}
                testID={testID}
                style={[
                    styles.container,
                    compact && styles.containerCompact,
                    {
                        backgroundColor: activeHover ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                        borderColor: activeHover ? theme.colors.primary : theme.colors.outline,
                        opacity: disabled ? 0.6 : 1,
                    },
                    style,
                ]}
            >
                {dropContent}
                {pickButton}
            </View>
        );
    }

    return (
        <DragDropContentView
            testID={testID}
            style={[
                styles.container,
                compact && styles.containerCompact,
                {
                    backgroundColor: activeHover ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                    borderColor: activeHover ? theme.colors.primary : theme.colors.outline,
                    opacity: disabled ? 0.6 : 1,
                },
                style,
            ]}
            onEnter={() => {
                setIsInternalHovered(true);
                onDragEnter?.();
            }}
            onExit={() => {
                setIsInternalHovered(false);
                onDragLeave?.();
            }}
            onDrop={handleAssetsDrop}
            onDragEnd={() => {
                setIsInternalHovered(false);
            }}
            allowedMimeTypes={allowedMimeTypes}
        >
            {dropContent}
            {pickButton}
        </DragDropContentView>
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
