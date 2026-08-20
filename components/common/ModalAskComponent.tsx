import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useDesignSystem } from '../../context/DesignSystemContext';
import { TextApp } from './TextApp';
import { ButtonApp } from './ButtonApp';

export interface ModalAskComponentProps {
  visible: boolean;
  modatTopBar?: string;
  modalTopBar?: string;
  modalBody?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmColor?: string;
  designSystem?: string;
  testID?: string;
}

export const ModalAskComponent: React.FC<ModalAskComponentProps> = ({
  visible,
  modatTopBar,
  modalTopBar,
  modalBody = 'information will be completely deleted from the database',
  cancelLabel = 'Cancel',
  confirmLabel = 'Delete',
  onCancel,
  onConfirm,
  confirmColor = '#d32f2f',
  designSystem,
  testID = 'modalAskComponent',
}) => {
  const { themeColors, isDark, activeSystem } = useDesignSystem();

  const titleText = modatTopBar || modalTopBar || 'Delete forever?';
  const effectiveSystem = designSystem || activeSystem;

  const isMd3 = effectiveSystem === 'googlemd3web' || effectiveSystem === 'paper';
  const borderRadius = isMd3 ? 28 : 16;
  const cardBg = isDark ? (themeColors?.surfaceVariant || '#2d2d3a') : '#ffffff';
  const textColor = isDark ? '#f0f0f5' : (themeColors?.onSurface || '#1c1b1f');
  const secondaryTextColor = isDark ? '#b0b0c2' : (themeColors?.onSurfaceVariant || '#49454f');

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
      testID={testID}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdropTouch}
          onPress={onCancel}
        />
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: cardBg,
              borderRadius,
            },
          ]}
          testID={`${testID}-content`}
        >
          {/* Top Bar Header */}
          <TextApp
            style={[
              styles.headerTitle,
              { color: textColor },
            ]}
            testID={`${testID}-topBar`}
          >
            {titleText}
          </TextApp>

          {/* Modal Body */}
          <TextApp
            style={[
              styles.bodyText,
              { color: secondaryTextColor },
            ]}
            testID={`${testID}-body`}
          >
            {modalBody}
          </TextApp>

          {/* Button Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onCancel}
              style={styles.cancelButton}
              testID={`${testID}-cancel`}
            >
              <TextApp style={[styles.cancelText, { color: themeColors?.primary || '#6750A4' }]}>
                {cancelLabel}
              </TextApp>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onConfirm}
              style={[styles.confirmButton, { backgroundColor: confirmColor }]}
              testID={`${testID}-confirm`}
            >
              <TextApp style={styles.confirmText}>
                {confirmLabel}
              </TextApp>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    lineHeight: 26,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ModalAskComponent;
