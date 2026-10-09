/** @jest-environment jsdom */
// usePMCrud: every PM CRUD command end-to-end (command -> React Query mutation -> Supabase
// -> refetch -> Zustand store), against the in-memory database of fakeSupabaseTestKit.
import { mockApprove, mockRouter, mountPM, PMHarness, unmountPM } from './pmCrudHarnessTestKit';
import { act } from 'react';
import { DAY_MS } from '../../../kit8/pm/model/constants';

let h: PMHarness;
const run = async (fn: () => unknown) => {
  let out: unknown;
  await act(async () => {
    out = await fn();
  });
  await h.settle();
  return out;
};
const dbTask = (name: string) => h.db.rows('project_task_table').find((t) => t.rowJSON.name === name)!;
const dbDeps = () => h.db.rows('project_task_dependencies_table').filter((d) => d.projectGUID === h.P1);
const hasDep = (pred: string, succ: string) => dbDeps().some((d) => d.rowGUID === h.byName(succ).rowGUID && d.rowDependsOnGUID === h.byName(pred).rowGUID);
const g = (name: string) => h.byName(name).rowGUID as string;

beforeEach(async () => {
  mockApprove.mockReset();
  mockApprove.mockImplementation(async () => true);
  mockRouter.push.mockReset();
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  h = await mountPM();
});
afterEach(unmountPM);

describe('load', () => {
  it('fetches the project and hydrates the store (tree, schedule, deps)', () => {
    const s = h.store();
    expect(h.childrenOf(null)).toEqual(['Stage 1', 'Stage 2']);
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'Task 112', 'Task 113']);
    expect(s.deps).toHaveLength(4);
    expect(s.schedule[g('Task 113')].startMs).toBeGreaterThanOrEqual(s.schedule[g('Task 112')].finishMs);
    expect(Object.keys(h.store().projectsById)).toEqual(expect.arrayContaining([h.P1, h.P2]));
  });
});

describe('create: stages / tasks / milestones', () => {
  it('createStage() appends "New stage" at the root and selects it', async () => {
    const guid = (await run(() => h.crud.createStage())) as string;
    expect(h.db.task(guid)).toMatchObject({ rowJSON: { rowKind: 'stage', name: 'New stage', durationDays: 0 }, projectGUID: h.P1, rowOwnerGUID: h.owner });
    expect(h.childrenOf(null)).toEqual(['Stage 1', 'Stage 2', 'New stage']);
    expect(h.store().selectedGUID).toBe(guid);
  });

  it('createStage(row) inserts the stage right after the row\'s top-level stage', async () => {
    await run(() => h.crud.createStage(g('Task 112')));
    expect(h.childrenOf(null)).toEqual(['Stage 1', 'New stage', 'Stage 2']);
  });

  it('createTask(stage) -> last child; createTask(task) -> sibling below; createTask(null, milestone) -> root', async () => {
    await run(() => h.crud.createTask(g('Stage 2')));
    expect(h.childrenOf(g('Stage 2'))).toEqual(['Task 121', 'Task 122', 'Task 123', 'New task']);

    const m = (await run(() => h.crud.createTask(g('Task 111'), 'milestone'))) as string;
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'New milestone', 'Task 112', 'Task 113']);
    expect(h.db.task(m)!.rowJSON).toEqual({ rowKind: 'milestone', name: 'New milestone', durationDays: 0 });
    expect(h.db.task(m)!.treePath.startsWith(`${dbTask('Stage 1').treePath}.`)).toBe(true);

    await run(() => h.crud.createTask(null));
    expect(h.childrenOf(null)).toEqual(['Stage 1', 'Stage 2', 'New task']);
  });

  it('hover panel: add task below / above the row', async () => {
    await run(() => h.crud.createTaskBelow(g('Task 111')));
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'New task', 'Task 112', 'Task 113']);
    await run(() => h.crud.createTaskAbove(g('Task 111')));
    expect(h.childrenOf(g('Stage 1'))).toEqual(['New task', 'Task 111', 'New task', 'Task 112', 'Task 113']);
    expect(await run(() => h.crud.createTaskBelow('missing'))).toBeNull();
  });

  it('duplicate task: copy right below the original, same fields, selected, one undo step', async () => {
    await run(() => h.crud.setProgress(g('Task 111'), 30));
    const copy = (await run(() => h.crud.duplicateTask(g('Task 111')))) as string;
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'Task 111 (copy)', 'Task 112', 'Task 113']);
    const orig = dbTask('Task 111');
    const dup = h.db.task(copy)!;
    const { name: _n1, startAt: _s1, ...origJSON } = orig.rowJSON;
    const { name: _n2, startAt: _s2, ...dupJSON } = dup.rowJSON;
    expect(dupJSON).toEqual(origJSON);
    expect(dup).toMatchObject({ rowProgress: 30, projectGUID: h.P1, rowOwnerGUID: h.owner });
    expect(dup.treePath.startsWith(`${dbTask('Stage 1').treePath}.`)).toBe(true);
    expect(dbDeps().some((d) => d.rowGUID === copy || d.rowDependsOnGUID === copy)).toBe(false); // links are not copied
    expect(h.store().selectedGUID).toBe(copy);
    await h.until(() => h.store().undoLabel === 'Duplicate "Task 111"', 'undo label');
    expect(await run(() => h.crud.duplicateTask('missing'))).toBeNull();
  });

  it('duplicate the last row: copy becomes the last sibling', async () => {
    await run(() => h.crud.duplicateTask(g('Task 113')));
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'Task 112', 'Task 113', 'Task 113 (copy)']);
  });

  it('duplicate stage: copies the whole subtree right below the stage', async () => {
    const copy = (await run(() => h.crud.duplicateTask(g('Stage 1')))) as string;
    expect(h.childrenOf(null)).toEqual(['Stage 1', 'Stage 1 (copy)', 'Stage 2']);
    expect(h.childrenOf(copy)).toEqual(['Task 111', 'Task 112', 'Task 113']);
    const copyPath = h.db.task(copy)!.treePath;
    const kids = h.db.rows('project_task_table').filter((t) => t.treePath.startsWith(`${copyPath}.`));
    expect(kids).toHaveLength(3);
    expect(h.store().tasks.length).toBe(12);
  });

  it('a failed insert rolls the optimistic row back and shows the error', async () => {
    h.db.failNext('pm_gantt: parent row does not exist', { table: 'project_task_table', op: 'insert' });
    await run(() => h.crud.createTask(g('Stage 1')));
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'Task 112', 'Task 113']);
    expect(h.store().lastError).toBe('parent row does not exist');
  });
});

