// The Gantt bar buttons of the Extended functions: Calculate (A2), Level (Resource optimization, only with its project switch), Scroll to task and Zoom to selection (E13), Details pane (E10).
// Each exists only while its function is on (kit8/pm/extended); with everything off the bar is the one it always was.
import React from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { PMCrud } from '../../../crud/usePMCrud';
import { extendedOptionsPatch } from '../../../extended/extendedOptions';
import PMGanttCalculateButton from './PMGanttCalculateButton';
import PMResourceLevelingBarButton from '../../../resourceleveling/PMResourceLevelingBarButton';
import { pmT } from '../../../i18n/pmT';

export default function PMGanttExtendedButtons({ crud, palette, scrollToTask, zoomToSelection }: { crud: PMCrud; palette: PMPalette; scrollToTask?: () => void; zoomToSelection?: () => void }) {
  const flags = usePMStore((s) => s.extFlags);
  const opts = usePMStore((s) => s.extOptions);
  const projectJSON = usePMStore((s) => (s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON : undefined));
  const hasSelection = usePMStore((s) => !!(s.selectedGUID && s.schedule[s.selectedGUID]));
  const checked = usePMStore((s) => Object.keys(s.checkedGUIDs).length);
  return (
    <>
      <PMGanttCalculateButton palette={palette} />
      <PMResourceLevelingBarButton palette={palette} />
      {flags.ganttScrollToTaskEnabled && (
        <>
          <PMIconButton testID="pm-gantt-scroll-to-task" icon="my_location" title={pmT('Scroll to the bar of the selected task')} color={palette.text} disabled={!hasSelection} onPress={() => scrollToTask?.()} />
          <PMIconButton testID="pm-gantt-zoom-to-selection" icon="zoom_in_map" title={pmT('Zoom the time scale to the checked tasks (or the selected one)')} color={palette.text} disabled={!hasSelection && checked === 0} onPress={() => zoomToSelection?.()} />
        </>
      )}
      {flags.ganttDetailsPaneEnabled && (
        <PMIconButton
          testID="pm-gantt-details-pane"
          icon="bottom_panel_open"
          title={opts.detailsPane ? pmT('Hide the details pane') : pmT('Show the details pane (the form of the selected task under the chart)')}
          color={palette.text}
          active={opts.detailsPane}
          activeColor={palette.primary}
          onPress={() => crud.saveProjectJSON(extendedOptionsPatch(projectJSON, { detailsPane: !opts.detailsPane }))}
        />
      )}
    </>
  );
}
