// The model of the initial program data: the definition, the files, what a status means, what the application does about it.
import {
  CALENDARS_WITH_DAYS, chunk, defaultChecked, evaluateStatus, fileKeys, gateDecision, INITIAL_GROUPS, INITIAL_TABLES, InitialDataStatus, INSTALL_CHUNK, isCompletelyEmpty,
  missingRows, requiredKeysOf, requiredMissingGroups, rowKeyOf, statusArgument,
} from '../../kit8/initial/data/code/initialDataModel';
import { loadAllInitialFiles, loadInitialFile } from '../../kit8/initial/data/code/loadInitialJson';

const files = loadAllInitialFiles();

/** the answer of a database that has EVERYTHING of the files */
function fullStatus(overrides: Partial<InitialDataStatus> = {}): InitialDataStatus {
  const tables: InitialDataStatus['tables'] = {};
  for (const t of INITIAL_TABLES) tables[t.table] = { rows: files[t.table].rows.length, found: fileKeys(t, files[t.table]) };
  tables.managementCalendarDaysTable = { rows: 5000, found: [...CALENDARS_WITH_DAYS] };
  tables.application_permission_table = { rows: 1, found: ['permissionApplicationAdmin'] };
  return { tables, year: 2026, signedIn: true, canWrite: true, canWriteApplication: true, isApplicationAdmin: true, bootstrap: false, ...overrides };
}
function emptyStatus(overrides: Partial<InitialDataStatus> = {}): InitialDataStatus {
  const tables: InitialDataStatus['tables'] = {};
  for (const t of INITIAL_TABLES) tables[t.table] = { rows: 0, found: [] };
  tables.managementCalendarDaysTable = { rows: 0, found: [] };
  tables.application_permission_table = { rows: 0, found: [] };
  return { tables, year: 2026, signedIn: true, canWrite: true, canWriteApplication: true, isApplicationAdmin: false, bootstrap: true, ...overrides };
}
const group = (ev: ReturnType<typeof evaluateStatus>, id: string) => ev.find((g) => g.id === id)!;

describe('the definition', () => {
  it('the administrator comes first (the read only catalogs need him), the rates after the currencies', () => {
    const ids = INITIAL_GROUPS.map((g) => g.id);
    expect(ids[0]).toBe('admin');
    expect(ids.indexOf('rates')).toBeGreaterThan(ids.indexOf('currencies'));
    expect(ids.indexOf('budgetItems')).toBeGreaterThan(ids.indexOf('genus'));
  });
  it('the tier A groups come before every tier B group', () => {
    const tiers = INITIAL_GROUPS.map((g) => g.tier).join('');
    expect(tiers).toMatch(/^A+B+$/);
  });
  it('every table and every file name is unique; every table has a file that is bundled', () => {
    expect(new Set(INITIAL_TABLES.map((t) => t.table)).size).toBe(INITIAL_TABLES.length);
    expect(new Set(INITIAL_TABLES.map((t) => t.file)).size).toBe(INITIAL_TABLES.length);
    for (const t of INITIAL_TABLES) expect(loadInitialFile(t.table).table).toBe(t.table);
  });
  it('a table of the natural key kind names its key column; the others are known by the rowGUID', () => {
    for (const t of INITIAL_TABLES) {
      if (t.mode === 'json') expect(t.keyColumn).toBeTruthy();
      else expect(t.keyColumn).toBeUndefined();
    }
  });
  it('the required keys exist in the files', () => {
    for (const t of INITIAL_TABLES) {
      const have = new Set(fileKeys(t, files[t.table]));
      for (const k of requiredKeysOf(t, files[t.table])) expect(have.has(k)).toBe(true);
    }
  });
  it('the three catalogs the client can only read are marked application', () => {
    expect(INITIAL_TABLES.filter((t) => t.level === 'application').map((t) => t.table).sort()).toEqual(['language_catalog', 'managementRACIGenusTable', 'project_permission_profile_catalog']);
  });
  it('business units: all 29 are in (Q4), parents before children', () => {
    const rows = files.businessUnitTable.rows;
    expect(rows.length).toBe(29);
    const seen = new Set<string>();
    for (const r of rows) {
      if (r.rowParentGUID !== 'empty') expect(seen.has(r.rowParentGUID)).toBe(true);
      seen.add(r.rowGUID as string);
    }
  });
});

