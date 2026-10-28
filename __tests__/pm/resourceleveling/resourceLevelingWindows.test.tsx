/** @jest-environment jsdom */
// The windows of Resource optimization: the preview, the question about posted tasks, the Level button of the Gantt bar. documentation/RESOURCE_LEVELING_WBS.html 7.7, 9.
import { act } from 'react-dom/test-utils';
import { cleanupUI, press, q, renderUI, seedStore, wait } from '../ui/pmUiTestKit';
import { planLevelingRun } from '../../../kit8/pm/resourceleveling/resourceLevelingRun';
import { useResourceLevelingUiStore } from '../../../kit8/pm/resourceleveling/resourceLevelingUiStore';
import { D0, day, makeTask, resetSeq, timeLine } from './levelingTestKit';

// the catalogs (names of the resources) need the redux provider: a plain empty set is enough here
jest.doMock('../../../kit8/pm/view/task/finances/useTaskLineCatalogs', () => ({
  useTaskLineCatalogs: () => ({ person: [], equipment: [], product: [], workCenter: [], resourceRoleType: [] }),
}));

const commands = { levelNow: jest.fn(), apply: jest.fn(), clear: jest.fn(), undoLast: jest.fn(), undoRun: jest.fn() };
jest.doMock('../../../kit8/pm/resourceleveling/useResourceLeveling', () => ({ useResourceLeveling: () => commands }));

const PreviewWindow = require('../../../kit8/pm/resourceleveling/PMResourceLevelingPreviewWindow').default;
const BarButton = require('../../../kit8/pm/resourceleveling/PMResourceLevelingBarButton').default;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const capacity = Array.from({ length: 60 }, (_, i) => ({ k: 'person', g: 'p1', d: iso(day(i)), h: [0, 6].includes(new Date(day(i)).getUTCDay()) ? 0 : 8 }));

function planOf(posted: boolean, extra: Record<string, unknown> = {}) {
  resetSeq();
  const A = makeTask('Alpha', 3);
  const B = makeTask('Beta', 3);
  const line = (t: any) => timeLine(t.rowGUID, 'p1', 24, posted ? { taskIsPosted: true, budgetItemTaskLine: 'b1' } : {});
  const args: any = {
    tasks: [A, B], deps: [], projectJSON: { resourceLevelingFunctionalityEnabled: true, skipWeekends: true, ...extra }, projectStartMs: D0,
    linesByTask: { [A.rowGUID]: [line(A)], [B.rowGUID]: [line(B)] }, capacityRows: capacity, foreignRows: [], todayMs: D0 - 30 * 86400000,
  };
  return { plan: planLevelingRun(args), args };
}

beforeEach(() => {
  Object.values(commands).forEach((f) => f.mockReset());
  act(() => useResourceLevelingUiStore.setState({ preview: null, postedDialog: false, history: false, busy: false }));
});
afterEach(cleanupUI);

describe('the preview', () => {
  it('shows nothing until a run sets it', () => {
    renderUI(<PreviewWindow onApply={jest.fn()} />);
    expect(q('pm-resource-leveling-preview')).toBeNull();
  });

  it('shows the counts, the dates and the moved task with its reason; Apply writes, Cancel closes', () => {
    const { plan, args } = planOf(false);
    const onApply = jest.fn();
    renderUI(<PreviewWindow onApply={onApply} />);
    act(() => useResourceLevelingUiStore.getState().setPreview({ plan, args, mode: 'manual', stamps: {} }));
    expect(q('pm-resource-leveling-preview')).not.toBeNull();
    expect(q('pm-resource-leveling-preview-before')!.textContent).toBe('3');
    expect(q('pm-resource-leveling-preview-after')!.textContent).toBe('0');
    expect(q('pm-resource-leveling-preview-moved')!.textContent).toBe('1');
    expect(q('pm-resource-leveling-preview-row-0')!.textContent).toContain('Beta');
    expect(q('pm-resource-leveling-preview-row-0')!.textContent).toContain('2026-10-05 → 2026-10-08');
    expect(q('pm-resource-leveling-preview-posted')).toBeNull();
    press('pm-resource-leveling-preview-apply');
    expect(onApply).toHaveBeenCalledWith();
    press('pm-resource-leveling-preview-cancel');
    expect(useResourceLevelingUiStore.getState().preview).toBeNull();
  });

  it('with nothing to move Apply is disabled and the conflicts are listed with their reason', () => {
    const { plan, args } = planOf(false, { resourceLevelingWithinSlackOnly: true });
    renderUI(<PreviewWindow onApply={jest.fn()} />);
    act(() => useResourceLevelingUiStore.getState().setPreview({ plan, args, mode: 'manual', stamps: {} }));
    expect(q('pm-resource-leveling-preview-moved')!.textContent).toBe('0');
    expect(q('pm-resource-leveling-conflicts')).not.toBeNull();
    expect(q('pm-resource-leveling-conflicts')!.textContent).toContain('Smoothing keeps the project dates');
    expect((q('pm-resource-leveling-preview-apply') as HTMLElement).getAttribute('aria-disabled')).toBe('true');
  });
});

