// PMVersionWindows - mount ONCE per screen (PMProjectDashboard):
//   * keeps the version store of the selected project filled (useReadProjectVersionsQuery)
//   * PMVersionTitleModalWindow         "Save project version" / "Rename version"
//   * ModalWindowListToSelect           "Restore project from version": pick the version, then approve

import React, { useMemo } from 'react';
import ModalWindowListToSelect, { ModalWindowListItem } from '../../../../components/common/ModalWindowListToSelect';
import { formatVersionDateTime } from '../../model/versionTypes';
import { usePMVersionStore } from '../../store/store_version';
import { useReadProjectVersionsQuery } from '../../crud/version/versionQueries';
import { useVersionCommands } from '../../crud/version/useVersionCommands';
import PMVersionTitleModalWindow from './PMVersionTitleModalWindow';
import { pmT } from '../../../i18n/pmT';

export default function PMVersionWindows({ ownerGUID, projectGUID }: { ownerGUID: string; projectGUID: string | null }) {
  useReadProjectVersionsQuery(ownerGUID ? projectGUID : null);
  const commands = useVersionCommands(ownerGUID, projectGUID);
  const versions = usePMVersionStore((s) => s.versions);
  const pickerOpen = usePMVersionStore((s) => s.restorePickerOpen);

  const items = useMemo<ModalWindowListItem[]>(
    () =>
      versions.map((v) => ({
        id: v.rowVersionGUID,
        title: v.rowJSON.versionTitle,
        subtitle: `Version ${v.rowJSON.versionNumber ?? v.orderInList} · ${formatVersionDateTime(v.rowJSON.versionCreatedAt)}${
          v.rowJSON.versionTaskCount != null ? ` · ${v.rowJSON.versionTaskCount} rows` : ''
        }`,
        icon: 'history',
      })),
    [versions]
  );

  return (
    <>
      <PMVersionTitleModalWindow commands={commands} />
      <ModalWindowListToSelect
        testID="pm-version-picker"
        visible={pickerOpen}
        title={pmT('Restore project from version')}
        message={pmT('Select the version. The current plan is saved as a new version before it is replaced.')}
        items={items}
        emptyText={pmT('No versions saved yet')}
        searchPlaceholder="Search a version…"
        onClose={commands.closeRestorePicker}
        onSelect={(id) => {
          commands.closeRestorePicker();
          commands.restoreVersion(id);
        }}
      />
    </>
  );
}