describe('update: edit / inline cells / chart drags', () => {
  it('updateTask saves the task edit dialog patch', async () => {
    const t = h.byName('Task 111');
    await run(() => h.crud.updateTask(t.rowGUID, { rowProgress: 30, rowJSON: { ...t.rowJSON, name: 'Design', notes: 'n', taskColor: '#22c55e' } }, 'Edit'));
    expect(h.db.task(t.rowGUID)).toMatchObject({ rowProgress: 30, rowJSON: { name: 'Design', notes: 'n', taskColor: '#22c55e' } });
    expect(h.store().tasksById[t.rowGUID].rowJSON.name).toBe('Design');
  });

  it('setProgress clamps to 0..100 and skips no-op writes', async () => {
    await run(() => h.crud.setProgress(g('Task 111'), 150));
    expect(dbTask('Task 111').rowProgress).toBe(100);
    const writes = h.db.calls.filter((c) => c.op === 'update').length;
    await run(() => h.crud.setProgress(g('Task 111'), 100));
    expect(h.db.calls.filter((c) => c.op === 'update').length).toBe(writes);
  });

  it('setDurationDays: tasks only (stages roll up, milestones stay 0), at least 1 day', async () => {
    await run(() => h.crud.setDurationDays(g('Task 112'), 0.2));
    expect(dbTask('Task 112').rowJSON.durationDays).toBe(1);
    await run(() => h.crud.setDurationDays(g('Task 112'), 9));
    expect(dbTask('Task 112').rowJSON.durationDays).toBe(9);
    const before = JSON.stringify(dbTask('Stage 1'));
    await run(() => h.crud.setDurationDays(g('Stage 1'), 4));
    expect(JSON.stringify(dbTask('Stage 1'))).toBe(before);
  });

  it('setStartConstraint sets / clears "start no earlier than"', async () => {
    const ms = Date.UTC(2026, 9, 12);
    await run(() => h.crud.setStartConstraint(g('Task 111'), ms));
    expect(dbTask('Task 111').rowJSON.manualStartAt).toBe(new Date(ms).toISOString());
    expect(h.store().schedule[g('Task 111')].startMs).toBe(ms);
    await run(() => h.crud.setStartConstraint(g('Task 111'), null));
    expect(dbTask('Task 111').rowJSON.manualStartAt).toBeNull();
  });

  it('applyBarEdit: move shifts the start, resize-end stretches the duration', async () => {
    const r = h.store().schedule[g('Task 111')];
    await run(() => h.crud.applyBarEdit(g('Task 111'), 'move', 2));
    expect(dbTask('Task 111').rowJSON.manualStartAt).toBe(new Date(r.startMs + 2 * DAY_MS).toISOString());
    await run(() => h.crud.applyBarEdit(g('Task 112'), 'resize-end', 2));
    expect(dbTask('Task 112').rowJSON.durationDays).toBe(7);
    const stage = JSON.stringify(dbTask('Stage 1'));
    await run(() => h.crud.applyBarEdit(g('Stage 1'), 'move', 3)); // summaries are rolled up
    expect(JSON.stringify(dbTask('Stage 1'))).toBe(stage);
  });

  it('a failed update rolls back to the server value', async () => {
    h.db.failNext('permission denied', { table: 'project_task_table', op: 'update' });
    await run(() => h.crud.setProgress(g('Task 111'), 50));
    expect(h.store().tasksById[g('Task 111')].rowProgress).toBe(0);
    expect(h.store().lastError).toBe('permission denied');
  });
});

