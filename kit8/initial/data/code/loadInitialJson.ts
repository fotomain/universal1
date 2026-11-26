// loadInitialJson - the JSON files of the initial program data (kit8/initial/data/json), bundled into the application.
// Metro needs the file names as plain strings in require(): the table below is that list. A Jest test checks that it has every file of initialDataDefinition.json
// and that every file is what the manifest says (count, sha-256). Files are read when asked, so the matrix (the biggest one) is not parsed at start.
import { INITIAL_TABLES, InitialFile } from './initialDataModel';

/* eslint-disable @typescript-eslint/no-require-imports */
const LOADERS: Record<string, () => any> = {
  '10_project_permission_profile_catalog.json': () => require('../json/10_project_permission_profile_catalog.json'),
  '11_project_permission_profile_crud_table.json': () => require('../json/11_project_permission_profile_crud_table.json'),
  '12_project_permission_profile_uxui_table.json': () => require('../json/12_project_permission_profile_uxui_table.json'),
  '20_managementGenusTable.json': () => require('../json/20_managementGenusTable.json'),
  '21_managementActivityGenusTable.json': () => require('../json/21_managementActivityGenusTable.json'),
  '22_budgetItemGenericKeyTable.json': () => require('../json/22_budgetItemGenericKeyTable.json'),
  '30_budgetItemTable.json': () => require('../json/30_budgetItemTable.json'),
  '40_managementRACIGenusTable.json': () => require('../json/40_managementRACIGenusTable.json'),
  '50_managementCalendarTable.json': () => require('../json/50_managementCalendarTable.json'),
  '60_kanban_stage_table.json': () => require('../json/60_kanban_stage_table.json'),
  '70_currencyTable.json': () => require('../json/70_currencyTable.json'),
  '80_valueAddedTaxTable.json': () => require('../json/80_valueAddedTaxTable.json'),
  '81_measureUnitTable.json': () => require('../json/81_measureUnitTable.json'),
  '82_distributionGenericTable.json': () => require('../json/82_distributionGenericTable.json'),
  '90_countryTable.json': () => require('../json/90_countryTable.json'),
  '91_cfrTypeTable.json': () => require('../json/91_cfrTypeTable.json'),
  '92_businessUnitTable.json': () => require('../json/92_businessUnitTable.json'),
  '93_language_catalog.json': () => require('../json/93_language_catalog.json'),
  '94_files_document_type_catalog.json': () => require('../json/94_files_document_type_catalog.json'),
  '95_budgetScenarioTable.json': () => require('../json/95_budgetScenarioTable.json'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export const INITIAL_JSON_FILE_NAMES = Object.keys(LOADERS);

/** one file of the application, validated (format, version, the table it says) */
export function loadInitialFile(table: string): InitialFile {
  const def = INITIAL_TABLES.find((t) => t.table === table);
  if (!def) throw new Error(`initial data: "${table}" is not in the list`);
  const loader = LOADERS[def.file];
  if (!loader) throw new Error(`initial data: the file ${def.file} is not bundled`);
  const file = loader() as InitialFile;
  if (file?.format !== 'kit8.initialdata' || file.version !== 1) throw new Error(`initial data: ${def.file} is not a kit8.initialdata v1 file`);
  if (file.table !== table) throw new Error(`initial data: ${def.file} holds "${file.table}", not "${table}"`);
  if (!Array.isArray(file.rows)) throw new Error(`initial data: ${def.file} has no rows`);
  return file;
}

/** every file, by table name */
export function loadAllInitialFiles(): Record<string, InitialFile> {
  const out: Record<string, InitialFile> = {};
  for (const t of INITIAL_TABLES) out[t.table] = loadInitialFile(t.table);
  return out;
}
