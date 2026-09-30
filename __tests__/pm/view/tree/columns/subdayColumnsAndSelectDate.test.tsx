/** @jest-environment jsdom */
import React, { act } from 'react';
import { renderUI, fakeCrud, typeInto, pressKey, seedStore, press, q } from '../../../ui/pmUiTestKit';
import {
  layoutTreeColumns,
  PM_TREE_COLUMN_TITLES,
  PM_TREE_COLUMN_WIDTHS,
} from '../../../../../kit8/pm/view/tree/columns/treeColumns';
import SelectDateApp, { normalizeDateValue } from '../../../../../kit8/components/common/SelectDateApp';
import EditTaskPlanningUnitField from '../../../../../kit8/pm/view/tree/inline/EditTaskPlanningUnitField';
import EditTaskStartDate from '../../../../../kit8/pm/view/tree/inline/EditTaskStartDate';
import EditTaskFinishDate from '../../../../../kit8/pm/view/tree/inline/EditTaskFinishDate';
import { usePMStore } from '../../../../../kit8/pm/store/store_pm';


describe('Sub-day planning columns layout (planHour, planMinute, planSecond)', () => {
  const baseOrder = [
    'wbs',
    'name',
    'taskStartDate',
    'taskFinishDate',
    'taskDuration',
    'progress',
    'kanban',
    'kanbanStageProgressPercent',
  ] as const;

  it('excludes sub-day columns when all plan flags are false or omitted', () => {
    const layout = layoutTreeColumns(1200, baseOrder, {});
    const keys = layout.columns.map((c) => c.key);
    expect(keys).not.toContain('startHourStart');
    expect(keys).not.toContain('startHourFinish');
    expect(keys).not.toContain('planMinuteStart');
    expect(keys).not.toContain('planMinuteFinish');
    expect(keys).not.toContain('planSecondStart');
    expect(keys).not.toContain('planSecondFinish');
    expect(keys.length).toBe(8);
  });

  it('includes startHourStart and startHourFinish when planHour is true', () => {
    const layout = layoutTreeColumns(1200, baseOrder, { planHour: true });
    const keys = layout.columns.map((c) => c.key);
    expect(keys).toContain('startHourStart');
    expect(keys).toContain('startHourFinish');
    expect(keys).not.toContain('planMinuteStart');
    expect(keys).not.toContain('planSecondStart');

    // Position check: startHourStart immediately after taskStartDate
    const startIdx = keys.indexOf('taskStartDate');
    const hourStartIdx = keys.indexOf('startHourStart');
    expect(hourStartIdx).toBe(startIdx + 1);

    // Position check: startHourFinish immediately after taskFinishDate
    const finishIdx = keys.indexOf('taskFinishDate');
    const hourFinishIdx = keys.indexOf('startHourFinish');
    expect(hourFinishIdx).toBe(finishIdx + 1);
  });

  it('includes planMinuteStart and planMinuteFinish when planMinute is true', () => {
    const layout = layoutTreeColumns(1200, baseOrder, { planMinute: true });
    const keys = layout.columns.map((c) => c.key);
    expect(keys).toContain('planMinuteStart');
    expect(keys).toContain('planMinuteFinish');
    expect(keys).not.toContain('startHourStart');
    expect(keys).not.toContain('planSecondStart');

    const startIdx = keys.indexOf('taskStartDate');
    expect(keys.indexOf('planMinuteStart')).toBe(startIdx + 1);
    const finishIdx = keys.indexOf('taskFinishDate');
    expect(keys.indexOf('planMinuteFinish')).toBe(finishIdx + 1);
  });

  it('includes planSecondStart and planSecondFinish when planSecond is true', () => {
    const layout = layoutTreeColumns(1200, baseOrder, { planSecond: true });
    const keys = layout.columns.map((c) => c.key);
    expect(keys).toContain('planSecondStart');
    expect(keys).toContain('planSecondFinish');
    expect(keys).not.toContain('startHourStart');
    expect(keys).not.toContain('planMinuteStart');

    const startIdx = keys.indexOf('taskStartDate');
    expect(keys.indexOf('planSecondStart')).toBe(startIdx + 1);
    const finishIdx = keys.indexOf('taskFinishDate');
    expect(keys.indexOf('planSecondFinish')).toBe(finishIdx + 1);
  });

  it('correctly sequences all sub-day columns when planHour, planMinute, and planSecond are all true', () => {
    const layout = layoutTreeColumns(1400, baseOrder, {
      planHour: true,
      planMinute: true,
      planSecond: true,
    });
    const keys = layout.columns.map((c) => c.key);

    // Start side order: taskStartDate -> startHourStart -> planMinuteStart -> planSecondStart
    const startIdx = keys.indexOf('taskStartDate');
    const hStartIdx = keys.indexOf('startHourStart');
    const mStartIdx = keys.indexOf('planMinuteStart');
    const sStartIdx = keys.indexOf('planSecondStart');
    expect(hStartIdx).toBe(startIdx + 1);
    expect(mStartIdx).toBe(hStartIdx + 1);
    expect(sStartIdx).toBe(mStartIdx + 1);

    // Finish side order: taskFinishDate -> startHourFinish -> planMinuteFinish -> planSecondFinish
    const finishIdx = keys.indexOf('taskFinishDate');
    const hFinishIdx = keys.indexOf('startHourFinish');
    const mFinishIdx = keys.indexOf('planMinuteFinish');
    const sFinishIdx = keys.indexOf('planSecondFinish');
    expect(hFinishIdx).toBe(finishIdx + 1);
    expect(mFinishIdx).toBe(hFinishIdx + 1);
    expect(sFinishIdx).toBe(mFinishIdx + 1);
  });

  it('defines titles and widths for all 6 sub-day columns', () => {
    const subdayKeys = [
      'startHourStart',
      'startHourFinish',
      'planMinuteStart',
      'planMinuteFinish',
      'planSecondStart',
      'planSecondFinish',
    ] as const;

    for (const key of subdayKeys) {
      expect(PM_TREE_COLUMN_TITLES[key]).toBeDefined();
      expect(typeof PM_TREE_COLUMN_TITLES[key]).toBe('string');
      expect(PM_TREE_COLUMN_WIDTHS[key]).toBeGreaterThan(0);
    }
  });
});

