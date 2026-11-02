/** @jest-environment jsdom */
// Kanban stage percent + the project switch autoUpdateTaskProgressPercentFromKanban, end to end:
// useKanbanCommands -> React Query -> in-memory Supabase -> Zustand (same harness as pmKanbanCrud.test.tsx).
//   stage percent 1..100 = FIXED (every card of the stage has it) · 0 = MANUAL (typed on the card)
//   switch off (default): the Kanban never writes project_task_table.rowProgress
//   switch on: a card moved into a FIXED stage, or a percent typed on a card of a MANUAL stage, sets rowProgress
import { mountPM, PMHarness, unmountPM } from './pmCrudHarnessTestKit';
import React, { act } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useReadProjectKanbanQuery } from '../../../kit8/pm/crud/kanban/kanbanQueries';
import { useKanbanCommands, PMKanbanCommands, KANBAN_FIXED_PERCENT_MESSAGE } from '../../../kit8/pm/crud/kanban/useKanbanCommands';
import { usePMKanbanStore } from '../../../kit8/pm/store/store_kanban';
import { buildKanbanBoard } from '../../../kit8/pm/view/kanban/kanbanModel';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

type Root = { render(node: React.ReactNode): void; unmount(): void };
const { createRoot } = require('react-dom/client') as { createRoot: (c: Element) => Root };

// the catalog of the SQL seed: waiting 0 (manual), plan 10, analyse 30, construct 60, execute 90
const PERCENTS = [0, 10, 30, 60, 90];
const CATALOG = ['Waiting', 'Plan', 'Analyse', 'Construct', 'Execute'].map((name, i) => ({
  rowGUID: `cat-${i}`,
  rowOwnerGUID: 'kanbanStageCatalog',
  rowParentGUID: 'empty',
  orderInList: (i + 1) * 1024,
  rowJSON: { stageCode: name.toLowerCase(), stageName: name, stageColor: '#94A3B8', isActive: true, stageProgressPercent: PERCENTS[i] },
}));

let h: PMHarness;
let kanbanRoot: Root | null = null;
const latest: { k: PMKanbanCommands | null } = { k: null };

function withEnsureRpc(db: any) {
  const orig = db.rpc.bind(db);
  db.rpc = async (fn: string, args: any) => {
    if (fn !== 'pm_kanban_ensure_project_stages') return orig(fn, args);
    const mine = db.tables.project_kanban_stage_table.filter((r: any) => r.rowOwnerGUID === args.p_project);
    if (!mine.length) {
      db.tables.kanban_stage_table.forEach((c: any, i: number) =>
        db.tables.project_kanban_stage_table.push({ rowGUID: `ps-${args.p_project.slice(-4)}-${i}`, rowOwnerGUID: args.p_project, rowParentGUID: c.rowGUID, orderInList: c.orderInList, rowJSON: { ...c.rowJSON } })
      );
    }
    return { data: db.tables.project_kanban_stage_table.filter((r: any) => r.rowOwnerGUID === args.p_project), error: null };
  };
}

