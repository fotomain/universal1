/** @jest-environment jsdom */
// Project versions on the real stack: useVersionCommands -> React Query -> versionApi -> in-memory Supabase
// (the RPCs pm_version_save / pm_version_restore / pm_version_set_title are emulated below like the SQL does it).
import { mockApprove, mountPM, PMHarness, unmountPM } from '../../crud/pmCrudHarnessTestKit';
import React, { act } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { UndoGanttStorageContext } from '../../../../kit8/pm/view/undo/undoGanttContext';
import { createWebUndoStorage } from '../../../../kit8/pm/view/undo/undoGanttWebStorage';
import { usePMStore } from '../../../../kit8/pm/store/store_pm';
import { useReadProjectVersionsQuery } from '../../../../kit8/pm/version/crud/version/versionQueries';
import { useVersionCommands, PMVersionCommands } from '../../../../kit8/pm/version/crud/version/useVersionCommands';
import { usePMVersionStore } from '../../../../kit8/pm/version/store/store_version';
import { PM_VERSION_MAX_CHECKED } from '../../../../kit8/pm/version/model/versionTypes';

type Root = { render(node: React.ReactNode): void; unmount(): void };
const { createRoot } = require('react-dom/client') as { createRoot: (container: Element) => Root };

let h: PMHarness;
let root: Root | null = null;
const latest: { c: PMVersionCommands | null } = { c: null };
const c = () => latest.c!;
const vs = () => usePMVersionStore.getState();
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** What kit8/sql/init/done/create_tables.sql section 5b does, on the fake tables. */
function installVersionRpcs(db: any) {
  for (const t of ['version_project_table', 'version_project_task_table', 'version_project_task_dependencies_table']) db.tables[t] = [];
  let seq = 0;
  const original = db.rpc.bind(db);
  const save = (project: string, title: string) => {
    const p = db.tables.project_table.find((x: any) => x.rowGUID === project);
    const guid = `aaaaaaaa-aaaa-4aaa-8aaa-${String(++seq).padStart(12, '0')}`;
    const no = db.tables.version_project_table.filter((v: any) => v.rowGUID === project).length + 1;
    const tasks = db.tables.project_task_table.filter((t: any) => t.projectGUID === project);
    db.tables.version_project_table.push({ ...clone(p), rowVersionGUID: guid, orderInList: no, rowJSON: { ...clone(p.rowJSON), versionTitle: title, versionCreatedAt: '2026-10-02T10:00:00.000Z', versionNumber: no, versionTaskCount: tasks.length } });
    for (const t of tasks) db.tables.version_project_task_table.push({ ...clone(t), rowVersionGUID: guid });
    for (const d of db.tables.project_task_dependencies_table.filter((x: any) => x.projectGUID === project)) db.tables.version_project_task_dependencies_table.push({ ...clone(d), rowVersionGUID: guid });
    return guid;
  };
  db.rpc = async (fn: string, args: any) => {
    if (!fn.startsWith('pm_version_')) return original(fn, args);
    db.rpcCalls.push({ fn, args });
    const failure = db.takeFailure(fn, 'rpc');
    if (failure) return { data: null, error: { message: failure } };
    if (fn === 'pm_version_save') return { data: save(args.p_project, args.p_title), error: null };
    const v = db.tables.version_project_table.find((x: any) => x.rowVersionGUID === args.p_version);
    if (!v) return { data: null, error: { message: 'pm_gantt: version not found' } };
    if (fn === 'pm_version_set_title') {
      v.rowJSON = { ...v.rowJSON, versionTitle: args.p_title };
      return { data: null, error: null };
    }
    const backup = save(v.rowGUID, args.p_backup_title);
    const strip = ({ rowVersionGUID: _g, ...row }: any) => clone(row);
    db.tables.project_task_table = [...db.tables.project_task_table.filter((t: any) => t.projectGUID !== v.rowGUID), ...db.tables.version_project_task_table.filter((t: any) => t.rowVersionGUID === v.rowVersionGUID).map(strip)];
    db.tables.project_task_dependencies_table = [
      ...db.tables.project_task_dependencies_table.filter((d: any) => d.projectGUID !== v.rowGUID),
      ...db.tables.version_project_task_dependencies_table.filter((d: any) => d.rowVersionGUID === v.rowVersionGUID).map(strip),
    ];
    return { data: backup, error: null };
  };
}

