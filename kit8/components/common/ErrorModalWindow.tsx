import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { create } from 'zustand';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from './IconApp';
import ButtonPrimaryApp from './ButtonPrimaryApp';

export interface AppErrorPayload {
  code?: string | number | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
  [key: string]: any;
}

interface ErrorModalState {
  isOpen: boolean;
  error: AppErrorPayload | null;
  title?: string;
  showError: (error: AppErrorPayload | Error | string | unknown, title?: string) => void;
  hideError: () => void;
}

export const useErrorModalStore = create<ErrorModalState>((set) => ({
  isOpen: false,
  error: null,
  title: undefined,
  showError: (err, title) => {
    let payload: AppErrorPayload;
    if (typeof err === 'string') {
      payload = { message: err };
    } else if (err instanceof Error) {
      payload = {
        name: err.name,
        message: err.message,
        code: (err as any).code,
        details: (err as any).details,
        hint: (err as any).hint,
      };
    } else if (err && typeof err === 'object') {
      payload = { ...(err as any) };
    } else {
      payload = { message: String(err) };
    }
    set({ isOpen: true, error: payload, title });
  },
  hideError: () => set({ isOpen: false, error: null, title: undefined }),
}));

/** Global helper to show the ErrorModalWindow anywhere */
export function showErrorModal(error: AppErrorPayload | Error | string | unknown, title?: string) {
  useErrorModalStore.getState().showError(error, title);
}

/** Global helper to hide the ErrorModalWindow */
export function hideErrorModal() {
  useErrorModalStore.getState().hideError();
}

export interface ErrorModalWindowProps {
  visible?: boolean;
  error?: AppErrorPayload | Error | string | null;
  title?: string;
  onClose?: () => void;
  testID?: string;
}

export default function ErrorModalWindow({
  visible: controlledVisible,
  error: controlledError,
  title: controlledTitle,
  onClose,
  testID = 'error-modal',
}: ErrorModalWindowProps) {
  const { themeColors, isDark } = useDesignSystem();
  const storeIsOpen = useErrorModalStore((s) => s.isOpen);
  const storeError = useErrorModalStore((s) => s.error);
  const storeTitle = useErrorModalStore((s) => s.title);
  const hideError = useErrorModalStore((s) => s.hideError);

  const isControlled = controlledVisible !== undefined;
  const isVisible = isControlled ? controlledVisible : storeIsOpen;

  let activeError: AppErrorPayload | null = null;
  if (isControlled) {
    if (typeof controlledError === 'string') {
      activeError = { message: controlledError };
    } else if (controlledError instanceof Error) {
      activeError = {
        name: controlledError.name,
        message: controlledError.message,
        code: (controlledError as any).code,
        details: (controlledError as any).details,
        hint: (controlledError as any).hint,
      };
    } else if (controlledError && typeof controlledError === 'object') {
      activeError = controlledError;
    }
  } else {
    activeError = storeError;
  }

  const handleClose = () => {
    if (onClose) onClose();
    if (!isControlled) hideError();
  };

  if (!isVisible || !activeError) return null;

  const code = activeError.code != null ? String(activeError.code) : null;
  const message = activeError.message || 'An unexpected error occurred.';
  const hint = activeError.hint || null;
  const details = activeError.details || null;

  const headerTitle =
    controlledTitle ||
    storeTitle ||
    (code === 'PGRST205'
      ? 'Database Schema Error'
      : code
      ? `Error (${code})`
      : 'Application Error');

  const cardBg = isDark ? '#1f1e24' : '#ffffff';
  const errorRed = themeColors?.error || '#d32f2f';
  const surfaceVariant = isDark ? '#2b2930' : '#f5f0f7';

  return (
    <Modal
      transparent
      visible={isVisible}
      animationType="fade"
      onRequestClose={handleClose}
      testID={testID}
    >
      <View style={styles.backdrop} testID="error-modal-window">
        <Pressable
          style={styles.backdropPress}
          onPress={handleClose}
          testID={`${testID}-backdrop`}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBg,
              borderColor: errorRed,
            },
          ]}
          testID={`${testID}-card`}
        >
          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: `${errorRed}18` },
              ]}
            >
              <IconApp name="error" size={24} color={errorRed} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={[styles.title, { color: themeColors.text }]}
                testID={`${testID}-title`}
                numberOfLines={2}
              >
                {headerTitle}
              </Text>
              {!!code && (
                <View style={styles.codeBadge}>
                  <Text
                    style={[styles.codeBadgeText, { color: errorRed }]}
                    testID={`${testID}-code`}
                  >
                    Code: {code}
                  </Text>
                </View>
              )}
            </View>
            <Pressable
              onPress={handleClose}
              style={styles.closeBtn}
              testID={`${testID}-close-icon`}
            >
              <IconApp name="close" size={20} color={themeColors.text} />
            </Pressable>
          </View>

          {/* Content Body */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Main Message */}
            <View style={[styles.messageBox, { backgroundColor: surfaceVariant }]}>
              <Text
                style={[styles.messageText, { color: themeColors.text }]}
                testID={`${testID}-message`}
              >
                {message}
              </Text>
            </View>

            {/* Hint */}
            {!!hint && (
              <View
                style={[
                  styles.infoBox,
                  { backgroundColor: '#0284c718', borderColor: '#0284c7' },
                ]}
                testID={`${testID}-hint-container`}
              >
                <Text style={[styles.boxLabel, { color: '#0284c7' }]}>Hint</Text>
                <Text
                  style={[styles.boxValue, { color: themeColors.text }]}
                  testID={`${testID}-hint`}
                >
                  {hint}
                </Text>
              </View>
            )}

            {/* Details */}
            {!!details && (
              <View
                style={[
                  styles.infoBox,
                  { backgroundColor: `${errorRed}10`, borderColor: errorRed },
                ]}
                testID={`${testID}-details-container`}
              >
                <Text style={[styles.boxLabel, { color: errorRed }]}>Details</Text>
                <Text
                  style={[styles.boxValue, { color: themeColors.text }]}
                  testID={`${testID}-details`}
                >
                  {details}
                </Text>
              </View>
            )}

            {/* Raw JSON inspection if there are extra properties */}
            {Object.keys(activeError).some(
              (k) => !['code', 'message', 'hint', 'details', 'name'].includes(k)
            ) && (
              <View
                style={[styles.rawBox, { backgroundColor: surfaceVariant }]}
              >
                <Text style={[styles.rawTitle, { color: themeColors.text }]}>
                  Additional Information:
                </Text>
                <Text
                  style={[
                    styles.rawText,
                    {
                      color: isDark ? '#b0b0c2' : '#49454f',
                      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    },
                  ]}
                >
                  {JSON.stringify(activeError, null, 2)}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Footer Action */}
          <View style={styles.footer}>
            <ButtonPrimaryApp
              testID={`${testID}-close-btn`}
              color={errorRed}
              onPress={handleClose}
              style={{ minWidth: 100 }}
            >
              Close
            </ButtonPrimaryApp>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 99999,
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    zIndex: 100000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  codeBadge: {
    marginTop: 3,
  },
  codeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
  },
  bodyScroll: {
    paddingHorizontal: 18,
  },
  bodyContent: {
    paddingBottom: 12,
  },
  messageBox: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  boxLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  boxValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  rawBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  rawTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  rawText: {
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
});
