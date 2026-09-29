// Harness for the PM CRUD tests: the real usePMCrud / React Query / Zustand stack on top of
// the in-memory Supabase (fakeSupabaseTestKit). Import this file FIRST (it registers mocks).
//
//   const h = await mountPM();          // demo data (Project 1 + 2) loaded, Project 1 open
//   act(() => h.crud.createTaskBelow(g)); await h.settle();
//   expect(h.db.task(newGUID)) ... expect(h.store().tree ...)

import React from 'react';
import { act } from 'react';

export const mockDb: { current: any } = { current: null };
export const mockApprove = jest.fn(async (_req: any) => true);
export const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false, setParams: jest.fn() };

jest.mock('../../../kit8/providers/WithSupabase', () => ({
  useSupabase: () => ({ supabase: require('./pmCrudHarnessTestKit').mockDb.current }),
}));
jest.mock('../../../kit8/pm/inner/PMApproveYesNoCancelModalWindow', () => ({
  approvePM: (req: any) => require('./pmCrudHarnessTestKit').mockApprove(req),
  askPMApprove: async (req: any) => ((await require('./pmCrudHarnessTestKit').mockApprove(req)) ? 'yes' : 'no'),
  isPMApproveOpen: () => false,
  __esModule: true,
  default: () => null,
}));
jest.mock('expo-router', () => ({
  useRouter: () => require('./pmCrudHarnessTestKit').mockRouter,
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePMCrud, PMCrud } from '../../../kit8/pm/crud/usePMCrud';
import {
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useReadProjectDataQuery,
  useProjectSearchQuery,
  useReadProjectsQuery, useReadProjectUserSettingsQuery,
  useScheduleWriteBack,
  useSeedDemoMutation,
  useUpdateProjectMutation,
  useBuildProjectRow,
} from '../../../kit8/pm/crud/queries';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { buildDemoData } from '../../../kit8/pm/model/seedDemo';
import { UndoGanttStorageContext } from '../../../kit8/pm/view/undo/undoGanttContext';
import { createWebUndoStorage } from '../../../kit8/pm/view/undo/undoGanttWebStorage';
import { createFakeSupabase, FakeSupabase } from './fakeSupabaseTestKit';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
type Root = { render(node: React.ReactNode): void; unmount(): void };
const { createRoot } = require('react-dom/client') as { createRoot: (container: Element) => Root };

let ownerSeq = 0;
let mounted: { root: Root; host: HTMLElement; qc: QueryClient } | null = null;

export interface PMHarness {
  db: FakeSupabase;
  qc: QueryClient;
  owner: string;
  P1: string;
  P2: string;
  demo: ReturnType<typeof buildDemoData>;
  /** latest crud object (re-read after every render) */
  readonly crud: PMCrud;
  readonly projects: ReturnType<typeof useProjectHooks>;
  readonly search: { text: string; data: any };
  setSearch(text: string): void;
  store: () => ReturnType<typeof usePMStore.getState>;
  byName: (name: string) => any;
  /** children of a row (or of the project root) as names, in tree order */
  childrenOf: (guid: string | null) => string[];
  settle: () => Promise<void>;
  until: (cond: () => boolean, what?: string) => Promise<void>;
}

function useProjectHooks(owner: string) {
  return {
    createProject: useCreateProjectMutation(owner),
    updateProject: useUpdateProjectMutation(owner),
    deleteProject: useDeleteProjectMutation(owner),
    seedDemo: useSeedDemoMutation(owner),
    buildRow: useBuildProjectRow(owner),
  };
}

export async function mountPM(opts: { writeBack?: boolean; seed?: (db: FakeSupabase, demo: any) => void } = {}): Promise<PMHarness> {
  unmountPM();
  const owner = `11111111-1111-4111-8111-${String(++ownerSeq).padStart(12, '0')}`;
  const db = createFakeSupabase();
  let n = 0;
  const demo = buildDemoData(owner, Date.UTC(2026, 8, 28), () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`);
  db.seed('project_table', demo.projects);
  db.seed('project_task_table', demo.tasks);
  db.seed('project_task_dependencies_table', demo.deps.map((d) => ({ ...d, rowJSON: {} })));
  opts.seed?.(db, demo);
  mockDb.current = db;
  const P1 = demo.projects[0].rowGUID;
  const P2 = demo.projects[1].rowGUID;

  act(() => {
    const s = usePMStore.getState();
    s.selectProject(null);
    s.setProjects([]);
    s.setRecentProjects([]);
    s.setError(null);
    s.setAllProjectUserSettings({}, false);
    usePMStore.setState({ keepWorkspaceMode: false });
    s.selectProject(P1);
  });

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const storage = createWebUndoStorage();
  const latest: { crud: PMCrud | null; projects: any; search: { text: string; data: any } } = { crud: null, projects: null, search: { text: '', data: undefined } };
  let setSearchText: (t: string) => void = () => undefined;

  function Harness() {
    const [text, setText] = React.useState('');
    setSearchText = setText;
    useReadProjectsQuery(owner);
    useReadProjectUserSettingsQuery(owner);
    const selected = usePMStore((s) => s.selectedProjectGUID);
    useReadProjectDataQuery(selected);
    if (opts.writeBack) useScheduleWriteBack(selected); // eslint-disable-line react-hooks/rules-of-hooks
    latest.crud = usePMCrud(owner, selected);
    latest.projects = useProjectHooks(owner);
    const search = useProjectSearchQuery(owner, text, true);
    latest.search = { text, data: search.data };
    return null;
  }

  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <QueryClientProvider client={qc}>
        <UndoGanttStorageContext.Provider value={storage}>
          <Harness />
        </UndoGanttStorageContext.Provider>
      </QueryClientProvider>
    )
  );
  mounted = { root, host, qc };

  const tick = () => act(async () => void (await new Promise((r) => setTimeout(r, 5))));
  const until = async (cond: () => boolean, what = 'condition') => {
    for (let i = 0; i < 400; i++) {
      if (cond()) return;
      await tick();
    }
    throw new Error(`timed out waiting for ${what}`);
  };
  const settle = async () => {
    let quiet = 0;
    for (let i = 0; i < 400 && quiet < 4; i++) {
      await tick();
      quiet = qc.isMutating() === 0 && qc.isFetching() === 0 ? quiet + 1 : 0;
    }
  };

  const store = () => usePMStore.getState();
  const h: PMHarness = {
    db,
    qc,
    owner,
    P1,
    P2,
    demo,
    get crud() {
      return latest.crud!;
    },
    get projects() {
      return latest.projects;
    },
    get search() {
      return latest.search;
    },
    setSearch: (t: string) => act(() => setSearchText(t)),
    store,
    byName: (name) => store().tasks.find((t) => t.rowJSON.name === name) ?? db.rows('project_task_table').find((t) => t.rowJSON.name === name),
    childrenOf: (guid) => {
      const s = store();
      return (s.tree.childrenById[guid ?? '__root__'] ?? s.tree.childrenById[guid ?? ''] ?? []).map((g: string) => s.tasksById[g]?.rowJSON.name);
    },
    settle,
    until,
  };
  await until(() => store().loadedProjectGUID === P1 && store().tasks.length === 8, 'project data');
  await settle();
  return h;
}

export function unmountPM() {
  if (!mounted) return;
  const m = mounted;
  mounted = null;
  act(() => m.root.unmount());
  m.host.remove();
  m.qc.clear();
}