async function mountKanban(catalog = CATALOG) {
  h = await mountPM({
    seed: (db) => {
      db.seed('kanban_stage_table', catalog);
      db.seed('project_kanban_stage_table', []);
      db.seed('project_task_kanban_state_table', []);
      withEnsureRpc(db);
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
const switchAuto = (on: boolean) =>
  act(() => {
    usePMStore.setState((s) => ({ projectsById: { ...s.projectsById, [h.P1]: { ...s.projectsById[h.P1], rowJSON: { ...s.projectsById[h.P1].rowJSON, autoUpdateTaskProgressPercentFromKanban: on } } } }));
  });
const progressOf = (name: string) => h.db.rows('project_task_table').find((t) => t.rowGUID === g(name))!.rowProgress as number;
const card = (name: string) => {
  const s = usePMStore.getState();
  const b = buildKanbanBoard({ tasksById: s.tasksById, tree: s.tree, schedule: s.schedule, stages: ks().stages, statesByTask: ks().statesByTask, scopeGUID: null });
  return b.columns.flatMap((c) => c.cards).find((c) => c.name === name)!;
};

afterEach(() => {
  if (kanbanRoot) act(() => kanbanRoot!.unmount());
  kanbanRoot = null;
  unmountPM();
});

describe('Kanban stage percent', () => {
  it('the project copies the percent of every catalog stage; cards show it (fixed) or are manual (0)', async () => {
    await mountKanban();
    expect(ks().stages.map((s) => s.rowJSON.stageProgressPercent)).toEqual(PERCENTS);
    expect(card('Task 111')).toMatchObject({ percentFixed: false, kanbanStageProgressPercent: 0 }); // first stage: Waiting = manual
    await run(() => k().moveTasksToStage([g('Task 111')], stageId('Construct')));
    expect(card('Task 111')).toMatchObject({ percentFixed: true, kanbanStageProgressPercent: 60 });
  });

  it('an old catalog row without a percent reads as the standard percent of its code', async () => {
    await mountKanban(CATALOG.map((c) => ({ ...c, rowJSON: { ...c.rowJSON, stageProgressPercent: undefined } })));
    expect(ks().stages.map((s) => s.rowJSON.stageProgressPercent)).toEqual(PERCENTS);
  });

  it('changing the percent of a stage changes the cards at once (read side); the state rows are not rewritten', async () => {
    await mountKanban();
    await run(() => k().moveTasksToStage([g('Task 111')], stageId('Plan')));
    await run(() => k().updateStage(stageId('Plan'), { stageProgressPercent: 25 }));
    expect(card('Task 111').kanbanStageProgressPercent).toBe(25);
    expect(h.db.rows('project_kanban_stage_table').find((r) => r.rowGUID === stageId('Plan'))!.rowJSON.stageProgressPercent).toBe(25);
    await run(() => k().updateStage(stageId('Plan'), { stageProgressPercent: 0 })); // fixed -> manual
    expect(card('Task 111')).toMatchObject({ percentFixed: false });
  });

  it('a new stage has the percent given (default 0 = manual)', async () => {
    await mountKanban();
    await run(() => k().createStage('Review', '#EF4444', 70));
    await run(() => k().createStage('Ideas', '#22C55E'));
    expect(ks().stages.find((s) => s.rowJSON.stageName === 'Review')!.rowJSON.stageProgressPercent).toBe(70);
    expect(ks().stages.find((s) => s.rowJSON.stageName === 'Ideas')!.rowJSON.stageProgressPercent).toBe(0);
  });
});

describe('autoUpdateTaskProgressPercentFromKanban', () => {
  it('OFF (default): moving cards and typing percents never touch the task progress %', async () => {
    await mountKanban();
    const before = progressOf('Task 112');
    await run(() => k().moveTasksToStage([g('Task 112')], stageId('Construct')));
    expect(progressOf('Task 112')).toBe(before);
    await run(() => k().moveTasksToStage([g('Task 112')], stageId('Waiting')));
    await run(() => k().setTaskKanbanProgress(g('Task 112'), 40));
    expect(card('Task 112').kanbanStageProgressPercent).toBe(40);
    expect(progressOf('Task 112')).toBe(before);
  });

  it('ON: a card moved into a FIXED stage sets the task progress to the stage percent', async () => {
    await mountKanban();
    switchAuto(true);
    await run(() => k().moveTasksToStage([g('Task 111'), g('Task 112')], stageId('Plan')));
    expect(progressOf('Task 111')).toBe(10);
    expect(progressOf('Task 112')).toBe(10);
    await run(() => k().moveTasksToStage([g('Task 111')], stageId('Construct')));
    expect(progressOf('Task 111')).toBe(60);
    expect(progressOf('Task 112')).toBe(10);
  });

  it('ON: moving into a MANUAL stage changes nothing; a reorder inside the column writes no progress', async () => {
    await mountKanban();
    switchAuto(true);
    await run(() => k().moveTasksToStage([g('Task 111')], stageId('Execute')));
    expect(progressOf('Task 111')).toBe(90);
    await run(() => k().moveTasksToStage([g('Task 111')], stageId('Waiting')));
    expect(progressOf('Task 111')).toBe(90); // Waiting is manual: the progress stays
    await run(() => k().moveTasksToStage([g('Task 112')], stageId('Plan')));
    expect(progressOf('Task 112')).toBe(10);
    await act(async () => void h.crud.setProgress(g('Task 112'), 55)); // the user types the task progress
    await h.settle();
    await run(() => k().moveTasksToStage([g('Task 112')], stageId('Plan'), 0)); // same column: only the order
    expect(progressOf('Task 112')).toBe(55);
  });

  it('ON: a percent typed on a card of a MANUAL stage also sets the task progress', async () => {
    await mountKanban();
    switchAuto(true);
    await run(() => k().setTaskKanbanProgress(g('Task 113'), 40)); // Task 113 is in Waiting (manual)
    expect(card('Task 113')).toMatchObject({ kanbanStageProgressPercent: 40, percentFixed: false });
    expect(progressOf('Task 113')).toBe(40);
    await run(() => k().setTasksKanbanProgress([g('Task 121'), g('Task 122')], 75));
    expect(progressOf('Task 121')).toBe(75);
    expect(progressOf('Task 122')).toBe(75);
  });

  it('a percent typed on a card of a FIXED stage is refused with a message; nothing is written', async () => {
    await mountKanban();
    switchAuto(true);
    await run(() => k().moveTasksToStage([g('Task 111')], stageId('Analyse')));
    await run(() => k().setTaskKanbanProgress(g('Task 111'), 99));
    expect(h.store().lastError).toBe(KANBAN_FIXED_PERCENT_MESSAGE);
    expect(card('Task 111').kanbanStageProgressPercent).toBe(30);
    expect(progressOf('Task 111')).toBe(30);
  });

  it('a stage row typed in the tree: cards of manual stages take it, cards of fixed stages keep the stage percent', async () => {
    await mountKanban();
    await run(() => k().moveTasksToStage([g('Task 121')], stageId('Plan')));
    await run(() => k().setTasksKanbanProgress([g('Task 121'), g('Task 122')], 20));
    expect(card('Task 121').kanbanStageProgressPercent).toBe(10); // fixed: refused
    expect(card('Task 122').kanbanStageProgressPercent).toBe(20); // manual: written
  });
});
