// Project versions - pure logic: titles, colors, scheduling of a version, differences, Gantt overlays, the store.
import { buildDemoData } from '../../../../kit8/pm/model/seedDemo';
import { PM_BAR_VPAD, PM_ROW_HEIGHT, DAY_MS } from '../../../../kit8/pm/model/constants';
import { scheduleProject } from '../../../../kit8/pm/view/project/scheduling';
import type { PMTaskRow } from '../../../../kit8/pm/model/types';
import {
  assignVersionColors,
  colorDistance,
  defaultVersionTitle,
  formatVersionDateTime,
  normalizeVersion,
  PM_VERSION_COLORS,
  PM_VERSION_MAX_CHECKED,
  PM_VERSION_TITLE_MAX,
  PMProjectVersionRow,
  validateVersionTitle,
  versionProjectTable,
  versionProjectTaskTable,
  versionProjectTaskDependenciesTable,
  versionProjectKanbanStageTable,
  versionProjectTaskKanbanStateTable,
} from '../../../../kit8/pm/version/model/versionTypes';
import {
  buildVersionOverlays,
  compareVersionWithCurrent,
  describeVersionDiff,
  overlaysRange,
  scheduleVersion,
  versionStripGeometry,
} from '../../../../kit8/pm/version/model/versionCompare';
import { normalizeChecked, usePMVersionStore } from '../../../../kit8/pm/version/store/store_version';

const OWNER = '11111111-1111-4111-8111-111111111111';
const START = Date.UTC(2026, 8, 28);

function demo() {
  let n = 0;
  const guid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const d = buildDemoData(OWNER, START, guid, null);
  const project = d.projects[0];
  const tasks = d.tasks.filter((t: PMTaskRow) => t.projectGUID === project.rowGUID);
  const deps = d.deps.filter((x: any) => x.projectGUID === project.rowGUID);
  return { project, tasks, deps };
}

function versionOf(project: any, number: number, title: string): PMProjectVersionRow {
  return normalizeVersion({
    ...project,
    rowVersionGUID: `aaaaaaaa-aaaa-4aaa-8aaa-${String(number).padStart(12, '0')}`,
    orderInList: number,
    rowJSON: { ...project.rowJSON, versionTitle: title, versionCreatedAt: '2026-10-02T10:00:00.000Z', versionNumber: number, versionTaskCount: 8 },
  });
}

function currentOf(project: any, tasks: PMTaskRow[], deps: any[]) {
  const r = scheduleProject({ tasks, deps, projectStartMs: Date.parse(project.rowJSON.projectStartAt), calendar: { skipWeekends: !!project.rowJSON.skipWeekends } });
  const tasksById: Record<string, PMTaskRow> = {};
  for (const t of tasks) tasksById[t.rowGUID] = t;
  return { schedule: r.rows, tasksById, projectFinishMs: r.projectFinishMs };
}

describe('version tables + titles', () => {
  it('table name = "version_" + original table name', () => {
    expect([versionProjectTable, versionProjectTaskTable, versionProjectTaskDependenciesTable, versionProjectKanbanStageTable, versionProjectTaskKanbanStateTable]).toEqual([
      'version_project_table',
      'version_project_task_table',
      'version_project_task_dependencies_table',
      'version_project_kanban_stage_table',
      'version_project_task_kanban_state_table',
    ]);
  });

  it('default title = project name + date and time', () => {
    const ms = new Date(2026, 9, 2, 14, 5).getTime();
    expect(formatVersionDateTime(ms)).toBe('2026-10-02 14:05');
    expect(defaultVersionTitle('House', ms)).toBe('House 2026-10-02 14:05');
    expect(defaultVersionTitle(undefined, ms)).toBe('Project 2026-10-02 14:05');
    expect(defaultVersionTitle('x'.repeat(200), ms).length).toBe(PM_VERSION_TITLE_MAX);
    expect(formatVersionDateTime('not a date')).toBe('');
  });

  it('validates the title', () => {
    expect(validateVersionTitle('  ')).toBeTruthy();
    expect(validateVersionTitle('x'.repeat(PM_VERSION_TITLE_MAX + 1))).toBeTruthy();
    expect(validateVersionTitle(' Baseline ')).toBeNull();
  });

  it('normalizeVersion fills versionTitle / versionCreatedAt and numbers', () => {
    const v = normalizeVersion({ rowVersionGUID: 'v', rowGUID: 'p', orderInList: '3', rowProgress: '12.5', created_at: '2026-10-01T00:00:00Z', rowJSON: null });
    expect([v.orderInList, v.rowProgress, v.rowJSON.versionTitle, v.rowJSON.versionCreatedAt]).toEqual([3, 12.5, 'Version 3', '2026-10-01T00:00:00Z']);
  });
});