describe('reorder / re-parent', () => {
  it('moveBy up / down swaps siblings (ends are no-ops)', async () => {
    await run(() => h.crud.moveBy(g('Task 112'), -1));
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 112', 'Task 111', 'Task 113']);
    await run(() => h.crud.moveBy(g('Task 112'), 1));
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'Task 112', 'Task 113']);
    const n = h.db.calls.length;
    await run(() => h.crud.moveBy(g('Task 113'), 1));
    await run(() => h.crud.moveBy(g('Task 111'), -1));
    expect(h.db.calls.filter((c) => c.op !== 'select').length).toBe(h.db.calls.slice(0, n).filter((c) => c.op !== 'select').length);
  });

  it('indent makes the row the last child of the previous sibling; outdent moves it back after its parent', async () => {
    await run(() => h.crud.indent(g('Task 112')));
    expect(h.childrenOf(g('Task 111'))).toEqual(['Task 112']);
    expect(dbTask('Task 112').treePath).toBe(`${dbTask('Task 111').treePath}.${g('Task 112').replace(/-/g, '_')}`);
    expect(h.store().schedule[g('Task 111')].isSummary).toBe(true);

    await run(() => h.crud.outdent(g('Task 112')));
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'Task 112', 'Task 113']);
    expect(dbTask('Task 112').treePath).toBe(`${dbTask('Stage 1').treePath}.${g('Task 112').replace(/-/g, '_')}`);
  });

  it('indent of a first child and outdent of a top-level row do nothing', async () => {
    await run(() => h.crud.indent(g('Task 111')));
    await run(() => h.crud.outdent(g('Stage 1')));
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 111', 'Task 112', 'Task 113']);
    expect(h.childrenOf(null)).toEqual(['Stage 1', 'Stage 2']);
  });

  it('dropRow moves a task into another stage (drag & drop in the tree)', async () => {
    const rows = h.store().visibleRows;
    const from = rows.indexOf(g('Task 111'));
    const slot = rows.indexOf(g('Task 122')); // gap right above Task 122
    await run(() => h.crud.dropRow(from, slot));
    expect(h.childrenOf(g('Stage 2'))).toEqual(['Task 121', 'Task 111', 'Task 122', 'Task 123']);
    expect(dbTask('Task 111').treePath.startsWith(`${dbTask('Stage 2').treePath}.`)).toBe(true);
    expect(hasDep('Task 111', 'Task 113')).toBe(true); // dependencies survive the move
  });
});

describe('sql_for_delete (asks first)', () => {
  it('No keeps the task', async () => {
    mockApprove.mockImplementation(async () => false);
    await run(() => h.crud.deleteTask(g('Task 111')));
    expect(mockApprove).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete task "Task 111"?', destructive: true, yesLabel: 'Delete' }));
    expect(dbTask('Task 111')).toBeDefined();
  });

  it('Yes deletes the task and its dependencies', async () => {
    await run(() => h.crud.deleteTask(g('Task 111')));
    expect(h.db.rows('project_task_table').some((t) => t.rowJSON.name === 'Task 111')).toBe(false);
    expect(dbDeps()).toHaveLength(3);
    expect(h.childrenOf(g('Stage 1'))).toEqual(['Task 112', 'Task 113']);
  });

  it('deleting a stage deletes everything inside it (question names the row count)', async () => {
    await run(() => h.crud.deleteTask(g('Stage 1')));
    expect(mockApprove.mock.calls[0][0]).toMatchObject({ title: 'Delete stage "Stage 1"?', message: expect.stringContaining('The 3 row(s) inside it') });
    expect(h.childrenOf(null)).toEqual(['Stage 2']);
    expect(h.store().tasks).toHaveLength(4);
    expect(dbDeps()).toHaveLength(2);
  });
});

