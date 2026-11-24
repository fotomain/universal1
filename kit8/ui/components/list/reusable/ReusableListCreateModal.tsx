// ReusableList - the window over the list that holds the form of a NEW element (props.CreateElementForm). The form makes the rowJSON, the list puts the row first / last.
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { CreateListElementFormProps } from './reusableListTypes';

interface Props {
  Form: React.ComponentType<CreateListElementFormProps>;
  onCreateFirst: (rowJSON: Record<string, any>, extras?: Record<string, any>) => void;
  onCreateLast: (rowJSON: Record<string, any>, extras?: Record<string, any>) => void;
  onClose: () => void;
  testID: string;
}

export default function ReusableListCreateModal({ Form, onCreateFirst, onCreateLast, onClose, testID }: Props) {
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} testID={`${testID}-create-modal`}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" testID={`${testID}-create-backdrop`} />
        <View style={styles.sheet} pointerEvents="box-none">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Form testID={`${testID}-create-form`} onCreateFirst={onCreateFirst} onCreateLast={onCreateLast} onClose={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%' },
  content: { flexGrow: 1, justifyContent: 'center' },
});
