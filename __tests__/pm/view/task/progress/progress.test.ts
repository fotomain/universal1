import { computeProjectProgress, scheduleProject } from '../../../../../kit8/pm/view/project/scheduling';
import { PMTaskRow, uxuiSettingsOf } from '../../../../../kit8/pm/model/types';

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
      taskProgressLineColor: '#FCFF00',
      projectProgressLineColor: '#FCFF00',
      criticalPathTaskColor: '#FF0033',
      ganttVsNetworkView: 'showGanttChart',
      networkViewMode: 'networkDiagram',
      networkDiagramVariant: 'cpmNodes',
      networkScheduleVariant: 'eventCircles',
      showTreeHierarchyNumbers: true,
      treeColumnsOrder: ['wbs', 'name', 'start', 'days', 'progress'],
      treeColumnsWidths: {},
      projectTreeContextCommandsMode: 'onHoverPanelMode',
      projectGanttChartContextCommandsMode: 'onHoverPanelMode',
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
    const u = uxuiSettingsOf({ rowKind: 'project', name: 'x', durationDays: 0, uxuiSettings: { taskProgressLineColor: '#00FF66', projectProgressLineColor: '' } });
    expect([u.taskProgressLineColor, u.projectProgressLineColor]).toEqual(['#00FF66', '#FCFF00']);
  });
});

import { isProgressLineUnderText, projectProgressLineLayout, taskProgressLineWidth, taskProgressLineY } from '../../../../../kit8/pm/view/task/progress/line/progressLineGeometry';

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

describe('progress line color set', () => {
  const { PM_PROGRESS_LINE_SWATCHES, PM_DEFAULT_PROGRESS_LINE_COLOR, progressLineColorOf } = require('../../../../../kit8/pm/view/task/progress/line/progressLineConstants');
  it('exactly 9 colors + white + black; default = the first', () => {
    expect(PM_PROGRESS_LINE_SWATCHES).toEqual(['#FCFF00', '#FFAA00', '#FF5500', '#00FF66', '#00F0FF', '#4455FF', '#9D00FF', '#FF007F', '#FF0033', '#FFFFFF', '#000000']);
    expect(PM_DEFAULT_PROGRESS_LINE_COLOR).toBe('#FCFF00');
  });
  it('saved colors outside the set (old yellow, other hex) fall back to the default; case-insensitive match', () => {
    expect(progressLineColorOf('#ff0033')).toBe('#FF0033');
    expect(progressLineColorOf(' #9d00ff ')).toBe('#9D00FF');
    expect(progressLineColorOf('yellow')).toBe('#FCFF00');
    expect(progressLineColorOf('#22c55e')).toBe('#FCFF00');
    expect(progressLineColorOf(undefined)).toBe('#FCFF00');
    expect(uxuiSettingsOf({ rowKind: 'project', name: 'x', uxuiSettings: { taskProgressLineColor: '#00ff66', projectProgressLineColor: '#123456' } } as any))
      .toMatchObject({ taskProgressLineColor: '#00FF66', projectProgressLineColor: '#FCFF00' });
  });
});