describe('statusArgument / rowKeyOf / chunk / missingRows', () => {
  it('asks for every table of the list and the two special entries', () => {
    const arg = statusArgument(files);
    expect(Object.keys(arg).sort()).toEqual([...INITIAL_TABLES.map((t) => t.table), 'application_permission_table', 'managementCalendarDaysTable'].sort());
    expect(arg.currencyTable).toContain('eur');
    expect(arg.managementGenusTable).toContain('timeGenus');
  });
  it('a natural key is lower case, a rowGUID stays as it is', () => {
    const cur = INITIAL_TABLES.find((t) => t.table === 'currencyTable')!;
    expect(rowKeyOf(cur, { rowOwnerGUID: 'x', rowParentGUID: 'x', rowFolderGUID: 'x', orderInList: 1, rowJSON: { currencyCode: 'EUR' } })).toBe('eur');
    expect(files.currencyTable.rows.every((r) => r.rowGUID === undefined)).toBe(true);
  });
  it('chunk makes pieces of at most INSTALL_CHUNK rows (the SQL refuses more than 1000)', () => {
    expect(INSTALL_CHUNK).toBeLessThanOrEqual(1000);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
    const pieces = chunk(files.project_permission_profile_crud_table.rows);
    expect(pieces.every((p) => p.length <= INSTALL_CHUNK)).toBe(true);
    expect(pieces.flat().length).toBe(files.project_permission_profile_crud_table.rows.length);
  });
  it('missingRows are the rows of the file the database does not have', () => {
    const t = INITIAL_TABLES.find((x) => x.table === 'managementGenusTable')!;
    const st = fullStatus();
    st.tables.managementGenusTable.found = st.tables.managementGenusTable.found.filter((k) => k !== 'timeGenus');
    expect(missingRows(t, files.managementGenusTable, st).map((r) => r.rowGUID)).toEqual(['timeGenus']);
  });
});

describe('evaluateStatus', () => {
  it('a database that has everything: every group complete and satisfied', () => {
    const ev = evaluateStatus(fullStatus(), files, true);
    for (const g of ev) { expect(g.state).toBe('complete'); expect(g.requiredOk).toBe(true); }
    expect(requiredMissingGroups(ev)).toEqual([]);
    expect(defaultChecked(ev)).toEqual([]);
  });
  it('an empty database: every group missing, nothing found, completely empty', () => {
    const ev = evaluateStatus(emptyStatus(), files, false);
    for (const g of ev) { expect(g.state).toBe('missing'); expect(g.found).toBe(0); }
    expect(isCompletelyEmpty(ev)).toBe(true);
    expect(requiredMissingGroups(ev).map((g) => g.id)).toEqual(INITIAL_GROUPS.filter((g) => g.tier === 'A').map((g) => g.id));
    // every group is checked by default, the optional ones too (Q4: all units)
    expect(defaultChecked(ev)).toEqual(INITIAL_GROUPS.map((g) => g.id));
  });
  it('a tier B group with rows missing does not make the application wait', () => {
    const st = fullStatus();
    st.tables.businessUnitTable.found = st.tables.businessUnitTable.found.slice(0, 5);
    const ev = evaluateStatus(st, files, true);
    expect(group(ev, 'businessUnits').state).toBe('partly');
    expect(requiredMissingGroups(ev)).toEqual([]);
    expect(gateDecision(ev, st)).toEqual({ kind: 'ready' });
    expect(defaultChecked(ev)).toEqual(['businessUnits']);
  });
  it('a required key that the user deleted is missing; a budget item nobody needs is not', () => {
    const st = fullStatus();
    st.tables.measureUnitTable.found = st.tables.measureUnitTable.found.filter((k) => k !== 'unit_hour');
    st.tables.budgetItemTable.found = st.tables.budgetItemTable.found.filter((k) => k !== 'dividendsPaidBudgetItem');
    const ev = evaluateStatus(st, files, true);
    expect(group(ev, 'units').requiredOk).toBe(false);
    expect(group(ev, 'units').tables.find((t) => t.table === 'measureUnitTable')!.requiredMissing).toEqual(['unit_hour']);
    expect(group(ev, 'budgetItems').requiredOk).toBe(true);
    expect(group(ev, 'budgetItems').state).toBe('partly');
  });
  it('the matrix needs at least one CRUD row', () => {
    const st = fullStatus();
    st.tables.project_permission_profile_crud_table = { rows: 0, found: [] };
    expect(group(evaluateStatus(st, files, true), 'permissions').requiredOk).toBe(false);
  });
  it('the days of the two calendars the application needs are required, the other calendars are not', () => {
    const st = fullStatus();
    st.tables.managementCalendarDaysTable.found = ['standardWorkWeekCalendar', 'sixDayWeekCalendar'];
    const g = group(evaluateStatus(st, files, true), 'calendars');
    expect(g.requiredOk).toBe(false);
    expect(g.note).toContain('workingDaysCalendar');
    st.tables.managementCalendarDaysTable.found = ['workingDaysCalendar', 'standardWorkWeekCalendar'];
    expect(group(evaluateStatus(st, files, true), 'calendars').requiredOk).toBe(true);
  });
  it('no administrator / no rate of 31 December: those groups are missing', () => {
    const st = fullStatus();
    st.tables.application_permission_table = { rows: 0, found: [] };
    const ev = evaluateStatus(st, files, false);
    expect(group(ev, 'admin').requiredOk).toBe(false);
    expect(group(ev, 'rates').requiredOk).toBe(false);
    expect(group(ev, 'rates').note).toContain('31 December');
    expect(evaluateStatus(st, files, null).find((g) => g.id === 'rates')!.requiredOk).toBe(false);
  });
  it('no group is locked: the default ticks what is missing, a complete group is not ticked', () => {
    const ev = evaluateStatus(emptyStatus(), files, false);
    expect(defaultChecked(ev)).toContain('genus');
    expect(defaultChecked(ev)).toContain('countries');
  });
});

