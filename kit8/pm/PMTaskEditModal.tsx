// "Lightbox" editor (DHTMLX-style) for one row, opened by double-tap / edit buttons.
// Header: title + close (X). Footer (always visible, outside the scroll area):
// Delete · Details · Cancel · Save. The bar color is stored as rowJSON.taskColor.

import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../providers/WithDesignSystem';
import { usePMStore } from './store';
import { formatDateISO, parseDateISO } from './scheduling';
import { PMCrud } from './usePMCrud';
import { PMRowKind, taskColorOf } from './types';
import { PMDialogButton, PMIconButton } from './buttons';

const SWATCHES = [null, '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#64748b'];
const KINDS: { kind: Exclude<PMRowKind, 'project'>; label: string }[] = [
  { kind: 'stage', label: 'Stage' },
  { kind: 'task', label: 'Task' },
  { kind: 'milestone', label: 'Milestone' },
];

export default function PMTaskEditModal({ crud }: { crud: PMCrud }) {
  const { themeColors } = useDesignSystem();
  const editingGUID = usePMStore((s) => s.editingGUID);
  const task = usePMStore((s) => (s.editingGUID ? s.tasksById[s.editingGUID] : undefined));
  const sched = usePMStore((s) => (s.editingGUID ? s.schedule[s.editingGUID] : undefined));
  const hasChildren = usePMStore((s) => (s.editingGUID ? (s.tree.childrenById[s.editingGUID]?.length ?? 0) > 0 : false));
  const close = () => usePMStore.getState().setEditing(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Exclude<PMRowKind, 'project'>>('task');
  const [days, setDays] = useState('1');
  const [start, setStart] = useState('');
  const [progress, setProgress] = useState('0');
  const [color, setColor] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setName(task.rowJSON.name || '');
    setKind((task.rowJSON.rowKind as any) === 'project' ? 'task' : (task.rowJSON.rowKind as Exclude<PMRowKind, 'project'>) || 'task');
    setDays(String(task.rowJSON.durationDays ?? 1));
    setStart(task.rowJSON.manualStartAt ? formatDateISO(Date.parse(task.rowJSON.manualStartAt)) : '');
    setProgress(String(Math.round(task.rowProgress || 0)));
    setColor(taskColorOf(task.rowJSON));
    setNotes(task.rowJSON.notes || '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingGUID]);

  if (!task) return null;
  const summary = hasChildren || kind === 'stage';

  const save = () => {
    const startMs = start.trim() ? parseDateISO(start) : null;
    if (start.trim() && startMs === null) {
      setError('Start must be YYYY-MM-DD (or empty = as soon as possible).');
      return;
    }
    const durationDays = kind === 'milestone' ? 0 : Math.max(kind === 'stage' ? 0 : 1, parseInt(days, 10) || 0);
    const { color: _legacyColor, ...json } = task.rowJSON;
    crud.updateTask(
      task.rowGUID,
      {
        rowProgress: Math.min(100, Math.max(0, parseInt(progress, 10) || 0)),
        rowJSON: {
          ...json,
          name: name.trim() || task.rowJSON.name,
          rowKind: kind,
          durationDays,
          manualStartAt: startMs === null ? null : new Date(startMs).toISOString(),
          taskColor: color,
          notes: notes.trim() || undefined,
        },
      },
      `Edit "${name.trim() || task.rowJSON.name}"`
    );
    close();
  };

  const input = [styles.input, { color: themeColors.text, borderColor: themeColors.border, backgroundColor: themeColors.background }];
  const label = [styles.label, { color: themeColors.text }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.text }]}>Edit {summary ? 'stage' : kind}</Text>
            <PMIconButton testID="pm-edit-close" icon="close" title="Cancel (close without saving)" color={themeColors.text} onPress={close} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">

            <Text style={label}>Name</Text>
            <TextInput testID="pm-edit-name" value={name} onChangeText={setName} style={input} autoFocus={Platform.OS === 'web'} onSubmitEditing={save} />

            <Text style={label}>Type</Text>
            <View style={styles.segment}>
              {KINDS.map((k, i) => (
                <Pressable
                  key={k.kind}
                  testID={`pm-edit-kind-${k.kind}`}
                  onPress={() => setKind(k.kind)}
                  style={[
                    styles.segmentBtn,
                    { borderColor: themeColors.border, backgroundColor: kind === k.kind ? themeColors.primary : 'transparent' },
                    i === 0 && styles.segmentFirst,
                    i === KINDS.length - 1 && styles.segmentLast,
                    i > 0 && { borderLeftWidth: 0 }, // shared borders: every button keeps its right border
                  ]}
                >
                  <Text style={{ color: kind === k.kind ? '#fff' : themeColors.text, fontWeight: '600' }}>{k.label}</Text>
                </Pressable>
              ))}
            </View>

            {!summary && (
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={label}>Duration (working days)</Text>
                  <TextInput testID="pm-edit-days" value={kind === 'milestone' ? '0' : days} editable={kind !== 'milestone'} onChangeText={(v) => setDays(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={label}>Progress %</Text>
                  <TextInput testID="pm-edit-progress" value={progress} onChangeText={(v) => setProgress(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={input} />
                </View>
              </View>
            )}

            {!summary && (
              <>
                <Text style={label}>Start no earlier than (YYYY-MM-DD, empty = ASAP)</Text>
                <TextInput testID="pm-edit-start" value={start} onChangeText={setStart} placeholder="as soon as possible" placeholderTextColor={themeColors.border} style={input} autoCapitalize="none" />
              </>
            )}

            {sched && (
              <Text style={[styles.hint, { color: themeColors.text }]}>
                Scheduled {formatDateISO(sched.startMs)} → {formatDateISO(sched.finishMs - 1)} · {sched.durationDays} d
                {sched.isCritical ? ' · critical' : sched.totalFloatDays ? ` · slack ${sched.totalFloatDays} d` : ''}
              </Text>
            )}

            <Text style={label}>Color</Text>
            <View style={styles.swatches}>
              {SWATCHES.map((c) => (
                <Pressable
                  key={c || 'auto'}
                  testID={`pm-edit-color-${c || 'auto'}`}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c || themeColors.background, borderColor: color === c ? themeColors.text : themeColors.border, borderWidth: color === c ? 2 : 1 },
                  ]}
                >
                  {!c && <Text style={{ fontSize: 10, color: themeColors.text }}>auto</Text>}
                </Pressable>
              ))}
            </View>

            <Text style={label}>Notes</Text>
            <TextInput testID="pm-edit-notes" value={notes} onChangeText={setNotes} multiline style={[input, { minHeight: 64, textAlignVertical: 'top' }]} />

            {!!error && <Text style={{ color: themeColors.error, marginTop: 8 }}>{error}</Text>}
          </ScrollView>

          <View style={styles.actions}>
            <PMDialogButton testID="pm-edit-delete" kind="danger" title="Delete" style={{ marginLeft: 0 }} onPress={() => { close(); crud.deleteTask(task.rowGUID); }} />
            <PMDialogButton testID="pm-edit-open" kind="text" title="Details" onPress={() => { close(); crud.openInfo(task.rowGUID); }} />
            <View style={{ flex: 1 }} />
            <PMDialogButton testID="pm-edit-cancel" kind="secondary" title="Cancel" color={themeColors.text} onPress={close} />
            <PMDialogButton testID="pm-edit-save" kind="primary" title="Save" onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 440, maxHeight: '92%', borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  label: { fontSize: 12, opacity: 0.7, marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  row: { flexDirection: 'row' },
  segment: { flexDirection: 'row' },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderWidth: 1 },
  segmentFirst: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  segmentLast: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap' },
  swatch: { width: 30, height: 30, borderRadius: 15, marginRight: 8, marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 10, fontSize: 12, opacity: 0.75 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 14 },
});
