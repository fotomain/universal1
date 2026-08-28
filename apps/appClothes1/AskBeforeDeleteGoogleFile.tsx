import React from 'react';
import {
    Modal,
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { IconApp } from '../../kit8/components/common/IconApp';
import type { DriveFile } from '../../kit8/google/drive/googleDrive';

export interface AskBeforeDeleteGoogleFileProps {
    visible: boolean;
    file?: DriveFile | null;
    folderTitle?: string | null;
    onDismiss: () => void;
    onCancel?: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    deleteProgress: number;
    deleteStatusText?: string;
    testID?: string;
}

export const AskBeforeDeleteGoogleFile: React.FC<AskBeforeDeleteGoogleFileProps> = ({
    visible,
    file,
    folderTitle,
    onDismiss,
    onCancel,
    onConfirm,
    isDeleting,
    deleteProgress,
    deleteStatusText,
    testID = 'askBeforeDeleteModal',
}) => {
    if (!visible) return null;

    const isFolderClear = !!folderTitle;
    const isCompleted = isDeleting && deleteProgress === 100;
    const targetName = isFolderClear ? folderTitle : (file?.name || 'Selected File');

    const handleBackdropPress = () => {
        if (!isDeleting) {
            onDismiss();
        }
    };

    const handleCancelPress = () => {
        if (isDeleting) {
            onCancel ? onCancel() : onDismiss();
        } else {
            onDismiss();
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={isDeleting ? undefined : onDismiss}
            testID={testID}
        >
            <View style={styles.modalOverlay}>
                {/* Backdrop touch area */}
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.modalBackdrop}
                    onPress={handleBackdropPress}
                    testID={`${testID}-backdrop`}
                    disabled={isDeleting}
                />

                {/* Dialog Content Card */}
                <View style={styles.dialogCard} testID={`${testID}-card`}>
                    {/* Header Icon Circle */}
                    <View style={styles.headerIconWrapper}>
                        <View
                            style={[
                                styles.headerIconCircle,
                                { backgroundColor: isCompleted ? '#E6F4EA' : '#FCE8E6' },
                            ]}
                        >
                            <IconApp
                                name={isCompleted ? 'check_circle' : isFolderClear ? 'folder_off' : 'delete'}
                                size={28}
                                color={isCompleted ? '#137333' : '#D93025'}
                            />
                        </View>
                    </View>

                    {/* Title */}
                    <Text
                        style={[styles.dialogTitle, isCompleted && { color: '#137333' }]}
                        testID={`${testID}-title`}
                    >
                        {isCompleted
                            ? 'Successfully Cleared!'
                            : isFolderClear
                            ? 'Clear all files?'
                            : 'Delete File?'}
                    </Text>

                    {/* Content Body */}
                    <View style={styles.dialogBody}>
                        <Text style={styles.contentText} testID={`${testID}-content`}>
                            {isCompleted
                                ? 'All files have been permanently removed from Google Drive.'
                                : isFolderClear
                                ? `Are you sure you want to permanently delete all files in "${folderTitle}"?`
                                : 'Are you sure you want to permanently remove this file from your dataset?'}
                        </Text>

                        {/* File / Folder Target Name Box */}
                        <View style={styles.fileNameBox} testID={`${testID}-targetBox`}>
                            <IconApp
                                name={isFolderClear ? 'folder' : 'description'}
                                size={22}
                                color="#5F6368"
                            />
                            <Text
                                numberOfLines={2}
                                style={styles.fileNameText}
                                testID={`${testID}-targetName`}
                            >
                                {targetName}
                            </Text>
                        </View>

                        {/* Warning / Informational Footer Text */}
                        <Text style={styles.warningText} testID={`${testID}-warningText`}>
                            {isCompleted
                                ? 'The folder is now empty.'
                                : isFolderClear
                                ? 'This action will permanently delete all files in this dataset folder and cannot be undone.'
                                : 'This action cannot be undone.'}
                        </Text>

                        {/* Deletion Progress Bar (visible during active deletion) */}
                        {isDeleting && (
                            <View style={styles.progressContainer} testID={`${testID}-progress`}>
                                <View style={styles.progressHeader}>
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.statusText,
                                            isCompleted && { color: '#137333', fontWeight: '600' },
                                        ]}
                                    >
                                        {deleteStatusText || 'Deleting files...'}
                                    </Text>
                                    <View
                                        style={[
                                            styles.percentBadge,
                                            isCompleted && { backgroundColor: '#E6F4EA' },
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.percentText,
                                                isCompleted && { color: '#137333' },
                                            ]}
                                        >
                                            {deleteProgress}%
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.sliderTrack}>
                                    <View
                                        style={[
                                            styles.sliderFill,
                                            {
                                                width: `${Math.max(deleteProgress, 5)}%`,
                                                backgroundColor: isCompleted ? '#137333' : '#D93025',
                                            },
                                        ]}
                                    />
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Actions Row */}
                    <View style={styles.dialogActions}>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleCancelPress}
                            disabled={isCompleted}
                            style={[
                                styles.cancelBtn,
                                isCompleted && { opacity: 0.4 },
                            ]}
                            testID={`${testID}-cancelBtn`}
                        >
                            <Text
                                style={[
                                    styles.cancelBtnText,
                                    isDeleting && { color: '#D93025' },
                                ]}
                            >
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            disabled={isDeleting}
                            style={[
                                styles.confirmBtn,
                                { backgroundColor: isCompleted ? '#137333' : '#D93025' },
                                isDeleting && !isCompleted && { opacity: 0.8 },
                            ]}
                            onPress={onConfirm}
                            testID={`${testID}-confirmBtn`}
                        >
                            {isDeleting && !isCompleted && (
                                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                            )}
                            <Text style={styles.confirmBtnText}>
                                {isCompleted
                                    ? 'Completed'
                                    : isDeleting
                                    ? `Deleting (${deleteProgress}%)`
                                    : isFolderClear
                                    ? 'Clear all'
                                    : 'Delete'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.54)',
        zIndex: 9999,
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    },
    dialogCard: {
        width: '100%',
        maxWidth: 440,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingTop: 24,
        paddingBottom: 20,
        paddingHorizontal: 20,
        elevation: 24,
        zIndex: 10000,
    },
    headerIconWrapper: {
        alignItems: 'center',
        marginBottom: 12,
    },
    headerIconCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dialogTitle: {
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 20,
        color: '#1F1F1F',
        marginBottom: 8,
    },
    dialogBody: {
        marginBottom: 16,
    },
    contentText: {
        textAlign: 'center',
        color: '#444746',
        marginBottom: 12,
        lineHeight: 20,
        fontSize: 14,
    },
    fileNameBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E0E2EC',
        marginBottom: 8,
    },
    fileNameText: {
        fontWeight: '600',
        color: '#1F1F1F',
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
    },
    warningText: {
        textAlign: 'center',
        color: '#D93025',
        fontSize: 12,
        lineHeight: 16,
    },
    progressContainer: {
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#FCE8E6',
        borderWidth: 1,
        borderColor: '#FAD2CF',
    },
    progressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    statusText: {
        color: '#1F1F1F',
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
        fontSize: 12,
    },
    percentBadge: {
        backgroundColor: '#D93025',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    percentText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 11,
    },
    sliderTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#F5C2C7',
        overflow: 'hidden',
    },
    sliderFill: {
        height: '100%',
        borderRadius: 3,
        backgroundColor: '#D93025',
    },
    dialogActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F3F4',
    },
    cancelBtnText: {
        color: '#5F6368',
        fontWeight: '600',
        fontSize: 14,
    },
    confirmBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmBtnText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
});

export default AskBeforeDeleteGoogleFile;