describe('dependencies', () => {
  it('link creates pred -> succ (FS / lag) and leaves link mode', async () => {
    act(() => h.crud.startLink(g('Task 111')));
    expect(h.store().linkSourceGUID).toBe(g('Task 111'));
    const ok = await run(() => h.crud.link(g('Task 111'), g('Task 121'), 'SS', 2));
    expect(ok).toBe(true);
    expect(h.store().linkSourceGUID).toBeNull();
    expect(dbDeps().find((d) => d.rowGUID === g('Task 121'))).toMatchObject({ rowDependsOnGUID: g('Task 111'), linkType: 'SS', lagDays: 2 });
    expect(h.store().schedule[g('Task 121')].startMs).toBeGreaterThanOrEqual(h.store().schedule[g('Task 111')].startMs + 2 * DAY_MS);
  });

  it('rejects self links, cycles and stage->own task; the error explains why', async () => {
    const calls = () => h.db.calls.filter((c) => c.op === 'insert').length;
    const n = calls();
    expect(await run(() => h.crud.link(g('Task 111'), g('Task 111')))).toBe(false);
    expect(await run(() => h.crud.link(g('Task 113'), g('Task 111')))).toBe(false);
    expect(h.store().lastError).toContain('cycle');
    expect(await run(() => h.crud.link(g('Stage 1'), g('Task 111')))).toBe(false);
    expect(calls()).toBe(n);
  });

  it('linking an existing pair again: same type -> error + highlight, other type -> changes the type', async () => {
    expect(await run(() => h.crud.link(g('Task 111'), g('Task 113'), 'FS'))).toBe(false);
    expect(h.store().lastError).toContain('already waits for');
    expect(h.store().selectedGUID).toBe(g('Task 113'));
    expect(await run(() => h.crud.link(g('Task 111'), g('Task 113'), 'FF'))).toBe(true);
    expect(dbDeps().find((d) => d.rowGUID === g('Task 113') && d.rowDependsOnGUID === g('Task 111'))!.linkType).toBe('FF');
  });

  it('updateDependency / updateDependencyColor (null = default)', async () => {
    const ref = { rowGUID: g('Task 113'), dependsOnGUID: g('Task 112') };
    const find = () => dbDeps().find((d) => d.rowGUID === ref.rowGUID && d.rowDependsOnGUID === ref.dependsOnGUID)!;
    await run(() => h.crud.updateDependency(ref, { linkType: 'SF', lagDays: -1 }));
    expect(find()).toMatchObject({ linkType: 'SF', lagDays: -1 });
    await run(() => h.crud.updateDependencyColor(ref, '#ef4444'));
    expect(find().rowJSON.dependencyColor).toBe('#ef4444');
    await run(() => h.crud.updateDependencyColor(ref, null));
    expect(find().rowJSON.dependencyColor).toBeNull();
  });

  it('menu + editor state: open / close', () => {
    const ref = { rowGUID: g('Task 113'), dependsOnGUID: g('Task 112') };
    act(() => h.crud.openDependencyMenu(ref, 10, 20));
    expect(h.store().depMenu).toEqual({ ...ref, x: 10, y: 20 });
    act(() => h.crud.closeDependencyMenu());
    expect(h.store().depMenu).toBeNull();
    act(() => h.crud.openDependencyEditor(ref));
    expect(h.store().editingDep).toEqual(ref);
  });

  it('deleteDependency asks; No returns to the editor, Yes deletes the edge only', async () => {
    const ref = { rowGUID: g('Task 113'), dependsOnGUID: g('Task 111') };
    act(() => h.crud.openDependencyEditor(ref));
    mockApprove.mockImplementationOnce(async () => false);
    await run(() => h.crud.deleteDependency(ref));
    expect(hasDep('Task 111', 'Task 113')).toBe(true);
    expect(h.store().editingDep).toEqual(ref);

    await run(() => h.crud.deleteDependency(ref));
    expect(mockApprove.mock.calls[1][0]).toMatchObject({ title: 'Delete this dependency?', icon: 'link_off' });
    expect(hasDep('Task 111', 'Task 113')).toBe(false);
    expect(h.store().editingDep).toBeNull();
    expect(dbTask('Task 111')).toBeDefined();
    expect(dbTask('Task 113')).toBeDefined();
  });

  it('unlink(pred, succ) is deleteDependency', async () => {
    await run(() => h.crud.unlink(g('Task 122'), g('Task 123')));
    expect(hasDep('Task 122', 'Task 123')).toBe(false);
  });
});