describe('SelectDateApp component', () => {
  it('normalizes Date, timestamp, and date strings correctly', () => {
    const d = new Date(2026, 8, 30);
    expect(normalizeDateValue(d)).toBe(d);

    const ts = d.getTime();
    expect(normalizeDateValue(ts)?.getTime()).toBe(ts);

    const iso = '2026-09-30';
    const parsed = normalizeDateValue(iso);
    expect(parsed).toBeDefined();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(30);

    expect(normalizeDateValue(null)).toBeUndefined();
    expect(normalizeDateValue(undefined)).toBeUndefined();
    expect(normalizeDateValue('invalid-date')).toBeUndefined();
  });

  it('renders trigger in icon mode and invokes onSelect on confirmation', () => {
    const onSelect = jest.fn();
    const testDate = new Date(2026, 8, 30);

    renderUI(
      <SelectDateApp
        value={testDate}
        trigger="icon"
        testID="test-date-picker"
        onSelect={onSelect}
      />
    );

    expect(q('test-date-picker-trigger')).not.toBeNull();

    // Clicking trigger opens modal
    press('test-date-picker-trigger');
    expect(q('mock-date-picker-modal')).not.toBeNull();

    // Confirm button in mock triggers onSelect
    expect(q('mock-date-picker-confirm')).not.toBeNull();
    press('mock-date-picker-confirm');

    expect(onSelect).toHaveBeenCalled();
  });

  it('supports custom render function children', () => {
    let receivedFormatted = '';
    renderUI(
      <SelectDateApp value={new Date(2026, 0, 15)}>
        {({ open, formatted }) => {
          receivedFormatted = formatted;
          return null;
        }}
      </SelectDateApp>
    );

    expect(receivedFormatted).toBe('2026-01-15');
  });
});

