// Gantt bar control (same look as the "Dependency arrows" selector): two buttons that switch
// the project view
//   ganttVsNetworkView = 'showGanttChart'  -> the Gantt chart (tree + Skia chart)
//   ganttVsNetworkView = 'showNetworkView' -> PMNetworkView (network diagram / network schedule)
// Saved per project in project_table.rowJSON.uxuiSettings.ganttVsNetworkView (crud.setGanttVsNetworkView);
// read-only views pass a local setter instead. The same control sits on the network view's bar,
// so the user can always switch back.

import React from 'react';
import { usePMStore } from '../../store';
import { PMPalette } from '../../theme';
import { PMGanttVsNetworkView } from '../../types';
import PMSegmentedIconButtons, { PMSegmentOption } from '../../network/PMSegmentedIconButtons';

export const GANTT_VS_NETWORK_VIEW_OPTIONS: PMSegmentOption<PMGanttVsNetworkView>[] = [
  {
    value: 'showGanttChart',
    icon: 'view_timeline',
    label: 'Gantt',
    title: 'Gantt chart',
  },
  {
    value: 'showNetworkView',
    icon: 'account_tree',
    label: 'Network',
    title: 'Network view: network diagram / network schedule',
  },
];

export default function GanttToNetworkViewToggleButtons({ palette, onChange }: { palette: PMPalette; onChange: (view: PMGanttVsNetworkView) => void }) {
  const view = usePMStore((s) => s.ganttVsNetworkView);
  return (
    <PMSegmentedIconButtons
      testID="pm-gantt-vs-network"
      options={GANTT_VS_NETWORK_VIEW_OPTIONS}
      value={view}
      onChange={onChange}
      color={palette.text}
      activeColor={palette.primary}
      border={palette.border}
    />
  );
}
