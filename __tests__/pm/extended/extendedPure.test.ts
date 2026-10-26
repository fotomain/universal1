// The pure modules of the Gantt Extended functions that extendedModel.test.ts does not cover: formulas, WBS mask, group / highlight rules, columns,
// schedule marks, bar edit patches, range selection, project summary, rich notes, keyboard commands, external dates.
import { evalFormula } from '../../../kit8/pm/extended/formula';
import { formatWbsMask } from '../../../kit8/pm/extended/wbsMask';
import { groupKeyOf, groupOrderOf, highlightHit } from '../../../kit8/pm/extended/rowRules';
import { customCellValue, extColumnDefsOf, extColumnEditable, extColumnValue, isExtColumnKey, PM_EXT_COLUMNS } from '../../../kit8/pm/extended/extendedColumns';
import { scheduleMarksOf } from '../../../kit8/pm/view/project/scheduleMarks';
import { barEditJSON } from '../../../kit8/pm/crud/task/barEditPatch';
import { rangeBetween, rangeBetweenChecked } from '../../../kit8/pm/extended/rangeSelect';
import { projectSummaryOf } from '../../../kit8/pm/extended/projectSummary';
import { keyCommandOf } from '../../../kit8/pm/extended/useExtendedKeys';
import { externalGuidsOf } from '../../../kit8/pm/crud/extended/useExternalDates';
import type { PMScheduledRow, PMTaskJSON, PMTaskRow } from '../../../kit8/pm/model/types';

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: () => undefined }));
jest.mock('../../../kit8/pm/crud/shared/queryShared', () => ({ usePMApi: () => ({}) }));

const DAY = 86400000;
const D0 = Date.UTC(2026, 9, 5);
const row = (extra: Partial<PMScheduledRow> = {}): PMScheduledRow => ({ startAt: '', finishAt: '', startMs: D0, finishMs: D0 + 5 * DAY, durationDays: 5, isSummary: false, isMilestone: false, progress: 0, totalFloatDays: 0, isCritical: false, inCycle: false, ...extra });
const task = (guid: string, json: Record<string, unknown> = {}): PMTaskRow => ({ rowGUID: guid, rowJSON: { rowKind: 'task', taskDescription: guid, durationDays: 5, ...json } as unknown as PMTaskJSON } as PMTaskRow);

describe('formula (F5)', () => {
  const field = (m: Record<string, number | string | boolean | null>) => (n: string) => (n in m ? m[n] : null);
  it('calculates numbers, text and IF without eval', () => {
    expect(evalFormula('[Duration]*2+1', field({ Duration: 4 }))).toBe(9);
    expect(evalFormula('IF([% Complete]>=100; "Done"; "Open")', field({ '% Complete': 100 }))).toBe('Done');
    expect(evalFormula('IF([% Complete]>=100; "Done"; "Open")', field({ '% Complete': 10 }))).toBe('Open');
    expect(evalFormula('"A" & "B"', field({}))).toBe('AB');
    expect(evalFormula('MAX(1; 5; 3)', field({}))).toBe(5);
    expect(evalFormula('ROUND(2.567; 1)', field({}))).toBe(2.6);
  });
  it('an error gives null, never an exception', () => {
    expect(evalFormula('1 +', field({}))).toBeNull();
    expect(evalFormula('require("fs")', field({}))).toBeNull();
    expect(evalFormula('[Missing', field({}))).toBeNull();
  });
});

describe('WBS mask (F6)', () => {
  it('formats the levels', () => {
    expect(formatWbsMask('2.3.4', 'A.01.001')).toBe('B.03.004');
    expect(formatWbsMask('1.1', 'T#')).toBe('T1.1');
    expect(formatWbsMask('27', 'A')).toBe('AA');
  });
  it('an empty mask changes nothing', () => {
    expect(formatWbsMask('1.2', '')).toBe('1.2');
    expect(formatWbsMask('', 'A')).toBe('');
  });
});

