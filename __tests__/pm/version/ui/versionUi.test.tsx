/** @jest-environment jsdom */
// Project versions UI: Gantt bar buttons, title window, ModalWindowListToSelect, Versions view + cards, legend, view switch.
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, inputValue, mustGet, OWNER, press, pressKey, q, qa, renderUI, seedStore, textOf, typeInto, wait } from '../../ui/pmUiTestKit';

const mockCommands: Record<string, jest.Mock> = {};
const cmd = (name: string) => (mockCommands[name] ??= jest.fn());
jest.mock('../../../../kit8/pm/version/crud/version/useVersionCommands', () => ({
  useVersionCommands: () =>
    new Proxy(
      {},
      {
        get: (_t, k: string) => (mockCommands[k] ??= jest.fn()),
      }
    ),
}));
const mockVersionData: Record<string, any> = {};
jest.mock('../../../../kit8/pm/crud/queries', () => ({
  useBuildProjectRow: () => jest.fn(),
  useCreateProjectMutation: () => ({ mutate: jest.fn() }),
  useUpdateProjectMutation: () => ({ mutate: jest.fn() }),
  useDeleteProjectMutation: () => ({ mutate: jest.fn() }),
  useProjectSearchQuery: () => ({ data: undefined, isFetching: false }),
}));
jest.mock('../../../../kit8/pm/crud/exchange/project/ImportExportProject', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../../kit8/pm/version/crud/version/versionQueries', () => ({
  useVersionDataQuery: (guid: string) => ({ data: mockVersionData[guid], isError: false }),
  useReadProjectVersionsQuery: () => ({}),
}));

import React from 'react';
import ModalWindowListToSelect from '../../../../kit8/ui/components/common/ModalWindowListToSelect';
import PMGanttToolbar from '../../../../kit8/pm/view/gantt/toolbars/PMGanttToolbar';
import PMRecentProjectsToolbar from '../../../../kit8/pm/view/project/recent/PMRecentProjectsToolbar';
import GanttToNetworkViewToggleButtons from '../../../../kit8/pm/view/gantt/toolbars/GanttToNetworkViewToggleButtons';
import PMGanttVersionButtons from '../../../../kit8/pm/version/view/buttons/PMGanttVersionButtons';
import PMVersionTitleModalWindow from '../../../../kit8/pm/version/view/windows/PMVersionTitleModalWindow';
import PMVersionWindows from '../../../../kit8/pm/version/view/windows/PMVersionWindows';
import PMProjectVersionsList from '../../../../kit8/pm/version/view/list/PMProjectVersionsList';
import PMGanttVersionsLegend from '../../../../kit8/pm/version/view/legend/PMGanttVersionsLegend';
import { makePMPalette } from '../../../../kit8/pm/view/theme';
import { pmMainViewOf, uxuiSettingsOf } from '../../../../kit8/pm/model/types';
import { normalizeVersion, PM_VERSION_MAX_CHECKED } from '../../../../kit8/pm/version/model/versionTypes';
import { usePMVersionStore } from '../../../../kit8/pm/version/store/store_version';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const V1 = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
const V2 = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';

function seedVersions() {
  const { demo, store } = seedStore();
  const project = demo.projects[0];
  const tasks = demo.tasks.filter((t: any) => t.projectGUID === project.rowGUID);
  const deps = demo.deps.filter((d: any) => d.projectGUID === project.rowGUID);
  const version = (guid: string, n: number, title: string) =>
    normalizeVersion({ ...project, rowVersionGUID: guid, orderInList: n, rowJSON: { ...project.rowJSON, versionTitle: title, versionCreatedAt: '2026-10-02T10:00:00.000Z', versionNumber: n, versionTaskCount: tasks.length } });
  mockVersionData[V1] = { versionGUID: V1, tasks, deps };
  mockVersionData[V2] = { versionGUID: V2, tasks: tasks.slice(0, -1), deps: [] };
  act(() => {
    usePMVersionStore.setState({ projectGUID: null, versions: [], checkedGUIDs: [], dataByVersion: {}, overlays: [], avoidColors: [], titlePrompt: null, restorePickerOpen: false, busy: false, tablesMissing: false });
    usePMVersionStore.getState().hydrateVersions(project.rowGUID, [version(V1, 1, 'Baseline'), version(V2, 2, 'After review')], false);
  });
  return { project, tasks, deps, store };
}

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
  for (const k of Object.keys(mockCommands)) delete mockCommands[k];
});

