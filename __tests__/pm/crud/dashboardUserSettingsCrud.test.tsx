/** @jest-environment jsdom */
// The last state of the project dashboard per user, project AND work place, end-to-end: usePMCrud -> React Query -> in-memory Supabase -> Zustand.
// The harness gives the user the work place 'test-work-place'.
import { mockApprove, mountPM, PMHarness, unmountPM } from './pmCrudHarnessTestKit';
import { act } from 'react';

let h: PMHarness;
const run = async (fn: () => unknown) => {
  await act(async () => { await fn(); });
  await h.settle();
};
const myRows = () => h.db.rows('project_dashboard_user_settings_table').filter((r) => r.rowOwnerGUID === h.P1 && r.rowParentGUID === h.owner);

beforeEach(async () => {
  mockApprove.mockReset();
  mockApprove.mockImplementation(async () => true);
  h = await mountPM();
});
afterEach(unmountPM);

describe('work place + tasksTreeWidth + tableColumnsWidth', () => {
  it('a save goes to the row of THIS work place (the key is project, user, work place)', async () => {
    await run(() => h.crud.setTasksTreeWidth(455.4));
    expect(myRows()).toHaveLength(1);
    expect(myRows()[0]).toMatchObject({ userWorkPlaceGUID: 'test-work-place', rowJSON: { uxuiSettings: { tasksTreeWidth: 455 } } });
    expect(h.store().treeWidth).toBe(455);
    const upsert = h.db.calls.filter((c) => c.table === 'project_dashboard_user_settings_table' && c.op === 'upsert').pop() as any;
    expect(upsert.payload[0].userWorkPlaceGUID).toBe('test-work-place');
  });

  it('a second work place keeps its own width; this one starts with the row of the work place "empty"', async () => {
    h.db.seed('project_dashboard_user_settings_table', [
      { rowGUID: 'old', rowOwnerGUID: h.P1, rowParentGUID: h.owner, orderInList: 0, rowJSON: { uxuiSettings: { tasksTreeWidth: 520, showCriticalPath: false } } },
      { rowGUID: 'other', rowOwnerGUID: h.P1, rowParentGUID: h.owner, userWorkPlaceGUID: 'another-device', orderInList: 0, rowJSON: { uxuiSettings: { tasksTreeWidth: 250 } } },
    ]);
    await run(() => h.qc.invalidateQueries());
    // the row of the work place 'empty' is the starting value (not the other device)
    expect(h.store().userSettingsByProject[h.P1]).toMatchObject({ tasksTreeWidth: 520, showCriticalPath: false });
    await run(() => h.crud.setTasksTreeWidth(430));
    expect(h.db.rows('project_dashboard_user_settings_table').map((r) => `${r.userWorkPlaceGUID ?? 'empty'}:${r.rowJSON.uxuiSettings.tasksTreeWidth}`).sort()).toEqual(['another-device:250', 'empty:520', 'test-work-place:430']);
  });

  it('setTableColumnsWidth keeps the widths of ONE table; the other tables stay', async () => {
    await run(() => h.crud.setTableColumnsWidth('taskLines.timeGenus', { qty: 90.2, unit: 70 })); // saved as whole pixels
    await run(() => h.crud.setTableColumnsWidth('taskLines.materialGenus', { qty: 110 }));
    const u = myRows()[0].rowJSON.uxuiSettings;
    expect(u.tableColumnsWidth).toEqual({ 'taskLines.timeGenus': { qty: 90, unit: 70 }, 'taskLines.materialGenus': { qty: 110 } });
    await run(() => h.crud.setTableColumnsWidth('taskLines.timeGenus', { qty: 95 }));
    expect(myRows()[0].rowJSON.uxuiSettings.tableColumnsWidth).toEqual({ 'taskLines.timeGenus': { qty: 95 }, 'taskLines.materialGenus': { qty: 110 } });
    expect(h.store().userSettingsByProject[h.P1]?.tableColumnsWidth?.['taskLines.timeGenus']).toEqual({ qty: 95 });
  });

  it('a non positive width saves nothing', async () => {
    await run(() => h.crud.setTasksTreeWidth(0));
    await run(() => h.crud.setTasksTreeWidth(NaN));
    expect(myRows()).toHaveLength(0);
  });
});
