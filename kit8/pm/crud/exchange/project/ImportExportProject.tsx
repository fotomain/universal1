// ImportExportProject - "Import / Export" section of the Project settings window
// (view/project/recent/PMRecentProjectsToolbar; opened also by the ⇅ button after "Show task progress").
// Top tabs: TabImport (default) · TabExport
//   TabImport: drop the file on the zone (or "Choose file…") - asks before deleting the current data
//   TabExport: three buttons of equal size (outlined):
//                Export to JSON        project_data_<rowGUID>.json with the project and ALL its tasks - downloaded at once
//                Export to PDF         the dashboard (task tree + Gantt chart) with the project name and dates; the
//                                      settings window closes first (onExportPdf) so that it is not in the picture
//                Export to MS Project  opens PMExportToMSProject (Microsoft Project XML)
//              PDF / MS Project export what the dashboard shows: enabled for the project that is open there.
// Logic: useProjectExchange.ts · export/ · import/ · projectExchangeFormat.ts

import React, { useState } from 'react';
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
import { useProjectExchange } from './useProjectExchange';

export default function ImportExportProject({
  ownerGUID,
  projectGUID,
  colors,
  onImported,
  onExportPdf,
  onSaveAsTemplate,
}: {
  ownerGUID: string;
  projectGUID: string;
  colors: { text: string; primary: string; error: string; border: string };
  /** after a successful import: the project's new rowJSON (the settings window refreshes its fields) */
  onImported?: (projectRowJSON: PMRowJSON) => void;
  /** "Export to PDF" pressed: the host closes its window and exports the dashboard (no button without it) */
  onExportPdf?: (projectGUID: string) => void;
  /** "Save as template" pressed */
  onSaveAsTemplate?: () => void;
}) {
  const { exportProject, importProject, status, busy } = useProjectExchange(ownerGUID);
  const name = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON.name ?? '');
  const fileName = projectDataFileName(projectGUID);
  const [tab, setTab] = useState<PMExchangeTab>('TabImport');
  // PDF / MS Project export the project that is open on the dashboard
  const paperTheme = useTheme();
  const primaryColor = paperTheme.colors?.primary || colors.primary;
  const onDashboard = usePMStore((s) => s.loadedProjectGUID === projectGUID);
  const [msProjectOpen, setMsProjectOpen] = useState(false);

  return (
    <View style={[styles.box, { borderColor: colors.border }]} testID="pm-project-exchange">
      <Text style={[styles.title, { color: colors.text }]}>{pmT('Import / Export')}</Text>

      {/* ---- top tabs ---- */}
      <View style={[styles.tabs, { borderColor: colors.border }]} accessibilityRole="tablist">
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
      </View>

      <View style={styles.panel} testID={`pm-project-exchange-panel-${tab}`}>
        {tab === 'TabImport' ? (
          <ReceiveDraggableFilesComponent
            testID="pm-project-import-drop"
            folderName={name}
            compact
            pickable
            pickLabel={pmT('Choose file…')}
            pickButtonWidth={PM_EXPORT_BUTTON_WIDTH}
            accept=".json,application/json"
            pickMimeTypes={['application/json', 'text/plain']}
            allowedMimeTypes={['application/json', 'text/plain', /json/]}
            title={pmT('Drop a project_data_….json here')}
            subtitle={pmT('Replaces the tasks of "{{name}}" (asks first)', { name })}
            disabled={busy}
            style={styles.dropZone}
            onFilesDropped={async (files) => {
              const plan = await importProject(projectGUID, files);
              if (plan) onImported?.(plan.projectRowJSON);
            }}
          />
        ) : (
          <View style={styles.exportPanel} testID="pm-project-export-panel">
            <Text style={[styles.hint, { color: colors.text }]}>
              {pmT('The project with all its stages, tasks, milestones and dependencies (+ your Gantt settings).')}
            </Text>
            <View style={{ height: 10 }} />
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
                title={pmT('Export to JSON')}
                disabled={busy}
                width={PM_EXPORT_BUTTON_WIDTH}
                style={styles.exportButton}
                onPress={() => exportProject(projectGUID)}
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
        )}
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
  fileName: { fontSize: 11, opacity: 0.6, marginTop: 8, textAlign: 'center' },
  status: { marginTop: 6, fontSize: 12, textAlign: 'center' },
});