describe('view switch', () => {
  it('Versions comes after Gantt | Kanban | Network and is a saved main view', () => {
    seedStore();
    const onChange = jest.fn();
    renderUI(<GanttToNetworkViewToggleButtons palette={palette} onChange={onChange} />);
    expectInOrder(['pm-gantt-vs-network-showGanttChart', 'pm-gantt-vs-network-showKanbanView', 'pm-gantt-vs-network-showNetworkView', 'pm-gantt-vs-network-showVersionsView']);
    press('pm-gantt-vs-network-showVersionsView');
    expect(onChange).toHaveBeenCalledWith('showVersionsView');
    expect(pmMainViewOf('showVersionsView')).toBe('showVersionsView');
    expect(uxuiSettingsOf({ rowKind: 'project', name: 'p', durationDays: 0 }, { checkedProjectVersions: ['a', 5 as any] }).checkedProjectVersions).toEqual(['a']);
    expect(uxuiSettingsOf(null).checkedProjectVersions).toEqual([]);
  });
});

describe('Gantt bar buttons', () => {
  it('Save version / Restore from version sit on the project bar (not on the Gantt bar), before the project settings button', () => {
    seedVersions();
    const { rerender } = renderUI(<PMRecentProjectsToolbar ownerGUID={OWNER} />);
    expectInOrder(['pm-project-sql_for_delete', 'pm-create-from-template-btn', 'pm-version-save', 'pm-version-restore', 'pm-project-edit']);
    rerender(<PMGanttToolbar crud={fakeCrud()} palette={palette} activeUnit="day" actions={{ zoomBy: jest.fn(), setZoom: jest.fn(), fit: jest.fn(), goToday: jest.fn() }} />);
    expect(q('pm-version-save')).toBeNull();
    expectInOrder(['pm-gantt-undo', 'pm-gantt-today', 'pm-gantt-vs-network-showVersionsView']);
  });

  it('Save opens the title window with "project name + date"; Restore opens the version list', () => {
    const { project } = seedVersions();
    renderUI(<PMGanttVersionButtons palette={palette} />);
    press('pm-version-save');
    const prompt = usePMVersionStore.getState().titlePrompt!;
    expect(prompt.mode).toBe('save');
    expect(prompt.title.startsWith(project.rowJSON.name)).toBe(true);
    press('pm-version-restore');
    expect(usePMVersionStore.getState().restorePickerOpen).toBe(true);
  });

  it('SQL not run: the buttons stay active and explain what to do instead of opening a window', () => {
    const { store } = seedVersions();
    act(() => usePMVersionStore.setState({ versions: [], tablesMissing: true }));
    renderUI(<PMGanttVersionButtons palette={palette} />);
    press('pm-version-restore');
    expect(store.getState().lastError).toContain('create_tables.sql');
    act(() => store.getState().setError(null));
    press('pm-version-save');
    expect(store.getState().lastError).toContain('create_tables.sql');
    expect(usePMVersionStore.getState().restorePickerOpen).toBe(false);
    expect(usePMVersionStore.getState().titlePrompt).toBeNull();
    act(() => store.getState().setError(null));
  });

  it('no versions yet: Restore opens the (empty) list; no project selected: both are disabled', () => {
    const { store } = seedVersions();
    act(() => usePMVersionStore.setState({ versions: [] }));
    const { rerender } = renderUI(<PMGanttVersionButtons palette={palette} />);
    press('pm-version-restore');
    expect(usePMVersionStore.getState().restorePickerOpen).toBe(true);
    act(() => {
      usePMVersionStore.getState().setRestorePickerOpen(false);
      store.getState().selectProject(null);
    });
    rerender(<PMGanttVersionButtons palette={palette} />);
    press('pm-version-save');
    press('pm-version-restore');
    expect(usePMVersionStore.getState().titlePrompt).toBeNull();
    expect(usePMVersionStore.getState().restorePickerOpen).toBe(false);
  });
});

