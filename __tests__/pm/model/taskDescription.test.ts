// rowJSON.taskDescription (2026-10-18): the text of a task row (project_task_table, templates_project_task_table, version_project_task_table).
// It was rowJSON.name; the projects keep name. The SQL upgrade renames the key in existing rows, an old project file is read through taskJSONOfFile.
import { taskJSONOfFile } from '../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { buildDemoData } from '../../../kit8/pm/model/seedDemo';
import { codeSql } from '../../sql/sqlFilesTestKit';

describe('taskJSONOfFile (an old project file)', () => {
  it('renames name -> taskDescription and keeps the other keys', () => {
    expect(taskJSONOfFile({ rowKind: 'task', name: 'Old', durationDays: 2 })).toEqual({ rowKind: 'task', taskDescription: 'Old', durationDays: 2 });
  });
  it('a new file is not changed; taskDescription wins over name', () => {
    expect(taskJSONOfFile({ rowKind: 'stage', taskDescription: 'New', durationDays: 0 })).toEqual({ rowKind: 'stage', taskDescription: 'New', durationDays: 0 });
    expect(taskJSONOfFile({ name: 'x', taskDescription: 'y' })).toEqual({ taskDescription: 'y' });
  });
  it('an empty JSON gives an empty description', () => {
    expect(taskJSONOfFile(undefined)).toEqual({ taskDescription: '' });
  });
});

describe('the demo data', () => {
  it('tasks and stages have taskDescription, projects have name', () => {
    const demo = buildDemoData('owner', Date.UTC(2026, 0, 5), (() => { let n = 0; return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`; })());
    for (const t of demo.tasks) {
      expect((t.rowJSON as any).name).toBeUndefined();
      expect(typeof t.rowJSON.taskDescription).toBe('string');
    }
    for (const p of demo.projects) expect(typeof p.rowJSON.name).toBe('string');
  });
});

describe('start2_sql_code.sql', () => {
  it('reads the text of a task from taskDescription (aliases t / tk / p_task are task rows)', () => {
    expect(codeSql).not.toMatch(/\b(t|tk)\."rowJSON"->>'name'/);
    expect(codeSql).not.toMatch(/p_task\."rowJSON"->>'name'/);
    expect(codeSql).toContain(`COALESCE(tk."rowJSON"->>'taskDescription', '')`);
    expect(codeSql).toContain(`jsonb_build_object('rowKind', 'task', 'taskDescription', v_task->>'name'`);
  });
  it('renames the key of the existing rows of the three task tables once (user triggers off, so updated_at stays)', () => {
    const at = codeSql.indexOf('-- upgrade 2026-10-18: the text of a task row');
    expect(at).toBeGreaterThan(0);
    const block = codeSql.slice(at, at + 2000);
    for (const t of ['project_task_table', 'templates_project_task_table', 'version_project_task_table']) expect(block).toContain(`'${t}'`);
    expect(block).toContain('DISABLE TRIGGER USER');
    expect(block).toContain('ENABLE TRIGGER USER');
    expect(block).toContain(`WHERE "rowJSON" ? 'name'`);
  });
});
