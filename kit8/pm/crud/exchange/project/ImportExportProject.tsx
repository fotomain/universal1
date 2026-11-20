// ImportExportProject - "Import / Export" section of the Project settings window
// (view/project/recent/PMRecentProjectsToolbar; opened also by the ⇅ button after "Show task progress").
// Top tabs: TabImport (default) · TabExport
// Above the title: the project GUID with a button that copies it to the clipboard (the label says "Copied" for two seconds).
//   TabImport: drop the file on the zone (or "Choose file…") - a project_data_….json or a project_package_….zip (with the BIM model) - asks before deleting the current data
//   TabExport: three switches (Task lines · BIM model + BIM properties of a BIM project) and three buttons of equal size (outlined):
//                Export to JSON        project_data_<rowGUID>.json with the project, ALL its tasks and the task lines - downloaded at once;
//                                      with "BIM model" on: Export package (zip) = project_package_<rowGUID>.zip (the same JSON + the 3D model, package/README.md)
//                Export to PDF         the dashboard (task tree + Gantt chart) with the project name and dates; the
//                                      settings window closes first (onExportPdf) so that it is not in the picture
//                Export to MS Project  opens PMExportToMSProject (Microsoft Project XML)
//              PDF / MS Project export what the dashboard shows: enabled for the project that is open there.
// Logic: useProjectExchange.ts · export/ · import/ · projectExchangeFormat.ts

