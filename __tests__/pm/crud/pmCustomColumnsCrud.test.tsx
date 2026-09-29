/** @jest-environment jsdom */
// AddCustomProjectTaskColumn + columnResizeWidth end-to-end: usePMCrud -> React Query -> in-memory
// Supabase -> Zustand. Definitions / header colors in project.rowJSON.customColumns, values in
// task.rowJSON.customColumns, order / widths in the user's project_user_settings_table row (rowJSON.uxuiSettings).
import { mockApprove, mountPM, PMHarness, unmountPM } from './pmCrudHarnessTestKit';
import { act } from 'react';

let h: PMHarness;
const run = async (fn: () => unknown) => {
  let out: unknown;
  await act(async () => {
    out = await fn();
  });
  await h.settle();
  return out;
};
const g = (name: string) => h.byName(name).rowGUID as string;
const projectJSON = () => h.db.rows('project_table').find((p) => p.rowGUID === h.P1)!.rowJSON;
/** this user's settings row of Project 1 (project_user_settings_table.rowJSON.uxuiSettings) */
const userUxui = () => h.db.rows('project_user_settings_table').find((r) => r.rowOwnerGUID === h.P1 && r.rowParentGUID === h.owner)!.rowJSON.uxuiSettings;

beforeEach(async () => {
  mockApprove.mockReset();
  mockApprove.mockImplementation(async () => true);
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  h = await mountPM();
});
afterEach(unmountPM);

