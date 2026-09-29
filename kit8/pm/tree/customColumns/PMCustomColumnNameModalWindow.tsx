// PMCustomColumnNameModalWindow: asks for the name of a new custom tree column (or a new name for
// an existing one). Add = the column becomes the LAST tree column and the tree scrolls to it
// (crud.addCustomColumn). Web: Enter = Add, Esc = Cancel. Mount once per screen (dashboard).

import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../components/common/IconApp';
import { usePMStore } from '../../store';
import { PMCrud } from '../../usePMCrud';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import { PM_CUSTOM_COLUMN_NAME_MAX, PM_CUSTOM_COLUMN_TYPE_ICON, PM_CUSTOM_COLUMN_TYPE_LABEL } from '../columns/customColumns';

export default function PMCustomColumnNameModalWindow({ crud }: { crud: PMCrud }) {
  const { themeColors: c } = useDesignSystem();
  const prompt = usePMStore((s) => s.customColumnPrompt);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(prompt?.name ?? '');
    setError(null);
  }, [prompt]);

  if (!prompt) return null;
  const renaming = !!prompt.key;
  const close = () => crud.closeCustomColumnPrompt();
  const submit = () => {
    const problem = crud.validateCustomColumnName(name, prompt.key);
    if (problem) {
      setError(problem);
      return;
    }
    if (renaming) crud.renameCustomColumn(prompt.key!, name);
    else crud.addCustomColumn(prompt.type, name);
  };
  const typeLabel = PM_CUSTOM_COLUMN_TYPE_LABEL[prompt.type];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cancel" />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="pm-custom-column-window">
          <View style={styles.header}>
            <View style={[styles.iconBubble, { backgroundColor: `${c.primary}1f` }]}>
              <IconApp testID="pm-custom-column-type-icon" name={PM_CUSTOM_COLUMN_TYPE_ICON[prompt.type]} size={20} color={c.primary} />
            </View>
            <Text style={[styles.title, { color: c.text }]} testID="pm-custom-column-title">
              {renaming ? `Rename the ${typeLabel} column` : `New ${typeLabel} column`}
            </Text>
          </View>
          <Text style={[styles.label, { color: c.text }]}>Column name</Text>
          <TextInput
            testID="pm-custom-column-name"
            value={name}
            onChangeText={(t) => {
              setName(t.slice(0, PM_CUSTOM_COLUMN_NAME_MAX));
              setError(null);
            }}
            placeholder={prompt.type === 'date' ? 'e.g. Deadline' : prompt.type === 'boolean' ? 'e.g. Approved' : prompt.type === 'text' ? 'e.g. Owner' : 'e.g. Budget'}
            placeholderTextColor={`${c.text}66`}
            autoFocus
            maxLength={PM_CUSTOM_COLUMN_NAME_MAX}
            onSubmitEditing={submit}
            onKeyPress={(e) => {
              if ((e.nativeEvent as any).key === 'Escape') close();
            }}
            style={[
              styles.input,
              { color: c.text, borderColor: error ? c.error : c.border, backgroundColor: c.background },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null,
            ]}
          />
          {!!error && (
            <Text testID="pm-custom-column-error" style={[styles.error, { color: c.error }]}>
              {error}
            </Text>
          )}
          {!renaming && <Text style={[styles.hint, { color: c.text }]}>It is added as the last column of the task tree.</Text>}
          <View style={styles.actions}>
            <View style={{ flex: 1 }} />
            <PMDialogButton testID="pm-custom-column-cancel" kind="secondary" title="Cancel" color={c.text} onPress={close} />
            <PMDialogButton testID="pm-custom-column-save" kind="primary" icon={renaming ? 'check' : 'add'} title={renaming ? 'Rename' : 'Add column'} onPress={submit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  iconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  label: { marginTop: 16, marginBottom: 6, fontSize: 12, fontWeight: '600', opacity: 0.7 },
  input: { height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 14 },
  error: { marginTop: 6, fontSize: 12 },
  hint: { marginTop: 8, fontSize: 12, opacity: 0.6 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
});
