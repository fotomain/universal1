/** @jest-environment jsdom */
import React from 'react';
import {
  formatPlanDate,
  parsePlanDate,
  formatPlanDuration,
  parsePlanDuration,
  PMPlanDateInputFormat,
  PM_PLAN_DATE_INPUT_FORMATS,
} from '../../../kit8/pm/model/planDateFormats';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { PMProjectRow, PMTaskRow } from '../../../kit8/pm/model/types';
import { renderUI, typeInto, pressKey, inputValue, fakeCrud } from '../ui/pmUiTestKit';
import EditTaskStartDate from '../../../kit8/pm/view/tree/inline/EditTaskStartDate';
import EditTaskFinishDate from '../../../kit8/pm/view/tree/inline/EditTaskFinishDate';
import EditTaskDuration from '../../../kit8/pm/view/tree/inline/EditTaskDuration';
import { act } from 'react';

describe('planDateFormats: 7 date formats', () => {
  const ts = Date.UTC(2026, 0, 15, 14, 30, 45); // 2026-01-15 14:30:45 UTC

  it('contains all 7 required formats', () => {
    expect(PM_PLAN_DATE_INPUT_FORMATS).toEqual([
      'DD MMM',
      'DD.MM.YYYY',
      'MM/DD/YYYY',
      'DD/MM/YYYY',
      'HH:MM:SS',
      'MM:SS',
      'YYYY-MM-DD',
    ]);
  });

  it('formats dates according to planDateInputFormat', () => {
    expect(formatPlanDate(ts, 'DD MMM')).toBe('15 Jan');
    expect(formatPlanDate(ts, 'DD.MM.YYYY')).toBe('15.01.2026');
    expect(formatPlanDate(ts, 'MM/DD/YYYY')).toBe('01/15/2026');
    expect(formatPlanDate(ts, 'DD/MM/YYYY')).toBe('15/01/2026');
    expect(formatPlanDate(ts, 'HH:MM:SS')).toBe('14:30:45');
    expect(formatPlanDate(ts, 'MM:SS')).toBe('30:45');
    expect(formatPlanDate(ts, 'YYYY-MM-DD')).toBe('2026-01-15');
  });

  it('parses formatted dates back to timestamp', () => {
    const d1 = parsePlanDate('15 Jan', 'DD MMM');
    expect(d1).not.toBeNull();
    const dt1 = new Date(d1!);
    expect(dt1.getUTCDate()).toBe(15);
    expect(dt1.getUTCMonth()).toBe(0);

    const d2 = parsePlanDate('15.01.2026', 'DD.MM.YYYY');
    expect(d2).toBe(Date.UTC(2026, 0, 15));

    const d3 = parsePlanDate('01/15/2026', 'MM/DD/YYYY');
    expect(d3).toBe(Date.UTC(2026, 0, 15));

    const d4 = parsePlanDate('15/01/2026', 'DD/MM/YYYY');
    expect(d4).toBe(Date.UTC(2026, 0, 15));

    const d5 = parsePlanDate('2026-01-15', 'YYYY-MM-DD');
    expect(d5).toBe(Date.UTC(2026, 0, 15));

    const d6 = parsePlanDate('14:30:45', 'HH:MM:SS');
    expect(d6).not.toBeNull();
    const dt6 = new Date(d6!);
    expect(dt6.getUTCHours()).toBe(14);
    expect(dt6.getUTCMinutes()).toBe(30);
    expect(dt6.getUTCSeconds()).toBe(45);

    const d7 = parsePlanDate('30:45', 'MM:SS');
    expect(d7).not.toBeNull();
    const dt7 = new Date(d7!);
    expect(dt7.getUTCMinutes()).toBe(30);
    expect(dt7.getUTCSeconds()).toBe(45);
  });
});

describe('planDateFormats: duration formatting & parsing with planning units', () => {
  it('formats duration in days when planDay is only unit', () => {
    const units = { planDay: true, planHour: false, planMinute: false, planSecond: false };
    expect(formatPlanDuration(5, units)).toBe('5');
    expect(parsePlanDuration('5', units)).toBe(5);
  });

  it('formats duration in hours when planHour is active', () => {
    const units = { planDay: false, planHour: true, planMinute: false, planSecond: false };
    // 1 day = 24 hours
    expect(formatPlanDuration(1, units)).toBe('24h');
    expect(parsePlanDuration('8h', units)).toBe(8 / 24);
  });

  it('formats duration in minutes when planMinute is active', () => {
    const units = { planDay: false, planHour: false, planMinute: true, planSecond: false };
    // 0.5 day = 720 minutes
    expect(formatPlanDuration(0.5, units)).toBe('720m');
    expect(parsePlanDuration('60m', units)).toBe(60 / 1440);
  });

  it('formats duration in seconds when planSecond is active', () => {
    const units = { planDay: false, planHour: false, planMinute: false, planSecond: true };
    expect(formatPlanDuration(1 / 86400, units)).toBe('1s');
    expect(parsePlanDuration('30s', units)).toBe(30 / 86400);
  });

  it('formats duration with unit suffix when specific subday unit is sole active unit', () => {
    const unitsH = { planDay: false, planHour: true, planMinute: false, planSecond: false };
    expect(formatPlanDuration(1.5, unitsH)).toBe('36h');
    const unitsM = { planDay: false, planHour: false, planMinute: true, planSecond: false };
    expect(formatPlanDuration(1, unitsM)).toBe('1440m');
    const unitsS = { planDay: false, planHour: false, planMinute: false, planSecond: true };
    expect(formatPlanDuration(1 / 86400, unitsS)).toBe('1s');
  });
});

