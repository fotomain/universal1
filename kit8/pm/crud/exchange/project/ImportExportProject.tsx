// ImportExportProject - "Import / Export" section of the Project settings window
// (view/project/recent/PMRecentProjectsToolbar; opened also by the ⇅ button after "Show task progress").
// Top tabs: TabImport (default) · TabExport
//   TabImport: drop the file on the zone (or "Choose file…") - asks before deleting the current data
//   TabExport: project_data_<rowGUID>.json with the project and ALL its tasks - downloaded at once
// Logic: useProjectExchange.ts · export/ · import/ · projectExchangeFormat.ts

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ReceiveDraggableFilesComponent } from '../../../../components/common/ReceiveDraggableFilesComponent';
import { PMDialogButton } from '../../../inner/buttons';
import { PMRowJSON } from '../../../model/types';
import { usePMStore } from '../../../store/store_pm';
import { projectDataFileName } from './projectExchangeFormat';
import { useProjectExchange } from './useProjectExchange';

export default function ImportExportProject({
  ownerGUID,
  projectGUID,
  colors,
  onImported,
}: {
  ownerGUID: string;
  projectGUID: string;
  colors: { text: string; primary: string; error: string; border: string };
  /** after a successful import: the project's new rowJSON (the settings window refreshes its fields) */
  onImported?: (projectRowJSON: PMRowJSON) => void;
}) {
  const { exportProject, importProject, status, busy } = useProjectExchange(ownerGUID);
  const name = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON.name ?? '');
  const fileName = projectDataFileName(projectGUID);
  const [tab, setTab] = useState<PMExchangeTab>('TabImport');

  return (
    <View style={[styles.box, { borderColor: colors.border }]} testID="pm-project-exchange">
      <Text style={[styles.title, { color: colors.text }]}>Import / Export</Text>

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
              <Text style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '700' : '500' }}>{t.title}</Text>
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
            pickLabel="Choose file…"
            accept=".json,application/json"
            pickMimeTypes={['application/json', 'text/plain']}
            allowedMimeTypes={['application/json', 'text/plain', /json/]}
            title="Drop a project_data_….json here"
            subtitle={`Replaces the tasks of "${name}" (asks first)`}
            disabled={busy}
            onFilesDropped={async (files) => {
              const plan = await importProject(projectGUID, files);
              if (plan) onImported?.(plan.projectRowJSON);
            }}
          />
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.text }]}>
              The project with all its stages, tasks, milestones and dependencies (+ your Gantt settings).
            </Text>
            <View style={styles.row}>
              <PMDialogButton
                testID="pm-project-export"
                kind="primary"
                icon="download"
                title="Export to file"
                disabled={busy}
                style={{ marginLeft: 0 }}
                onPress={() => exportProject(projectGUID)}
              />
              <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={2}>
                {fileName}
              </Text>
            </View>
          </>
        )}
      </View>
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
  box: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 10 },
  title: { fontWeight: '700', fontSize: 14, marginBottom: 6 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2 },
  panel: { minHeight: 110, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  hint: { fontSize: 12, opacity: 0.75 },
  fileName: { flex: 1, fontSize: 11, opacity: 0.6, marginLeft: 8 },
  status: { marginTop: 6, fontSize: 12 },
});