describe('version colors', () => {
  it('are different from each other and from the colors of the active project', () => {
    const active = ['#6366f1', '#FF0033', '#f59e0b', '#475569'];
    const ids = ['a', 'b', 'c', 'd'];
    const colors = assignVersionColors(ids, active);
    const list = ids.map((i) => colors[i]);
    expect(new Set(list).size).toBe(4);
    for (const c of list) for (const a of active) expect(colorDistance(c, a)).toBeGreaterThanOrEqual(70);
  });

  it('skips a palette color the project already uses', () => {
    const colors = assignVersionColors(['a'], [PM_VERSION_COLORS[0]]);
    expect(colors.a).not.toBe(PM_VERSION_COLORS[0]);
  });

  it('keeps the color of a version when another one is checked after it', () => {
    expect(assignVersionColors(['a', 'b'], []).a).toBe(assignVersionColors(['a'], []).a);
  });
});

describe('scheduleVersion + compareVersionWithCurrent', () => {
  it('a version saved from the project has no differences', () => {
    const { project, tasks, deps } = demo();
    const version = versionOf(project, 1, 'Baseline');
    const s = scheduleVersion(version, { tasks, deps });
    expect(Object.keys(s.bars).length).toBe(tasks.length);
    const diff = compareVersionWithCurrent(s.bars, s.finishMs, currentOf(project, tasks, deps));
    expect(diff).toEqual({ added: 0, removed: 0, moved: 0, changed: 0, unchanged: tasks.length, finishDeltaDays: 0 });
    expect(describeVersionDiff(diff)).toBe('No differences');
  });

  it('finds moved, added, removed and renamed rows (matched by rowGUID)', () => {
    const { project, tasks, deps } = demo();
    const version = versionOf(project, 1, 'Baseline');
    const s = scheduleVersion(version, { tasks, deps });

    const leaf = tasks.filter((t) => t.rowJSON.rowKind === 'task');
    const longer = leaf[0];
    const deleted = leaf[leaf.length - 1];
    const now = tasks
      .filter((t) => t.rowGUID !== deleted.rowGUID) // one task was deleted
      .map((t) => (t.rowGUID === longer.rowGUID ? { ...t, rowJSON: { ...t.rowJSON, durationDays: t.rowJSON.durationDays + 5 } } : t));
    const extra: PMTaskRow = { ...leaf[0], rowGUID: 'ffffffff-ffff-4fff-8fff-ffffffffffff', treePath: `${project.treePath}.ffffffff_ffff_4fff_8fff_ffffffffffff`, rowJSON: { rowKind: 'task', name: 'New', durationDays: 1 } };
    const removedCount = tasks.length - now.length;
    const nowDeps = deps.filter((d: any) => now.some((t) => t.rowGUID === d.rowGUID) && now.some((t) => t.rowGUID === d.rowDependsOnGUID));
    const diff = compareVersionWithCurrent(s.bars, s.finishMs, currentOf(project, [...now, extra], nowDeps));

    expect(diff.added).toBe(1);
    expect(removedCount).toBe(1);
    expect(diff.removed).toBe(1);
    expect(diff.moved).toBeGreaterThan(0);
    expect(diff.added + diff.moved + diff.changed + diff.unchanged).toBe(now.length + 1);
    const text = describeVersionDiff(diff);
    expect(text).toContain('1 added');
    expect(text).toContain('1 removed');
    expect(text).toContain('moved');
  });

  it('a renamed row with the same dates counts as changed', () => {
    const { project, tasks, deps } = demo();
    const s = scheduleVersion(versionOf(project, 1, 'Baseline'), { tasks, deps });
    const now = tasks.map((t, i) => (i === tasks.length - 1 ? { ...t, rowJSON: { ...t.rowJSON, name: 'Renamed' } } : t));
    const diff = compareVersionWithCurrent(s.bars, s.finishMs, currentOf(project, now, deps));
    expect([diff.changed, diff.moved, diff.added, diff.removed]).toEqual([1, 0, 0, 0]);
  });

  it('uses the start date and calendar stored in the version, not the live project', () => {
    const { project, tasks, deps } = demo();
    const later = versionOf({ ...project, rowJSON: { ...project.rowJSON, projectStartAt: new Date(START + 10 * DAY_MS).toISOString() } }, 2, 'Later');
    const a = scheduleVersion(versionOf(project, 1, 'Baseline'), { tasks, deps });
    const b = scheduleVersion(later, { tasks, deps });
    expect(b.startMs - a.startMs).toBe(10 * DAY_MS);
  });
});