describe('PMVersionTitleModalWindow', () => {
  it('saves a new version with the typed title and closes', async () => {
    seedVersions();
    const commands: any = { saveVersion: jest.fn(() => Promise.resolve('new')), renameVersion: jest.fn(), closeTitlePrompt: jest.fn(() => usePMVersionStore.getState().setTitlePrompt(null)) };
    act(() => usePMVersionStore.getState().setTitlePrompt({ mode: 'save', title: 'Project 1 2026-10-02 14:05' }));
    renderUI(<PMVersionTitleModalWindow commands={commands} />);
    expect(textOf('pm-version-title-heading')).toBe('Save project version');
    expect(inputValue('pm-version-title-input')).toBe('Project 1 2026-10-02 14:05');
    typeInto('pm-version-title-input', 'Baseline');
    press('pm-version-title-save');
    await wait(0);
    expect(commands.saveVersion).toHaveBeenCalledWith('Baseline');
    expect(q('pm-version-title-window')).toBeNull();
  });

  it('refuses an empty title; a failed save keeps the window open; Esc cancels', async () => {
    seedVersions();
    const commands: any = { saveVersion: jest.fn(() => Promise.resolve(null)), renameVersion: jest.fn(), closeTitlePrompt: jest.fn(() => usePMVersionStore.getState().setTitlePrompt(null)) };
    act(() => usePMVersionStore.getState().setTitlePrompt({ mode: 'save', title: 'x' }));
    renderUI(<PMVersionTitleModalWindow commands={commands} />);
    typeInto('pm-version-title-input', '   ');
    press('pm-version-title-save');
    expect(textOf('pm-version-title-error')).toContain('title');
    expect(commands.saveVersion).not.toHaveBeenCalled();
    typeInto('pm-version-title-input', 'Baseline');
    press('pm-version-title-save');
    await wait(0);
    expect(mustGet('pm-version-title-window')).toBeTruthy();
    pressKey('pm-version-title-input', 'Escape');
    expect(q('pm-version-title-window')).toBeNull();
  });

  it('rename mode calls renameVersion', async () => {
    seedVersions();
    const commands: any = { saveVersion: jest.fn(), renameVersion: jest.fn(() => Promise.resolve(true)), closeTitlePrompt: jest.fn(() => usePMVersionStore.getState().setTitlePrompt(null)) };
    act(() => usePMVersionStore.getState().setTitlePrompt({ mode: 'rename', versionGUID: V1, title: 'Baseline' }));
    renderUI(<PMVersionTitleModalWindow commands={commands} />);
    expect(textOf('pm-version-title-heading')).toBe('Rename version');
    typeInto('pm-version-title-input', 'Approved baseline');
    press('pm-version-title-save');
    await wait(0);
    expect(commands.renameVersion).toHaveBeenCalledWith(V1, 'Approved baseline');
    expect(commands.saveVersion).not.toHaveBeenCalled();
  });
});

