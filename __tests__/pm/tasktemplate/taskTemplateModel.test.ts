// Task templates: the pure helpers of kit8/pm/tasktemplate/model/taskTemplateTypes.ts
import {
  defaultTaskTemplateTitle,
  describeTaskTemplate,
  fillResultMessage,
  normalizeFillResult,
  normalizeTaskTemplate,
  PM_TASK_TEMPLATE_TITLE_MAX,
  templateCreatorLabel,
  validateTaskTemplateTitle,
} from '../../../kit8/pm/tasktemplate/model/taskTemplateTypes';

const row = (json: Record<string, any> = {}, extra: Record<string, any> = {}) =>
  normalizeTaskTemplate({ rowGUID: 't1', rowOrganizationGUID: 'org', rowOwnerGUID: 'u1', orderInList: '3', created_at: '2026-10-26T10:00:00.000Z', rowJSON: { templateTitle: 'Foundation', templateKind: 'stage', templateRowCount: 3, templateLineCount: 4, ...json }, ...extra });

describe('normalize', () => {
  it('numbers become numbers, a missing kind is a task, a missing rowJSON does not crash', () => {
    const r = row();
    expect(r.orderInList).toBe(3);
    expect(r.rowJSON).toMatchObject({ templateKind: 'stage', templateRowCount: 3, templateLineCount: 4 });
    const bare = normalizeTaskTemplate({ rowGUID: 'x' });
    expect(bare.rowJSON).toMatchObject({ templateTitle: '', templateKind: 'task', templateRowCount: 0, templateLineCount: 0 });
    expect(normalizeTaskTemplate({ rowGUID: 'x', rowJSON: { templateKind: 'weird' } }).rowJSON.templateKind).toBe('task');
  });
  it('the answer of the fill RPC', () => {
    expect(normalizeFillResult({ mode: 'tree', tasks: '2', lines: 4, dependencies: 1 })).toEqual({ mode: 'tree', tasks: 2, lines: 4, dependencies: 1 });
    expect(normalizeFillResult(null)).toEqual({ mode: 'single', tasks: 0, lines: 0, dependencies: 0 });
  });
});

describe('titles', () => {
  it('an empty title or a long one is refused', () => {
    expect(validateTaskTemplateTitle('   ')).toBe('Enter a template title');
    expect(validateTaskTemplateTitle('x'.repeat(PM_TASK_TEMPLATE_TITLE_MAX + 1))).toContain(String(PM_TASK_TEMPLATE_TITLE_MAX));
    expect(validateTaskTemplateTitle(' Foundation ')).toBeNull();
  });
  it('the default title is the name of the task, cut to the maximum', () => {
    expect(defaultTaskTemplateTitle('  Pour concrete ')).toBe('Pour concrete');
    expect(defaultTaskTemplateTitle(undefined)).toBe('Task');
    expect(defaultTaskTemplateTitle('y'.repeat(200))).toHaveLength(PM_TASK_TEMPLATE_TITLE_MAX);
  });
});

describe('texts of the picker', () => {
  it('describe: kind, rows, lines, project, day', () => {
    expect(describeTaskTemplate(row({ templateSourceProjectName: 'Railway' }))).toMatch(/^Stage · 3 rows · 4 lines · from Railway · 2026-10-2\d$/);
    expect(describeTaskTemplate(row({ templateKind: 'task', templateRowCount: 1, templateLineCount: 1 }, { created_at: undefined }))).toBe('Task · 1 row · 1 line');
  });
  it('the creator: "by you" for my own, else the e-mail', () => {
    expect(templateCreatorLabel(row(), 'u1')).toBe('by you');
    expect(templateCreatorLabel(row({ templateCreatedByEmail: 'anna@acme.test' }), 'u2')).toBe('by anna@acme.test');
    expect(templateCreatorLabel(row(), 'u2')).toBe('');
  });
  it('the snackbar after a fill reminds of Recalculate only when lines were copied', () => {
    expect(fillResultMessage({ mode: 'tree', tasks: 2, lines: 4, dependencies: 1 })).toBe('Filled from the template: 2 rows, 4 lines. Press Recalculate in the Finances table for the sums in the currencies of the project.');
    expect(fillResultMessage({ mode: 'tree', tasks: 1, lines: 0, dependencies: 0 })).toBe('Filled from the template: 1 row, 0 lines.');
    expect(fillResultMessage({ mode: 'single', tasks: 0, lines: 1, dependencies: 0 })).toContain('1 line.');
  });
});
