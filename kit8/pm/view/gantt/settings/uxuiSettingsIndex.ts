// Tabs + searchable index of PMGanttUXUISettinsModalWindow ("Gantt settings").
// Every option of the window is listed once: its tab, its label and extra search words.
// Pure (no React) - unit-tested in __tests__/pm/view/gantt/settings/uxuiSettingsIndex.test.ts.

export type PMUxUiTab = 'TabTask' | 'TabTree' | 'TabGantt' | 'TabProject';

export const PM_UXUI_TABS: { key: PMUxUiTab; title: string; icon: string }[] = [
  { key: 'TabTask', title: 'Task', icon: 'task_alt' },
  { key: 'TabTree', title: 'Tree', icon: 'account_tree' },
  { key: 'TabGantt', title: 'Gantt', icon: 'view_timeline' },
  { key: 'TabProject', title: 'Project', icon: 'folder' },
];

export const uxuiTabTitle = (tab: PMUxUiTab): string => PM_UXUI_TABS.find((t) => t.key === tab)?.title ?? tab;

export type PMUxUiOptionId =
  | 'taskProgress'
  | 'taskProgressLine'
  | 'treeCommands'
  | 'treeNumbers'
  | 'treeColumns'
  | 'criticalPath'
  | 'arrows'
  | 'ganttCommands'
  | 'projectProgressLine';

export interface PMUxUiOption {
  id: PMUxUiOptionId;
  tab: PMUxUiTab;
  label: string;
  /** extra words the search matches (setting keys, synonyms) */
  keywords: string;
}

/** In tab order, then in the order the options appear inside the tab. */
export const PM_UXUI_OPTIONS: PMUxUiOption[] = [
  { id: 'taskProgress', tab: 'TabTask', label: 'Show task progress on the Gantt (lines + %)', keywords: 'showTaskProgressOnGantt percent percentage' },
  { id: 'taskProgressLine', tab: 'TabTask', label: 'Task progress line: position on the task bar, color', keywords: 'taskProgressLinePosition taskProgressLineColor top bottom middle colour' },
  { id: 'treeCommands', tab: 'TabTree', label: 'Task tree: row commands (hover panel / right-click menu)', keywords: 'projectTreeContextCommandsMode context menu long-press buttons' },
  { id: 'treeNumbers', tab: 'TabTree', label: 'Show hierarchy numbers ("#" column) in the task tree', keywords: 'showTreeHierarchyNumbers wbs outline number' },
  { id: 'treeColumns', tab: 'TabTree', label: 'Task tree columns: default order, default widths', keywords: 'treeColumnsOrder treeColumnsWidths reset resize width custom column' },
  { id: 'criticalPath', tab: 'TabGantt', label: 'Show the critical path', keywords: 'showCriticalPath cpm float' },
  { id: 'arrows', tab: 'TabGantt', label: 'Dependency arrows: smooth / square', keywords: 'ganttArrowsForm links lines shape' },
  { id: 'ganttCommands', tab: 'TabGantt', label: 'Gantt chart: bar commands (hover panel / right-click menu)', keywords: 'projectGanttChartContextCommandsMode context menu long-press buttons' },
  { id: 'projectProgressLine', tab: 'TabProject', label: 'Project progress line: position in the time scale, color', keywords: 'projectProgressLinePosition projectProgressLineColor top bottom middle colour' },
];

export const uxuiOptionsOfTab = (tab: PMUxUiTab): PMUxUiOption[] => PM_UXUI_OPTIONS.filter((o) => o.tab === tab);

/** Case-insensitive substring search over label, keywords and tab title. Empty query = no results. */
export function searchUxuiOptions(query: string): PMUxUiOption[] {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return PM_UXUI_OPTIONS.filter((o) => `${o.label} ${o.keywords} ${uxuiTabTitle(o.tab)}`.toLowerCase().includes(q));
}
