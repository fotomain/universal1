// PMGanttToolbar - the Gantt bar (toolbar above the chart canvas):
//   Undo | Zoom out · Zoom in · Fit to screen | Today | Day · Week · Month · Year · arrow shape
//   ..................................  % · ⇅ | Gantt · Kanban · Network · Versions | ⚙ · Critical path
// In tap-to-link mode it shows PMGanttLinkModeHint instead.

import React from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMScaleUnit } from '../ganttGeometry';
import { PMPalette } from '../../theme';
import { PMCrud } from '../../../crud/usePMCrud';
import { PMToolbar, PMToolbarDivider, PMToolbarSpacer } from '../../../inner/toolbars/PMToolbarPrimitives';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import DependencyArrowLineFormSelector from '../../task/dependency/DependencyArrowLineFormSelector';
import PMGanttUndoButton from '../buttons/PMGanttUndoButton';
import PMGanttZoomButtons from '../buttons/PMGanttZoomButtons';
import PMGanttScaleButtons from '../buttons/PMGanttScaleButtons';
import PMGanttViewToggles from '../buttons/PMGanttViewToggles';
import PMGanttLinkModeHint from './PMGanttLinkModeHint';
import GanttToNetworkViewToggleButtons from './GanttToNetworkViewToggleButtons';
import PMGanttPeriodButton from '../buttons/PMGanttPeriodButton';
import { pmT } from '../../../i18n/pmT';

export interface PMGanttToolbarActions {
  zoomBy: (factor: number) => void;
  setZoom: (dayWidth: number) => void;
  fit: () => void;
  goToday: () => void;
}

export default function PMGanttToolbar({
  crud,
  palette,
  activeUnit,
  actions,
}: {
  crud: PMCrud;
  palette: PMPalette;
  activeUnit: PMScaleUnit;
  actions: PMGanttToolbarActions;
}) {
  const linkSourceName = usePMStore((s) => (s.linkSourceGUID ? s.tasksById[s.linkSourceGUID]?.rowJSON.name ?? '' : null));
  return (
    <PMToolbar background={palette.surface} border={palette.border}>
      {linkSourceName !== null ? (
        <PMGanttLinkModeHint sourceName={linkSourceName} palette={palette} onCancel={crud.cancelLink} />
      ) : (
        <>
          <PMGanttUndoButton crud={crud} palette={palette} />
          <PMToolbarDivider color={palette.border} />
          <PMGanttZoomButtons palette={palette} onZoomOut={() => actions.zoomBy(1 / 1.5)} onZoomIn={() => actions.zoomBy(1.5)} onFit={actions.fit} />
          <PMToolbarDivider color={palette.border} />
          <PMGanttPeriodButton palette={palette} />
          <PMIconButton testID="pm-gantt-today" icon="today" label={pmT('Today')} color={palette.text} onPress={actions.goToday} />
          <PMToolbarDivider color={palette.border} />
          <PMGanttScaleButtons palette={palette} activeUnit={activeUnit} onZoom={actions.setZoom} />
          <PMToolbarDivider color={palette.border} />
          <DependencyArrowLineFormSelector color={palette.text} activeColor={palette.primary} border={palette.border} onChange={crud.setGanttArrowsForm} />
          <PMToolbarSpacer />
          <PMGanttViewToggles
            crud={crud}
            palette={palette}
            viewSwitch={<GanttToNetworkViewToggleButtons palette={palette} onChange={crud.setGanttVsNetworkView} />}
          />
        </>
      )}
    </PMToolbar>
  );
}