describe('custom columns', () => {
  it('header menu + name window state', () => {
    act(() => h.crud.openTreeHeaderMenu('name', 10, 20));
    expect(h.store().treeHeaderMenu).toEqual({ x: 10, y: 20, columnKey: 'name' });
    act(() => h.crud.promptAddCustomColumn('float'));
    expect(h.store().customColumnPrompt).toEqual({ type: 'float' });
    expect(h.store().treeHeaderMenu).toBeNull();
    act(() => h.crud.closeCustomColumnPrompt());
    expect(h.store().customColumnPrompt).toBeNull();
  });

  it('addCustomColumn: saved in project.rowJSON.customColumns, appended as the LAST column, revealed', async () => {
    let key: string | null = null;
    await run(() => {
      key = h.crud.addCustomColumn('float', '  Budget ');
    });
    expect(key).toMatch(/^cc_/);
    expect(projectJSON().customColumns.columns).toEqual([expect.objectContaining({ key, name: 'Budget', type: 'float' })]);
    const order = userUxui().treeColumnsOrder;
    expect(order[order.length - 1]).toBe(key);
    expect(h.store().customColumns.map((c) => c.key)).toEqual([key]);
    expect(h.store().treeColumnsOrder[h.store().treeColumnsOrder.length - 1]).toBe(key);
    expect(h.store().treeColumnReveal?.key).toBe(key);

    // a second one goes after it; duplicate names are refused
    let key2: string | null = null;
    await run(() => {
      key2 = h.crud.addCustomColumn('boolean', 'Approved');
    });
    expect(userUxui().treeColumnsOrder.slice(-2)).toEqual([key, key2]);
    expect(h.crud.validateCustomColumnName('budget')).toBe('A column with this name already exists');
    await run(() => {
      expect(h.crud.addCustomColumn('text', 'BUDGET')).toBeNull();
    });
    expect(projectJSON().customColumns.columns).toHaveLength(2);
  });

  it('setCustomColumnValue: task.rowJSON.customColumns, null clears, undoable', async () => {
    let key = '';
    await run(() => {
      key = h.crud.addCustomColumn('integer', 'Points')!;
    });
    const t = g('Task 111');
    await run(() => h.crud.setCustomColumnValue(t, key, 8));
    expect(h.db.task(t)!.rowJSON.customColumns).toEqual({ [key]: 8 });
    expect(h.db.task(t)!.rowJSON.name).toBe('Task 111'); // the rest of rowJSON is kept
    await run(() => h.crud.setCustomColumnValue(g('Stage 1'), key, 21)); // stages have values too
    expect(h.db.task(g('Stage 1'))!.rowJSON.customColumns).toEqual({ [key]: 21 });
    await run(() => h.crud.setCustomColumnValue(t, key, null));
    expect(h.db.task(t)!.rowJSON.customColumns).toEqual({});
    await h.until(() => h.store().undoCount >= 3, 'undo steps');
    expect(h.store().undoLabel).toBe('Points of "Task 111"');
  });

  it('deleteCustomColumn asks, then removes definition, order, width, header color and the values', async () => {
    let key = '';
    await run(() => {
      key = h.crud.addCustomColumn('text', 'Owner')!;
    });
    await run(() => h.crud.setCustomColumnValue(g('Task 111'), key, 'Ann'));
    await run(() => h.crud.setTreeColumnWidth(key as any, 150));
    await run(() => h.crud.setTreeHeaderBackgroundColor(key as any, '#dcfce7'));
    expect(projectJSON().customColumns.headersBackgroundColors).toEqual({ [key]: '#dcfce7' });

    mockApprove.mockImplementationOnce(async () => false);
    await run(() => h.crud.deleteCustomColumn(key));
    expect(projectJSON().customColumns.columns).toHaveLength(1);

    await run(() => h.crud.deleteCustomColumn(key));
    expect(mockApprove).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Delete the column "Owner"?', destructive: true }));
    expect(mockApprove.mock.calls[1][0].message).toMatch(/1 task/);
    const json = projectJSON();
    expect(json.customColumns).toEqual({ columns: [], headersBackgroundColors: {} });
    expect(userUxui().treeColumnsOrder).not.toContain(key);
    expect(userUxui().treeColumnsWidths).not.toHaveProperty(key);
    expect(h.db.task(g('Task 111'))!.rowJSON.customColumns).toEqual({});
    expect(h.store().customColumns).toEqual([]);
  });

  it('renameCustomColumn keeps key, type and values', async () => {
    let key = '';
    await run(() => {
      key = h.crud.addCustomColumn('date', 'Due')!;
    });
    act(() => h.crud.promptRenameCustomColumn(key));
    expect(h.store().customColumnPrompt).toEqual({ type: 'date', key, name: 'Due' });
    await run(() => h.crud.renameCustomColumn(key, 'Deadline'));
    expect(projectJSON().customColumns.columns[0]).toMatchObject({ key, name: 'Deadline', type: 'date' });
    expect(h.store().customColumnPrompt).toBeNull();
  });

  it('header background colors work for built-in columns too (null = default)', async () => {
    await run(() => h.crud.setTreeHeaderBackgroundColor('name', '#fef3c7'));
    expect(projectJSON().customColumns.headersBackgroundColors).toEqual({ name: '#fef3c7' });
    expect(h.store().treeHeadersBackgroundColors).toEqual({ name: '#fef3c7' });
    await run(() => h.crud.setTreeHeaderBackgroundColor('name', null));
    expect(h.store().treeHeadersBackgroundColors).toEqual({});
  });
});

describe('columnResizeWidth', () => {
  it('setTreeColumnWidth / resetTreeColumnWidth persist the user row uxuiSettings.treeColumnsWidths', async () => {
    await run(() => h.crud.setTreeColumnWidth('name', 280.6));
    expect(userUxui().treeColumnsWidths).toEqual({ name: 281 });
    expect(h.store().treeColumnsWidths).toEqual({ name: 281 });
    await run(() => h.crud.setTreeColumnWidth('days', 2)); // clamped
    expect(userUxui().treeColumnsWidths).toEqual({ name: 281, days: 32 });
    await run(() => h.crud.resetTreeColumnWidth('name'));
    expect(userUxui().treeColumnsWidths).toEqual({ days: 32 });
    await run(() => h.crud.resetTreeColumnWidth());
    expect(userUxui().treeColumnsWidths).toEqual({});
  });
});
