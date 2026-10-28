/** @jest-environment jsdom */
// Project settings -> "Resources" (TabResources): the part "Resources" and the section "Resource optimization" (PMResourceLevelingSettingsTab). documentation/RESOURCE_LEVELING_WBS.html 7.1, 9.
import * as fs from 'fs';
import * as path from 'path';
import { cleanupUI, press, q, renderUI, textOf, toggleSwitch } from '../ui/pmUiTestKit';
import PMResourceLevelingSettingsTab from '../../../kit8/pm/resourceleveling/PMResourceLevelingSettingsTab';
import { defaultProjectSettingsOf, newProjectPatchFrom } from '../../../kit8/catalog/organization/defaultProjectSettings';

afterEach(cleanupUI);
const checked = (id: string) => (q(id)!.querySelector('input') as HTMLInputElement).checked;
const readSrc = (rel: string) => fs.readFileSync(path.join(__dirname, '../../..', rel), 'utf8');

describe('the tab', () => {
  it('shows the defaults for a project that never saved: master off, Manual, Leveling, day by day, hour', () => {
    renderUI(<PMResourceLevelingSettingsTab values={{}} onChange={jest.fn()} />);
    expect(q('pm-project-tab-resources-content')).not.toBeNull();
    expect(checked('pm-resource-leveling-enabled')).toBe(false);
    expect(checked('pm-resource-leveling-posted-movement')).toBe(true);
    expect(q('pm-resource-leveling-grain-hour')!.getAttribute('aria-checked')).toBe('true');
    expect(q('pm-resource-leveling-grain-week')!.getAttribute('aria-checked')).toBe('false');
    expect(q('pm-resource-leveling-model-dayByDayModel')!.getAttribute('aria-checked')).toBe('true');
  });

  it('the master saves only its own key; the planning model and the grain are editable while the master is off', () => {
    const onChange = jest.fn();
    renderUI(<PMResourceLevelingSettingsTab values={{}} onChange={onChange} />);
    toggleSwitch('pm-resource-leveling-enabled');
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingFunctionalityEnabled: true });
    press('pm-resource-leveling-grain-week');
    expect(onChange).toHaveBeenLastCalledWith({ resourceGrainUnit: 'week' });
  });

  it('the hour by hour model cannot be chosen yet (phase 2) and says so', () => {
    const onChange = jest.fn();
    renderUI(<PMResourceLevelingSettingsTab values={{}} onChange={onChange} />);
    press('pm-resource-leveling-model-hourByHourModel');
    expect(onChange).not.toHaveBeenCalled();
    expect(q('pm-project-tab-resources-content')!.textContent).toContain('Phase 2');
  });

  it('with the master on: the mode, the method and the posted tasks action write their own keys', () => {
    const onChange = jest.fn();
    renderUI(<PMResourceLevelingSettingsTab values={{ resourceLevelingFunctionalityEnabled: true }} onChange={onChange} />);
    press('pm-resource-leveling-mode-automatic');
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingMode: 'automatic' });
    press('pm-resource-leveling-method-smoothing');
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingWithinSlackOnly: true }); // Smoothing = "Level only within available slack"
    press('pm-resource-leveling-method-leveling');
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingWithinSlackOnly: false });
    press('pm-resource-leveling-posted-action-moveAndPostAgain');
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingPostedTasksAction: 'moveAndPostAgain' });
    press('pm-resource-leveling-order-priorityStandard');
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingOrder: 'priorityStandard' });
    toggleSwitch('pm-resource-leveling-fast');
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingFunctionalityFastModeEnabled: true });
    toggleSwitch('pm-resource-leveling-posted-movement');
    expect(onChange).toHaveBeenLastCalledWith({ resourceLevelingPostedTasksMovementEnabled: false });
  });

  it('shows the stored values', () => {
    renderUI(<PMResourceLevelingSettingsTab values={{ resourceLevelingFunctionalityEnabled: true, resourceLevelingFunctionalityFastModeEnabled: true, resourceLevelingKeepHistory: false }} onChange={jest.fn()} />);
    expect(checked('pm-resource-leveling-enabled')).toBe(true);
    expect(checked('pm-resource-leveling-fast')).toBe(true);
    expect(checked('pm-resource-leveling-history')).toBe(false);
    expect(textOf('pm-project-tab-resources-content')).toContain('Resource optimization');
  });
});

describe('the organization defaults carry the keys', () => {
  it('defaultProjectSettingsOf lists them with their defaults; a new project starts from the stored ones', () => {
    const all = defaultProjectSettingsOf(null);
    expect(all.resourceLevelingFunctionalityEnabled).toBe(false);
    expect(all.resourceLevelingPostedTasksMovementEnabled).toBe(true);
    expect(all.resourceLevelingPostedTasksAction).toBe('ask');
    expect(all.resourceGrainUnit).toBe('hour');
    expect(all.resourceOptimizationMode).toBe('dayByDayModel');
    expect(newProjectPatchFrom({ resourceLevelingFunctionalityEnabled: true, resourceLevelingMode: 'automatic' } as any)).toMatchObject({ resourceLevelingFunctionalityEnabled: true, resourceLevelingMode: 'automatic' });
  });
});

describe('the tab is wired where the other tabs are (source check)', () => {
  it('Organization edit: the tab Resources after ROI', () => {
    const org = readSrc('kit8/catalog/organization/OrganizationProjectSettings.tsx');
    expect(org.indexOf("{ id: 'resources', label: 'Resources' }")).toBeGreaterThan(org.indexOf("{ id: 'roi', label: 'ROI' }"));
    expect(org).toContain("{tab === 'resources' && <PMResourceLevelingSettingsTab values={v} onChange={patch} />}");
  });
  it('Project settings window: TabResources after TabROI; read for a project, written on save, defaulted for a new one', () => {
    const w = readSrc('kit8/pm/view/project/recent/PMRecentProjectsToolbar.tsx');
    expect(w.indexOf("{ id: 'TabResources' as const")).toBeGreaterThan(w.indexOf("{ id: 'TabROI' as const"));
    expect(w).toContain('...resourceLevelingValuesOf(null)');
    expect(w).toContain('...resourceLevelingValuesOf(project.rowJSON)');
    expect(w).toContain('resourceLevelingValuesOf(draft)');
    expect(w).toContain("<PMResourceLevelingSettingsTab values={draft || {}}");
  });
});
