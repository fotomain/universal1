// PMResourceLevelingSettingsTab - the tab "Resources" of the Project settings window (TabResources, after ROI) and of Organization edit -> Projects -> Settings.
// Part "Resources" (resourceOptimizationMode, resourceGrainUnit) and the section "Resource optimization" (everything else). documentation/RESOURCE_LEVELING_WBS.html 7.1, 9.
// The values and the rules are in resourceLevelingSettings.ts (pure); this file is only the form. The sub switches are edited only while the master is on.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import SwitchApp from '../../ui/components/common/SwitchApp';
import { pmT } from '../i18n/pmT';
import { withAlpha } from '../view/theme';
import {
  HOUR_BY_HOUR_MODEL_AVAILABLE, methodOf, methodPatch, resourceLevelingValuesOf,
  type PMResourceLevelingValues, type ResourceGrainUnit, type ResourceLevelingMode, type ResourceLevelingOrder, type ResourceLevelingPostedAction, type ResourceOptimizationMethod,
  type ResourceOptimizationMode,
} from './resourceLevelingSettings';

export type { PMResourceLevelingValues };
export { resourceLevelingValuesOf };

interface Choice<T extends string> { value: T; label: string; hint?: string; disabled?: boolean }

// the labels are looked up at render time (pmT follows a language change)
const MODES = (): Choice<ResourceOptimizationMode>[] => [
  { value: 'dayByDayModel', label: pmT('Day by day'), hint: pmT('The plan counts working days, as it does today.') },
  { value: 'hourByHourModel', label: pmT('Hour by hour'), hint: pmT('Phase 2: the time-of-day model is not available yet.'), disabled: !HOUR_BY_HOUR_MODEL_AVAILABLE },
];
const GRAINS = (): Choice<ResourceGrainUnit>[] => [
  { value: 'hour', label: pmT('Hour') }, { value: 'day', label: pmT('Day') }, { value: 'week', label: pmT('Week') },
];
const RUN_MODES = (): Choice<ResourceLevelingMode>[] => [
  { value: 'manual', label: pmT('Manual'), hint: pmT('Optimize on command, with a preview.') },
  { value: 'automatic', label: pmT('Automatic'), hint: pmT('Optimize after every change.') },
];
const METHODS = (): Choice<ResourceOptimizationMethod>[] => [
  { value: 'leveling', label: pmT('Leveling'), hint: pmT('Dates may move beyond the slack; the project finish may change.') },
  { value: 'smoothing', label: pmT('Smoothing'), hint: pmT('Only the slack is used; the project finish does not change.') },
];
const ORDERS = (): Choice<ResourceLevelingOrder>[] => [
  { value: 'standard', label: pmT('Standard') }, { value: 'priorityStandard', label: pmT('Priority, Standard') }, { value: 'idOnly', label: pmT('ID only') },
];
const POSTED = (): Choice<ResourceLevelingPostedAction>[] => [
  { value: 'ask', label: pmT('Ask me') }, { value: 'unpostAndMove', label: pmT('Unpost and move') },
  { value: 'moveAndPostAgain', label: pmT('Move and post again') }, { value: 'keep', label: pmT('Keep their dates') },
];

