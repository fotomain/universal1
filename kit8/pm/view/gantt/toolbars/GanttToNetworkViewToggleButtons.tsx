// Main view switch (same look as the "Dependency arrows" selector): Gantt | Kanban | Network | Versions
//   ganttVsNetworkView = 'showGanttChart'  -> the Gantt chart (tree + Skia chart)
//   ganttVsNetworkView = 'showKanbanView'  -> tree + PMKanbanDashboard (view/kanban)
//   ganttVsNetworkView = 'showNetworkView' -> PMNetworkView (network diagram / network schedule)
//   ganttVsNetworkView = 'showVersionsView' -> tree + PMProjectVersionsList (kit8/pm/version)
//   ganttVsNetworkView = 'showFinancesView' -> tree + PMProjectFinancesView (the lines of the selected task: view/task/finances)
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
  {
    value: 'showVersionsView',
    icon: 'layers',
    label: 'Versions',
    title: 'Project versions: save, restore and check the versions to compare on the Gantt chart',
  },
  {
    value: 'showFinancesView',
    icon: 'payments',
    label: 'Finances',
    title: 'Finances: the time, material, expense and revenue lines of the selected task',
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
