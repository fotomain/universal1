/** @jest-environment jsdom */
// Kanban end-to-end: useReadProjectKanbanQuery / useKanbanCommands -> React Query -> in-memory Supabase
// -> Zustand (store_kanban). Tables: kanban_stage_table, project_kanban_stage_table,
// project_task_kanban_state_table (kit8/sql/init/done/create_tables.sql).
import { mountPM, PMHarness, unmountPM } from './pmCrudHarnessTestKit';
import React, { act } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useReadProjectKanbanQuery } from '../../../kit8/pm/crud/kanban/kanbanQueries';
import { useKanbanCommands, PMKanbanCommands } from '../../../kit8/pm/crud/kanban/useKanbanCommands';
import { usePMKanbanStore } from '../../../kit8/pm/store/store_kanban';
import { buildKanbanBoard } from '../../../kit8/pm/view/kanban/kanbanModel';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

type Root = { render(node: React.ReactNode): void; unmount(): void };
const { createRoot } = require('react-dom/client') as { createRoot: (c: Element) => Root };

const CATALOG = ['Waiting', 'Plan', 'Analyse', 'Construct', 'Execute'].map((name, i) => ({
  rowGUID: `cat-${i}`,
  rowOwnerGUID: 'kanbanStageCatalog',
  rowParentGUID: 'empty',
  orderInList: (i + 1) * 1024,
  rowJSON: { stageCode: name.toLowerCase(), stageName: name, stageColor: '#94A3B8', isActive: true },
}));

let h: PMHarness;
let kanbanRoot: Root | null = null;
const latest: { k: PMKanbanCommands | null } = { k: null };

/** emulates the SQL function pm_kanban_ensure_project_stages (copy the catalog once) */
function withEnsureRpc(db: any, mode: 'rpc' | 'missingRpc' = 'rpc') {
  const orig = db.rpc.bind(db);
  db.rpc = async (fn: string, args: any) => {
    if (fn !== 'pm_kanban_ensure_project_stages') return orig(fn, args);
    db.rpcCalls.push({ fn, args });
    if (mode === 'missingRpc') return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    const mine = db.tables.project_kanban_stage_table.filter((r: any) => r.rowOwnerGUID === args.p_project);
    if (!mine.length) {
      db.tables.kanban_stage_table.forEach((c: any, i: number) =>
        db.tables.project_kanban_stage_table.push({ rowGUID: `ps-${args.p_project.slice(-4)}-${i}`, rowOwnerGUID: args.p_project, rowParentGUID: c.rowGUID, orderInList: c.orderInList, rowJSON: { ...c.rowJSON } })
      );
    }
    return { data: db.tables.project_kanban_stage_table.filter((r: any) => r.rowOwnerGUID === args.p_project), error: null };
  };
}