describe('ModalWindowListToSelect (reusable)', () => {
  const items = [
    { id: 'a', title: 'Alpha', subtitle: 'first' },
    { id: 'b', title: 'Beta', subtitle: 'second' },
  ];

  it('renders the items, selects one, cancels', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    renderUI(<ModalWindowListToSelect visible title="Pick" items={items} onSelect={onSelect} onClose={onClose} searchable />);
    expect(textOf('modal-list-title')).toBe('Pick');
    expect(qa('modal-list-item-')).toEqual(['modal-list-item-a', 'modal-list-item-b']);
    press('modal-list-item-b');
    expect(onSelect).toHaveBeenCalledWith('b');
    press('modal-list-cancel');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('search filters by title or subtitle; empty list shows the empty text; hidden when not visible', () => {
    const { rerender } = renderUI(<ModalWindowListToSelect visible title="Pick" items={items} onSelect={jest.fn()} onClose={jest.fn()} searchable />);
    typeInto('modal-list-search', 'sec');
    expect(qa('modal-list-item-')).toEqual(['modal-list-item-b']);
    typeInto('modal-list-search', 'zzz');
    expect(textOf('modal-list-empty')).toBe('No matches');
    rerender(<ModalWindowListToSelect visible title="Pick" items={[]} onSelect={jest.fn()} onClose={jest.fn()} emptyText="Nothing here" />);
    expect(textOf('modal-list-empty')).toBe('Nothing here');
    expect(q('modal-list-search')).toBeNull();
    rerender(<ModalWindowListToSelect visible={false} title="Pick" items={items} onSelect={jest.fn()} onClose={jest.fn()} />);
    expect(q('modal-list-window')).toBeNull();
  });
});

describe('PMVersionWindows', () => {
  it('"Restore project from version": the user picks the version in ModalWindowListToSelect', () => {
    seedVersions();
    renderUI(<PMVersionWindows ownerGUID={OWNER} projectGUID={usePMVersionStore.getState().projectGUID} />);
    expect(q('pm-version-picker-window')).toBeNull();
    act(() => usePMVersionStore.getState().setRestorePickerOpen(true));
    expect(qa('pm-version-picker-item-')).toEqual([`pm-version-picker-item-${V2}`, `pm-version-picker-item-${V1}`]); // newest first
    expect(textOf(`pm-version-picker-item-${V1}`)).toContain('Baseline');
    press(`pm-version-picker-item-${V1}`);
    expect(cmd('closeRestorePicker')).toHaveBeenCalled();
    expect(cmd('restoreVersion')).toHaveBeenCalledWith(V1);
  });
});

describe('PMProjectVersionsList + ProjectVersionCard', () => {
  const list = (projectGUID: string, crud = fakeCrud()) => <PMProjectVersionsList ownerGUID={OWNER} projectGUID={projectGUID} width={600} height={500} palette={palette} crud={crud} />;

  it('shows a card per version (newest first) with the differences to the project', () => {
    const { project } = seedVersions();
    renderUI(list(project.rowGUID));
    expect(textOf('pm-versions-count')).toContain('2 versions');
    expectInOrder([`pm-version-card-${V2}`, `pm-version-card-${V1}`]);
    expect(textOf(`pm-version-title-${V1}`)).toBe('Baseline');
    expect(textOf(`pm-version-diff-${V1}`)).toContain('No differences');
    expect(textOf(`pm-version-diff-${V2}`)).toContain('1 added'); // the live project has one row more than this version
  });

  it('check box = compare on the Gantt; the card buttons restore / rename / sql_for_delete', () => {
    const { project } = seedVersions();
    renderUI(list(project.rowGUID));
    expect(mustGet(`pm-version-check-${V1}`).getAttribute('aria-checked')).toBe('false');
    press(`pm-version-check-${V1}`);
    expect(cmd('toggleChecked')).toHaveBeenCalledWith(V1);
    press(`pm-version-card-restore-${V2}`);
    expect(cmd('restoreVersion')).toHaveBeenCalledWith(V2);
    press(`pm-version-card-rename-${V2}`);
    expect(cmd('openRenameVersion')).toHaveBeenCalledWith(V2);
    press(`pm-version-card-delete-${V2}`);
    expect(cmd('deleteVersion')).toHaveBeenCalledWith(V2);
    press('pm-versions-save');
    expect(cmd('openSaveVersion')).toHaveBeenCalled();
  });

  it('a checked version shows its bar color; "Clear" unchecks all; the view switch is on the bar', () => {
    const { project, store } = seedVersions();
    act(() => {
      usePMVersionStore.getState().setChecked([V1]);
      usePMVersionStore.getState().setVersionData(mockVersionData[V1]);
    });
    const crud = fakeCrud();
    act(() => store.getState().setNetworkViewSettings({ ganttVsNetworkView: 'showVersionsView' }));
    renderUI(list(project.rowGUID, crud));
    expect(mustGet(`pm-version-check-${V1}`).getAttribute('aria-checked')).toBe('true');
    expect(mustGet(`pm-version-color-${V1}`)).toBeTruthy();
    expect(q(`pm-version-color-${V2}`)).toBeNull();
    expect(textOf('pm-versions-count')).toContain('1 checked');
    press('pm-versions-clear-checked');
    expect(cmd('clearChecked')).toHaveBeenCalled();
    press('pm-gantt-vs-network-showGanttChart');
    expect(crud.setGanttVsNetworkView).toHaveBeenCalledWith('showGanttChart');
    expect(textOf('pm-versions-hint')).toContain(String(PM_VERSION_MAX_CHECKED));
  });

  it('empty project: "Save the first version"; SQL not run: a hint instead of the list', () => {
    const { project } = seedVersions();
    act(() => usePMVersionStore.getState().hydrateVersions(project.rowGUID, [], false));
    const { rerender } = renderUI(list(project.rowGUID));
    press('pm-versions-empty-save');
    expect(cmd('openSaveVersion')).toHaveBeenCalledTimes(1);
    act(() => usePMVersionStore.getState().hydrateVersions(project.rowGUID, [], true));
    rerender(list(project.rowGUID));
    expect(textOf('pm-versions-missing')).toContain('create_tables.sql');
  });
});

describe('PMGanttVersionsLegend', () => {
  it('lists the project and every compared version with its color; hidden when nothing is checked', () => {
    seedVersions();
    const { rerender } = renderUI(<PMGanttVersionsLegend palette={palette} />);
    expect(q('pm-gantt-versions-legend')).toBeNull();
    act(() => {
      usePMVersionStore.getState().setChecked([V1, V2]);
      usePMVersionStore.getState().setVersionData(mockVersionData[V1]);
      usePMVersionStore.getState().setVersionData(mockVersionData[V2]);
    });
    rerender(<PMGanttVersionsLegend palette={palette} />);
    const text = textOf('pm-gantt-versions-legend');
    expect(text).toContain('Project (now)');
    expect(text).toContain('Baseline');
    expect(text).toContain('After review');
    const [a, b] = usePMVersionStore.getState().overlays;
    expect(a.color).not.toBe(b.color);
    expect([a.color, b.color]).not.toContain(palette.bar);
  });
});