describe('navigation / UI state commands', () => {
  it('edit, openInfo, startLink / cancelLink', () => {
    act(() => h.crud.edit(g('Task 111')));
    expect(h.store().editingGUID).toBe(g('Task 111'));
    act(() => h.crud.openInfo(g('Task 111')));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pm/project/task', params: { taskGUID: g('Task 111'), projectGUID: h.P1 } });
    act(() => h.crud.startLink(g('Task 112')));
    act(() => h.crud.cancelLink());
    expect(h.store().linkSourceGUID).toBeNull();
  });
});

describe('Gantt view settings (project_user_settings_table: one row per project and user)', () => {
  const userRow = (projectGUID = h.P1) => h.db.rows('project_user_settings_table').find((r) => r.rowOwnerGUID === projectGUID && r.rowParentGUID === h.owner);
  const uxui = () => userRow()!.rowJSON.uxuiSettings;

  it('toggles and setters persist in the user row and reach the store', async () => {
    const critical = h.store().showCriticalPath;
    await run(() => h.crud.toggleCriticalPath());
    expect(userRow()).toMatchObject({ rowOwnerGUID: h.P1, rowParentGUID: h.owner }); // project + user (defTable pattern)
    expect(uxui().showCriticalPath).toBe(!critical);
    expect(h.store().showCriticalPath).toBe(!critical);

    await run(() => h.crud.toggleTaskProgressOnGantt());
    expect(uxui().showTaskProgressOnGantt).toBe(true);

    await run(() => h.crud.setGanttArrowsForm('squareForm'));
    await run(() => h.crud.setTaskProgressLinePosition('onBottom'));
    await run(() => h.crud.setProjectProgressLinePosition('atTheMiddle'));
    expect(uxui()).toMatchObject({ ganttArrowsForm: 'squareForm', taskProgressLinePosition: 'onBottom', projectProgressLinePosition: 'atTheMiddle', showCriticalPath: !critical });
    // one row per (project, user) - saving again updates it; the project row is not touched
    expect(h.db.rows('project_user_settings_table').filter((r) => r.rowOwnerGUID === h.P1)).toHaveLength(1);
    expect(h.db.rows('project_table').find((p) => p.rowGUID === h.P1)!.rowJSON.uxuiSettings).toBeUndefined();
    expect(h.db.calls.some((c) => c.table === 'project_table' && c.op === 'update')).toBe(false);
  });

  it('the main view (Finances ...) is saved in the user row of THAT project; each project opens in the view it was left in', async () => {
    await run(() => h.crud.setGanttVsNetworkView('showFinancesView'));
    expect(uxui().ganttVsNetworkView).toBe('showFinancesView');
    expect(h.store().ganttVsNetworkView).toBe('showFinancesView');
    expect(userRow(h.P2)).toBeUndefined(); // Project 2 was not touched

    await act(async () => h.store().selectProject(h.P2)); // never customized: the default view, not the one of Project 1
    await h.settle();
    expect(h.store().ganttVsNetworkView).toBe('showGanttChart');
    await run(() => h.crud.setGanttVsNetworkView('showKanbanView'));
    expect(userRow(h.P2)!.rowJSON.uxuiSettings.ganttVsNetworkView).toBe('showKanbanView');
    expect(uxui().ganttVsNetworkView).toBe('showFinancesView'); // Project 1 keeps its own

    await act(async () => h.store().selectProject(h.P1));
    await h.settle();
    expect(h.store().ganttVsNetworkView).toBe('showFinancesView');
    await act(async () => h.store().selectProject(h.P2));
    await h.settle();
    expect(h.store().ganttVsNetworkView).toBe('showKanbanView');
  });

  it('a reload opens the project in the saved main view (the rows are read from the database)', async () => {
    unmountPM();
    h = await mountPM({
      seed: (db, demo) => {
        const P1 = demo.projects[0].rowGUID;
        const owner = demo.projects[0].rowOwnerGUID;
        db.seed('project_user_settings_table', [{ rowGUID: 'a0000000-0000-4000-8000-000000000003', rowOwnerGUID: P1, rowParentGUID: owner, orderInList: 0, rowJSON: { uxuiSettings: { ganttVsNetworkView: 'showFinancesView' } } }]);
      },
    });
    await h.until(() => h.store().ganttVsNetworkView === 'showFinancesView', 'saved main view applied');
  });

  it('criticalPathTaskColor is saved in the user row and reaches the store', async () => {
    await run(() => h.crud.setGanttViewSettings({ criticalPathTaskColor: '#00F0FF' }));
    expect(uxui().criticalPathTaskColor).toBe('#00F0FF');
    expect(h.store().criticalPathTaskColor).toBe('#00F0FF');
  });

  it('setGanttViewSettings merges the draft of the ⚙ window', async () => {
    await run(() => h.crud.setGanttViewSettings({ taskProgressLineColor: '#22c55e', projectProgressLineColor: '#ef4444' }));
    expect(uxui()).toMatchObject({ taskProgressLineColor: '#22c55e', projectProgressLineColor: '#ef4444', ganttArrowsForm: 'smoothForm' });
  });

  it('settings are per user: only rows of the signed-in user are read', async () => {
    unmountPM();
    h = await mountPM({
      seed: (db, demo) => {
        const P1 = demo.projects[0].rowGUID;
        const owner = demo.projects[0].rowOwnerGUID;
        db.seed('project_user_settings_table', [
          { rowGUID: 'a0000000-0000-4000-8000-000000000001', rowOwnerGUID: P1, rowParentGUID: owner, orderInList: 0, rowJSON: { uxuiSettings: { ganttArrowsForm: 'squareForm', projectTreeContextCommandsMode: 'onRightClickMenuMode' } } },
          { rowGUID: 'a0000000-0000-4000-8000-000000000002', rowOwnerGUID: P1, rowParentGUID: '22222222-2222-4222-8222-222222222222', orderInList: 0, rowJSON: { uxuiSettings: { showCriticalPath: false } } },
        ]);
      },
    });
    await h.until(() => h.store().linkLineForm === 'squareForm', 'user settings applied');
    expect(h.store().projectTreeContextCommandsMode).toBe('onRightClickMenuMode');
    expect(h.store().showCriticalPath).toBe(true); // the other user's row is not ours
    expect(h.db.calls.find((c) => c.table === 'project_user_settings_table' && c.op === 'select')!.filters).toEqual([['eq', 'rowParentGUID', h.owner]]);
  });
});

