// Main view switch (same look as the "Dependency arrows" selector): Gantt | Kanban | Network | Versions | Finances | Plan | Reports
//   ganttVsNetworkView = 'showGanttChart'  -> the Gantt chart (tree + Skia chart)
//   ganttVsNetworkView = 'showKanbanView'  -> tree + PMKanbanDashboard (view/kanban)
//   ganttVsNetworkView = 'showNetworkView' -> PMNetworkView (network diagram / network schedule)
//   ganttVsNetworkView = 'showVersionsView' -> tree + PMProjectVersionsList (kit8/pm/version)
//   ganttVsNetworkView = 'showFinancesView' -> tree + PMProjectFinancesView (the lines of the selected task: view/task/finances)
//   ganttVsNetworkView = 'showPlanView' -> tree + PMTaskLinePlanView (the posted days of the lines of the selected task: view/task/plan)
//   ganttVsNetworkView = 'showReportsView' -> tree + PMProjectReportsView (project summary: view/reports)
// Saved per project in project_table.rowJSON.uxuiSettings.ganttVsNetworkView (crud.setGanttVsNetworkView);
// read-only views pass a local setter instead. The same control sits on the Gantt bar, the Kanban bar
// and the network view's bar (and in the app bar of the Projects screen), so the user can always switch.
// The buttons can be dragged and dropped (onReorder): the order is saved per project AND user
// in uxuiSettings.viewButtonsOrder (crud.setViewButtonsOrder). GANTT_VS_NETWORK_VIEW_OPTIONS = the default order.

import React, { useMemo } from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMGanttVsNetworkView, viewButtonsOrderOf } from '../../../model/types';
import PMSegmentedIconButtons, { PMSegmentOption } from '../../network/PMSegmentedIconButtons';

export const GANTT_VS_NETWORK_VIEW_OPTIONS: PMSegmentOption<PMGanttVsNetworkView>[] = [
  {
    value: 'showGanttChart',
    icon: 'view_timeline',
    label: 'Gantt',
    title: 'Gantt chart',
  },
  {
    value: 'showFinancesView',
    icon: 'edit',
    label: 'Edit',
    title: 'Edit: the time, material, expense and revenue lines of the selected task',
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
    value: 'showPlanView',
    icon: 'event_note',
    label: 'Budgets',
    title: 'Budgets: the posted days of every line of the selected task',
  },
  {
    value: 'showReportsView',
    icon: 'assessment',
    label: 'Reports',
    title: 'Reports: summary of the project (tasks, progress, dates)',
  },
];

export default function GanttToggleButtons({
  palette,
  onChange,
  onReorder,
  compact = false,
}: {
  palette: PMPalette;
  onChange: (view: PMGanttVsNetworkView) => void;
  /** makes the buttons draggable (drag and drop): called with the new order */
  onReorder?: (order: PMGanttVsNetworkView[]) => void;
  /** icons only (phones) */
  compact?: boolean;
}) {
  const view = usePMStore((s) => s.ganttVsNetworkView);
  const order = usePMStore((s) => s.viewButtonsOrder);
  const options = useMemo(() => {
    const byValue = new Map(GANTT_VS_NETWORK_VIEW_OPTIONS.map((o) => [o.value, o]));
    return viewButtonsOrderOf(order).map((v) => {
      const o = byValue.get(v)!;
      return compact ? { ...o, label: undefined } : o;
    });
  }, [order, compact]);
  return (
    <PMSegmentedIconButtons
      testID="pm-gantt-vs-network"
      options={options}
      value={view}
      onChange={onChange}
      onReorder={onReorder}
      color={palette.text}
      activeColor={palette.primary}
      border={palette.border}
    />
  );
}