async function mount() {
  h = await mountPM({ seed: (db) => installVersionRpcs(db) });
  act(() => usePMVersionStore.setState({ projectGUID: null, versions: [], checkedGUIDs: [], dataByVersion: {}, overlays: [], avoidColors: [], titlePrompt: null, restorePickerOpen: false, busy: false, tablesMissing: false }));
  function VersionHarness() {
    const selected = usePMStore((s) => s.selectedProjectGUID);
    useReadProjectVersionsQuery(selected);
    latest.c = useVersionCommands(h.owner, selected);
    return null;
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <QueryClientProvider client={h.qc}>
        <UndoGanttStorageContext.Provider value={createWebUndoStorage()}>
          <VersionHarness />
        </UndoGanttStorageContext.Provider>
      </QueryClientProvider>
    )
  );
  await h.until(() => vs().projectGUID === h.P1, 'versions of the project');
  await h.settle();
}

async function save(title: string): Promise<string> {
  let guid: string | null = null;
  await act(async () => {
    guid = await c().saveVersion(title);
  });
  await h.settle();
  return guid!;
}

beforeEach(() => {
  mockApprove.mockReset();
  mockApprove.mockResolvedValue(true);
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  unmountPM();
});

describe('project versions (commands)', () => {
  it('saveVersion stores the whole plan through pm_version_save and the list refreshes', async () => {
    await mount();
    expect(vs().versions).toEqual([]);
    const guid = await save('  Baseline  ');
    expect(h.db.rpcCalls.filter((r) => r.fn === 'pm_version_save')).toEqual([{ fn: 'pm_version_save', args: { p_project: h.P1, p_title: 'Baseline' } }]);
    expect(vs().versions.map((v) => [v.rowVersionGUID, v.rowJSON.versionTitle, v.rowJSON.versionTaskCount])).toEqual([[guid, 'Baseline', 8]]);
    expect(h.db.rows('version_project_task_table').length).toBe(8);
    expect(vs().busy).toBe(false);
  });

  it('a failed save reports the error and returns null', async () => {
    await mount();
    h.db.failNext('pm_gantt: project not found', { table: 'pm_version_save', op: 'rpc' });
    let guid: string | null = 'x';
    await act(async () => {
      guid = await c().saveVersion('Baseline');
    });
    expect(guid).toBeNull();
    expect(h.store().lastError).toBe('Could not save the version: project not found');
    expect(vs().busy).toBe(false);
  });

  it('checking a version loads its rows, draws it (overlay) and saves the choice per project and user', async () => {
    await mount();
    const v1 = await save('Baseline');
    act(() => c().toggleChecked(v1));
    await h.until(() => vs().overlays.length === 1, 'overlay of the checked version');
    await h.settle();
    expect(vs().overlays[0]).toMatchObject({ versionGUID: v1, title: 'Baseline' });
    expect(Object.keys(vs().overlays[0].bars).length).toBe(8);
    const saved = h.db.rows('project_user_settings_table').find((r) => r.rowOwnerGUID === h.P1 && r.rowParentGUID === h.owner);
    expect(saved?.rowJSON.uxuiSettings.checkedProjectVersions).toEqual([v1]);

    act(() => c().toggleChecked(v1));
    await h.settle();
    expect(vs().checkedGUIDs).toEqual([]);
    expect(vs().overlays).toEqual([]);
    expect(h.db.rows('project_user_settings_table').find((r) => r.rowOwnerGUID === h.P1)?.rowJSON.uxuiSettings.checkedProjectVersions).toEqual([]);
  });

  it(`at most ${PM_VERSION_MAX_CHECKED} versions can be compared at once`, async () => {
    await mount();
    const guids: string[] = [];
    for (let i = 0; i <= PM_VERSION_MAX_CHECKED; i++) guids.push(await save(`V${i + 1}`));
    for (const g of guids.slice(0, PM_VERSION_MAX_CHECKED)) act(() => c().toggleChecked(g));
    await h.settle();
    expect(vs().checkedGUIDs.length).toBe(PM_VERSION_MAX_CHECKED);
    act(() => c().toggleChecked(guids[PM_VERSION_MAX_CHECKED]));
    expect(vs().checkedGUIDs.length).toBe(PM_VERSION_MAX_CHECKED);
    expect(h.store().lastError).toContain(`At most ${PM_VERSION_MAX_CHECKED}`);
    const colors = vs().overlays.map((o) => o.color);
    expect(new Set(colors).size).toBe(colors.length);
    act(() => c().clearChecked());
    expect(vs().checkedGUIDs).toEqual([]);
  });

  it('restoreVersion asks first, brings the plan back with the same row ids and keeps the replaced plan as a version', async () => {
    await mount();
    const v1 = await save('Baseline');
    const before = h.store().tasks.map((t) => t.rowGUID).sort();
    const victim = h.byName('Task 111').rowGUID as string;
    act(() => void h.crud.deleteTask(victim));
    await h.until(() => !h.store().tasksById[victim], 'task deleted');
    await h.settle();
    expect(h.store().undoCount).toBeGreaterThan(0);

    mockApprove.mockResolvedValueOnce(false); // "No": nothing happens
    let ok = true;
    await act(async () => {
      ok = await c().restoreVersion(v1);
    });
    expect(ok).toBe(false);
    expect(h.db.rpcCalls.some((r) => r.fn === 'pm_version_restore')).toBe(false);

    await act(async () => {
      ok = await c().restoreVersion(v1);
    });
    await h.settle();
    expect(ok).toBe(true);
    expect(mockApprove.mock.calls[mockApprove.mock.calls.length - 1][0]).toMatchObject({ yesLabel: 'Restore', destructive: true });
    const call = h.db.rpcCalls.find((r) => r.fn === 'pm_version_restore')!;
    expect(call.args.p_version).toBe(v1);
    expect(call.args.p_backup_title).toMatch(/^Before restore \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    await h.until(() => !!h.store().tasksById[victim], 'restored task');
    expect(h.store().tasks.map((t) => t.rowGUID).sort()).toEqual(before);
    expect(vs().versions.map((v) => v.rowJSON.versionTitle)).toEqual([call.args.p_backup_title, 'Baseline']);
    expect(vs().versions[0].rowJSON.versionTaskCount).toBeLessThan(8); // the plan that was replaced
    expect(h.store().undoCount).toBe(0); // the undo history described the replaced rows
  });

  it('rename and sql_for_delete (asks first); a deleted version leaves the comparison', async () => {
    await mount();
    const v1 = await save('Baseline');
    await act(async () => void (await c().renameVersion(v1, ' Approved ')));
    await h.settle();
    expect(vs().versions[0].rowJSON.versionTitle).toBe('Approved');

    act(() => c().toggleChecked(v1));
    await h.until(() => vs().overlays.length === 1, 'overlay');
    mockApprove.mockResolvedValueOnce(false);
    await act(async () => void (await c().deleteVersion(v1)));
    expect(vs().versions.length).toBe(1);

    await act(async () => void (await c().deleteVersion(v1)));
    await h.settle();
    expect(h.db.rows('version_project_table')).toEqual([]);
    expect(vs().versions).toEqual([]);
    expect(vs().checkedGUIDs).toEqual([]);
    expect(vs().overlays).toEqual([]);
  });

  it('window helpers: Save opens the title prompt with the project name, Rename with the current title', async () => {
    await mount();
    act(() => c().openSaveVersion());
    expect(vs().titlePrompt).toMatchObject({ mode: 'save' });
    expect(vs().titlePrompt!.title.startsWith('Project 1 ')).toBe(true);
    act(() => c().closeTitlePrompt());
    const v1 = await save('Baseline');
    act(() => c().openRenameVersion(v1));
    expect(vs().titlePrompt).toEqual({ mode: 'rename', versionGUID: v1, title: 'Baseline' });
    act(() => c().openRestorePicker());
    expect(vs().restorePickerOpen).toBe(true);
    act(() => c().closeRestorePicker());
    expect(vs().restorePickerOpen).toBe(false);
  });
});