describe('group by and highlight (F8, F9)', () => {
  it('groups and orders', () => {
    expect(groupKeyOf('priority', task('a', { taskPriority: 900 }), row())).toBe('priority: high');
    expect(groupKeyOf('critical', task('a'), row({ isCritical: true }))).toBe('critical');
    expect(groupKeyOf('percent', task('a'), row({ progress: 60 }))).toBe('50-74%');
    expect(groupKeyOf('duration', task('a'), row({ durationDays: 10 }))).toBe('6-20 days');
    expect(groupKeyOf('none', task('a'), row())).toBe('');
    expect(groupOrderOf('critical', task('a'), row({ isCritical: true }))).toBeLessThan(groupOrderOf('critical', task('b'), row()));
  });
  it('highlight never hits a stage', () => {
    expect(highlightHit('critical', task('a'), row({ isCritical: true }), 0, 0)).toBe(true);
    expect(highlightHit('critical', task('a'), row({ isCritical: true, isSummary: true }), 0, 0)).toBe(false);
    expect(highlightHit('late', task('a'), row({ finishMs: D0 + DAY }), 0, D0 + 5 * DAY)).toBe(true);
    expect(highlightHit('late', task('a'), row({ finishMs: D0 + DAY, progress: 100 }), 0, D0 + 5 * DAY)).toBe(false);
    expect(highlightHit('highPriority', task('a', { taskPriority: 800 }), row(), 0, 0)).toBe(true);
    expect(highlightHit('none', task('a'), row({ isCritical: true }), 0, 0)).toBe(false);
  });
});

describe('Extended columns (F4, F5, C1, B1)', () => {
  const ctx = { baselineNo: 0, deps: [], wbsById: {}, tasksById: {}, calendarNames: {}, customDefs: [] as any[] };
  it('only the columns of the functions that are on are offered', () => {
    expect(extColumnDefsOf({}, { shownColumns: [], hiddenColumns: [] })).toEqual([]);
    const on = extColumnDefsOf({ ganttTaskPriorityEnabled: true }, { shownColumns: [], hiddenColumns: [] });
    expect(on.every((c) => isExtColumnKey(c.key))).toBe(true);
    expect(PM_EXT_COLUMNS.length).toBeGreaterThan(5);
  });
  it('values', () => {
    expect(extColumnValue('priority', task('a', { taskPriority: 700 }), row(), ctx)).toBe(700);
    expect(extColumnValue('priority', task('a'), row({ isSummary: true }), ctx)).toBeNull();
    expect(extColumnValue('mode', task('a'), row({ isManual: true }), ctx)).toBe('Manual');
    expect(extColumnValue('deadline', task('a', { taskDeadline: '2026-11-01T00:00:00.000Z' }), row(), ctx)).toBe('2026-11-01');
  });
  it('a formula column reads the other fields of its row', () => {
    const c2 = { ...ctx, customDefs: [{ key: 'cc_f1', name: 'Twice', type: 'float', formula: '[Duration]*2' }] };
    expect(customCellValue('cc_f1', task('a'), row({ durationDays: 4 }), c2 as any)).toBe(8);
  });
  it('a formula column is never editable, an Extended column is', () => {
    expect(extColumnEditable('cc_ext_priority', false)).toBe(true);
    expect(extColumnEditable('cc_ext_priority', true)).toBe(false);
  });
});

describe('schedule marks (E11)', () => {
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  it('no function, no mark', () => {
    expect(scheduleMarksOf({ a: row() }, { a: task('a') }, {}, fmt, {})).toEqual({});
  });
  it('marks a pending edit (A2), an inactive task (A14), a missed deadline (A5)', () => {
    const marks = scheduleMarksOf(
      { a: row(), b: row({ isInactive: true }), c: row({ deadlineMissed: true }) },
      { a: task('a'), b: task('b'), c: task('c') },
      { a: true },
      fmt,
      { ganttCalculationModeEnabled: true, ganttInactiveTasksEnabled: true, ganttDeadlineEnabled: true }
    );
    expect(marks.a?.icon).toBe('pending');
    expect(marks.b?.icon).toBe('block');
    expect(marks.c?.conflict).toBe(true);
  });
});

