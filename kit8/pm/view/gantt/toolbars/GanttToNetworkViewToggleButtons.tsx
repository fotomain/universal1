// Main view switch (same look as the "Dependency arrows" selector): Gantt | Kanban | Network
//   ganttVsNetworkView = 'showGanttChart'  -> the Gantt chart (tree + Skia chart)
//   ganttVsNetworkView = 'showKanbanView'  -> tree + PMKanbanDashboard (view/kanban)
//   ganttVsNetworkView = 'showNetworkView' -> PMNetworkView (network diagram / network schedule)
// Saved per project in project_table.rowJSON.uxuiSettings.ganttVsNetworkView (crud.setGanttVsNetworkView);
// read-only views pass a local setter instead. The same control sits on the Gantt bar, the Kanban bar
// and the network view's bar, so the user can always switch.

import React from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMGanttVsNetworkView } from '../../../model/types';
import PMSegmentedIconButtons, { PMSegmentOption } from '../../network/PMSegmentedIconButtons';

export const GANTT_VS_NETWORK_VIEW_OPTIONS: PMSegmentOption<PMGanttVsNetworkView>[] = [
  {
    value: 'showGanttChart',
    icon: 'view_timeline',
    label: 'Gantt',
    title: 'Gantt chart',
  },
  {
    value: 'showKanbanView',
    icon: 'view_kanban',
    label: 'Kanban',
    title: 'Kanban board: task stages (drag tasks from the tree onto a column)',
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