describe('legacy view settings (project_table.rowJSON)', () => {
  it('old per-project settings are the defaults; saving writes the full user row, the project row stays', async () => {
    unmountPM();
    h = await mountPM({
      seed: (db) => {
        const p = db.rows('project_table')[0];
        p.rowJSON = { ...p.rowJSON, showCriticalPath: false, ganttArrowsForm: 'squareForm', uxuiSettings: { showTaskProgressOnGantt: true } };
      },
    });
    expect(h.store().showCriticalPath).toBe(false);
    expect(h.store().showTaskProgressOnGantt).toBe(true);
    await run(() => h.crud.setTaskProgressLinePosition('onBottom'));
    const row = h.db.rows('project_user_settings_table').find((r) => r.rowOwnerGUID === h.P1)!;
    expect(row.rowJSON.uxuiSettings).toMatchObject({ showCriticalPath: false, ganttArrowsForm: 'squareForm', showTaskProgressOnGantt: true, taskProgressLinePosition: 'onBottom' });
    expect(h.db.rows('project_table').find((p) => p.rowGUID === h.P1)!.rowJSON).toMatchObject({ showCriticalPath: false, uxuiSettings: { showTaskProgressOnGantt: true } });
  });

  it('table not created yet (SQL upgrade not run): saves fall back to project_table.rowJSON.uxuiSettings', async () => {
    unmountPM();
    h = await mountPM({ seed: (db) => void delete db.tables.project_user_settings_table });
    await h.until(() => h.store().userSettingsTableMissing, 'missing table detected');
    await run(() => h.crud.setGanttArrowsForm('squareForm'));
    expect(h.store().linkLineForm).toBe('squareForm');
    await h.until(() => h.db.rows('project_table').find((p) => p.rowGUID === h.P1)!.rowJSON.uxuiSettings?.ganttArrowsForm === 'squareForm', 'legacy save');
    expect(h.store().lastError).toBeNull();
  });
});

