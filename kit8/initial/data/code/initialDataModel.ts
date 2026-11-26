// initialDataModel - the initial program data (documentation/INITIAL_DATA_WBS.html): the groups, the tables, what is REQUIRED, and the pure functions that turn the answer of the
// database (initial_data_status, SQL PART 60) into "what is missing" and "what the application does about it". No React, no Supabase here: unit-tested in __tests__/initial.
//   The list itself is initialDataDefinition.json (ONE list for the app, the dump script and the tests).
//   tier A = the application does not work without it (the first run locks the app until it exists) · tier B = optional, in the list with a check box.
import definition from './initialDataDefinition.json';

export type InitialTier = 'A' | 'B';
export type InitialSpecial = 'admin' | 'calendarDays' | 'rates';
export interface InitialRequired { all?: boolean; keys?: string[]; minRows?: number }
export interface InitialTableDef { table: string; file: string; mode: 'guid' | 'json'; keyColumn?: string; level?: 'application'; required: InitialRequired }
export interface InitialGroupDef { id: string; title: string; tier: InitialTier; special?: InitialSpecial; tables: InitialTableDef[] }

export interface InitialRow { rowGUID?: string; rowOwnerGUID: string; rowParentGUID: string; rowFolderGUID: string; orderInList: number; rowJSON: Record<string, any> }
export interface InitialFile { format: string; version: number; table: string; group: string; mode: 'guid' | 'json'; keyColumn?: string; rows: InitialRow[] }

export const INITIAL_GROUPS: InitialGroupDef[] = (definition as any).groups as InitialGroupDef[];
export const INITIAL_TABLES: InitialTableDef[] = INITIAL_GROUPS.flatMap((g) => g.tables);

/** the calendars that get day rows (initial_data_fill_calendars of SQL PART 60 fills the same five) */
export const CALENDARS_WITH_DAYS = ['workingDaysCalendar', 'standardWorkWeekCalendar', 'sixDayWeekCalendar', 'sevenDayWeekCalendar', 'partTime4hCalendar'] as const;
/** the calendars whose days of the current year the application cannot work without */
export const REQUIRED_CALENDAR_DAYS = ['workingDaysCalendar', 'standardWorkWeekCalendar'] as const;
/** the currencies whose rate of 31 December of the previous year must exist (the base currency has no rows) */
export const RATES_REQUIRED_CODES = ['USD', 'EUR', 'GBP'] as const;
/** rows of one install call (the SQL function refuses more than 1000) */
export const INSTALL_CHUNK = 500;

export const initialGroupOf = (id: string) => INITIAL_GROUPS.find((g) => g.id === id);

/** the key of a row: the rowGUID, or the natural key of the table in lower case */
export const rowKeyOf = (t: Pick<InitialTableDef, 'mode' | 'keyColumn'>, row: InitialRow): string =>
  t.mode === 'json' ? String(row.rowJSON?.[t.keyColumn as string] ?? '').toLowerCase() : String(row.rowGUID ?? '');

/** keys of the file, in the way the database compares them (a natural key in lower case) */
export const fileKeys = (t: InitialTableDef, file: InitialFile): string[] => file.rows.map((r) => rowKeyOf(t, r)).filter((k) => k !== '');

/** the keys the application cannot work without (null = the rule is a number of rows, see requiredMinRows) */
export function requiredKeysOf(t: InitialTableDef, file: InitialFile): string[] {
  if (t.required.all) return fileKeys(t, file);
  if (t.required.keys) return t.required.keys.map((k) => (t.mode === 'json' ? k.toLowerCase() : k));
  return [];
}
export const requiredMinRowsOf = (t: InitialTableDef): number => t.required.minRows ?? 0;

/** the argument of initial_data_status: every table with the keys to look for (+ the two special entries) */
export function statusArgument(files: Record<string, InitialFile>): Record<string, string[]> {
  const arg: Record<string, string[]> = {};
  for (const t of INITIAL_TABLES) arg[t.table] = fileKeys(t, files[t.table]);
  arg.managementCalendarDaysTable = [...CALENDARS_WITH_DAYS];
  arg.application_permission_table = [];
  return arg;
}

/** the answer of initial_data_status */
export interface InitialDataStatus {
  tables: Record<string, { rows: number; found: string[] }>;
  year: number;
  signedIn: boolean;
  canWrite: boolean;
  canWriteApplication: boolean;
  isApplicationAdmin: boolean;
  bootstrap: boolean;
}

export type InitialState = 'missing' | 'partly' | 'complete';
export interface TableEvaluation {
  table: string;
  rowsInFile: number;
  rowsInDatabase: number;
  found: number;
  missingKeys: string[];
  /** the required keys / rows that are not there (empty = the application can work) */
  requiredMissing: string[];
  state: InitialState;
  level?: 'application';
}
export interface GroupEvaluation {
  id: string;
  title: string;
  tier: InitialTier;
  special?: InitialSpecial;
  tables: TableEvaluation[];
  rowsInFile: number;
  found: number;
  state: InitialState;
  /** the application can work with what is there */
  requiredOk: boolean;
  /** why a special group is not satisfied (calendar days, administrator, rates) */
  note?: string;
}

