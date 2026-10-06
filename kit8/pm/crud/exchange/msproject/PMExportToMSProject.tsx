// PMExportToMSProject - "Export to MS Project" window (Gantt bar: Export > Export to MSProject, and
// Project settings > Import / Export > Export).
//
//   Export custom fields:
//     [x] Export Kanban Stage     -> custom field Text1   "Kanban Stage"
//     [x] Export Kanban Percent   -> custom field Number1 "Kanban Percent"
//   [ Cancel ]  [ Export ]        -> <Project_name>_<time>.xml (Microsoft Project XML, msProjectXml.ts)
//
// The choices are remembered while the app runs.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { PM_DIALOG_BUTTON_WIDTH } from '../../../model/constants';
import { usePMStore } from '../../../store/store_pm';
import { pmT } from '../../../i18n/pmT';
import { exportProjectToMSProject } from './exportProjectToMSProject';
import type { MSProjectExportOptions } from './msProjectXml';

let remembered: Required<MSProjectExportOptions> = { exportKanbanStage: true, exportKanbanPercent: true };

type Status = { kind: 'idle' } | { kind: 'busy'; text?: string } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

export default function PMExportToMSProject({
  visible,
  projectGUID,
  onClose,
  exporter = exportProjectToMSProject,
}: {
  visible: boolean;
  projectGUID: string | null | undefined;
  onClose: () => void;
  /** tests */
  exporter?: typeof exportProjectToMSProject;
}) {
  const { themeColors: c } = useDesignSystem();
  const paperTheme = useTheme();
  const projectName = usePMStore((s) => (projectGUID ? s.projectsById[projectGUID]?.rowJSON?.name ?? '' : ''));
  const [stage, setStage] = useState(remembered.exportKanbanStage);
  const [percent, setPercent] = useState(remembered.exportKanbanPercent);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (!visible) return;
    setStage(remembered.exportKanbanStage);
    setPercent(remembered.exportKanbanPercent);
    setStatus({ kind: 'idle' });
  }, [visible]);

  if (!visible) return null;
  const busy = status.kind === 'busy';
  const done = status.kind === 'done';
  const run = async () => {
    if (busy || !projectGUID) return;
    remembered = { exportKanbanStage: stage, exportKanbanPercent: percent };
    setStatus({ kind: 'busy', text: pmT('Export in progress…') });
    try {
      const r = await exporter(projectGUID, remembered);
      setStatus({ kind: 'done', text: pmT('Exported {{file}} ({{count}} tasks).', { file: r.fileName, count: r.tasks }) });
    } catch (e: any) {
      setStatus({ kind: 'error', text: e?.message || pmT('The export failed.') });
    }
  };

  const primaryColor = paperTheme.colors?.primary || c.primary;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable testID="pm-export-msproject-backdrop" style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={pmT('Cancel')} />
        <View
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
          testID="pm-export-msproject-window"
          {...(Platform.OS === 'web'
            ? ({
                onKeyDown: (e: any) => {
                  if (e.key === 'Escape') onClose();
                },
              } as any)
            : {})}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
              {pmT('Export to MS Project')}
            </Text>
            <PMIconButton testID="pm-export-msproject-close" icon="close" title={pmT('Close')} color={c.text} onPress={onClose} />
          </View>
          {!!projectName && (
            <Text style={[styles.project, { color: c.text }]} numberOfLines={2} testID="pm-export-msproject-project">
              {projectName}
            </Text>
          )}
          <Text style={[styles.hint, { color: c.text }]}>
            {pmT('Microsoft Project XML file (.xml) with all stages, tasks, milestones and dependencies. In MS Project: File > Open > the file > As a new project.')}
          </Text>

          <Text style={[styles.section, { color: c.text }]}>{pmT('Export custom fields')}</Text>
          <CheckRow testID="pm-export-msproject-kanban-stage" label={pmT('Export Kanban Stage')} hint={pmT('Text1')} checked={stage} onChange={setStage} colors={c} disabled={busy || done} />
          <CheckRow testID="pm-export-msproject-kanban-percent" label={pmT('Export Kanban Percent')} hint={pmT('Number1')} checked={percent} onChange={setPercent} colors={c} disabled={busy || done} />

          {busy && (
            <View testID="pm-export-msproject-progress" accessibilityLiveRegion="polite" style={styles.progressBox}>
              <ActivityIndicator size="small" color={primaryColor} />
              <Text style={[styles.progressText, { color: c.text }]}>
                {status.text || pmT('Export in progress…')}
              </Text>
            </View>
          )}

          {done && (
            <View testID="pm-export-msproject-status" accessibilityLiveRegion="polite" style={styles.statusBox}>
              <View style={styles.successRow}>
                <IconApp testID="pm-export-msproject-success-icon" name="check_circle" size={18} color={primaryColor} />
                <Text style={[styles.statusSuccess, { color: c.text }]}>
                  {pmT('Export successfully finished')}
                </Text>
              </View>
              {!!status.text && (
                <Text style={[styles.statusDetail, { color: c.text }]}>
                  {status.text}
                </Text>
              )}
            </View>
          )}

          {status.kind === 'error' && (
            <View testID="pm-export-msproject-status" accessibilityLiveRegion="polite" style={styles.statusBox}>
              <Text style={[styles.statusError, { color: c.error }]}>
                {status.text}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            {done ? (
              <PMDialogButton
                testID="pm-export-msproject-cancel"
                kind="primary"
                color={primaryColor}
                title={pmT('Close')}
                width={PM_DIALOG_BUTTON_WIDTH}
                style={{ marginLeft: 0 }}
                onPress={onClose}
              />
            ) : (
              <>
                <PMDialogButton
                  testID="pm-export-msproject-cancel"
                  kind="secondary"
                  title={pmT('Cancel')}
                  width={PM_DIALOG_BUTTON_WIDTH}
                  disabled={busy}
                  style={{ marginLeft: 0 }}
                  onPress={onClose}
                />
                <PMDialogButton
                  testID="pm-export-msproject-export"
                  kind="primary"
                  color={primaryColor}
                  icon="download"
                  title={pmT('Export')}
                  width={PM_DIALOG_BUTTON_WIDTH}
                  disabled={!projectGUID || busy}
                  loading={busy}
                  onPress={run}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CheckRow({
  testID,
  label,
  hint,
  checked,
  onChange,
  colors,
  disabled,
}: {
  testID: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  colors: { text: string; primary: string };
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      // react-native-web 0.21 ignores accessibilityState -> aria-* too
      aria-checked={checked}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ hovered, pressed }: any) => [styles.check, { backgroundColor: hovered || pressed ? `${colors.primary}14` : 'transparent', opacity: disabled ? 0.5 : 1 }]}
    >
      <IconApp testID={`${testID}-icon`} name={checked ? 'check_box' : 'check_box_outline_blank'} size={22} color={checked ? colors.primary : colors.text} />
      <Text style={[styles.checkLabel, { color: colors.text }]}>{label}</Text>
      {!!hint && <Text style={[styles.checkHint, { color: colors.text }]}>{hint}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 440,
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
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  project: { marginTop: 4, fontSize: 14, fontWeight: '600' },
  hint: { marginTop: 6, fontSize: 12, opacity: 0.7 },
  section: { marginTop: 16, marginBottom: 4, fontSize: 12, fontWeight: '700', opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.3 },
  check: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 6, borderRadius: 8 },
  checkLabel: { flex: 1, marginLeft: 10, fontSize: 14, fontWeight: '500' },
  checkHint: { fontSize: 11, opacity: 0.5, marginLeft: 8 },
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  progressText: { fontSize: 13, fontWeight: '500' },
  statusBox: { marginTop: 14, gap: 4 },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusSuccess: { fontSize: 13, fontWeight: '600' },
  statusDetail: { fontSize: 12, opacity: 0.7, marginLeft: 24 },
  statusError: { fontSize: 12, fontWeight: '500' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
});
