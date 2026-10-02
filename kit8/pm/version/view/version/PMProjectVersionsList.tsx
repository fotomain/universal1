// PMProjectVersionsList - the "Versions" view (right pane of PMGanttSurface when
// uxuiSettings.ganttVsNetworkView = 'showVersionsView'; the Skia task tree stays on the left).
//
//   toolbar   N versions · M checked · [Clear] ........ [Gantt | Kanban | Network | Versions] [Save version]
//   cards     ProjectVersionCard per version (newest first): check box = compare on the Gantt chart,
//             Restore from version, rename, delete
//
// Checked versions are drawn on the Gantt chart together with the live project (press "Gantt"):
// thin bars under the task bars, one color per version (PMGanttVersionBars + PMGanttVersionsLegend).

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../../view/theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { PMDialogButton, PMTipIcon } from '../../../inner/buttons';
import { PMToolbar, PMToolbarDivider, PMToolbarSpacer } from '../../../inner/toolbars/PMToolbarPrimitives';
import GanttToNetworkViewToggleButtons from '../../../view/gantt/toolbars/GanttToNetworkViewToggleButtons';
import ActivityIndicatorCircleApp from '../../../../components/activityindicator/ActivityIndicatorCircleApp';
import { PM_VERSION_MAX_CHECKED } from '../../model/versionTypes';
import { usePMVersionStore } from '../../store/store_version';
import { useVersionCommands } from '../../crud/version/useVersionCommands';
import ProjectVersionCard from './ProjectVersionCard';

export interface PMProjectVersionsListProps {
  ownerGUID: string;
  projectGUID: string;
  width: number;
  height: number;
  palette: PMPalette;
  crud: PMCrud;
}

export default function PMProjectVersionsList({ ownerGUID, projectGUID, width, height, palette, crud }: PMProjectVersionsListProps) {
  const commands = useVersionCommands(ownerGUID, projectGUID);
  const loaded = usePMVersionStore((s) => s.projectGUID === projectGUID);
  const versions = usePMVersionStore((s) => s.versions);
  const checked = usePMVersionStore((s) => s.checkedGUIDs);
  const overlays = usePMVersionStore((s) => s.overlays);
  const missing = usePMVersionStore((s) => s.tablesMissing);
  const busy = usePMVersionStore((s) => s.busy);
  const projectName = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON?.name);
  const colorOf = (guid: string) => overlays.find((o) => o.versionGUID === guid)?.color;

  return (
    <View style={{ width, height, backgroundColor: palette.background }} testID="pm-versions-list">
      <PMToolbar background={palette.surface} border={palette.border}>
        <PMTipIcon tip="Project versions" testID="pm-versions-icon" name="layers" size={18} color={palette.primary} style={{ marginHorizontal: 4 }} />
        <Text style={[styles.count, { color: palette.text }]} testID="pm-versions-count" numberOfLines={1}>
          {versions.length} {versions.length === 1 ? 'version' : 'versions'}
          {checked.length ? ` · ${checked.length} checked` : ''}
        </Text>
        {checked.length > 0 && <PMIconButton testID="pm-versions-clear-checked" icon="deselect" label="Clear" title="Uncheck all versions (nothing is compared)" color={palette.text} onPress={commands.clearChecked} />}
        <PMToolbarSpacer />
        <GanttToNetworkViewToggleButtons palette={palette} onChange={crud.setGanttVsNetworkView} />
        <PMToolbarDivider color={palette.border} />
        <PMIconButton
          testID="pm-versions-save"
          icon="bookmark_add"
          label="Save version"
          title="Save project version (the whole plan: tasks, dependencies, Kanban)"
          color={palette.text}
          disabled={busy || missing}
          onPress={commands.openSaveVersion}
        />
      </PMToolbar>

      {missing ? (
        <View style={styles.center}>
          <PMTipIcon tip="SQL upgrade needed" testID="pm-versions-missing-icon" name="database" size={34} color={palette.primary} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Versions are not installed yet</Text>
          <Text style={[styles.emptyText, { color: palette.textMuted }]} testID="pm-versions-missing">
            Run kit8/sql/init/done/create_tables.sql in the Supabase SQL editor (it adds the version_ tables; nothing is deleted).
          </Text>
        </View>
      ) : !loaded ? (
        <View style={styles.center}>
          <ActivityIndicatorCircleApp testID="pm-versions-loading" />
        </View>
      ) : versions.length === 0 ? (
        <View style={styles.center}>
          <PMTipIcon tip="Project versions" testID="pm-versions-empty-icon" name="layers" size={36} color={palette.primary} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No versions yet</Text>
          <Text style={[styles.emptyText, { color: palette.textMuted }]}>
            Save the current plan of {projectName ? `"${projectName}"` : 'the project'} as a version. Later you can restore it or compare it with the project on the Gantt chart.
          </Text>
          <PMDialogButton testID="pm-versions-empty-save" kind="primary" icon="bookmark_add" title="Save the first version" style={{ marginTop: 14, marginLeft: 0 }} onPress={commands.openSaveVersion} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
          <Text style={[styles.hint, { color: palette.textMuted }]} testID="pm-versions-hint">
            Check the versions to compare (at most {PM_VERSION_MAX_CHECKED}), then press Gantt: the project and the checked versions are drawn on one chart, each version in its own color.
          </Text>
          {versions.map((v) => (
            <ProjectVersionCard
              key={v.rowVersionGUID}
              version={v}
              checked={checked.includes(v.rowVersionGUID)}
              color={colorOf(v.rowVersionGUID)}
              palette={palette}
              disabled={busy}
              onToggleChecked={commands.toggleChecked}
              onRestore={commands.restoreVersion}
              onRename={commands.openRenameVersion}
              onDelete={commands.deleteVersion}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: 13, fontWeight: '600', marginHorizontal: 6 },
  body: { padding: 12, paddingBottom: 32 },
  hint: { fontSize: 12.5, marginBottom: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 460 },
});