describe('PMProjectRow: planning units and date format in rowJSON', () => {
  const project = (guid: string, json: Partial<PMProjectRow['rowJSON']> = {}): PMProjectRow => ({
    rowGUID: guid,
    treePath: guid,
    rowOwnerGUID: 'u',
    rowDuration: null,
    rowProgress: 0,
    orderInList: 1024,
    rowJSON: { rowKind: 'project', name: guid, durationDays: 0, ...json },
  });

  it('defaults to planDay: true, planDateInputFormat: YYYY-MM-DD', () => {
    const s = usePMStore.getState();
    s.selectProject(null);
    s.setProjects([project('p_def')]);
    usePMStore.getState().selectProject('p_def');
    const st = usePMStore.getState();
    expect(st.planDay).toBe(true);
    expect(st.planHour).toBe(false);
    expect(st.planMinute).toBe(false);
    expect(st.planSecond).toBe(false);
    expect(st.planDateInputFormat).toBe('YYYY-MM-DD');
  });

  it('mirrors custom planning units and date format from rowJSON', () => {
    const s = usePMStore.getState();
    s.selectProject(null);
    s.setProjects([
      project('p_custom', {
        planDay: true,
        planHour: true,
        planMinute: true,
        planSecond: false,
        planDateInputFormat: 'DD.MM.YYYY',
      }),
    ]);
    usePMStore.getState().selectProject('p_custom');
    const st = usePMStore.getState();
    expect(st.planDay).toBe(true);
    expect(st.planHour).toBe(true);
    expect(st.planMinute).toBe(true);
    expect(st.planSecond).toBe(false);
    expect(st.planDateInputFormat).toBe('DD.MM.YYYY');
  });
});

describe('TaskTree cross-recalculation: taskStartDate, taskFinishDate, taskDuration', () => {
  const scrollY = { value: 0 } as any;
  const colors = { text: '#000', background: '#fff', primary: '#007aff', error: '#ff3b30' };

  it('EditTaskStartDate: editing start commits setStartDateConstraint, preserves durationDays', () => {
    const { byName } = require('../ui/pmUiTestKit').seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'taskStartDate' }));

    renderUI(
      <EditTaskStartDate
        guid={g}
        rowIndex={1}
        x={0}
        width={100}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    const inputId = `pm-tree-edit-taskStartDate-${g}`;
    typeInto(inputId, '2026-10-15');
    pressKey(inputId, 'Enter');

    expect(crud.setStartConstraint).toHaveBeenCalledWith(g, expect.any(Number));
    expect(usePMStore.getState().cellEdit).toBeNull();
  });

  it('EditTaskFinishDate: editing finish recalculates taskDuration = workDaysBetween', () => {
    const { byName } = require('../ui/pmUiTestKit').seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'taskFinishDate' }));

    renderUI(
      <EditTaskFinishDate
        guid={g}
        rowIndex={1}
        x={0}
        width={100}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    const inputId = `pm-tree-edit-taskFinishDate-${g}`;
    typeInto(inputId, '2026-10-20');
    pressKey(inputId, 'Enter');

    expect(crud.setDurationDays).toHaveBeenCalled();
    const calledDuration = crud.setDurationDays.mock.calls[0][1];
    expect(Number.isFinite(calledDuration)).toBe(true);
    expect(calledDuration).toBeGreaterThan(0);
    expect(usePMStore.getState().cellEdit).toBeNull();
  });

  it('EditTaskDuration: editing duration commits setDurationDays', () => {
    const { byName } = require('../ui/pmUiTestKit').seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'taskDuration' }));

    renderUI(
      <EditTaskDuration
        guid={g}
        rowIndex={1}
        x={0}
        width={100}
        scrollY={scrollY}
        crud={crud}
        colors={colors}
      />
    );

    const inputId = `pm-tree-edit-taskDuration-${g}`;
    typeInto(inputId, '8');
    pressKey(inputId, 'Enter');

    expect(crud.setDurationDays).toHaveBeenCalledWith(g, 8);
    expect(usePMStore.getState().cellEdit).toBeNull();
  });
});
