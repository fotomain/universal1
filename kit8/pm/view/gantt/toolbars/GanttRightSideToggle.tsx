// GanttRightSideToggle - the right side toggle of the Reports bar (right after the word "Reports"): Costs | Revenues | Monitor01 | Network.
//   Costs, Revenues, Monitor01 (kit8/pm/reports/monitor01) = pages of the Reports view (ganttVsNetworkView = 'showReportsView', store.reportsSection)
//   Network         = the network view (ganttVsNetworkView = 'showNetworkView'); this is the ONLY place that has a Network button
// Shown on the Reports bar and on the bar of the network view (where Network is the active one).
// view/reports/PMReportsSectionButtons.tsx re-exports it under its old name.
import React from 'react';
import { usePMStore } from '../../../store/store_pm';
import { PMPalette } from '../../theme';
import { PMGanttVsNetworkView, PMReportsSection } from '../../../model/types';
import PMSegmentedIconButtons, { PMSegmentOption } from '../../network/PMSegmentedIconButtons';

export const REPORTS_SECTION_OPTIONS: PMSegmentOption<PMReportsSection>[] = [
  { value: 'costs', icon: 'trending_down', label: 'Costs', title: 'Costs: the Time, Material and Expense lines of the whole project' },
  { value: 'revenues', icon: 'trending_up', label: 'Revenues', title: 'Revenues: the Revenue lines of the whole project' },
  { value: 'monitor01', icon: 'monitoring', label: 'Monitor01', title: 'Monitor01: planned, contracted, delivered and used quantities per resource role, month and task - live' },
  { value: 'network', icon: 'account_tree', label: 'Network', title: 'Network view: network diagram / network schedule' },
];

export default function GanttRightSideToggle({
  palette,
  setView,
  compact = false,
}: {
  palette: PMPalette;
  /** switches the main view (saved per project; a read-only view passes a local setter) */
  setView: (view: PMGanttVsNetworkView) => void;
  compact?: boolean;
}) {
  const view = usePMStore((s) => s.ganttVsNetworkView);
  const page = usePMStore((s) => s.reportsSection);
  const setPage = usePMStore((s) => s.setReportsSection);
  const value: PMReportsSection = view === 'showNetworkView' ? 'network' : page;
  const options = compact ? REPORTS_SECTION_OPTIONS.map((o) => ({ ...o, label: undefined })) : REPORTS_SECTION_OPTIONS;
  return (
    <PMSegmentedIconButtons
      testID="pm-reports-sections"
      options={options}
      value={value}
      onChange={(section) => {
        if (section === 'network') return setView('showNetworkView');
        setPage(section);
        setView('showReportsView');
      }}
      color={palette.text}
      activeColor={palette.primary}
      border={palette.border}
    />
  );
}
