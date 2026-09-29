// Per-project view switches (saved in project_table.rowJSON.uxuiSettings):
// % = showTaskProgressOnGantt · ⚙ = PMGanttUXUISettinsModalWindow · [viewSwitch = Gantt | Network] · Critical path = showCriticalPath.

import React from 'react';
import { PM_WIDE_ACTION_WIDTH } from '../../../model/constants';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { PMToolbarDivider } from '../../../inner/toolbars/PMToolbarPrimitives';

export default function PMGanttViewToggles({
  crud,
  palette,
  viewSwitch,
}: {
  crud: PMCrud;
  palette: PMPalette;
  /** Gantt | Network switch, shown right before the Critical path button */
  viewSwitch?: React.ReactNode;
}) {
  const showTaskProgress = usePMStore((s) => s.showTaskProgressOnGantt);
  const showCritical = usePMStore((s) => s.showCriticalPath);
  return (
    <>
      <PMIconButton
        testID="pm-gantt-task-progress"
        icon="percent"
        title={showTaskProgress ? 'Hide task progress on the bars' : 'Show task progress on the bars (line + %)'}
        active={showTaskProgress}
        activeColor={palette.primary}
        color={palette.text}
        onPress={crud.toggleTaskProgressOnGantt}
      />
      <PMIconButton
        testID="pm-gantt-uxui-settings"
        icon="settings"
        title="Gantt settings (progress lines, colors, arrows, critical path)"
        color={palette.text}
        onPress={() => usePMStore.getState().setUxuiSettingsOpen(true)}
      />
      {viewSwitch && (
        <>
          <PMToolbarDivider color={palette.border} />
          {viewSwitch}
          <PMToolbarDivider color={palette.border} />
        </>
      )}
      <PMIconButton
        testID="pm-gantt-critical"
        icon="route"
        label="Critical path"
        width={PM_WIDE_ACTION_WIDTH}
        active={showCritical}
        activeColor={palette.critical}
        color={palette.text}
        onPress={crud.toggleCriticalPath}
      />
    </>
  );
}
