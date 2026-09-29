// Gantt settings window: tabs + searchable option index (kit8/pm/view/gantt/settings/uxuiSettingsIndex.ts).
import { PM_UXUI_OPTIONS, PM_UXUI_TABS, searchUxuiOptions, uxuiOptionsOfTab, uxuiTabTitle } from '../../../../../kit8/pm/view/gantt/settings/uxuiSettingsIndex';

describe('uxuiSettingsIndex', () => {
  it('four tabs in order; every tab has options; ids unique', () => {
    expect(PM_UXUI_TABS.map((t) => t.key)).toEqual(['TabTask', 'TabTree', 'TabGantt', 'TabProject']);
    for (const t of PM_UXUI_TABS) expect(uxuiOptionsOfTab(t.key).length).toBeGreaterThan(0);
    expect(new Set(PM_UXUI_OPTIONS.map((o) => o.id)).size).toBe(PM_UXUI_OPTIONS.length);
    expect(uxuiTabTitle('TabGantt')).toBe('Gantt');
  });

  it('search: trimmed, case-insensitive substring of label, keywords or tab title', () => {
    expect(searchUxuiOptions('')).toEqual([]);
    expect(searchUxuiOptions('   ')).toEqual([]);
    expect(searchUxuiOptions('ARROW').map((o) => o.id)).toEqual(['arrows']);
    expect(searchUxuiOptions(' hierarchy ').map((o) => o.id)).toEqual(['treeNumbers']);
    expect(searchUxuiOptions('showCriticalPath').map((o) => o.id)).toEqual(['criticalPath']); // setting key
    expect(searchUxuiOptions('right-click').map((o) => o.id)).toEqual(['treeCommands', 'ganttCommands']);
    expect(searchUxuiOptions('project').map((o) => o.id)).toContain('projectProgressLine'); // tab title / label
    expect(searchUxuiOptions('zzz')).toEqual([]);
  });
});