describe('bar edit patch (A1, A3, A4)', () => {
  const edit = { mode: 'move' as const, startMs: D0 + 2 * DAY, finishMs: D0 + 7 * DAY, durationDays: 5 };
  const j = { rowKind: 'task', taskDescription: 'x', durationDays: 5 } as PMTaskJSON;
  it('constraints off: Start No Earlier Than as before', () => {
    const out = barEditJSON(j, edit, { manual: false, constraintsEnabled: false, fromFinish: false });
    expect(out.manualStartAt).toBe(new Date(edit.startMs).toISOString());
    expect(out.taskConstraintType).toBeUndefined();
  });
  it('manual task keeps its own start', () => {
    const out = barEditJSON(j, edit, { manual: true, constraintsEnabled: true, fromFinish: false });
    expect(out.taskManualStartAt).toBeTruthy();
  });
  it('from the finish date: Finish No Later Than on the dropped last day', () => {
    const out = barEditJSON(j, edit, { manual: false, constraintsEnabled: true, fromFinish: true });
    expect(out.taskConstraintType).toBe('FNLT');
    expect(out.taskConstraintDate).toBe(new Date(edit.finishMs - DAY).toISOString());
  });
  it('resize at the end only changes the duration', () => {
    const out = barEditJSON(j, { ...edit, mode: 'resize-end', durationDays: 8 }, { manual: false, constraintsEnabled: true, fromFinish: false });
    expect(out.durationDays).toBe(8);
    expect(out.manualStartAt).toBeUndefined();
  });
});

describe('range selection (F3)', () => {
  const visible = ['a', 'b', 'c', 'd', 'e'];
  it('between the first and the last checked', () => {
    expect(rangeBetweenChecked(visible, { b: true, d: true })).toEqual(['b', 'c', 'd']);
    expect(rangeBetweenChecked(visible, { b: true })).toEqual([]);
  });
  it('between two rows, in either direction', () => {
    expect(rangeBetween(visible, 'd', 'b')).toEqual(['b', 'c', 'd']);
    expect(rangeBetween(visible, 'a', 'zzz')).toEqual([]);
  });
});

describe('project summary (E7)', () => {
  it('null without a task', () => {
    expect(projectSummaryOf([row({ isSummary: true })], D0)).toBeNull();
  });
  it('dates, weighted progress and counts', () => {
    const s = projectSummaryOf(
      [row({ startMs: D0, finishMs: D0 + 4 * DAY, durationDays: 4, progress: 100 }), row({ startMs: D0 + 4 * DAY, finishMs: D0 + 12 * DAY, durationDays: 8, progress: 50, isCritical: true }), row({ startMs: D0 + 12 * DAY, finishMs: D0 + 12 * DAY, durationDays: 0, isMilestone: true }), row({ isSummary: true })],
      D0 + 20 * DAY
    )!;
    expect(s.startMs).toBe(D0);
    expect(s.finishMs).toBe(D0 + 12 * DAY);
    expect(s.spanDays).toBe(12);
    expect(s.progress).toBe(67);
    expect(s.tasks).toBe(2);
    expect(s.milestones).toBe(1);
    expect(s.critical).toBe(1);
    expect(s.done).toBe(1);
    expect(s.late).toBe(2);
  });
});

describe('keyboard commands (F11)', () => {
  it('maps the shortcuts', () => {
    expect(keyCommandOf({ key: 'ArrowRight', altKey: true, shiftKey: true })).toBe('indent');
    expect(keyCommandOf({ key: 'ArrowLeft', altKey: true, shiftKey: true })).toBe('outdent');
    expect(keyCommandOf({ key: 'ArrowUp', altKey: true, shiftKey: true })).toBe('moveUp');
    expect(keyCommandOf({ key: 'F2', ctrlKey: true })).toBe('link');
    expect(keyCommandOf({ key: 'F2', ctrlKey: true, shiftKey: true })).toBe('unlink');
    expect(keyCommandOf({ key: 'f', metaKey: true })).toBe('find');
    expect(keyCommandOf({ key: 'g', ctrlKey: true })).toBe('goTo');
  });
  it('plain keys and other combinations are not commands', () => {
    expect(keyCommandOf({ key: 'ArrowRight' })).toBeNull();
    expect(keyCommandOf({ key: 'f' })).toBeNull();
    expect(keyCommandOf({ key: 'f', ctrlKey: true, shiftKey: true })).toBeNull();
  });
});

describe('external predecessors (B5)', () => {
  it('lists each external task once, lower case, sorted', () => {
    const t = (guids: string[]) => ({ rowJSON: { externalPredecessors: guids.map((g) => ({ taskGUID: g })) } });
    expect(externalGuidsOf([t(['B', 'a']), t(['A']), { rowJSON: {} }, { rowJSON: null }])).toEqual(['a', 'b']);
  });
});
