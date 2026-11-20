// PMExportProjectWindow - the "Export project" window (project bar: Import / Export button > Export).
//
//   [x] Task lines (Time, Material, Expense)
//   [x] BIM model (3D geometry) - makes a zip package        (only a BIM project)
//   [ ] BIM properties (large)                               (only with the BIM model)
//   [ Export to PDF ] [ Export to MS Project ]               (what the dashboard shows: only for the project that is open there)
//   [ Close ]  [ Export ]  -> project_data_<rowGUID>.json, or project_package_<rowGUID>.zip with the BIM model
//
// While the export runs the window shows a PROGRESS BAR (determinate: the steps report how far they are) + the list of the steps;
// the options, Export and Close are locked until it has finished (done or failed); then the result and a Close button.
// The work is useProjectExchange().exportProject (export/exportProjectToFile.ts, package/).

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { PMDialogButton } from '../../../inner/buttons/PMDialogButton';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { projectIsBimBased } from '../../../bim/model/bimModel';
import { usePMStore } from '../../../store/store_pm';
import { pmT } from '../../../i18n/pmT';
import PMExportToMSProject from '../msproject/PMExportToMSProject';
import { useProjectExchange } from './useProjectExchange';
import { projectDataFileName } from './projectExchangeFormat';
import { DEFAULT_EXPORT_OPTIONS, projectPackageFileName, type PMExportOptions } from './package/packageModel';

/** overlay padding + card padding + title row + the pinned button row with its divider (px) */
export const BODY_RESERVED = 32 + 36 + 40 + 86;

export const STEPS_HEIGHT = 5 * 24 + 4;

/** the steps already done + the one running (the texts of the status while it is busy) */
export function addStep(steps: string[], text: string): string[] {
  return steps[steps.length - 1] === text ? steps : [...steps, text];
}