async function mountKanban(opts: { tables?: boolean; rpc?: 'rpc' | 'missingRpc' } = {}) {
  const tables = opts.tables !== false;
  h = await mountPM({
    seed: (db) => {
      if (!tables) return;
      db.seed('kanban_stage_table', CATALOG);
      db.seed('project_kanban_stage_table', []);
      db.seed('project_task_kanban_state_table', []);
      withEnsureRpc(db, opts.rpc);
    },
  });
  function KanbanHarness() {
    const selected = usePMStore((s) => s.selectedProjectGUID);
    useReadProjectKanbanQuery(selected);
    latest.k = useKanbanCommands(selected);
    return null;
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  kanbanRoot = createRoot(host);
  act(() =>
    kanbanRoot!.render(
      <QueryClientProvider client={h.qc}>
        <KanbanHarness />
      </QueryClientProvider>
    )
  );
  await h.until(() => usePMKanbanStore.getState().loadedProjectGUID === h.P1, 'kanban data');
  await h.settle();
}

const k = () => latest.k!;
const ks = () => usePMKanbanStore.getState();
const g = (name: string) => h.byName(name).rowGUID as string;
const stageId = (name: string) => ks().stages.find((s) => s.rowJSON.stageName === name)!.rowGUID;
const run = async (fn: () => unknown) => {
  await act(async () => void fn());
  await h.settle();
};
const column = (name: string) => {
  const s = usePMStore.getState();
  const b = buildKanbanBoard({ tasksById: s.tasksById, tree: s.tree, schedule: s.schedule, stages: ks().stages, statesByTask: ks().statesByTask, scopeGUID: null });
  return b.columns.find((c) => c.stage.rowJSON.stageName === name)!.cards.map((c) => c.name);
};

afterEach(() => {
  if (kanbanRoot) act(() => kanbanRoot!.unmount());
  kanbanRoot = null;
  unmountPM();
});

describe('Kanban CRUD', () => {
  it('first open copies the catalog into the project (RPC); all tasks start in the first stage', async () => {
    await mountKanban();
    expect(ks().stages.map((s) => s.rowJSON.stageName)).toEqual(['Waiting', 'Plan', 'Analyse', 'Construct', 'Execute']);
    expect(h.db.rows('project_kanban_stage_table').filter((r) => r.rowOwnerGUID === h.P1)).toHaveLength(5);
    expect(column('Waiting')).toEqual(['Task 111', 'Task 112', 'Task 113', 'Task 121', 'Task 122', 'Task 123']);
    expect(h.db.rows('project_task_kanban_state_table')).toHaveLength(0); // no rows until a task moves
  });

  it('old database without the RPC: the client copies the catalog itself', async () => {
    await mountKanban({ rpc: 'missingRpc' });
    expect(ks().stages.map((s) => s.rowJSON.stageName)).toEqual(['Waiting', 'Plan', 'Analyse', 'Construct', 'Execute']);
    expect(h.db.rows('project_kanban_stage_table').every((r) => r.rowParentGUID.startsWith('cat-'))).toBe(true);
  });

  it('moves tasks (upsert per task), reorders inside a column, a stage row moves all its tasks; progress untouched', async () => {
    await mountKanban();
    const before = h.db.rows('project_task_table').map((t) => [t.rowGUID, t.rowProgress]);
    await run(() => k().moveTasksToStage([g('Task 112')], stageId('Plan')));
    expect(column('Plan')).toEqual(['Task 112']);
    const row = h.db.rows('project_task_kanban_state_table').find((r) => r.rowParentGUID === g('Task 112'))!;
    expect(row).toMatchObject({ rowOwnerGUID: h.P1, rowJSON: { stageGUID: stageId('Plan') } });

    await run(() => k().moveTasksToStage([g('Task 113')], stageId('Plan'), 0));
    expect(column('Plan')).toEqual(['Task 113', 'Task 112']);

    await run(() => k().moveTreeRowToStage(g('Stage 2'), stageId('Execute')));
    expect(column('Execute')).toEqual(['Task 121', 'Task 122', 'Task 123']);
    expect(column('Waiting')).toEqual(['Task 111']);
    expect(h.db.rows('project_task_kanban_state_table').filter((r) => r.rowParentGUID === g('Task 112'))).toHaveLength(1); // one row per task
    expect(h.db.rows('project_task_table').map((t) => [t.rowGUID, t.rowProgress])).toEqual(before);
  });

  it('stages: add, rename / recolor, move, delete (tasks fall back to the first stage)', async () => {
    await mountKanban();
    await run(() => k().createStage('Review', '#EF4444'));
    expect(ks().stages.map((s) => s.rowJSON.stageName)).toEqual(['Waiting', 'Plan', 'Analyse', 'Construct', 'Execute', 'Review']);
    await run(() => k().updateStage(stageId('Review'), { stageName: 'QA', stageColor: '#22C55E' }));
    expect(h.db.rows('project_kanban_stage_table').find((r) => r.rowGUID === stageId('QA'))!.rowJSON).toMatchObject({ stageName: 'QA', stageColor: '#22C55E' });
    await run(() => k().moveStage(stageId('QA'), -1));
    expect(ks().stages.map((s) => s.rowJSON.stageName)).toEqual(['Waiting', 'Plan', 'Analyse', 'Construct', 'QA', 'Execute']);
    await run(() => k().moveTasksToStage([g('Task 111')], stageId('QA')));
    await run(() => k().deleteStage(stageId('QA')));
    expect(ks().stages).toHaveLength(5);
    expect(column('Waiting')).toContain('Task 111');
  });

  it('missing tables: read-only, writes explain which SQL to run', async () => {
    await mountKanban({ tables: false });
    expect(ks().tablesMissing).toBe(true);
    await run(() => k().moveTasksToStage([g('Task 111')], 'x'));
    expect(h.store().lastError).toContain('create_tables.sql');
  });
});
