// Modal editor for ONE dependency (arrow), opened by double-clicking an arrow in the
// chart or "Edit" in the arrow's context menu.
//
//   * fromTaskGUID / toTaskGUID  - read-only TextInputApp fields with a copy icon
//   * link type (FS/SS/FF/SF) + lag / lead in working days
//   * SelectDependencyColor      - swatches; DefaultDependencyColor resets to automatic
//   * updateDependencyColor      - saved into the dependency's rowJSON.dependencyColor
//   * deleteDependency           - deletes ONLY the dependency (never a task); undoable
//                                  from the Gantt bar (undoGanttAction)

import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import TextInputApp from '../../../../components/common/TextInputApp';
import { usePMStore } from '../../../store/store_pm';
import { LINK_TYPES } from '../../project/scheduling';
import { PMLinkType } from '../../../model/types';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMDialogButton, PMIconButton } from '../../../inner/buttons';
import { useUxuiCurrentJSON } from '../../../../redux/useUxuiCurrentJSON';
import ShareScreenshotButton from '../../../../components/common/ShareScreenshotButton';
import { pmT } from '../../../i18n/pmT';

export const DEPENDENCY_COLOR_SWATCHES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#64748b'];

const LINK_TYPE_LABEL: Record<PMLinkType, string> = {
  FS: 'Finish → Start',
  SS: 'Start → Start',
  FF: 'Finish → Finish',
  SF: 'Start → Finish',
};

/** DefaultDependencyColor: "automatic" color (normal / critical / highlighted by the chart). */
export function DefaultDependencyColor({
  selected,
  onPress,
  colors,
}: {
  selected: boolean;
  onPress: () => void;
  colors: { text: string; border: string; background: string };
}) {
  return (
    <Pressable
      testID="pm-dep-color-default"
      accessibilityLabel={pmT('Default dependency color')}
      onPress={onPress}
      style={[styles.defaultSwatch, { borderColor: selected ? colors.text : colors.border, borderWidth: selected ? 2 : 1, backgroundColor: colors.background }]}
    >
      <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>{pmT('Default')}</Text>
    </Pressable>
  );
}

/** SelectDependencyColor: palette of arrow colors (+ the default). */
export function SelectDependencyColor({
  value,
  onChange,
  colors,
}: {
  value: string | null;
  onChange: (color: string | null) => void;
  colors: { text: string; border: string; background: string };
}) {
  return (
    <View style={styles.swatches}>
      <DefaultDependencyColor selected={!value} onPress={() => onChange(null)} colors={colors} />
      {DEPENDENCY_COLOR_SWATCHES.map((c) => (
        <Pressable
          key={c}
          testID={`pm-dep-color-${c}`}
          accessibilityLabel={`Dependency color ${c}`}
          onPress={() => onChange(c)}
          style={[styles.swatch, { backgroundColor: c, borderColor: value === c ? colors.text : colors.border, borderWidth: value === c ? 2 : 1 }]}
        />
      ))}
    </View>
  );
}

function CopyableGUID({ label, value, testID, colors }: { label: string; value: string; testID: string; colors: { text: string; primary: string } }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(value);
      setCopied(true);
    } catch {
      // clipboard unavailable: nothing else to do
    }
  };
  return (
    <View style={styles.guidRow}>
      <View style={{ flex: 1 }}>
        {/* read-only: no clear (x) icon inside the input */}
        <TextInputApp testID={testID} label={label} value={value} editable={false} selectTextOnFocus hideClearIcon />
      </View>
      <PMIconButton testID={`${testID}-copy`} icon={copied ? 'check' : 'content_copy'} label={copied ? 'Copied' : undefined} title={`Copy ${label}`} color={colors.primary} onPress={copy} />
    </View>
  );
}

