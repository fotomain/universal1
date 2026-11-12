// Project bar buttons of the project versions (PMRecentProjectsToolbar, before the project settings button):
//   Save project version          -> PMVersionTitleModalWindow (title) -> RPC pm_version_save
//   Restore project from version  -> ModalWindowListToSelect (pick the version) -> approval -> RPC pm_version_restore
// The buttons only open the windows (version store); PMVersionWindows (mounted once per screen) does the work.

import React from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../../view/theme';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { defaultVersionTitle } from '../../model/versionTypes';
import { usePMVersionStore } from '../../store/store_version';
import { projectIsReadonly } from '../../../model/projectReadonly';

export default function PMGanttVersionButtons({ palette, showLabels = false }: { palette: Pick<PMPalette, 'text'>; showLabels?: boolean }) {
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const versionCount = usePMVersionStore((s) => s.versions.length);
  const busy = usePMVersionStore((s) => s.busy);
  const missing = usePMVersionStore((s) => s.tablesMissing);
  // a read-only project (model/projectReadonly.ts, SQL PART 51): no version is saved, renamed or restored - the database refuses it, the buttons say so
  const readonly = usePMStore((s) => projectIsReadonly(projectGUID ? s.projectsById[projectGUID]?.rowJSON : null));
  const openSave = () => {
    if (missing) {
      // the version_ tables are not in the database yet: say what to do instead of a dead button
      usePMStore.getState().setError('Project versions are not installed yet: run kit8/sql/init/done/create_tables.sql in the Supabase SQL editor (it only adds the version_ tables, nothing is deleted), then reload.');
      return;
    }
    const name = projectGUID ? usePMStore.getState().projectsById[projectGUID]?.rowJSON?.name : undefined;
    usePMVersionStore.getState().setTitlePrompt({ mode: 'save', title: defaultVersionTitle(name) });
  };
  return (
    <>
      <PMIconButton
        testID="pm-version-save"
        icon="bookmark_add"
        label={showLabels ? 'Save version' : undefined}
        title={readonly ? 'Save project version - the project is read-only' : missing ? 'Save project version - run kit8/sql/init/done/create_tables.sql first' : 'Save project version (the whole plan: tasks, dependencies, Kanban)'}
        color={palette.text}
        disabled={!projectGUID || busy || readonly}
        onPress={openSave}
      />
      <PMIconButton
        testID="pm-version-restore"
        icon="settings_backup_restore"
        label={showLabels ? 'Restore' : undefined}
        title={readonly ? 'Restore project from version - the project is read-only' : versionCount ? 'Restore project from version' : 'Restore project from version - no versions saved yet'}
        color={palette.text}
        badge={versionCount || undefined}
        disabled={!projectGUID || busy || readonly}
        onPress={() => (missing ? openSave() : usePMVersionStore.getState().setRestorePickerOpen(true))}
      />
    </>
  );
}
