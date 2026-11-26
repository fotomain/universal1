// initialDataApi - the calls of SQL PART 60 (start2_sql_code.sql). All of them are RPCs: the app never writes these tables itself.
import { InitialDataStatus, InitialFile, InitialRow, statusArgument } from './initialDataModel';

const fail = (what: string, error: any): never => {
  throw new Error(`${what}: ${error?.message || String(error)}`);
};

/** what exists (one call); `files` = the files of the application, the keys to look for are theirs */
export async function fetchInitialDataStatus(supabase: any, files: Record<string, InitialFile>): Promise<InitialDataStatus> {
  const { data, error } = await supabase.rpc('initial_data_status', { p_check: statusArgument(files) });
  if (error) fail('initial_data_status', error);
  return data as InitialDataStatus;
}

/** inserts the rows of ONE table that the database does not have (insert only; the function skips what exists) */
export async function installInitialRows(supabase: any, table: string, rows: InitialRow[]): Promise<{ inserted: number; skipped: number }> {
  const { data, error } = await supabase.rpc('initial_data_install', { p_table: table, p_rows: rows });
  if (error) fail(`initial_data_install ${table}`, error);
  return { inserted: Number(data?.inserted ?? 0), skipped: Number(data?.skipped ?? 0) };
}

/** the day rows of the seeded calendars (last, this and next year); returns how many calendar years were made */
export async function fillInitialCalendars(supabase: any): Promise<number> {
  const { data, error } = await supabase.rpc('initial_data_fill_calendars');
  if (error) fail('initial_data_fill_calendars', error);
  return Number(data ?? 0);
}

/** the first application administrator of a new database; false = not possible (somebody is one already, or the database has more than one user) */
export async function bootstrapInitialAdmin(supabase: any): Promise<boolean> {
  const { data, error } = await supabase.rpc('initial_data_bootstrap_admin');
  if (error) fail('initial_data_bootstrap_admin', error);
  return data === true;
}