describe('Gantt overlays', () => {
  it('one overlay per checked + loaded version, in checked order, with different colors', () => {
    const { project, tasks, deps } = demo();
    const v1 = versionOf(project, 1, 'Baseline');
    const v2 = versionOf(project, 2, 'Second');
    const data = { [v1.rowVersionGUID]: { versionGUID: v1.rowVersionGUID, tasks, deps }, [v2.rowVersionGUID]: { versionGUID: v2.rowVersionGUID, tasks, deps } };
    const overlays = buildVersionOverlays([v2.rowVersionGUID, v1.rowVersionGUID, 'unknown'], [v1, v2], data, ['#6366f1']);
    expect(overlays.map((o) => o.title)).toEqual(['Second', 'Baseline']);
    expect(overlays[0].color).not.toBe(overlays[1].color);
    expect(Object.keys(overlays[0].bars).length).toBe(tasks.length);
    // not loaded yet -> not drawn
    expect(buildVersionOverlays([v1.rowVersionGUID], [v1], {}, []).length).toBe(0);
    const range = overlaysRange(overlays)!;
    expect(range.startMs).toBe(overlays[0].startMs);
    expect(overlaysRange([])).toBeNull();
  });

  it('thin bars stay inside the row, never overlap each other, one version fits under the task bar', () => {
    const one = versionStripGeometry(1, 0);
    expect(one.offsetY).toBeGreaterThanOrEqual(PM_ROW_HEIGHT - PM_BAR_VPAD); // completely under the task bar
    expect(one.offsetY + one.height).toBeLessThanOrEqual(PM_ROW_HEIGHT);
    for (let n = 1; n <= PM_VERSION_MAX_CHECKED; n++) {
      let prevTop = PM_ROW_HEIGHT;
      for (let k = 0; k < n; k++) {
        const g = versionStripGeometry(n, k);
        expect(g.offsetY).toBeGreaterThan(0);
        expect(g.offsetY + g.height).toBeLessThanOrEqual(prevTop);
        prevTop = g.offsetY;
      }
    }
  });
});

describe('version store', () => {
  beforeEach(() => usePMVersionStore.setState({ projectGUID: null, versions: [], checkedGUIDs: [], dataByVersion: {}, overlays: [], avoidColors: [], titlePrompt: null, restorePickerOpen: false, busy: false, tablesMissing: false }));

  it('hydrate sorts newest first; checked versions become overlays once their rows are loaded', () => {
    const { project, tasks, deps } = demo();
    const v1 = versionOf(project, 1, 'Baseline');
    const v2 = versionOf(project, 2, 'Second');
    const st = usePMVersionStore.getState();
    st.hydrateVersions(project.rowGUID, [v1, v2], false);
    expect(usePMVersionStore.getState().versions.map((v) => v.rowJSON.versionTitle)).toEqual(['Second', 'Baseline']);

    st.setChecked([v1.rowVersionGUID, 'unknown', v1.rowVersionGUID]);
    expect(usePMVersionStore.getState().checkedGUIDs).toEqual([v1.rowVersionGUID]);
    expect(usePMVersionStore.getState().overlays.length).toBe(0);
    st.setVersionData({ versionGUID: v1.rowVersionGUID, tasks, deps });
    expect(usePMVersionStore.getState().overlays.map((o) => o.title)).toEqual(['Baseline']);

    // a deleted version leaves the comparison
    usePMVersionStore.getState().hydrateVersions(project.rowGUID, [v2], false);
    expect(usePMVersionStore.getState().checkedGUIDs).toEqual([]);
    expect(usePMVersionStore.getState().overlays).toEqual([]);

    // another project: everything is reset
    usePMVersionStore.getState().resetProject('other');
    expect(usePMVersionStore.getState().versions).toEqual([]);
  });

  it(`normalizeChecked keeps at most ${PM_VERSION_MAX_CHECKED} existing versions`, () => {
    const { project } = demo();
    const versions = Array.from({ length: PM_VERSION_MAX_CHECKED + 2 }, (_, i) => versionOf(project, i + 1, `V${i + 1}`));
    expect(normalizeChecked(versions.map((v) => v.rowVersionGUID), versions).length).toBe(PM_VERSION_MAX_CHECKED);
    expect(normalizeChecked('nope', versions)).toEqual([]);
  });
});
