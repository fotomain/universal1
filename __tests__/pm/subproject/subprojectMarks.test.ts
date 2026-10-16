// Subproject marks on an origin task: the label, the tip and the date warning.
import { buildSubprojectMarks, subprojectDatesConflict, subprojectLabelOf } from '../../../kit8/pm/subproject/subprojectMarks';

const DAY = 86400000;
const d = (s: string) => Date.parse(`${s}T00:00:00Z`);
const link = { taskGUID: 't1', subprojectGUID: 'pb', subprojectName: 'Project B', linkStartAt: '2026-11-02T00:00:00Z', linkFinishAt: '2026-11-10T00:00:00Z' };

describe('subprojectDatesConflict', () => {
  const same = { startMs: d('2026-11-02'), finishMs: d('2026-11-10') };
  it('same start day and finish day: no warning', () => expect(subprojectDatesConflict(same, link, true)).toBe(false));
  it('a start later by a day: warning', () => expect(subprojectDatesConflict({ ...same, startMs: same.startMs + DAY }, link, true)).toBe(true));
  it('a finish later by a day: warning', () => expect(subprojectDatesConflict({ ...same, finishMs: same.finishMs + DAY }, link, true)).toBe(true));
  it('hours inside the same day are not a conflict', () => expect(subprojectDatesConflict({ startMs: same.startMs + 3600000, finishMs: same.finishMs + 3600000 }, link, true)).toBe(false));
  it('the project does not make the task follow the dates (switch off): no warning', () => expect(subprojectDatesConflict({ ...same, startMs: same.startMs + 5 * DAY }, link, false)).toBe(false));
  it('the subproject is not scheduled yet, or the task has no schedule: no warning', () => {
    expect(subprojectDatesConflict(same, { linkStartAt: null, linkFinishAt: null }, true)).toBe(false);
    expect(subprojectDatesConflict(undefined, link, true)).toBe(false);
    expect(subprojectDatesConflict(same, { linkStartAt: 'x', linkFinishAt: 'y' }, true)).toBe(false);
  });
});

describe('buildSubprojectMarks / subprojectLabelOf', () => {
  const schedule = { t1: { startMs: d('2026-11-02'), finishMs: d('2026-11-10') } };
  it('a mark per origin task with the name and a tip with the dates (the finish shown is the last day)', () => {
    const m = buildSubprojectMarks([link], schedule, true);
    expect(m.t1).toMatchObject({ subprojectGUID: 'pb', name: 'Project B', conflict: false });
    expect(m.t1.tip).toBe('Subproject: Project B (2026-11-02 - 2026-11-09)');
  });
  it('a conflict says so in the tip', () => {
    const m = buildSubprojectMarks([link], { t1: { startMs: d('2026-11-04'), finishMs: d('2026-11-10') } }, true);
    expect(m.t1.conflict).toBe(true);
    expect(m.t1.tip).toContain('the dates of this task differ from the subproject');
  });
  it('a missing name falls back to the GUID', () => expect(buildSubprojectMarks([{ ...link, subprojectName: '' }], schedule, true).t1.name).toBe('pb'));
  it('the label: the task name, then the subproject in brackets, then "!" on a conflict; no mark = the name as it is', () => {
    const ok = buildSubprojectMarks([link], schedule, true).t1;
    const bad = buildSubprojectMarks([link], { t1: { startMs: d('2026-11-04'), finishMs: d('2026-11-10') } }, true).t1;
    expect(subprojectLabelOf('Task 111', ok)).toBe('Task 111  [Project B]');
    expect(subprojectLabelOf('Task 111', bad)).toBe('Task 111  [Project B] !');
    expect(subprojectLabelOf('Task 111', undefined)).toBe('Task 111');
  });
});