export default function PMResourceLevelingSettingsTab({ values, onChange }: { values: PMResourceLevelingValues; onChange: (patch: PMResourceLevelingValues) => void }) {
  const { themeColors } = useDesignSystem();
  const v = resourceLevelingValuesOf(values);
  const on = v.resourceLevelingFunctionalityEnabled;

  function Chips<T extends string>({ id, items, value, onPick, disabled }: { id: string; items: Choice<T>[]; value: T; onPick: (v: T) => void; disabled?: boolean }) {
    const picked = items.find((i) => i.value === value);
    return (
      <View>
        <View style={styles.chips}>
          {items.map((i) => {
            const sel = i.value === value;
            const off = disabled || i.disabled;
            return (
              <Pressable
                key={i.value}
                testID={`pm-resource-leveling-${id}-${i.value}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: sel, disabled: !!off }}
                aria-checked={sel}
                disabled={!!off}
                onPress={() => onPick(i.value)}
                style={[styles.chip, { borderColor: sel ? themeColors.primary : themeColors.border, backgroundColor: sel ? withAlpha(themeColors.primary, 0.14) : 'transparent', opacity: off ? 0.45 : 1 }]}
              >
                <Text style={{ color: sel ? themeColors.primary : themeColors.text, fontWeight: sel ? '700' : '500' }}>{i.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {(items.find((i) => i.disabled)?.hint && items.some((i) => i.disabled) ? items.find((i) => i.disabled)!.hint : picked?.hint) ? (
          <Text style={styles.hint}>{items.some((i) => i.disabled) ? items.find((i) => i.disabled)!.hint : picked?.hint}</Text>
        ) : null}
      </View>
    );
  }

  const sw = (key: keyof PMResourceLevelingValues, label: string, hint: string, id: string, extra?: { disabled?: boolean }) => (
    <>
      <SwitchApp
        testID={`pm-resource-leveling-${id}`}
        label={label}
        value={v[key] as boolean}
        disabled={!on || extra?.disabled}
        onValueChange={(next) => onChange({ [key]: next } as PMResourceLevelingValues)}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{hint}</Text>
    </>
  );

  return (
    <View testID="pm-project-tab-resources-content">
      <Text style={[styles.section, { color: themeColors.text }]}>{pmT('Resources')}</Text>
      <Text style={[styles.label, { color: themeColors.text }]}>{pmT('Planning model (resourceOptimizationMode)')}</Text>
      <Chips id="model" items={MODES()} value={v.resourceOptimizationMode} onPick={(m) => onChange({ resourceOptimizationMode: m })} />
      <Text style={[styles.label, { color: themeColors.text }]}>{pmT('Unit of resource load (resourceGrainUnit)')}</Text>
      <Chips id="grain" items={GRAINS()} value={v.resourceGrainUnit} onPick={(g) => onChange({ resourceGrainUnit: g })} />
      <Text style={styles.hint}>{pmT('The unit shown for the hours of a resource and the period in which the load is compared with the calendar. In the day by day model one working day is the finest period.')}</Text>

      <Text style={[styles.section, { color: themeColors.text, marginTop: 16 }]}>{pmT('Resource optimization')}</Text>
      <SwitchApp
        testID="pm-resource-leveling-enabled"
        label={pmT('Resource optimization (resourceLevelingFunctionalityEnabled)')}
        value={on}
        onValueChange={(next) => onChange({ resourceLevelingFunctionalityEnabled: next })}
        style={styles.switchRow}
      />
      <Text style={styles.hint}>{pmT('On: resources that are booked for more hours than their calendar allows can be levelled (tasks are delayed or split) or smoothed. Off: nothing changes.')}</Text>

      <View pointerEvents={on ? 'auto' : 'none'} style={{ opacity: on ? 1 : 0.5 }}>
        <Text style={[styles.label, { color: themeColors.text }]}>{pmT('Optimize (resourceLevelingMode)')}</Text>
        <Chips id="mode" items={RUN_MODES()} value={v.resourceLevelingMode} onPick={(m) => onChange({ resourceLevelingMode: m })} disabled={!on} />
        <Text style={[styles.label, { color: themeColors.text }]}>{pmT('Method (resourceLevelingWithinSlackOnly)')}</Text>
        <Chips id="method" items={METHODS()} value={methodOf(v)} onPick={(m) => onChange(methodPatch(m))} disabled={!on} />
        <Text style={[styles.label, { color: themeColors.text }]}>{pmT('Leveling order (resourceLevelingOrder)')}</Text>
        <Chips id="order" items={ORDERS()} value={v.resourceLevelingOrder} onPick={(o) => onChange({ resourceLevelingOrder: o })} disabled={!on} />

        {sw('resourceLevelingFunctionalityFastModeEnabled', pmT('Fast mode (resourceLevelingFunctionalityFastModeEnabled)'), pmT('On: change the data in place on the screen: drag a bar, type hours in a cell, move a task to another resource, fix one conflict in one click.'), 'fast')}

        <Text style={[styles.label, { color: themeColors.text }]}>{pmT('Posted tasks')}</Text>
        {sw('resourceLevelingPostedTasksMovementEnabled', pmT('Posted tasks may be moved (resourceLevelingPostedTasksMovementEnabled)'), pmT('On: a posted task can be moved, but never without asking: moving it unposts its lines and payments. Off: posted tasks keep their dates.'), 'posted-movement')}
        <Text style={[styles.label, { color: themeColors.text }]}>{pmT('When a posted task must move (resourceLevelingPostedTasksAction)')}</Text>
        <Chips id="posted-action" items={POSTED()} value={v.resourceLevelingPostedTasksAction} onPick={(a) => onChange({ resourceLevelingPostedTasksAction: a })} disabled={!on || !v.resourceLevelingPostedTasksMovementEnabled} />

        <Text style={[styles.label, { color: themeColors.text }]}>{pmT('Options')}</Text>
        {sw('resourceLevelingClearBeforeLeveling', pmT('Clear leveling values before leveling (resourceLevelingClearBeforeLeveling)'), pmT('On: level from the plan without the old delays. Always on in Automatic.'), 'clear')}
        {sw('resourceLevelingCanSplit', pmT('Leveling can create splits (resourceLevelingCanSplit)'), pmT('On: a task may be interrupted instead of moved. Works only with the Gantt Extended function "Split tasks".'), 'split')}
        {sw('resourceLevelingManualTasks', pmT('Level manually scheduled tasks (resourceLevelingManualTasks)'), pmT('On: manually scheduled tasks may be moved too. Works only with the Gantt Extended function "Manually scheduled tasks".'), 'manual-tasks')}
        {sw('resourceLevelingIncludeOtherProjects', pmT('Respect the other projects (resourceLevelingIncludeOtherProjects)'), pmT('On: the posted hours of the other projects of the organization count as load that cannot be moved.'), 'other-projects')}
        {sw('resourceLevelingShowDelayBar', pmT('Show the leveling delay bar (resourceLevelingShowDelayBar)'), pmT('On: the Gantt chart draws the delay before a moved task.'), 'delay-bar')}
        {sw('resourceLevelingShowOverallocation', pmT('Show over-allocated resources (resourceLevelingShowOverallocation)'), pmT('On: a mark in the task tree and on the bar where a resource is booked for more hours than it has.'), 'overallocation')}
        {sw('resourceLevelingKeepHistory', pmT('Keep the history of the runs (resourceLevelingKeepHistory)'), pmT('On: every run is saved, so a run can be undone later.'), 'history')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  label: { fontWeight: '600', marginTop: 10, marginBottom: 6 },
  switchRow: { marginVertical: 4 },
  hint: { fontSize: 12, opacity: 0.65, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
});