export default function PMEditDependencyScreen({ crud }: { crud: PMCrud }) {
  const { themeColors } = useDesignSystem();
  const editingDep = usePMStore((s) => s.editingDep);
  const dep = usePMStore((s) =>
    s.editingDep ? s.deps.find((d) => d.rowGUID === s.editingDep!.rowGUID && d.rowDependsOnGUID === s.editingDep!.dependsOnGUID) : undefined
  );
  const fromName = usePMStore((s) => (dep ? s.tasksById[dep.rowDependsOnGUID]?.rowJSON.name : undefined));
  const toName = usePMStore((s) => (dep ? s.tasksById[dep.rowGUID]?.rowJSON.name : undefined));
  const close = () => usePMStore.getState().setEditingDep(null);
  // uxui.currentJSON while the window is open ("Share screenshot + JSON")
  useUxuiCurrentJSON(dep ? { kind: 'dependency', title: `${fromName || '?'} -> ${toName || '?'}`, json: dep } : null);

  const [linkType, setLinkType] = useState<PMLinkType>('FS');
  const [lag, setLag] = useState('0');
  const [color, setColor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dep) return;
    setLinkType(dep.linkType || 'FS');
    setLag(String(Number(dep.lagDays) || 0));
    setColor(dep.rowJSON?.dependencyColor ?? null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingDep?.rowGUID, editingDep?.dependsOnGUID]);

  // the dependency vanished (deleted elsewhere / undo) -> close
  useEffect(() => {
    if (editingDep && !dep) close();
  }, [editingDep, dep]);

  if (!editingDep || !dep) return null;
  const ref = { rowGUID: dep.rowGUID, dependsOnGUID: dep.rowDependsOnGUID };
  const c = themeColors;

  const save = () => {
    const lagDays = Number(lag.replace(',', '.'));
    if (!Number.isFinite(lagDays)) return setError('Lag must be a number of working days (negative = lead).');
    const changed =
      linkType !== (dep.linkType || 'FS') || lagDays !== (Number(dep.lagDays) || 0) || (color ?? null) !== (dep.rowJSON?.dependencyColor ?? null);
    if (changed) {
      crud.updateDependency(ref, { linkType, lagDays, rowJSON: { ...(dep.rowJSON || {}), dependencyColor: color } });
    }
    close();
  };

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{pmT('Edit dependency')}</Text>
            <ShareScreenshotButton testID="pm-dep-share" color={c.text} />
            <PMIconButton testID="pm-dep-close" icon="close" title={pmT('Close without saving')} color={c.text} onPress={close} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ color: c.text, marginBottom: 6 }} numberOfLines={2}>
              <Text style={{ fontWeight: '700' }}>{fromName || '?'}</Text>
              {'  →  '}
              <Text style={{ fontWeight: '700' }}>{toName || '?'}</Text>
            </Text>

            <CopyableGUID label={pmT('fromTaskGUID')} value={dep.rowDependsOnGUID} testID="pm-dep-from-guid" colors={c} />
            <CopyableGUID label={pmT('toTaskGUID')} value={dep.rowGUID} testID="pm-dep-to-guid" colors={c} />

            <Text style={[styles.label, { color: c.text }]}>{pmT('Link type')}</Text>
            <View style={styles.segment}>
              {LINK_TYPES.map((t, i) => {
                const active = linkType === t;
                return (
                  <Pressable
                    key={t}
                    testID={`pm-dep-type-${t}`}
                    accessibilityLabel={LINK_TYPE_LABEL[t]}
                    onPress={() => setLinkType(t)}
                    style={[
                      styles.segmentBtn,
                      { borderColor: c.border, backgroundColor: active ? c.primary : 'transparent' },
                      i === 0 && styles.segmentFirst,
                      i === LINK_TYPES.length - 1 && styles.segmentLast,
                      i > 0 && { borderLeftWidth: 0 },
                    ]}
                  >
                    <Text style={{ color: active ? '#fff' : c.text, fontWeight: '700' }}>{t}</Text>
                    <Text style={{ color: active ? '#ffffffcc' : c.text, opacity: active ? 1 : 0.6, fontSize: 10 }}>{LINK_TYPE_LABEL[t]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: c.text }]}>{pmT('Lag (working days, negative = lead)')}</Text>
            <TextInput testID="pm-dep-lag" value={lag} onChangeText={(v) => setLag(v.replace(/[^0-9.,-]/g, ''))} keyboardType="numbers-and-punctuation" style={input} />

            <Text style={[styles.label, { color: c.text }]}>{pmT('Arrow color')}</Text>
            <SelectDependencyColor value={color} onChange={setColor} colors={c} />

            {!!error && <Text style={{ color: c.error, marginTop: 8 }}>{error}</Text>}
          </ScrollView>

          <View style={styles.actions}>
            <PMDialogButton testID="pm-dep-delete" kind="danger" icon="link_off" title={pmT('Delete dependency')} style={{ marginLeft: 0 }} onPress={() => crud.deleteDependency(ref)} />
            {/* Cancel + Save stay together on the right; on a phone they wrap under "Delete dependency" as ONE group */}
            <View style={styles.actionsRight}>
              <PMDialogButton testID="pm-dep-cancel" kind="secondary" title={pmT('Cancel')} color={c.text} style={{ marginLeft: 0 }} onPress={close} />
              <PMDialogButton testID="pm-dep-save" kind="primary" title={pmT('Save')} onPress={save} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 460, maxHeight: '92%', borderRadius: 14, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  label: { fontSize: 12, opacity: 0.7, marginTop: 12, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  guidRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  segment: { flexDirection: 'row' },
  segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderWidth: 1 },
  segmentFirst: { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  segmentLast: { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  swatch: { width: 30, height: 30, borderRadius: 15, marginRight: 8, marginBottom: 6 },
  defaultSwatch: { height: 30, paddingHorizontal: 10, borderRadius: 15, marginRight: 8, marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 16, rowGap: 8 },
  actionsRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 },
});