describe('EditTaskPlanningUnitField inline editing', () => {
  const scrollY = { value: 0 } as any;
  const colors = { text: '#000', background: '#fff', primary: '#007aff', error: '#ff3b30' };

  it('edits startHourStart and commits to task.rowJSON.startHourStart', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'startHourStart' }));

    renderUI(
      <EditTaskPlanningUnitField
        guid={g}
        field="startHourStart"
        rowIndex={1}
        x={0}
        width={60}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    const inputId = `pm-tree-edit-startHourStart-${g}`;
    typeInto(inputId, '14');
    pressKey(inputId, 'Enter');

    expect(crud.updateTask).toHaveBeenCalledWith(
      g,
      expect.objectContaining({
        rowJSON: expect.objectContaining({ startHourStart: 14 }),
      }),
      expect.any(String)
    );
    expect(usePMStore.getState().cellEdit).toBeNull();
  });

  it('edits planMinuteFinish and commits to task.rowJSON.planMinuteFinish', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'planMinuteFinish' }));

    renderUI(
      <EditTaskPlanningUnitField
        guid={g}
        field="planMinuteFinish"
        rowIndex={1}
        x={0}
        width={60}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    const inputId = `pm-tree-edit-planMinuteFinish-${g}`;
    typeInto(inputId, '45');
    pressKey(inputId, 'Enter');

    expect(crud.updateTask).toHaveBeenCalledWith(
      g,
      expect.objectContaining({
        rowJSON: expect.objectContaining({ planMinuteFinish: 45 }),
      }),
      expect.any(String)
    );
  });

  it('rejects values out of range (e.g. 24 for hour, 60 for minute)', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'startHourStart' }));

    renderUI(
      <EditTaskPlanningUnitField
        guid={g}
        field="startHourStart"
        rowIndex={1}
        x={0}
        width={60}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    const inputId = `pm-tree-edit-startHourStart-${g}`;
    typeInto(inputId, '99');
    pressKey(inputId, 'Enter');

    // Should NOT call updateTask because 99 > 23
    expect(crud.updateTask).not.toHaveBeenCalled();
  });
});

describe('TaskTree date editing with SelectDateApp integration', () => {
  const scrollY = { value: 0 } as any;
  const colors = { text: '#000', background: '#fff', primary: '#007aff', error: '#ff3b30' };

  it('renders SelectDateApp inside EditTaskStartDate and allows date selection', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'taskStartDate' }));

    renderUI(
      <EditTaskStartDate
        guid={g}
        rowIndex={1}
        x={0}
        width={120}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    expect(q(`pm-tree-select-date-start-${g}-trigger`)).not.toBeNull();

    press(`pm-tree-select-date-start-${g}-trigger`);

    expect(q('mock-date-picker-confirm')).not.toBeNull();
    press('mock-date-picker-confirm');

    expect(crud.setStartConstraint).toHaveBeenCalledWith(g, expect.any(Number));
  });

  it('renders SelectDateApp inside EditTaskFinishDate and allows date selection', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'taskFinishDate' }));

    renderUI(
      <EditTaskFinishDate
        guid={g}
        rowIndex={1}
        x={0}
        width={120}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    expect(q(`pm-tree-select-date-finish-${g}-trigger`)).not.toBeNull();

    press(`pm-tree-select-date-finish-${g}-trigger`);

    expect(q('mock-date-picker-confirm')).not.toBeNull();
    press('mock-date-picker-confirm');

    expect(crud.setDurationDays).toHaveBeenCalled();
  });
});
