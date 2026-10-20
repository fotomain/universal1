// The dates of a task edited in the toolbar of the task window (kit8/pm/view/task/taskDatesModel.ts): who can edit, what a typed start / finish / a picked period writes.
import { parseTaskDay, taskDatesPatch, taskDatesReadOnlyReason, taskPeriodPatch } from '../../../kit8/pm/view/task/taskDatesModel';

const base = (over: Record<string, any> = {}) => ({ json: { rowKind: 'task', durationDays: 5, manualStartAt: '2026-11-02T00:00:00.000Z', ...over }, hasChildren: false, subDay: false, skipWeekends: false, format: 'YYYY-MM-DD' as const });
const D = (iso: string) => Date.parse(iso + 'T00:00:00Z');

describe('who can edit the dates here', () => {
  it('a leaf task and a milestone in a project planned in days', () => {
    expect(taskDatesReadOnlyReason(base())).toBeNull();
    expect(taskDatesReadOnlyReason(base({ rowKind: 'milestone' }))).toBeNull();
  });
  it('not a stage or a task with children, not a task that follows its subproject, not with hours / minutes / seconds on', () => {
    expect(taskDatesReadOnlyReason(base({ rowKind: 'stage' }))).toMatch(/stage/);
    expect(taskDatesReadOnlyReason({ ...base(), hasChildren: true })).toMatch(/stage/);
    expect(taskDatesReadOnlyReason(base({ taskIsSubproject: true }))).toMatch(/subproject/);
    expect(taskDatesReadOnlyReason({ ...base(), subDay: true })).toMatch(/task form/);
  });
});

describe('parseTaskDay', () => {
  it('YYYY-MM-DD and the project format; anything else is null', () => {
    expect(parseTaskDay('2026-11-09', 'YYYY-MM-DD')).toBe(D('2026-11-09'));
    expect(parseTaskDay('09.11.2026', 'DD.MM.YYYY')).toBe(D('2026-11-09'));
    expect(parseTaskDay('', 'YYYY-MM-DD')).toBeNull();
    expect(parseTaskDay('2026-1', 'YYYY-MM-DD')).toBeNull();
  });
});

describe('taskDatesPatch', () => {
  it('a new start writes manualStartAt and keeps the duration (the finish follows)', () => {
    expect(taskDatesPatch(base(), { start: '2026-11-09' }, D('2026-11-02'))).toEqual({ json: { manualStartAt: '2026-11-09T00:00:00.000Z' } });
  });
  it('a new finish sets the duration in WORKING days from the start (inclusive of the finish day)', () => {
    expect(taskDatesPatch(base(), { finish: '2026-11-13' }, D('2026-11-02'))).toEqual({ json: { durationDays: 12 } });                 // 2 .. 13 Nov, every day counts
    expect(taskDatesPatch({ ...base(), skipWeekends: true }, { finish: '2026-11-13' }, D('2026-11-02'))).toEqual({ json: { durationDays: 10 } });   // weekends skipped
  });
  it('a finish before the start is refused with a message; a finish with no start known too', () => {
    expect(taskDatesPatch(base(), { finish: '2026-11-01' }, D('2026-11-02'))).toEqual({ error: 'Finish date cannot be before start date.' });
    expect(taskDatesPatch(base(), { finish: '2026-11-20' }, null)).toEqual({ error: 'Set the start date first' });
  });
  it('an unreadable text, the same dates, a read only task: nothing is written', () => {
    expect(taskDatesPatch(base(), { start: '2026-1' }, D('2026-11-02'))).toBeNull();
    expect(taskDatesPatch(base(), { start: '2026-11-02' }, D('2026-11-02'))).toBeNull();
    expect(taskDatesPatch(base({ rowKind: 'stage' }), { start: '2026-11-09' }, D('2026-11-02'))).toBeNull();
  });
  it('a milestone has one date: the finish is not written', () => {
    expect(taskDatesPatch(base({ rowKind: 'milestone', durationDays: 0 }), { finish: '2026-12-01' }, D('2026-11-02'))).toBeNull();
    expect(taskDatesPatch(base({ rowKind: 'milestone', durationDays: 0 }), { start: '2026-11-09' }, D('2026-11-02'))).toEqual({ json: { manualStartAt: '2026-11-09T00:00:00.000Z' } });
  });
});

describe('taskPeriodPatch (Select period: a range of months)', () => {
  it('writes the start AND the finish at once', () => {
    const p: any = taskPeriodPatch(base(), { startDate: '2026-12-01', finishDate: '2026-12-31' }, D('2026-11-02'));
    expect(p.json.manualStartAt).toBe('2026-12-01T00:00:00.000Z');
    expect(p.json.durationDays).toBe(31);
  });
});