describe('undo (undoGanttAction)', () => {
  const snapshot = () =>
    JSON.stringify({
      tasks: h.db.rows('project_task_table').filter((t) => t.projectGUID === h.P1).map(({ rowGUID, treePath, orderInList, rowProgress, rowJSON }) => ({ rowGUID, treePath, orderInList, rowProgress, name: rowJSON.name, d: rowJSON.durationDays, s: rowJSON.manualStartAt ?? null })).sort((a, b) => a.rowGUID.localeCompare(b.rowGUID)),
      deps: dbDeps().map((d) => `${d.rowDependsOnGUID}>${d.rowGUID}:${d.linkType}:${d.lagDays}`).sort(),
    });

  it('every command records one step; the Undo count follows', async () => {
    expect(h.store().undoCount).toBe(0);
    await run(() => h.crud.setProgress(g('Task 111'), 10));
    await run(() => h.crud.createTaskBelow(g('Task 111')));
    await h.until(() => h.store().undoCount === 2, 'undo count 2');
    expect(h.store().undoLabel).toBe('Add task');
  });

  it('asks first; No keeps the change', async () => {
    await run(() => h.crud.setProgress(g('Task 111'), 10));
    await h.until(() => h.store().undoCount === 1);
    mockApprove.mockImplementationOnce(async () => false);
    await run(() => h.crud.undoGanttAction());
    expect(mockApprove).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Undo the last action?', yesLabel: 'Undo', message: 'Undo: Progress of "Task 111"' }));
    expect(dbTask('Task 111').rowProgress).toBe(10);
  });

  it('with nothing to undo it does not ask', async () => {
    await run(() => h.crud.undoGanttAction());
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it.each([
    ['sql_for_delete task', () => h.crud.deleteTask(g('Task 111'))],
    ['sql_for_delete stage', () => h.crud.deleteTask(g('Stage 1'))],
    ['add task', () => h.crud.createTaskBelow(g('Task 112'))],
    ['duplicate task', () => h.crud.duplicateTask(g('Task 112'))],
    ['duplicate stage', () => h.crud.duplicateTask(g('Stage 1'))],
    ['progress', () => h.crud.setProgress(g('Task 112'), 70)],
    ['duration', () => h.crud.setDurationDays(g('Task 112'), 12)],
    ['start', () => h.crud.setStartConstraint(g('Task 112'), Date.UTC(2026, 10, 2))],
    ['move bar', () => h.crud.applyBarEdit(g('Task 111'), 'move', 3)],
    ['reorder', () => h.crud.moveBy(g('Task 113'), -1)],
    ['indent', () => h.crud.indent(g('Task 113'))],
    ['link', () => h.crud.link(g('Task 111'), g('Task 121'))],
    ['unlink', () => h.crud.deleteDependency({ rowGUID: g('Task 113'), dependsOnGUID: g('Task 111') })],
    ['edit dependency', () => h.crud.updateDependency({ rowGUID: g('Task 113'), dependsOnGUID: g('Task 111') }, { linkType: 'SS', lagDays: 4 })],
  ])('undo restores the database after: %s', async (_name, action) => {
    const before = snapshot();
    await run(action as () => unknown);
    expect(snapshot()).not.toBe(before);
    await h.until(() => h.store().undoCount === 1, 'undo step recorded');
    await run(() => h.crud.undoGanttAction());
    await h.until(() => snapshot() === before && h.store().undoCount === 0, 'database restored');
    expect(h.store().tasks.length).toBe(8);
  });

  it('two actions are undone newest first', async () => {
    const start = snapshot();
    await run(() => h.crud.setProgress(g('Task 111'), 10));
    const mid = snapshot();
    await run(() => h.crud.deleteTask(g('Task 112')));
    await h.until(() => h.store().undoCount === 2);
    await run(() => h.crud.undoGanttAction());
    await h.until(() => snapshot() === mid, 'first undo');
    await run(() => h.crud.undoGanttAction());
    await h.until(() => snapshot() === start, 'second undo');
  });
});

describe('redo (redoGanttAction)', () => {
  const snapshot = () =>
    JSON.stringify({
      tasks: h.db.rows('project_task_table').filter((t) => t.projectGUID === h.P1).map(({ rowGUID, treePath, orderInList, rowProgress, rowJSON }) => ({ rowGUID, treePath, orderInList, rowProgress, name: rowJSON.name, d: rowJSON.durationDays, s: rowJSON.manualStartAt ?? null })).sort((a, b) => a.rowGUID.localeCompare(b.rowGUID)),
      deps: dbDeps().map((d) => `${d.rowDependsOnGUID}>${d.rowGUID}:${d.linkType}:${d.lagDays}`).sort(),
    });

  it('nothing to redo before an undo; redo does nothing then', async () => {
    await run(() => h.crud.setProgress(g('Task 111'), 10));
    await h.until(() => h.store().undoCount === 1);
    expect(h.store().redoCount).toBe(0);
    const s = snapshot();
    await run(() => h.crud.redoGanttAction());
    expect(snapshot()).toBe(s);
  });

  it.each([
    ['progress', () => h.crud.setProgress(g('Task 112'), 70)],
    ['sql_for_delete task', () => h.crud.deleteTask(g('Task 111'))],
    ['sql_for_delete stage', () => h.crud.deleteTask(g('Stage 1'))],
    ['add task', () => h.crud.createTaskBelow(g('Task 112'))],
    ['move bar', () => h.crud.applyBarEdit(g('Task 111'), 'move', 3)],
    ['indent', () => h.crud.indent(g('Task 113'))],
    ['link', () => h.crud.link(g('Task 111'), g('Task 121'))],
    ['unlink', () => h.crud.deleteDependency({ rowGUID: g('Task 113'), dependsOnGUID: g('Task 111') })],
  ])('undo then redo brings the action back: %s', async (_name, action) => {
    const before = snapshot();
    await run(action as () => unknown);
    await h.until(() => h.store().undoCount === 1, 'undo step recorded');
    const after = snapshot();
    expect(after).not.toBe(before);
    await run(() => h.crud.undoGanttAction());
    await h.until(() => snapshot() === before && h.store().undoCount === 0 && h.store().redoCount === 1, 'undone, redo available');
    expect(h.store().redoLabel).toBeTruthy();
    await run(() => h.crud.redoGanttAction());
    await h.until(() => snapshot() === after && h.store().redoCount === 0 && h.store().undoCount === 1, 'redone, undo available again');
    // and it can be undone once more
    await run(() => h.crud.undoGanttAction());
    await h.until(() => snapshot() === before && h.store().redoCount === 1, 'undone again');
  });

  it('several steps: redo follows the order of the undos; redo does not ask', async () => {
    const s0 = snapshot();
    await run(() => h.crud.setProgress(g('Task 111'), 10));
    const s1 = snapshot();
    await run(() => h.crud.deleteTask(g('Task 112')));
    const s2 = snapshot();
    await h.until(() => h.store().undoCount === 2);
    await run(() => h.crud.undoGanttAction());
    await run(() => h.crud.undoGanttAction());
    await h.until(() => snapshot() === s0 && h.store().redoCount === 2, 'both undone');
    mockApprove.mockClear();
    await run(() => h.crud.redoGanttAction());
    await h.until(() => snapshot() === s1 && h.store().redoCount === 1, 'first redo');
    await run(() => h.crud.redoGanttAction());
    await h.until(() => snapshot() === s2 && h.store().redoCount === 0 && h.store().undoCount === 2, 'second redo');
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('a new action after an undo clears the redo history', async () => {
    await run(() => h.crud.setProgress(g('Task 111'), 10));
    await h.until(() => h.store().undoCount === 1);
    await run(() => h.crud.undoGanttAction());
    await h.until(() => h.store().redoCount === 1, 'redo available');
    await run(() => h.crud.setProgress(g('Task 112'), 55));
    await h.until(() => h.store().redoCount === 0 && h.store().undoCount === 1, 'redo cleared');
    const s = snapshot();
    await run(() => h.crud.redoGanttAction());
    expect(snapshot()).toBe(s);
  });
});

describe('clearUndo / clearRedo', () => {
  const steps = async () => {
    await run(() => h.crud.setProgress(g('Task 111'), 10));
    await run(() => h.crud.setProgress(g('Task 112'), 20));
    await run(() => h.crud.setProgress(g('Task 113'), 30));
    await h.until(() => h.store().undoCount === 3, '3 undo steps');
    await run(() => h.crud.undoGanttAction());
    await h.until(() => h.store().undoCount === 2 && h.store().redoCount === 1, '2 undo + 1 redo');
  };

  it('clearUndo asks, forgets the undo steps only and leaves the data', async () => {
    await steps();
    const p111 = dbTask('Task 111').rowProgress;
    mockApprove.mockImplementationOnce(async () => false);
    await run(() => h.crud.clearUndo());
    expect(mockApprove).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Clear the undo history?', destructive: true }));
    expect(h.store().undoCount).toBe(2); // "No" keeps it
    await run(() => h.crud.clearUndo());
    await h.until(() => h.store().undoCount === 0, 'undo cleared');
    expect(h.store().redoCount).toBe(1);
    expect(dbTask('Task 111').rowProgress).toBe(p111);
    // the redo step still works
    await run(() => h.crud.redoGanttAction());
    await h.until(() => dbTask('Task 113').rowProgress === 30 && h.store().redoCount === 0, 'redo after clearUndo');
  });

  it('clearRedo asks, forgets the redo steps only', async () => {
    await steps();
    await run(() => h.crud.clearRedo());
    expect(mockApprove).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Clear the redo history?' }));
    await h.until(() => h.store().redoCount === 0, 'redo cleared');
    expect(h.store().undoCount).toBe(2);
    expect(dbTask('Task 113').rowProgress).not.toBe(30); // the undone action stays undone
  });

  it('nothing to clear: no question', async () => {
    await run(() => h.crud.clearUndo());
    await run(() => h.crud.clearRedo());
    expect(mockApprove).not.toHaveBeenCalled();
  });
});