describe('the question about the posted tasks (7.7)', () => {
  it('the dialog names the posted tasks and offers Unpost and move, Move and post again, Keep their dates', () => {
    const { plan, args } = planOf(true);
    const onApply = jest.fn();
    renderUI(<PreviewWindow onApply={onApply} />);
    act(() => useResourceLevelingUiStore.getState().setPreview({ plan, args, mode: 'manual', stamps: {} }));
    expect(q('pm-resource-leveling-preview-posted')!.textContent).toBe('1');
    expect(q('pm-resource-leveling-posted-dialog')).toBeNull();
    act(() => useResourceLevelingUiStore.getState().setPostedDialog(true));
    expect(q('pm-resource-leveling-posted-dialog')).not.toBeNull();
    expect(q('pm-resource-leveling-posted-list')!.textContent).toContain('Beta');
    press('pm-resource-leveling-posted-repost');
    expect(onApply).toHaveBeenCalledWith('moveAndPostAgain');
    expect(useResourceLevelingUiStore.getState().postedDialog).toBe(false);
  });

  it.each([['pm-resource-leveling-posted-unpost', 'unpostAndMove'], ['pm-resource-leveling-posted-keep', 'keep']])('%s answers %s', (id, choice) => {
    const { plan, args } = planOf(true);
    const onApply = jest.fn();
    renderUI(<PreviewWindow onApply={onApply} />);
    act(() => useResourceLevelingUiStore.getState().setPreview({ plan, args, mode: 'manual', stamps: {} }));
    act(() => useResourceLevelingUiStore.getState().setPostedDialog(true));
    press(id);
    expect(onApply).toHaveBeenCalledWith(choice);
  });

  it('Cancel of the question changes nothing', () => {
    const { plan, args } = planOf(true);
    const onApply = jest.fn();
    renderUI(<PreviewWindow onApply={onApply} />);
    act(() => useResourceLevelingUiStore.getState().setPreview({ plan, args, mode: 'manual', stamps: {} }));
    act(() => useResourceLevelingUiStore.getState().setPostedDialog(true));
    press('pm-resource-leveling-posted-cancel');
    expect(onApply).not.toHaveBeenCalled();
    expect(useResourceLevelingUiStore.getState().postedDialog).toBe(false);
    expect(useResourceLevelingUiStore.getState().preview).not.toBeNull();
  });
});

describe('the Level button of the Gantt bar', () => {
  const palette: any = { text: '#111', primary: '#00f' };

  it('is not there while the project switch is off: the bar is the one it always was', () => {
    const { store, demo } = seedStore();
    act(() => store.getState().setProjects([{ ...demo.projects[0], rowJSON: { ...demo.projects[0].rowJSON, resourceLevelingFunctionalityEnabled: false } }, demo.projects[1]]));
    renderUI(<BarButton palette={palette} />);
    expect(q('pm-gantt-resource-leveling')).toBeNull();
  });

  it('is there with the switch on, and its menu runs the commands', async () => {
    const { store, demo } = seedStore();
    act(() => store.getState().setProjects([{ ...demo.projects[0], rowJSON: { ...demo.projects[0].rowJSON, resourceLevelingFunctionalityEnabled: true } }, demo.projects[1]]));
    renderUI(<BarButton palette={palette} />);
    expect(q('pm-gantt-resource-leveling')).not.toBeNull();
    const openMenu = async () => { press('pm-gantt-resource-leveling'); await wait(60); };
    await openMenu();
    expect(q('pm-gantt-resource-leveling-menu')).not.toBeNull();
    press('pm-resource-leveling-menu-level');
    expect(commands.levelNow).toHaveBeenCalledTimes(1);
    await openMenu();
    press('pm-resource-leveling-menu-clear');
    expect(commands.clear).toHaveBeenCalledTimes(1);
    await openMenu();
    press('pm-resource-leveling-menu-undo');
    expect(commands.undoLast).toHaveBeenCalledTimes(1);
    await openMenu();
    press('pm-resource-leveling-menu-history');
    expect(useResourceLevelingUiStore.getState().history).toBe(true);
  });
});
