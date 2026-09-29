// Per-project view switches (saved in project_table.rowJSON.uxuiSettings):
// % = showTaskProgressOnGantt · ⚙ = PMGanttUXUISettinsModalWindow · Critical path = showCriticalPath.

import React from 'react';
import { PM_WIDE_ACTION_WIDTH } from '../../constants';
import { usePMStore } from '../../store';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../usePMCrud';
import { PMIconButton } from '../../buttons/PMIconButton';

export default function PMGanttViewToggles({ crud, palette }: { crud: PMCrud; palette: PMPalette }) {
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
