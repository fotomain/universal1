// Task templates (documentation/TASK_TEMPLATE_WBS.html, SQL PART 40): names of the tables / RPCs, the row types and the pure helpers.
// A template is a task (or a stage with everything inside it) saved for the whole ORGANIZATION; "Fill from template" copies it into another task.

export const taskTemplateHeaderTable = 'task_template_header';
export const pmRpcTaskTemplateSave = 'task_template_save';
export const pmRpcTaskTemplateFill = 'task_template_fill';
export const pmRpcTaskTemplateSetTitle = 'task_template_set_title';

export const PM_TASK_TEMPLATE_TITLE_MAX = 80;
export const PM_TASK_TEMPLATE_DESCRIPTION_MAX = 500;

/** a template with more rows takes seconds to fill (SQL: 5 000 rows is the most Save accepts) */
export const PM_TASK_TEMPLATE_BIG_FROM = 500;

export type PMTaskTemplateKind = 'task' | 'stage' | 'milestone';

/** task_template_header.rowJSON */
export interface PMTaskTemplateJSON {
  templateTitle: string;
  templateDescription?: string;
  /** the kind of the top row */
  templateKind: PMTaskTemplateKind;
  templateSourceTaskName?: string;
  templateSourceProjectGUID?: string;
  templateSourceProjectName?: string;
  templateCreatedByEmail?: string;
  /** all rows of the template, the top row included */
  templateRowCount: number;
  templateLineCount: number;
}

export interface PMTaskTemplateRow {
  rowGUID: string;
  rowOrganizationGUID: string;
  /** the user who saved it */
  rowOwnerGUID: string;
  orderInList: number;
  rowJSON: PMTaskTemplateJSON;
  created_at?: string;
  updated_at?: string;
}

/** what task_template_fill answers: 'single' = the lines (and the data) of ONE task went into the target, 'tree' = the rows inside the top row were created inside the target */
export interface PMTaskTemplateFillResult {
  mode: 'single' | 'tree';
  tasks: number;
  lines: number;
  dependencies: number;
}

export function normalizeTaskTemplate(row: any): PMTaskTemplateRow {
  const json = (row?.rowJSON || {}) as Partial<PMTaskTemplateJSON>;
  return {
    ...row,
    orderInList: Number(row?.orderInList) || 0,
    rowJSON: {
      ...json,
      templateTitle: String(json.templateTitle ?? ''),
      templateKind: json.templateKind === 'stage' || json.templateKind === 'milestone' ? json.templateKind : 'task',
      templateRowCount: Number(json.templateRowCount) || 0,
      templateLineCount: Number(json.templateLineCount) || 0,
    },
  };
}

export function normalizeFillResult(raw: any): PMTaskTemplateFillResult {
  return {
    mode: raw?.mode === 'tree' ? 'tree' : 'single',
    tasks: Number(raw?.tasks) || 0,
    lines: Number(raw?.lines) || 0,
    dependencies: Number(raw?.dependencies) || 0,
  };
}

/** null = ok, otherwise the message to show under the input. */
export function validateTaskTemplateTitle(title: string): string | null {
  const t = title.trim();
  if (!t) return 'Enter a template title';
  if (t.length > PM_TASK_TEMPLATE_TITLE_MAX) return `At most ${PM_TASK_TEMPLATE_TITLE_MAX} characters`;
  return null;
}

/** The title offered in the "Save to template" window: the name of the task. */
export function defaultTaskTemplateTitle(taskName: string | null | undefined): string {
  return (taskName || 'Task').trim().slice(0, PM_TASK_TEMPLATE_TITLE_MAX);
}

const pad = (n: number) => String(n).padStart(2, '0');
function dayOf(value: string | undefined): string {
  const ms = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** One line under the title in the picker: "Stage · 3 rows · 4 lines · from Project X · 2026-10-26". */
export function describeTaskTemplate(row: PMTaskTemplateRow): string {
  const j = row.rowJSON;
  const what = j.templateKind === 'stage' ? 'Stage' : j.templateKind === 'milestone' ? 'Milestone' : 'Task';
  const rows = j.templateRowCount;
  const parts = [what, `${rows} ${rows === 1 ? 'row' : 'rows'}`, `${j.templateLineCount} ${j.templateLineCount === 1 ? 'line' : 'lines'}`];
  if (j.templateSourceProjectName) parts.push(`from ${j.templateSourceProjectName}`);
  const day = dayOf(row.created_at);
  if (day) parts.push(day);
  return parts.join(' · ');
}

/** The e-mail of the creator shown as "by x" in the picker (the name of the user is not stored on the template). */
export function templateCreatorLabel(row: PMTaskTemplateRow, myUserGUID: string | null | undefined): string {
  if (myUserGUID && row.rowOwnerGUID === myUserGUID) return 'by you';
  const email = row.rowJSON.templateCreatedByEmail;
  return email ? `by ${email}` : '';
}

/** The message of the snackbar after a fill. */
export function fillResultMessage(r: PMTaskTemplateFillResult): string {
  const rows = r.mode === 'tree' ? `${r.tasks} ${r.tasks === 1 ? 'row' : 'rows'}, ` : '';
  const base = `Filled from the template: ${rows}${r.lines} ${r.lines === 1 ? 'line' : 'lines'}.`;
  return r.lines > 0 ? `${base} Press Recalculate in the Finances table for the sums in the currencies of the project.` : base;
}
