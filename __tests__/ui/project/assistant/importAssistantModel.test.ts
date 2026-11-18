// The Import New Project Assistant: what a project file says, the notes of its steps (pure).
import { IMPORT_STEPS, importHasError, importNameNotes, importStepNotes, summarizeProjectFile } from '../../../../kit8/ui/project/assistant/import/importAssistantModel';
import { buildProjectExchangeFile } from '../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';

const project: any = { rowGUID: 'p1', rowOwnerGUID: 'o', rowParentGUID: 'org', orderInList: 1, rowJSON: { name: 'Plant 7', projectStartAt: '2026-12-01T00:00:00.000Z' } };
const task = (id: string): any => ({ rowGUID: id, projectGUID: 'p1', treePath: id, rowJSON: { taskDescription: id } });

describe('summarizeProjectFile', () => {
  it('counts tasks and dependencies and reads the start', () => {
    const file = buildProjectExchangeFile(project, [task('a'), task('b')], [{ rowGUID: 'd1', projectGUID: 'p1' } as any], undefined, new Date('2026-11-17T00:00:00Z'));
    const r = summarizeProjectFile(JSON.stringify(file), 'project_data_p1.json');
    expect(r).toMatchObject({ ok: true, summary: { sourceProjectName: 'Plant 7', tasks: 2, dependencies: 1, startDate: '2026-12-01', fileName: 'project_data_p1.json' } });
  });
  it('refuses a file that is not a project file, with a reason', () => {
    const r = summarizeProjectFile('{"hello": 1}', 'x.json');
    expect(r.ok).toBe(false);
    expect((r as any).error).toBeTruthy();
    expect(summarizeProjectFile('not json', 'x.json').ok).toBe(false);
  });
});

describe('notes', () => {
  const summary: any = { fileName: 'f.json', sourceProjectName: 'Plant 7', tasks: 0, dependencies: 0, exportedAt: '', startDate: '', startMs: 0 };
  it('the file step needs a file; an empty file is a warning', () => {
    expect(importHasError(importStepNotes('file', null, '', []))).toBe(true);
    const empty = importStepNotes('file', summary, 'x', []);
    expect(importHasError(empty)).toBe(false);
    expect(empty.some((n) => n.level === 'warning')).toBe(true);
  });
  it('the name is required; a duplicate is a warning', () => {
    expect(importHasError(importNameNotes('  ', []))).toBe(true);
    expect(importNameNotes('plant 7', ['Plant 7'])[0].level).toBe('warning');
    expect(importNameNotes('Plant 8', ['Plant 7'])).toEqual([]);
  });
  it('has the three steps in order', () => {
    expect(IMPORT_STEPS.map((s) => s.id)).toEqual(['file', 'name', 'import']);
  });
});