const stateOf = (found: number, total: number): InitialState => (total === 0 || found >= total ? 'complete' : found === 0 ? 'missing' : 'partly');

/** @param ratesOk the caller's answer for the special group "rates" (null = not known yet: counts as missing) */
export function evaluateStatus(status: InitialDataStatus, files: Record<string, InitialFile>, ratesOk: boolean | null = null): GroupEvaluation[] {
  return INITIAL_GROUPS.map((g) => {
    const tables: TableEvaluation[] = g.tables.map((t) => {
      const file = files[t.table];
      const keys = fileKeys(t, file);
      const got = status.tables[t.table] ?? { rows: 0, found: [] };
      const have = new Set(got.found);
      const missingKeys = keys.filter((k) => !have.has(k));
      const reqKeys = requiredKeysOf(t, file);
      const requiredMissing = reqKeys.filter((k) => !have.has(k));
      const minRows = requiredMinRowsOf(t);
      if (minRows > 0 && got.rows < minRows) requiredMissing.push(`${minRows} row(s)`);
      return { table: t.table, rowsInFile: keys.length, rowsInDatabase: got.rows, found: keys.length - missingKeys.length, missingKeys, requiredMissing, state: stateOf(keys.length - missingKeys.length, keys.length), level: t.level };
    });
    let rowsInFile = tables.reduce((a, t) => a + t.rowsInFile, 0);
    let found = tables.reduce((a, t) => a + t.found, 0);
    let requiredOk = tables.every((t) => t.requiredMissing.length === 0);
    let note: string | undefined;
    let state: InitialState = stateOf(found, rowsInFile);
    if (g.special === 'admin') {
      const there = (status.tables.application_permission_table?.found ?? []).length > 0;
      rowsInFile = 1; found = there ? 1 : 0; requiredOk = there; state = there ? 'complete' : 'missing';
      if (!there) note = 'Nobody is an application administrator yet';
    } else if (g.special === 'calendarDays') {
      const days = new Set(status.tables.managementCalendarDaysTable?.found ?? []);
      const lacking = REQUIRED_CALENDAR_DAYS.filter((c) => !days.has(c));
      const allDays = CALENDARS_WITH_DAYS.filter((c) => !days.has(c));
      rowsInFile += CALENDARS_WITH_DAYS.length; found += CALENDARS_WITH_DAYS.length - allDays.length;
      if (lacking.length) { requiredOk = false; note = `No days of ${status.year} for: ${lacking.join(', ')}`; }
      state = stateOf(found, rowsInFile);
    } else if (g.special === 'rates') {
      rowsInFile = 1; found = ratesOk ? 1 : 0; requiredOk = !!ratesOk; state = ratesOk ? 'complete' : 'missing';
      if (!ratesOk) note = 'No exchange rate of 31 December of the previous year';
    }
    return { id: g.id, title: g.title, tier: g.tier, special: g.special, tables, rowsInFile, found, state, requiredOk, note };
  });
}

/** the tier A groups that are not satisfied */
export const requiredMissingGroups = (ev: GroupEvaluation[]): GroupEvaluation[] => ev.filter((g) => g.tier === 'A' && !g.requiredOk);

/** nothing of the initial data exists at all (a new database): no key of any table, no days, no administrator */
export function isCompletelyEmpty(ev: GroupEvaluation[]): boolean {
  return ev.every((g) => g.found === 0);
}

export type GateDecision =
  | { kind: 'ready' }
  | { kind: 'auto'; groups: string[] }            // everything is missing: run by itself, only the progress is shown
  | { kind: 'open'; groups: string[] }            // a part is missing: open the list, the user presses Create
  | { kind: 'blocked'; reason: 'noRight' | 'needsApplicationAdmin'; groups: string[] };

/** what the application does at the start; groups = the ids that a run would write (every group that has something missing: tier A first, tier B too) */
export function gateDecision(ev: GroupEvaluation[], status: InitialDataStatus): GateDecision {
  const required = requiredMissingGroups(ev);
  if (required.length === 0) return { kind: 'ready' };
  const groups = ev.filter((g) => g.state !== 'complete').map((g) => g.id);
  if (!status.canWrite) return { kind: 'blocked', reason: 'noRight', groups };
  const needsApp = required.some((g) => g.tables.some((t) => t.level === 'application' && t.requiredMissing.length > 0));
  if (needsApp && !status.canWriteApplication) return { kind: 'blocked', reason: 'needsApplicationAdmin', groups };
  return isCompletelyEmpty(ev) ? { kind: 'auto', groups } : { kind: 'open', groups };
}

/** the groups the list checks by default: every group that has something missing (Q4: all business units too); a complete group is not ticked; the user may change any check box */
export const defaultChecked = (ev: GroupEvaluation[]): string[] => ev.filter((g) => g.state !== 'complete').map((g) => g.id);

/** rows of a file that the database does not have yet (by key) */
export function missingRows(t: InitialTableDef, file: InitialFile, status: InitialDataStatus): InitialRow[] {
  const have = new Set(status.tables[t.table]?.found ?? []);
  return file.rows.filter((r) => !have.has(rowKeyOf(t, r)));
}

/** pieces of at most `size` rows */
export function chunk<T>(items: T[], size: number = INSTALL_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
