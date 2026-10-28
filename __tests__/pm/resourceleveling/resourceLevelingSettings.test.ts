import { HOUR_BY_HOUR_MODEL_AVAILABLE, methodOf, methodPatch, resourceLevelingEnabledOf, resourceLevelingOf, resourceLevelingValuesOf } from '../../../kit8/pm/resourceleveling/resourceLevelingSettings';

describe('Resource optimization settings', () => {
  it('everything is off / at its default while never saved', () => {
    const v = resourceLevelingValuesOf(null);
    expect(v).toMatchObject({
      resourceLevelingFunctionalityEnabled: false, resourceLevelingMode: 'manual', resourceLevelingWithinSlackOnly: false, resourceLevelingFunctionalityFastModeEnabled: false,
      resourceLevelingPostedTasksMovementEnabled: true, resourceLevelingPostedTasksAction: 'ask', resourceLevelingOrder: 'standard', resourceLevelingClearBeforeLeveling: true,
      resourceLevelingCanSplit: false, resourceLevelingManualTasks: false, resourceLevelingIncludeOtherProjects: true, resourceLevelingKeepHistory: true,
      resourceOptimizationMode: 'dayByDayModel', resourceGrainUnit: 'hour',
    });
    expect(resourceLevelingOf(undefined).enabled).toBe(false);
    expect(resourceLevelingEnabledOf({})).toBe(false);
  });

  it('a wrong stored value reads as the default', () => {
    expect(resourceLevelingValuesOf({ resourceLevelingMode: 'x' as any, resourceGrainUnit: 'minute' as any, resourceLevelingOrder: 1 as any }).resourceLevelingMode).toBe('manual');
    expect(resourceLevelingValuesOf({ resourceGrainUnit: 'minute' as any }).resourceGrainUnit).toBe('hour');
    expect(resourceLevelingValuesOf({ resourceLevelingPostedTasksAction: 'delete' as any }).resourceLevelingPostedTasksAction).toBe('ask');
  });

  it('the master off switches the sub switches off', () => {
    const e = resourceLevelingOf({ resourceLevelingFunctionalityEnabled: false, resourceLevelingMode: 'automatic', resourceLevelingFunctionalityFastModeEnabled: true, resourceLevelingShowDelayBar: true });
    expect(e).toMatchObject({ enabled: false, mode: 'manual', fastMode: false, showDelayBar: false, showOverallocation: false });
  });

  it('Automatic always clears before leveling', () => {
    expect(resourceLevelingOf({ resourceLevelingFunctionalityEnabled: true, resourceLevelingMode: 'automatic', resourceLevelingClearBeforeLeveling: false }).clearBefore).toBe(true);
    expect(resourceLevelingOf({ resourceLevelingFunctionalityEnabled: true, resourceLevelingMode: 'manual', resourceLevelingClearBeforeLeveling: false }).clearBefore).toBe(false);
  });

  it('posted tasks: movement off = keep; otherwise the action (default ask)', () => {
    const on = { resourceLevelingFunctionalityEnabled: true };
    expect(resourceLevelingOf(on).postedTasksAction).toBe('ask');
    expect(resourceLevelingOf({ ...on, resourceLevelingPostedTasksAction: 'moveAndPostAgain' }).postedTasksAction).toBe('moveAndPostAgain');
    expect(resourceLevelingOf({ ...on, resourceLevelingPostedTasksMovementEnabled: false, resourceLevelingPostedTasksAction: 'moveAndPostAgain' }).postedTasksAction).toBe('keep');
  });

  it('splits and manual tasks need their Extended function', () => {
    const base = { resourceLevelingFunctionalityEnabled: true, resourceLevelingCanSplit: true, resourceLevelingManualTasks: true };
    expect(resourceLevelingOf(base)).toMatchObject({ canSplit: false, manualTasks: false });
    const ext = { ...base, ganttExtendedFunctionalityEnabled: true, ganttSplitTasksEnabled: true, ganttManualSchedulingEnabled: true };
    expect(resourceLevelingOf(ext)).toMatchObject({ canSplit: true, manualTasks: true });
  });

  it('the PMBOK method is the presentation of resourceLevelingWithinSlackOnly', () => {
    expect(methodOf({})).toBe('leveling');
    expect(methodOf({ resourceLevelingWithinSlackOnly: true })).toBe('smoothing');
    expect(methodPatch('smoothing')).toEqual({ resourceLevelingWithinSlackOnly: true });
    expect(methodPatch('leveling')).toEqual({ resourceLevelingWithinSlackOnly: false });
    expect(resourceLevelingOf({ resourceLevelingFunctionalityEnabled: true, resourceLevelingWithinSlackOnly: true }).method).toBe('smoothing');
  });

  it('the hour-by-hour model is not available yet: the project plans by day whatever is stored', () => {
    expect(HOUR_BY_HOUR_MODEL_AVAILABLE).toBe(false);
    expect(resourceLevelingValuesOf({ resourceOptimizationMode: 'hourByHourModel' }).resourceOptimizationMode).toBe('hourByHourModel');
    expect(resourceLevelingOf({ resourceOptimizationMode: 'hourByHourModel' }).optimizationMode).toBe('dayByDayModel');
  });
});
