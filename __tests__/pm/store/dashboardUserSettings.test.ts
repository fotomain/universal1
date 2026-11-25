// The new keys of the last state of the project dashboard (project_dashboard_user_settings_table.rowJSON.uxuiSettings): the width of the task tree + the widths of the table columns.
import { normalizeTableColumnsWidth, uxuiSettingsOf } from '../../../kit8/pm/model/types';
import { viewSettingsOf } from '../../../kit8/pm/store/storeDerive';
import { PM_TREE_MAX_WIDTH, PM_TREE_MIN_WIDTH } from '../../../kit8/pm/model/constants';
import { pickWorkPlaceRows, NO_WORK_PLACE } from '../../../kit8/pm/crud/api/projectUserSettingsApi';

const proj: any = { rowJSON: { name: 'P' } };

test('tasksTreeWidth: a positive number is kept (rounded), anything else = null (the default width)', () => {
  expect(uxuiSettingsOf(null, { tasksTreeWidth: 412.6 }).tasksTreeWidth).toBe(413);
  for (const bad of [0, -5, NaN, '300', null, undefined]) expect(uxuiSettingsOf(null, { tasksTreeWidth: bad as any }).tasksTreeWidth).toBeNull();
});

test('the store gets the saved width of the tree (clamped); no saved width = the store keeps its own', () => {
  expect(viewSettingsOf(proj, { tasksTreeWidth: 450 })).toMatchObject({ treeWidth: 450 });
  expect((viewSettingsOf(proj, { tasksTreeWidth: 10 }) as any).treeWidth).toBe(PM_TREE_MIN_WIDTH);
  expect((viewSettingsOf(proj, { tasksTreeWidth: 9999 }) as any).treeWidth).toBe(PM_TREE_MAX_WIDTH);
  expect('treeWidth' in viewSettingsOf(proj, {})).toBe(false);
});

test('tableColumnsWidth: { table: { column: px } }, only positive numbers', () => {
  expect(normalizeTableColumnsWidth({ 'taskLines.timeGenus': { qty: 80.4, bad: 0, worse: 'x' }, empty: {}, notAnObject: 3 })).toEqual({ 'taskLines.timeGenus': { qty: 80 } });
  expect(uxuiSettingsOf(null, { tableColumnsWidth: { t: { a: 90 } } }).tableColumnsWidth).toEqual({ t: { a: 90 } });
  expect(uxuiSettingsOf(null, {}).tableColumnsWidth).toEqual({});
});

test('one row per project: the row of the work place wins over the row of "empty"', () => {
  const r = (project: string, wp: string, w: number): any => ({ rowGUID: `${project}-${wp}`, rowOwnerGUID: project, rowParentGUID: 'u', userWorkPlaceGUID: wp, orderInList: 0, rowJSON: { uxuiSettings: { tasksTreeWidth: w } } });
  const rows = pickWorkPlaceRows([r('p1', NO_WORK_PLACE, 1), r('p1', 'wp', 2), r('p2', NO_WORK_PLACE, 3), r('p3', 'wp', 4)], 'wp');
  expect(Object.fromEntries(rows.map((x) => [x.rowOwnerGUID, x.rowJSON.uxuiSettings?.tasksTreeWidth]))).toEqual({ p1: 2, p2: 3, p3: 4 });
  // the order of the rows does not matter
  const reversed = pickWorkPlaceRows([r('p1', 'wp', 2), r('p1', NO_WORK_PLACE, 1)], 'wp');
  expect(reversed.map((x) => x.rowJSON.uxuiSettings?.tasksTreeWidth)).toEqual([2]);
});
