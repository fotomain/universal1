// A2 Calculation: Automatic or Manual - the store freezes the plan in manual mode, counts the edits not calculated yet and Calculate applies them.
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import type { PMProjectRow, PMTaskDependencyRow, PMTaskRow } from '../../../kit8/pm/model/types';

const P = 'proj';
const DAY = 86400000;
const START = Date.UTC(2026, 9, 5); // Monday
const project = (json: Record<string, unknown>): PMProjectRow =>
  ({ rowGUID: P, treePath: P, rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name: 'P', durationDays: 0, projectStartDate: new Date(START).toISOString(), ...json } }) as unknown as PMProjectRow;
const task = (guid: string, order: number, days: number): PMTaskRow =>
  ({ rowGUID: guid, treePath: `${P}.${guid}`, projectGUID: P, rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: order, rowJSON: { rowKind: 'task', taskDescription: guid, durationDays: days } }) as unknown as PMTaskRow;
const dep: PMTaskDependencyRow = { rowGUID: 'b', rowDependsOnGUID: 'a', projectGUID: P, rowOwnerGUID: 'u', linkType: 'FS', lagDays: 0 } as PMTaskDependencyRow;
const startOf = (g: string) => usePMStore.getState().schedule[g]?.startMs;

function open(json: Record<string, unknown>) {
  usePMStore.getState().selectProject(null);
  usePMStore.getState().setProjects([project(json)]);
  usePMStore.getState().selectProject(P);
  usePMStore.getState().hydrate(P, [task('a', 1, 2), task('b', 2, 2)], [dep]);
}
const MANUAL = { ganttExtendedFunctionalityEnabled: true, ganttCalculationModeEnabled: true, ganttExtendedOptions: { calculationManual: true } };

describe('calculation mode (A2)', () => {
  it('automatic (the default): an edit moves the successor at once', () => {
    open({});
    const b0 = startOf('b');
    usePMStore.getState().hydrate(P, [task('a', 1, 4), task('b', 2, 2)], [dep]);
    expect(startOf('b')).toBeGreaterThan(b0);
    expect(usePMStore.getState().calculationMode).toBe('automatic');
    expect(Object.keys(usePMStore.getState().pendingGUIDs)).toEqual([]);
  });

  it('the function off: the manual option in the options is ignored', () => {
    open({ ganttExtendedFunctionalityEnabled: true, ganttExtendedOptions: { calculationManual: true } });
    expect(usePMStore.getState().calculationMode).toBe('automatic');
  });

  it('manual: the plan stays frozen until Calculate, the edited task is pending', () => {
    open(MANUAL);
    expect(usePMStore.getState().calculationMode).toBe('manual');
    const b0 = startOf('b');
    usePMStore.getState().hydrate(P, [task('a', 1, 4), task('b', 2, 2)], [dep]);
    expect(startOf('b')).toBe(b0);
    expect(Object.keys(usePMStore.getState().pendingGUIDs)).toContain('a');
    usePMStore.getState().calculateProject();
    expect(startOf('b')).toBe(b0 + 2 * DAY);
    expect(Object.keys(usePMStore.getState().pendingGUIDs)).toEqual([]);
    expect(usePMStore.getState().calcRequest).toBeGreaterThan(0);
  });
});