export default function PMExportProjectWindow({
  visible,
  projectGUID,
  ownerGUID,
  onClose,
  onExportPdf,
}: {
  visible: boolean;
  projectGUID: string | null | undefined;
  ownerGUID: string;
  onClose: () => void;
  /** "Export to PDF": the host closes this window and exports the dashboard (no button without it) */
  onExportPdf?: (projectGUID: string) => void;
}) {
  const { themeColors: c } = useDesignSystem();
  const paperTheme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  // the body grows with its content (the steps join while it runs) up to what the window leaves above the pinned buttons:
  // an explicit maxHeight - a flex shrink of a ScrollView inside a card with no height of its own stayed at the first (small) size
  const bodyMaxHeight = Math.max(160, windowHeight - BODY_RESERVED);
  const primaryColor = paperTheme.colors?.primary || c.primary;
  const { exportProject, cancelExport, status, busy } = useProjectExchange(ownerGUID);
  const projectName = usePMStore((s) => (projectGUID ? s.projectsById[projectGUID]?.rowJSON?.name ?? '' : ''));
  const bimBased = usePMStore((s) => (projectGUID ? projectIsBimBased(s.projectsById[projectGUID]?.rowJSON) : false));
  const onDashboard = usePMStore((s) => !!projectGUID && s.loadedProjectGUID === projectGUID);
  const [options, setOptions] = useState<PMExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [steps, setSteps] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [msProjectOpen, setMsProjectOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const bodyRef = useRef<ScrollView>(null);
  const stepsRef = useRef<ScrollView>(null);

  // every time the window opens: nothing started, the default options
  useEffect(() => {
    if (!visible) return;
    setOptions(DEFAULT_EXPORT_OPTIONS);
    setSteps([]);
    setStarted(false);
    setStopping(false);
  }, [visible]);
  // the running step joins the list (the last one is the step in progress)
  useEffect(() => {
    if (started && status.kind === 'busy') setSteps((s) => addStep(s, status.text));
  }, [started, status]);

  // a new step / the result: scroll down so the newest line is in view
  useEffect(() => {
    if (!started) return;
    const t = setTimeout(() => {
      stepsRef.current?.scrollToEnd?.({ animated: true }); // the step list has a fixed height: the active (last) step is always in view
      bodyRef.current?.scrollToEnd?.({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [started, steps.length, status.kind]);

  if (!visible || !projectGUID) return null;
  const done = started && status.kind === 'done';
  const failed = started && status.kind === 'error';
  const cancelled = started && status.kind === 'cancelled';
  const running = started && busy;
  const withBim = bimBased && options.bim;
  const fileName = withBim ? projectPackageFileName(projectGUID) : projectDataFileName(projectGUID);
  const locked = running || done;
  const fraction = done ? 1 : cancelled ? 0 : status.kind === 'busy' ? status.fraction ?? 0 : 0;

  const stopExport = () => { setStopping(true); cancelExport(); };
  const run = async () => {
    if (running) return;
    setStopping(false);
    setSteps([]);
    setStarted(true);
    await exportProject(projectGUID, { taskLines: options.taskLines, bim: withBim, bimProperties: withBim && options.bimProperties });
  };
  // no close while it runs: the file is being made
  const close = () => { if (!running) onClose(); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable testID="pm-export-project-backdrop" style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={pmT('Cancel')} />
        <View
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
          testID="pm-export-project-window"
          {...(Platform.OS === 'web'
            ? ({ onKeyDown: (e: any) => { if (e.key === 'Escape') close(); } } as any)
            : {})}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>{pmT('Export project')}</Text>
            <PMIconButton testID="pm-export-project-close" icon="close" title={pmT('Close')} color={c.text} disabled={running} onPress={close} />
          </View>
          <ScrollView ref={bodyRef} style={[styles.body, { maxHeight: bodyMaxHeight }]} contentContainerStyle={styles.bodyContent} testID="pm-export-project-body" showsVerticalScrollIndicator>
          {!!projectName && <Text style={[styles.project, { color: c.text }]} numberOfLines={2} testID="pm-export-project-name">{projectName}</Text>}
          <Text style={[styles.hint, { color: c.text }]}>
            {pmT('The project with all its stages, tasks, milestones and dependencies (+ your Gantt settings).')}
          </Text>

          <Text style={[styles.section, { color: c.text }]}>{pmT('Options')}</Text>
          <View testID="pm-export-project-options">
            <SwitchApp testID="pm-export-project-opt-lines" label={pmT('Task lines (Time, Material, Expense)')} value={options.taskLines} disabled={locked} onValueChange={(v: boolean) => setOptions((o) => ({ ...o, taskLines: v }))} />
            {bimBased && (
              <SwitchApp testID="pm-export-project-opt-bim" label={pmT('BIM model (3D geometry) - makes a zip package')} value={options.bim} disabled={locked} onValueChange={(v: boolean) => setOptions((o) => ({ ...o, bim: v }))} />
            )}
            {withBim && (
              <SwitchApp testID="pm-export-project-opt-bim-props" label={pmT('BIM properties (large)')} value={options.bimProperties} disabled={locked} onValueChange={(v: boolean) => setOptions((o) => ({ ...o, bimProperties: v }))} />
            )}
          </View>
          {/* the format of the file that Export makes: a ZIP archive while the BIM model is on, else the plain JSON */}
          <View style={styles.formatRow} testID="pm-export-project-format">
            <IconApp testID="pm-export-project-format-icon" name={withBim ? 'folder_zip' : 'data_object'} size={20} color={primaryColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.formatTitle, { color: c.text }]} testID="pm-export-project-format-title">
                {withBim ? pmT('ZIP archive with the BIM model') : pmT('JSON file')}
              </Text>
              <Text style={[styles.fileName, styles.formatFile, { color: c.text }]} numberOfLines={2} testID="pm-export-project-file-name">{fileName}</Text>
              {withBim && (
                <Text style={[styles.fileName, styles.formatFile, { color: c.text }]} testID="pm-export-project-format-content">
                  {options.bimProperties
                    ? pmT('Inside: project_data.json, csv/ (all tables as CSV), bim/ (manifest, elements, 3D chunks, properties)')
                    : pmT('Inside: project_data.json, csv/ (all tables as CSV), bim/ (manifest, elements, 3D chunks)')}
                </Text>
              )}
            </View>
          </View>

          {(
            <View style={styles.otherRow} testID="pm-export-project-other">
              {!!onExportPdf && (
                <View style={styles.cell}>
                  <PMDialogButton testID="pm-export-project-pdf" kind="secondary" color={primaryColor} icon="picture_as_pdf" title={pmT('Export to PDF')} disabled={locked || !onDashboard} style={styles.fill} onPress={() => onExportPdf(projectGUID)} />
                </View>
              )}
              <View style={styles.cell}>
                <PMDialogButton testID="pm-export-project-msproject" kind="secondary" color={primaryColor} icon="account_tree" title={pmT('Export to MS Project')} disabled={locked || !onDashboard} style={styles.fill} onPress={() => setMsProjectOpen(true)} />
              </View>
            </View>
          )}
          {!onDashboard && (
            <Text style={[styles.fileName, { color: c.text }]} testID="pm-export-project-dashboard-hint">
              {pmT('PDF and MS Project export the project that is open on the dashboard.')}
            </Text>
          )}

          {started && (
            <View testID="pm-export-project-progress" accessibilityLiveRegion="polite" style={styles.progressBox}>
              {/* a plain two-View bar: the Paper ProgressBar left a tall empty gap under itself */}
              <View style={[styles.bar, { backgroundColor: c.border }]} testID="pm-export-project-bar" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round((failed ? 0 : fraction) * 100) }}>
                <View style={{ height: 8, borderRadius: 4, width: `${Math.round((failed ? 0 : fraction) * 100)}%`, backgroundColor: failed ? c.error : primaryColor }} />
              </View>
              <Text style={[styles.percent, { color: c.text }]} testID="pm-export-project-percent">{`${Math.round((failed ? 0 : fraction) * 100)} %`}</Text>
              <ScrollView ref={stepsRef} style={styles.steps} contentContainerStyle={styles.stepsContent} nestedScrollEnabled testID="pm-export-project-steps">
                {steps.map((text, i) => {
                  const last = i === steps.length - 1;
                  const current = running && last;
                  return (
                    <View key={text} style={styles.stepRow} testID={`pm-export-project-step-${i}`}>
                      <View style={styles.stepIcon}>
                        {current ? <ActivityIndicator size="small" color={primaryColor} style={styles.spinner} /> : <IconApp testID={`pm-export-project-step-${i}-icon`} name={failed && last ? 'error' : 'check_circle'} size={16} color={failed && last ? c.error : primaryColor} />}
                      </View>
                      <Text style={[styles.stepText, { color: c.text }]}>{text}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
          {done && (
            <View testID="pm-export-project-status" accessibilityLiveRegion="polite" style={styles.statusBox}>
              <Text style={[styles.statusSuccess, { color: c.text }]}>{pmT('Export successfully finished')}</Text>
              <Text style={[styles.statusDetail, { color: c.text }]}>{status.kind === 'done' ? status.text : ''}</Text>
            </View>
          )}
          {cancelled && (
            <View testID="pm-export-project-status" accessibilityLiveRegion="polite" style={styles.statusBox}>
              <Text style={[styles.statusDetail, { color: c.text }]}>{status.kind === 'cancelled' ? status.text : ''}</Text>
            </View>
          )}
          {failed && (
            <View testID="pm-export-project-status" accessibilityLiveRegion="polite" style={styles.statusBox}>
              <Text style={[styles.statusError, { color: c.error }]}>{status.kind === 'error' ? status.text : ''}</Text>
            </View>
          )}

          </ScrollView>

          <View style={styles.actions}>
            {done ? (
              <View style={styles.cell}>
                <PMDialogButton testID="pm-export-project-done" kind="primary" color={primaryColor} title={pmT('Close')} style={styles.fill} onPress={onClose} />
              </View>
            ) : (
              <>
                <View style={styles.cell}>
                  <PMDialogButton testID="pm-export-project-cancel" kind={running ? 'dangerOutlined' : 'secondary'} icon={running ? 'cancel' : undefined} title={running ? pmT('Cancel export') : pmT('Cancel')} disabled={running && stopping} style={styles.fill} onPress={running ? stopExport : close} />
                </View>
                <View style={styles.cell}>
                  <PMDialogButton testID="pm-export-project-export" kind="primary" color={primaryColor} icon="download" title={failed || cancelled ? pmT('Try again') : withBim ? pmT('Export ZIP') : pmT('Export')} disabled={running} loading={running} style={styles.fill} onPress={run} />
                </View>
              </>
            )}
          </View>
        </View>
      </View>
      <PMExportToMSProject visible={msProjectOpen} projectGUID={projectGUID} onClose={() => setMsProjectOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '100%',
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
  // the body scrolls when the window is low; the buttons below it stay in view
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '700' },
  project: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  hint: { fontSize: 12, opacity: 0.75, marginTop: 6 },
  section: { fontSize: 13, fontWeight: '700', marginTop: 14, marginBottom: 4 },
  fileName: { fontSize: 12, opacity: 0.7, marginTop: 8 },
  formatRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  formatTitle: { fontSize: 13, fontWeight: '700' },
  formatFile: { marginTop: 2 },
  // two rows of buttons: each button takes half of the row (a gap between), so the row is spread from edge to edge
  otherRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  cell: { flex: 1 },
  fill: { marginLeft: 0, marginVertical: 0, width: '100%', minWidth: 0, maxWidth: '100%', flexGrow: 1, flexShrink: 1 },
  progressBox: { marginTop: 14, gap: 2 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', alignSelf: 'stretch' },
  percent: { fontSize: 12, alignSelf: 'flex-end', opacity: 0.8 },
  // a fixed height (about 5 lines): a long list scrolls inside, the newest step is kept in view
  steps: { height: STEPS_HEIGHT, flexGrow: 0, marginTop: 4 },
  stepsContent: { paddingVertical: 2 },
  stepIcon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  spinner: { transform: [{ scale: 0.75 }] },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 24 },
  stepText: { fontSize: 13 },
  statusBox: { marginTop: 10 },
  statusSuccess: { fontSize: 14, fontWeight: '700' },
  statusDetail: { fontSize: 12, opacity: 0.8, marginTop: 2 },
  statusError: { fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.35)' },
});
