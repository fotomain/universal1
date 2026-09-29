import { computeProjectProgress, scheduleProject } from '../../kit8/pm/scheduling';
import { PMTaskRow, uxuiSettingsOf } from '../../kit8/pm/types';

const t = (guid: string, path: string, kind: 'stage' | 'task' | 'milestone', days: number, progress = 0): PMTaskRow => ({
  rowGUID: guid,
  treePath: path,
  projectGUID: 'p',
  rowOwnerGUID: 'u',
  rowDuration: null,
  rowProgress: progress,
  orderInList: 1024,
  rowJSON: { rowKind: kind, name: guid, durationDays: days },
});

describe('project progress formula (same as SQL pm_recalc_project_progress)', () => {
  const tasks = [
    t('s1', 'p.s1', 'stage', 0),
    t('a', 'p.s1.a', 'task', 3, 100),
    t('b', 'p.s1.b', 'task', 5, 50),
    t('c', 'p.s1.c', 'task', 2, 0),
    t('s2', 'p.s2', 'stage', 0),
    t('d', 'p.s2.d', 'task', 3),
    t('e', 'p.s2.e', 'task', 5),
    t('f', 'p.s2.f', 'task', 2),
    t('m', 'p.m', 'milestone', 0, 100),
    t('empty', 'p.empty', 'stage', 0),
  ];
  const res = scheduleProject({ tasks, deps: [], projectStartMs: Date.UTC(2026, 0, 5), calendar: { skipWeekends: false } });

  it('stage = duration-weighted over its leaves', () => {
    expect(res.rows.s1.progress).toBe(55); // (3*100 + 5*50) / 10
  });
  it('project = duration-weighted over all leaves, milestone counts as 1 day, empty stage ignored', () => {
    // (300 + 250 + 0 + 0 + 0 + 0 + 1*100) / (3+5+2+3+5+2+1) = 650 / 21
    expect(computeProjectProgress(res.rows)).toBe(31);
  });
  it('no leaves -> 0', () => {
    expect(computeProjectProgress({})).toBe(0);
  });
});

describe('uxuiSettingsOf', () => {
  it('defaults', () => {
    expect(uxuiSettingsOf(undefined)).toEqual({
      showCriticalPath: true,
      ganttArrowsForm: 'smoothForm',
      showTaskProgressOnGantt: false,
      taskProgressLinePosition: 'onTop',
      projectProgressLinePosition: 'onBottom',
      taskProgressLineColor: 'yellow',
      projectProgressLineColor: 'yellow',
      ganttVsNetworkView: 'showGanttChart',
      networkViewMode: 'networkDiagram',
      networkDiagramVariant: 'cpmNodes',
      networkScheduleVariant: 'eventCircles',
      showTreeHierarchyNumbers: true,
      treeColumnsOrder: ['wbs', 'name', 'start', 'days', 'progress'],
    });
  });
  it('uxuiSettings wins over legacy top-level keys', () => {
    const u = uxuiSettingsOf({
      rowKind: 'project',
      name: 'x',
      durationDays: 0,
      showCriticalPath: false,
      uxuiSettings: { showCriticalPath: true, taskProgressLinePosition: 'atTheMiddle', projectProgressLinePosition: 'onTop' },
    });
    expect([u.showCriticalPath, u.taskProgressLinePosition, u.projectProgressLinePosition]).toEqual([true, 'atTheMiddle', 'onTop']);
  });
  it('custom progress line colors', () => {
    const u = uxuiSettingsOf({ rowKind: 'project', name: 'x', durationDays: 0, uxuiSettings: { taskProgressLineColor: '#22c55e', projectProgressLineColor: '' } });
    expect([u.taskProgressLineColor, u.projectProgressLineColor]).toEqual(['#22c55e', 'yellow']);
  });
});

import { isProgressLineUnderText, projectProgressLineLayout, taskProgressLineWidth, taskProgressLineY } from '../../kit8/pm/progress/line/progressLineGeometry';

describe('progress line geometry', () => {
  it('task line y for onTop / onBottom / atTheMiddle', () => {
    expect(taskProgressLineY('onTop', 10, 20)).toBe(8);
    expect(taskProgressLineY('onBottom', 10, 20)).toBe(28);
    expect(taskProgressLineY('atTheMiddle', 10, 20)).toBe(18);
    expect(isProgressLineUnderText('atTheMiddle')).toBe(true);
    expect(taskProgressLineWidth(100, 0.5)).toBe(50);
    expect(taskProgressLineWidth(100, 0.001)).toBe(4);
  });
  it('project line layout in a 48 px scale', () => {
    expect(projectProgressLineLayout('onTop', 48).y).toBe(1);
    expect(projectProgressLineLayout('atTheMiddle', 48).y).toBe(22);
    expect(projectProgressLineLayout('onBottom', 48).y).toBe(43);
  });
});
