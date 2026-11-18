// The three currencies of an organization (organizationTable.rowJSON.defaultProjectSettings) and what a CHANGE of one of them means.
//   currencyForBudget / currencyForAccounting / currencyForContract = ISO 4217 codes. They are changed ONLY in Organization edit -> Projects -> Settings -> Budgets -> Main
//   (a project shows them read only). When the administrator saves a different currency the screen asks (askPMApprove): Yes = save and RECALCULATE every project of the
//   organization with the new currencies (recalculateOrganizationProjects.ts), No = save only (the existing projects keep theirs), Cancel = save nothing.
// Pure (no React, no Supabase): the rules are tested without a screen.
export const ORGANIZATION_CURRENCY_KEYS = ['currencyForBudget', 'currencyForAccounting', 'currencyForContract'] as const;
export type OrganizationCurrencyKey = (typeof ORGANIZATION_CURRENCY_KEYS)[number];
export type OrganizationCurrencies = Record<OrganizationCurrencyKey, string>;

/** the words of the three currencies (the same titles as the fields of the Budgets tab) */
export const ORGANIZATION_CURRENCY_LABELS: Record<OrganizationCurrencyKey, string> = {
  currencyForBudget: 'Budget currency',
  currencyForAccounting: 'Accounting currency',
  currencyForContract: 'Default currency for contracts',
};

export interface OrganizationCurrencyChange {
  key: OrganizationCurrencyKey;
  label: string;
  /** '' = not set */
  from: string;
  to: string;
}

const codeOf = (v: unknown): string => (typeof v === 'string' ? v.trim().toUpperCase() : '');

/** the three codes of a defaultProjectSettings / a project rowJSON ('' = not set) */
export function organizationCurrenciesOf(settings: Record<string, any> | null | undefined): OrganizationCurrencies {
  return {
    currencyForBudget: codeOf(settings?.currencyForBudget),
    currencyForAccounting: codeOf(settings?.currencyForAccounting),
    currencyForContract: codeOf(settings?.currencyForContract),
  };
}

/** the currencies that differ between the stored settings and the edited ones (empty = nothing changed) */
export function changedOrganizationCurrencies(before: Record<string, any> | null | undefined, after: Record<string, any> | null | undefined): OrganizationCurrencyChange[] {
  const a = organizationCurrenciesOf(before);
  const b = organizationCurrenciesOf(after);
  return ORGANIZATION_CURRENCY_KEYS.filter((key) => a[key] !== b[key]).map((key) => ({ key, label: ORGANIZATION_CURRENCY_LABELS[key], from: a[key], to: b[key] }));
}

/** the keys written into the rowJSON of a project: only the currencies the organization has set (an empty one never wipes a project's currency) */
export function projectCurrencyPatch(next: OrganizationCurrencies): Partial<OrganizationCurrencies> {
  const patch: Partial<OrganizationCurrencies> = {};
  for (const k of ORGANIZATION_CURRENCY_KEYS) if (next[k]) patch[k] = next[k];
  return patch;
}

/** the words of the approval window (pmT keys: the caller translates) */
export const CURRENCY_CHANGE_TITLE = 'Change the currencies of the organization?';
export const CURRENCY_CHANGE_MESSAGE =
  'Yes: save, then recalculate ALL projects of the organization with the new currencies - this OVERWRITES the own currencies of the projects (the sums of the task lines are converted again and the posted tasks are posted again; a project with posted documents is refused and listed). No: save only - the existing projects keep their own currencies. Cancel: do not save.';

export const PROJECT_CURRENCY_CHANGE_TITLE = 'Change the currencies of the project?';
export const PROJECT_CURRENCY_CHANGE_MESSAGE =
  'Yes: save, then recalculate THIS project with the new currencies (the sums of its task lines are converted again and its posted tasks are posted again). The budget and accounting currency cannot change while the project has posted documents (unpost them first). Cancel: do not save.';

/** one line per changed currency: 'Budget currency: USD -> EUR' */
export const currencyChangeLines = (changes: OrganizationCurrencyChange[]): string[] =>
  changes.map((c) => `${c.label}: ${c.from || '-'} → ${c.to || '-'}`);

/** the outcome of the recalculation of ONE project */
export interface ProjectRecalcResult {
  projectGUID: string;
  name: string;
  /** done = recalculated; skipped = left as it was (read only project, no right) ; failed = an error stopped it */
  status: 'done' | 'skipped' | 'failed';
  /** the words for a skipped / failed project */
  reason?: string;
  linesChanged: number;
  tasksPosted: number;
  /** tasks that were posted AND changed before: they need a Post by the user (their posted days are in the old currencies) */
  tasksNeedPost: number;
  /** lines that could not be converted (no exchange rate) */
  linesWithoutRate: number;
  /** tasks whose Post was refused or left lines out */
  postProblems: string[];
}

/** the summary of the whole run for the snackbar */
export function recalcSummary(results: ProjectRecalcResult[]): { message: string; isError: boolean } {
  const done = results.filter((r) => r.status === 'done');
  const skipped = results.filter((r) => r.status === 'skipped');
  const failed = results.filter((r) => r.status === 'failed');
  const lines = done.reduce((s, r) => s + r.linesChanged, 0);
  const posted = done.reduce((s, r) => s + r.tasksPosted, 0);
  const needPost = done.reduce((s, r) => s + r.tasksNeedPost, 0);
  const noRate = done.reduce((s, r) => s + r.linesWithoutRate, 0);
  const parts = [`${done.length} / ${results.length} project(s) recalculated · ${lines} line(s) · ${posted} task(s) posted again`];
  if (needPost) parts.push(`${needPost} task(s) need Post`);
  if (noRate) parts.push(`${noRate} line(s) have no exchange rate`);
  if (skipped.length) parts.push(`${skipped.length} skipped (${skipped[0].name}: ${skipped[0].reason})`);
  if (failed.length) parts.push(`${failed.length} failed (${failed[0].name}: ${failed[0].reason})`);
  return { message: parts.join(' · '), isError: failed.length > 0 || noRate > 0 };
}