import React, { useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { ReceiveDraggableFilesComponent } from '../../../../ui/components/common/ReceiveDraggableFilesComponent';
import { PMDialogButton } from '../../../inner/buttons';
import { PM_EXPORT_BUTTON_WIDTH } from '../../../model/constants';
import { pmT } from '../../../i18n/pmT';
import PMExportToMSProject from '../msproject/PMExportToMSProject';
import { PMRowJSON } from '../../../model/types';
import { usePMStore } from '../../../store/store_pm';
import { projectDataFileName } from './projectExchangeFormat';
import { DEFAULT_EXPORT_OPTIONS, projectPackageFileName, type PMExportOptions } from './package/packageModel';
import { projectIsBimBased } from '../../../bim/model/bimModel';
import SwitchApp from '../../../../ui/components/common/SwitchApp';
import { useProjectExchange } from './useProjectExchange';
import ScrollableTabBar from '../../../../ui/components/tabs/ScrollableTabBar';

export default function ImportExportProject({
  ownerGUID,
  projectGUID,
  colors,
  onImported,
  onExportPdf,
  onSaveAsTemplate,
  onImportBim,
  initialTab = 'TabImport',
}: {
  /** the panel shown first (the Import / Export button of the project bar picks one) */
  initialTab?: PMExchangeTab;
  ownerGUID: string;
  projectGUID: string;
  colors: { text: string; primary: string; error: string; border: string };
  /** after a successful import: the project's new rowJSON (the settings window refreshes its fields) */
  onImported?: (projectRowJSON: PMRowJSON) => void;
  /** "Export to PDF" pressed: the host closes its window and exports the dashboard (no button without it) */
  onExportPdf?: (projectGUID: string) => void;
  /** "Save as template" pressed */
  onSaveAsTemplate?: () => void;
  /** "Import BIM (IFC)…" pressed: the host opens the BIM importer (kit8/pm/bim, route /pm/bim/import) for this project; no button without it */
  onImportBim?: () => void;
}) {
  const { exportProject, importProject, status, busy } = useProjectExchange(ownerGUID);
  const name = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON.name ?? '');
  // the BIM switches only for a project that has a model; "package" = the zip with the model
  const bimBased = usePMStore((s) => projectIsBimBased(s.projectsById[projectGUID]?.rowJSON));
  const [options, setOptions] = useState<PMExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const withBim = bimBased && options.bim;
  const fileName = withBim ? projectPackageFileName(projectGUID) : projectDataFileName(projectGUID);
  const [tab, setTab] = useState<PMExchangeTab>(initialTab);
  // PDF / MS Project export the project that is open on the dashboard
  const paperTheme = useTheme();
  const primaryColor = paperTheme.colors?.primary || colors.primary;
  const onDashboard = usePMStore((s) => s.loadedProjectGUID === projectGUID);
  const [msProjectOpen, setMsProjectOpen] = useState(false);
  // the project GUID on the clipboard
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);
  const copyGuid = async () => {
    try {
      await Clipboard.setStringAsync(projectGUID);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <View style={[styles.box, { borderColor: colors.border }]} testID="pm-project-exchange">
      {/* ---- the project GUID + copy ---- */}
      <View style={styles.guidRow} testID="pm-project-guid-row">
        <Text style={[styles.guidLabel, { color: colors.text }]}>{pmT('Project GUID')}</Text>
        <Text selectable numberOfLines={1} style={[styles.guidValue, { color: colors.text }]} testID="pm-project-guid">{projectGUID}</Text>
        <Pressable
          testID="pm-project-guid-copy"
          accessibilityRole="button"
          accessibilityLabel={pmT('Copy project GUID')}
          onPress={copyGuid}
          style={[styles.guidCopy, { borderColor: primaryColor }]}
        >
          <Text style={{ color: primaryColor, fontWeight: '700', fontSize: 12 }}>{copied ? pmT('Copied') : pmT('Copy')}</Text>
        </Pressable>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{pmT('Import / Export')}</Text>

      {/* ---- top tabs ---- */}
      <ScrollableTabBar style={[styles.tabs, { borderColor: colors.border }]}>
        {PM_EXCHANGE_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              testID={`pm-project-exchange-tab-${t.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              // react-native-web 0.21 ignores accessibilityState -> aria-* too
              aria-selected={active}
              onPress={() => setTab(t.key)}
              style={[styles.tab, { borderBottomColor: active ? colors.primary : 'transparent' }]}
            >
              <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '500' }}>{pmT(t.title)}</Text>
            </Pressable>
          );
        })}
      </ScrollableTabBar>

      <View style={styles.panel} testID={`pm-project-exchange-panel-${tab}`}>
        {tab === 'TabImport' ? (
          <ReceiveDraggableFilesComponent
            testID="pm-project-import-drop"
            folderName={name}
            compact
            pickable
            pickLabel={pmT('Choose file…')}
            pickButtonWidth={PM_EXPORT_BUTTON_WIDTH}
            accept=".json,.zip,application/json,application/zip"
            pickMimeTypes={['application/json', 'text/plain', 'application/zip', 'application/x-zip-compressed']}
            allowedMimeTypes={['application/json', 'text/plain', /json/, 'application/zip', 'application/x-zip-compressed', /zip/]}
            title={pmT('Drop a project_data_….json or a project_package_….zip here')}
            subtitle={pmT('Replaces the tasks of "{{name}}" (asks first)', { name })}
            disabled={busy}
            style={styles.dropZone}
            onFilesDropped={async (files) => {
              const plan = await importProject(projectGUID, files);
              if (plan) onImported?.(plan.projectRowJSON);
            }}
          />
        ) : null}
        {tab === 'TabImport' && !!onImportBim ? (
          <View style={{ alignItems: 'center', marginTop: 8 }}>
            <PMDialogButton testID="pm-project-import-bim" kind="secondary" icon="view_in_ar" title={pmT('Import BIM (IFC)…')} disabled={busy} width={PM_EXPORT_BUTTON_WIDTH} style={styles.exportButton} onPress={onImportBim} />
          </View>
        ) : null}
        {tab !== 'TabImport' ? (
          <View style={styles.exportPanel} testID="pm-project-export-panel">
            <Text style={[styles.hint, { color: colors.text }]}>
              {pmT('The project with all its stages, tasks, milestones and dependencies (+ your Gantt settings).')}
            </Text>
            <View style={{ height: 8 }} />
            <View testID="pm-project-export-options" style={styles.options}>
              <SwitchApp testID="pm-project-export-opt-lines" label={pmT('Task lines (Time, Material, Expense)')} value={options.taskLines} disabled={busy} onValueChange={(v: boolean) => setOptions((o) => ({ ...o, taskLines: v }))} />
              {bimBased && (
                <SwitchApp testID="pm-project-export-opt-bim" label={pmT('BIM model (3D geometry) - makes a zip package')} value={options.bim} disabled={busy} onValueChange={(v: boolean) => setOptions((o) => ({ ...o, bim: v }))} />
              )}
              {withBim && (
                <SwitchApp testID="pm-project-export-opt-bim-props" label={pmT('BIM properties (large)')} value={options.bimProperties} disabled={busy} onValueChange={(v: boolean) => setOptions((o) => ({ ...o, bimProperties: v }))} />
              )}
            </View>
            <View style={{ height: 8 }} />
            <View testID="pm-project-export-button-group" style={styles.exportButtonGroup}>
              {!!onExportPdf && (
                <PMDialogButton
                  testID="pm-project-export-pdf"
                  kind="secondary"
                  color={primaryColor}
                  icon="picture_as_pdf"
                  title={pmT('Export to PDF')}
                  disabled={busy || !onDashboard}
                  width={PM_EXPORT_BUTTON_WIDTH}
                  style={styles.exportButton}
                  onPress={() => onExportPdf(projectGUID)}
                />
              )}
              <PMDialogButton
                testID="pm-project-export"
                kind="secondary"
                icon="data_object"
                title={withBim ? pmT('Export package (zip)') : pmT('Export to JSON')}
                disabled={busy}
                width={PM_EXPORT_BUTTON_WIDTH}
                style={styles.exportButton}
                onPress={() => exportProject(projectGUID, { taskLines: options.taskLines, bim: withBim, bimProperties: withBim && options.bimProperties })}
              />
              <PMDialogButton
                testID="pm-project-export-msproject"
                kind="secondary"
                icon="account_tree"
                title={pmT('Export to MS Project')}
                disabled={busy || !onDashboard}
                width={PM_EXPORT_BUTTON_WIDTH}
                style={styles.exportButton}
                onPress={() => setMsProjectOpen(true)}
              />
              {!!onSaveAsTemplate && (
                <PMDialogButton
                  testID="pm-settings-save-as-template"
                  kind="secondary"
                  icon="bookmark_add"
                  title={pmT('Save as template')}
                  width={PM_EXPORT_BUTTON_WIDTH}
                  style={styles.exportButton}
                  onPress={onSaveAsTemplate}
                />
              )}
            </View>
            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2} testID="pm-project-export-file-name">
              {fileName}
            </Text>
            {!onDashboard && (
              <Text style={[styles.fileName, { color: colors.text }]} testID="pm-project-export-dashboard-hint">
                {pmT('PDF and MS Project export the project that is open on the dashboard.')}
              </Text>
            )}
          </View>
        ) : null}
      </View>
      <PMExportToMSProject visible={msProjectOpen} projectGUID={projectGUID} onClose={() => setMsProjectOpen(false)} />
      {status.kind !== 'idle' && (
        <Text
          testID="pm-project-exchange-status"
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: status.kind === 'error' ? colors.error : colors.text }]}
        >
          {status.text}
        </Text>
      )}
    </View>
  );
}

export type PMExchangeTab = 'TabImport' | 'TabExport';
export const PM_EXCHANGE_TABS: { key: PMExchangeTab; title: string }[] = [
  { key: 'TabImport', title: 'Import' },
  { key: 'TabExport', title: 'Export' },
];

const styles = StyleSheet.create({
  // fills the rest of the (fixed height) Project settings window; the Import drop zone takes all of it
  box: { flexGrow: 1, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 10 },
  title: { fontWeight: '700', fontSize: 14, marginBottom: 6 },
  guidRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  guidLabel: { fontSize: 12, opacity: 0.7 },
  guidValue: { flex: 1, fontSize: 12, fontFamily: 'monospace' },
  guidCopy: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2 },
  panel: { flexGrow: 1, minHeight: 110, justifyContent: 'center' },
  dropZone: { flexGrow: 1, marginVertical: 0 },
  // Export tab: button, description and file name centered
  exportPanel: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  // the export buttons: one column, equal size (PM_EXPORT_BUTTON_WIDTH), 2 pixels gap between them
  exportButtonGroup: { alignItems: 'center', gap: 2 },
  exportButton: { marginLeft: 0, marginTop: 0, marginBottom: 0, marginVertical: 0, alignSelf: 'center' },
  hint: { fontSize: 12, opacity: 0.75, textAlign: 'center' },
  options: { alignSelf: 'stretch', gap: 2, paddingHorizontal: 8 },
  fileName: { fontSize: 11, opacity: 0.6, marginTop: 8, textAlign: 'center' },
  status: { marginTop: 6, fontSize: 12, textAlign: 'center' },
});
