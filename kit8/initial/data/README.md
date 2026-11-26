# Initial program data (`kit8/initial/data`)

What an EMPTY Supabase database needs before the application works (the permission matrix, the genus and budget items, the calendars, the currencies ...), and how the
application creates it by itself. Plan: `documentation/INITIAL_DATA_WBS.html`. How it works: `documentation/INITIAL_DATA_HOW_IT_WORKS.html`. SQL: `start2_sql_code.sql` PART 60.

```
kit8/initial/data/
  code/   the TypeScript (and the dump script)        json/   the data (one file per table + manifest.json)
```

## What happens

| | |
|---|---|
| **First run** | after a user is signed in, `InitialDataGate` (mounted in `app/_layout.tsx`) asks ONE question (`initial_data_status`). Everything required is there: nothing is shown. **Nothing exists** (a new database): `CreateInitialProgramData` runs by itself, no approval, only the progress is shown. **A part exists**: the list opens and the user presses Create. While it is open the whole window is covered; at the end the home page opens. A check that cannot be made (PART 60 not installed, no network) does NOT lock the application. |
| **Menu** | Drawer -> System settings -> **Create initial data** (`/system/initialdata`, administrators): the same screen, no lock; add what is missing or was deleted. |
| **The list** | a `ReusableTable` (local rows) of the groups, a check box near each, "In the file / In the database / Status". EVERY check box is free (2026-11-26): the user selects what to create; by default the groups with something missing are ticked, a complete group is not; a missing required group left unticked is named under the lead text. Buttons **Close**, **Skip** (leave without creating; on the first run the gate lets the user in until the next start) and **Create** (+ **Exchange rates**). |
| **Create** | only what the database does not have is sent, in pieces of 500 rows, through `initial_data_install` (INSERT ONLY: a row that exists, by rowGUID or by natural key, is never changed). A failure stops at its group; what was written stays; **Create again** goes on from there. |

## The groups (`code/initialDataDefinition.json`: THE list, in install order)

Tier **A** (required: the first run waits for it): `admin` (the first application administrator) · `permissions` (11 profiles + the CRUD and UXUI matrix) · `genus` ·
`budgetItems` · `raci` · `calendars` (+ the days of last / this / next year, made by `initial_data_fill_calendars`) · `kanban` · `currencies` · `units` (VAT, units of measure,
distributions) · `rates` (the rate in force on 31 December of the previous year).
Tier **B** (optional, checked by default): `countries` · `businessUnits` (CFR types + all 29 units) · `languages` · `fileTypes` · `scenarios`.
`required` per table says what the application cannot work without (all rows / these keys / at least n rows); the rest of a table may be missing without the first-run screen.

## Exchange rates (separate: `code/rates`)

* **The algorithm** (`fillRatesOfDay`, run by the group `rates`): for every active currency of the catalog (the base excluded) that has no Default rate on or before 31 December of the
  previous year, the last day the rates service (Frankfurter) published on or before that day (up to 10 days back) is stored as the rate OF 31 December (`rowJSON.rateFromDay`).
* **`ExchangeRatesWindow`** (a separate Modal; offered after a run that made the rate of 31 December, and by the button "Exchange rates"): **Fill from 1 January to today**
  (`refreshCurrencyRatio` of the currency screen), **Download `currencies_reates_import_template.csv`**, **Import from CSV** (preview, then import).
* CSV: `currencyCode,startingDate,currencyRatio,rateType`; `,` or `;`; day `2026-01-02` or `02.01.2026`; ratio with `.` or `,`; `rateType` Default (empty) or Budget; a line with an empty ratio is skipped;
  rates that exist stay unless "Replace" is checked. The template has a line per currency with an empty ratio.
* If the service cannot be reached the run stops at `rates`: Create again, or **Continue without rates** (first run). Nothing is bundled: a rate points at the currency's rowGUID, which differs from database to database.

## The JSON files and the dump

* `json/NN_<table>.json` = `{ format: 'kit8.initialdata', version: 1, table, group, mode, keyColumn?, rows: [{ rowGUID, rowOwnerGUID, rowParentGUID, rowFolderGUID, orderInList, rowJSON }] }`, one row a line.
  A table of `mode: "json"` (currencies, countries, Kanban stages) has no rowGUID: it differs from database to database and a row is known by its natural key. A row comes after the row it names as parent.
  `manifest.json` has the rows and the sha-256 of every file (`__tests__/initial/initialDataJson.test.ts`). The files are bundled by `code/loadInitialJson.ts` (a fixed `require` map: a new table needs its line).
* `node kit8/initial/data/code/dumpInitialData.mjs` (the owner runs it; `--source supabase` default): reads the database of `.env` (`EXPO_PUBLIC_SUPABASE_URL` + a service key, never printed or written), writes the files, prints the report
  (rows `+added -removed ~changed` against the files that were there; a warning for an e-mail address in the data). It dumps ALL rows of the listed tables: delete the rows that are the user's own work before the files are used.
  `--source docker --db sqlseeds` reads the local test database made by `kit8/docker/make_seeds_db.sh` (start1 + start2 + start4) = the files in the repository now. `--dry`, `--only <table>`.

## SQL (PART 60, `start2_sql_code.sql`; no table)

`initial_data_tables()` (the whitelist, 20 tables) · `initial_data_status(p_check)` · `initial_data_install(table, rows)` · `initial_data_fill_calendars()` · `initial_data_bootstrap_admin()`;
all SECURITY DEFINER, granted to `authenticated` only. Who may write: an organization administrator (every signed-in user is one of his own organization) the catalogs the client may write anyway;
`language_catalog`, `managementRACIGenusTable`, `project_permission_profile_catalog` (the client may only read them) need an application administrator or the bootstrap case.
**The first application administrator**: only while nobody is one and `userTable` has at most one row (the first sign-up); the e-mail is the caller's own (`auth.jwt()`), never a value from the client.
A second user of a new database cannot claim it from the app: an administrator adds the e-mail in SQL (`application_permission_table`, see start4 PART 54).

## Tests

`./kit8/docker/test_initial_data.sh` (Docker; a fresh database WITHOUT start4): `initial_data_tests/112_initial_data.sql` (53 checks), the JSON installed through the functions, every one of the 20 tables +
the calendar days equal to the database of start4, a smoke on the database made without start4 (demo project, task, Time line, Post). Jest: `__tests__/initial` (model, JSON, rates, run, screen, gate, window),
`__tests__/sql/initialDataSql.test.ts`. A SQL test on an EMPTY database does not belong in `kit8/docker/tests/` (the other runners load start4 first).

## Not done

Nothing seen in a browser or on a phone. The real Supabase of the owner was not touched. The experiment "take one group away and see what breaks" was not run. Texts of the screen and the gate are English
(only the menu row is in 15 languages). A guest cannot be checked (no right to call the function): the check runs when a user signs in.
