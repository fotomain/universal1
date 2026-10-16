// Subprojects: the keys and their defaults (the same rule as the SQL functions subproject_enabled / subproject_setting), the error texts of the database, the Monitor01 kind filter.
import {
  MONITOR01_PROJECT_KIND_DEFAULT, parseSubprojectCandidate, parseSubprojectError, subprojectErrorText, subprojectEffectiveOf, subprojectsEnabledOf, subprojectValuesOf,
} from '../../../kit8/pm/subproject/subprojectModel';
import { filterMonitor01RowsByProjectKind } from '../../../kit8/pm/reports/monitor01/monitor01Model';

describe('defaults (a missing key)', () => {
  it('the functionality is OFF, the follow switch and the dates switch are ON, the three aggregate switches are OFF', () => {
    expect(subprojectValuesOf(null)).toEqual({
      subprojectsFunctionalityEnabled: false,
      autoChangeOriginTaskBasedOnSubprojects: true,
      autoChangeStartAndFinishDatesForOriginTask: true,
      aggregateTimeFromSubprojectToTheOriginTask: false,
      aggregateMaterialFromSubprojectToTheOriginTask: false,
      aggregateExpenceFromSubprojectToTheOriginTask: false,
    });
    expect(subprojectValuesOf({})).toEqual(subprojectValuesOf(undefined));
  });
  it('only a stored false turns a true-by-default switch off; only a stored true turns a false-by-default switch on', () => {
    const v = subprojectValuesOf({ autoChangeOriginTaskBasedOnSubprojects: false, autoChangeStartAndFinishDatesForOriginTask: false, aggregateTimeFromSubprojectToTheOriginTask: true });
    expect(v.autoChangeOriginTaskBasedOnSubprojects).toBe(false);
    expect(v.autoChangeStartAndFinishDatesForOriginTask).toBe(false);
    expect(v.aggregateTimeFromSubprojectToTheOriginTask).toBe(true);
    expect(v.aggregateMaterialFromSubprojectToTheOriginTask).toBe(false);
  });
  it('subprojectsEnabledOf is true only for a stored true', () => {
    expect(subprojectsEnabledOf({})).toBe(false);
    expect(subprojectsEnabledOf({ subprojectsFunctionalityEnabled: true })).toBe(true);
  });
});

describe('subprojectEffectiveOf: a child switch counts only while the functionality AND the follow switch are on', () => {
  it('everything is off while the functionality is off, whatever the children say', () => {
    expect(subprojectEffectiveOf({ aggregateTimeFromSubprojectToTheOriginTask: true })).toEqual({ enabled: false, follow: false, dates: false, time: false, material: false, expense: false });
  });
  it('on: dates work by default, the aggregates only when switched on', () => {
    expect(subprojectEffectiveOf({ subprojectsFunctionalityEnabled: true })).toEqual({ enabled: true, follow: true, dates: true, time: false, material: false, expense: false });
    expect(subprojectEffectiveOf({ subprojectsFunctionalityEnabled: true, aggregateMaterialFromSubprojectToTheOriginTask: true, aggregateExpenceFromSubprojectToTheOriginTask: true }))
      .toMatchObject({ time: false, material: true, expense: true });
  });
  it('the follow switch off turns every child off', () => {
    expect(subprojectEffectiveOf({ subprojectsFunctionalityEnabled: true, autoChangeOriginTaskBasedOnSubprojects: false, aggregateTimeFromSubprojectToTheOriginTask: true }))
      .toEqual({ enabled: true, follow: false, dates: false, time: false, material: false, expense: false });
  });
});

describe('the errors of the database', () => {
  it('a cycle names the chain; the other codes have a fixed text', () => {
    const m = 'SUBPROJECT_CYCLE: Project B -> Project A -> Project B';
    expect(parseSubprojectError({ message: m })).toEqual({ code: 'SUBPROJECT_CYCLE', detail: 'Project B -> Project A -> Project B' });
    expect(subprojectErrorText(m)).toContain('Project B -> Project A -> Project B');
    expect(subprojectErrorText('SUBPROJECT_DISABLED: switch on')).toBe('Switch on "Subprojects" in the settings of the project first.');
    expect(subprojectErrorText('SUBPROJECT_BAD_TASK: only a task')).toContain('Only a task');
    expect(subprojectErrorText('SUBPROJECT_IN_USE: 2 task(s) of this project stand for a subproject - clear them first')).toContain('2 task(s)');
  });
  it('any other message is not ours', () => {
    expect(parseSubprojectError('deadlock detected')).toBeNull();
    expect(subprojectErrorText('boom')).toBeUndefined();
    expect(subprojectErrorText('SUBPROJECT_UNKNOWN: x')).toBeUndefined();
  });
  it('the translation function is applied to the fixed part', () => {
    expect(subprojectErrorText('SUBPROJECT_NOT_FOUND: x', (s) => `[${s}]`)).toBe('[The project does not exist or you cannot see it.]');
  });
});

describe('the picker rows', () => {
  it('parseSubprojectCandidate reads the RPC row', () => {
    expect(parseSubprojectCandidate({ projectGUID: 'p1', projectName: 'B', startAt: '2026-11-02T00:00:00Z', finishAt: null, usedByCount: 2 }))
      .toEqual({ projectGUID: 'p1', projectName: 'B', startAt: '2026-11-02T00:00:00Z', finishAt: null, usedByCount: 2 });
    expect(parseSubprojectCandidate({})).toEqual({ projectGUID: '', projectName: '', startAt: null, finishAt: null, usedByCount: 0 });
  });
});

describe('Monitor01 radio: Projects | Subprojects | All', () => {
  const rows = [{ rowProjectGUID: 'A', n: 1 }, { rowProjectGUID: 'B', n: 2 }, { rowProjectGUID: 'C', n: 3 }];
  const subs = new Set(['B']);
  it('Projects is the default', () => expect(MONITOR01_PROJECT_KIND_DEFAULT).toBe('projects'));
  it('Projects keeps the projects that are not a subproject; Subprojects the ones that are; All everything', () => {
    expect(filterMonitor01RowsByProjectKind(rows, 'projects', subs).map((r) => r.n)).toEqual([1, 3]);
    expect(filterMonitor01RowsByProjectKind(rows, 'subprojects', subs).map((r) => r.n)).toEqual([2]);
    expect(filterMonitor01RowsByProjectKind(rows, 'all', subs)).toBe(rows);
  });
  it('the radio is not shown (null set): no row is cut, whatever the kind is', () => {
    expect(filterMonitor01RowsByProjectKind(rows, 'projects', null)).toBe(rows);
    expect(filterMonitor01RowsByProjectKind(rows, 'subprojects', null)).toBe(rows);
  });
});
