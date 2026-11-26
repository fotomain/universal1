// runInitialData - writes the chosen groups, in the install order of the definition, group by group:
//   admin           the first application administrator (only when the database allows it), BEFORE the groups that only an application administrator may write
//   a table         the rows the database does not have, in pieces of INSTALL_CHUNK, through initial_data_install (insert only)
//   calendarDays    initial_data_fill_calendars (the days of last / this / next year; not a file)
//   rates           the rate in force on 31 December of the previous year (rates/ratesApi.fillRatesOfDay; needs the network)
// A failure stops the run at that group with an InitialDataRunError; what was written stays and a second run goes on from there (insert only).
import { bootstrapInitialAdmin, fillInitialCalendars, installInitialRows } from './initialDataApi';
import { chunk, INITIAL_GROUPS, InitialDataStatus, InitialFile, missingRows } from './initialDataModel';
import { fillRatesOfDay, readCurrencies, RatesOfDayResult } from './rates/ratesApi';
import { previousYearEnd } from './rates/ratesModel';

export class InitialDataRunError extends Error {
  constructor(public groupId: string, public table: string | null, message: string) {
    super(message);
    this.name = 'InitialDataRunError';
  }
}

export interface InitialProgress {
  groupId: string;
  groupTitle: string;
  /** 1-based, among the groups of this run */
  groupNumber: number;
  groupCount: number;
  table: string | null;
  /** rows written / total of the table, or 0 / 0 for a step with no rows */
  done: number;
  total: number;
  /** the whole run, 0..1 */
  fraction: number;
  text: string;
}

export interface InitialRunResult {
  inserted: Record<string, number>;
  administrator: boolean;
  calendarYears: number;
  rates: RatesOfDayResult | null;
}

export interface RunInitialDataArgs {
  supabase: any;
  files: Record<string, InitialFile>;
  /** the status from before the run: it says which rows exist */
  status: InitialDataStatus;
  groupIds: string[];
  onProgress?: (p: InitialProgress) => void;
  today?: string;
  /** replaceable in tests */
  fetchFn?: typeof fetch;
}

export async function runInitialData(args: RunInitialDataArgs): Promise<InitialRunResult> {
  const groups = INITIAL_GROUPS.filter((g) => args.groupIds.includes(g.id));
  // the work of the run in rows, so the progress bar moves with the data and not with the number of groups
  const todo = groups.map((g) => ({ g, rows: g.tables.reduce((a, t) => a + missingRows(t, args.files[t.table], args.status).length, 0) + (g.special ? 1 : 0) }));
  const totalWork = Math.max(1, todo.reduce((a, x) => a + x.rows, 0));
  let doneWork = 0;
  const result: InitialRunResult = { inserted: {}, administrator: false, calendarYears: 0, rates: null };
  const emit = (g: (typeof groups)[number], index: number, table: string | null, done: number, total: number, text: string) =>
    args.onProgress?.({ groupId: g.id, groupTitle: g.title, groupNumber: index + 1, groupCount: groups.length, table, done, total, fraction: Math.min(1, doneWork / totalWork), text });

  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    try {
      if (g.special === 'admin') {
        emit(g, gi, null, 0, 0, g.title);
        if (!args.status.isApplicationAdmin && args.status.bootstrap) result.administrator = await bootstrapInitialAdmin(args.supabase);
        doneWork += 1;
      }
      for (const t of g.tables) {
        const rows = missingRows(t, args.files[t.table], args.status);
        if (rows.length === 0) continue;
        let written = 0;
        emit(g, gi, t.table, 0, rows.length, t.table);
        for (const part of chunk(rows)) {
          try {
            const r = await installInitialRows(args.supabase, t.table, part);
            result.inserted[t.table] = (result.inserted[t.table] ?? 0) + r.inserted;
          } catch (e: any) {
            throw new InitialDataRunError(g.id, t.table, e?.message || String(e));
          }
          written += part.length;
          doneWork += part.length;
          emit(g, gi, t.table, written, rows.length, t.table);
        }
      }
      if (g.special === 'calendarDays') {
        emit(g, gi, 'managementCalendarDaysTable', 0, 0, g.title);
        result.calendarYears = await fillInitialCalendars(args.supabase);
        doneWork += 1;
      }
      if (g.special === 'rates') {
        emit(g, gi, 'currencyExchangeRateTable', 0, 0, g.title);
        const currencies = await readCurrencies(args.supabase);
        result.rates = await fillRatesOfDay({ supabase: args.supabase, currencies, day: previousYearEnd(args.today), fetchFn: args.fetchFn });
        doneWork += 1;
      }
    } catch (e: any) {
      if (e instanceof InitialDataRunError) throw e;
      throw new InitialDataRunError(g.id, null, e?.message || String(e));
    }
    emit(g, gi, null, 1, 1, g.title);
  }
  doneWork = totalWork;
  if (groups.length) emit(groups[groups.length - 1], groups.length - 1, null, 1, 1, 'Done');
  return result;
}
