// PMVersionTitleModalWindow: asks for the title of a new project version ("Save project version")
// or a new title of an existing one ("Rename version"). Web: Enter = save, Esc = cancel.

import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../components/common/IconApp';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { PM_VERSION_TITLE_MAX, validateVersionTitle } from '../../model/versionTypes';
import { usePMVersionStore } from '../../store/store_version';
import type { PMVersionCommands } from '../../crud/version/useVersionCommands';

export default function PMVersionTitleModalWindow({ commands }: { commands: PMVersionCommands }) {
  const { themeColors: c } = useDesignSystem();
  const prompt = usePMVersionStore((s) => s.titlePrompt);
  const busy = usePMVersionStore((s) => s.busy);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(prompt?.title ?? '');
    setError(null);
    setSaving(false);
  }, [prompt]);

  if (!prompt) return null;
  const renaming = prompt.mode === 'rename';
  const close = () => commands.closeTitlePrompt();
  const submit = async () => {
    if (saving) return;
    const problem = validateVersionTitle(title);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const ok = renaming && prompt.versionGUID ? await commands.renameVersion(prompt.versionGUID, title) : !!(await commands.saveVersion(title));
    setSaving(false);
    if (ok) close();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Cancel" />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="pm-version-title-window">
          <View style={styles.header}>
            <View style={[styles.iconBubble, { backgroundColor: `${c.primary}1f` }]}>
              <IconApp testID="pm-version-title-icon" name={renaming ? 'edit' : 'bookmark_add'} size={20} color={c.primary} />
            </View>
            <Text style={[styles.title, { color: c.text }]} testID="pm-version-title-heading">
              {renaming ? 'Rename version' : 'Save project version'}
            </Text>
          </View>
          <Text style={[styles.label, { color: c.text }]}>Version title</Text>
          <TextInput
            testID="pm-version-title-input"
            value={title}
            onChangeText={(t) => {
              setTitle(t.slice(0, PM_VERSION_TITLE_MAX));
              setError(null);
            }}
            placeholder="e.g. Baseline approved by the customer"
            placeholderTextColor={`${c.text}66`}
            autoFocus
            selectTextOnFocus
            maxLength={PM_VERSION_TITLE_MAX}
            onSubmitEditing={submit}
            onKeyPress={(e) => {
              if ((e.nativeEvent as any).key === 'Escape') close();
            }}
            style={[styles.input, { color: c.text, borderColor: error ? c.error : c.border, backgroundColor: c.background }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
          />
          {!!error && (
            <Text testID="pm-version-title-error" style={[styles.error, { color: c.error }]}>
              {error}
            </Text>
          )}
          {!renaming && (
            <Text style={[styles.hint, { color: c.text }]}>
              The whole plan is stored: project data, stages, tasks, milestones, dependencies and Kanban. A version never changes afterwards.
            </Text>
          )}
          <View style={styles.actions}>
            <View style={{ flex: 1 }} />
            <PMDialogButton testID="pm-version-title-cancel" kind="secondary" title="Cancel" color={c.text} onPress={close} />
            <PMDialogButton
              testID="pm-version-title-save"
              kind="primary"
              icon={renaming ? 'check' : 'bookmark_add'}
              title={renaming ? 'Rename' : 'Save version'}
              loading={saving || busy}
              disabled={saving || busy}
              onPress={submit}
            />
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
    maxWidth: 420,
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