describe('gateDecision (Q2 of the owner)', () => {
  it('everything required is there: ready, nothing is shown', () => {
    expect(gateDecision(evaluateStatus(fullStatus(), files, true), fullStatus())).toEqual({ kind: 'ready' });
  });
  it('NOTHING exists: run by itself (auto) - all groups', () => {
    const st = emptyStatus();
    const d = gateDecision(evaluateStatus(st, files, false), st);
    expect(d.kind).toBe('auto');
    expect((d as any).groups).toEqual(INITIAL_GROUPS.map((g) => g.id));
  });
  it('a PART exists: open the list, the user presses Create', () => {
    const st = fullStatus();
    st.tables.managementGenusTable = { rows: 0, found: [] };
    const d = gateDecision(evaluateStatus(st, files, true), st);
    expect(d.kind).toBe('open');
    expect((d as any).groups).toEqual(['genus']);
  });
  it('an existing currency alone is a part: not "completely empty"', () => {
    const st = emptyStatus();
    st.tables.currencyTable = { rows: 1, found: ['eur'] };
    expect(gateDecision(evaluateStatus(st, files, false), st).kind).toBe('open');
  });
  it('a user who may not write is blocked, with the reason', () => {
    const st = emptyStatus({ canWrite: false });
    expect(gateDecision(evaluateStatus(st, files, false), st)).toMatchObject({ kind: 'blocked', reason: 'noRight' });
  });
  it('the read only catalogs missing and the user is no application administrator: blocked', () => {
    const st = emptyStatus({ canWriteApplication: false, bootstrap: false });
    expect(gateDecision(evaluateStatus(st, files, false), st)).toMatchObject({ kind: 'blocked', reason: 'needsApplicationAdmin' });
  });
  it('the read only catalogs are there, only an ordinary catalog is missing: an administrator of the organization is enough', () => {
    const st = fullStatus({ canWriteApplication: false, isApplicationAdmin: false });
    st.tables.managementGenusTable = { rows: 0, found: [] };
    expect(gateDecision(evaluateStatus(st, files, true), st).kind).toBe('open');
  });
});
