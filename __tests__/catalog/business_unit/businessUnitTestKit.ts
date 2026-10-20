// The business unit rows of the tests: parsed from the SEED of PART 18 in kit8/sql/start/start4_sql_insert_missing.sql, so the tests run on exactly the 29 units of the
// document "W1 businessUnit" that SQL creates (and a change of the seed is a change of the tests).
import fs from 'fs';
import path from 'path';

const sql = fs.readFileSync(path.join(__dirname, '../../../kit8/sql/start/start4_sql_insert_missing.sql'), 'utf8');
const part = sql.slice(sql.indexOf('-- PART 18: create_business_unit_tables.sql'));

export const cfrRows = (): any[] => [
  ['costCenter', 10, true, false, 'Cost center'], ['revenueCenter', 20, false, true, 'Revenue center'], ['profitCenter', 30, true, true, 'Profit center'], ['investmentCenter', 40, true, true, 'Investment center'],
].map(([rowGUID, orderInList, acceptsCosts, acceptsRevenues, title]) => ({ rowGUID, rowOwnerGUID: 'cfrTypeCatalog', rowParentGUID: 'empty', orderInList, rowJSON: { title, acceptsCosts, acceptsRevenues } }));

export function unitRows(): any[] {
  const rows: any[] = [];
  const re = /^\s*\('(bu_[a-z0-9]+)',\s*'([a-z0-9_]+)',\s*(\d+),\s*'(\{.*\})'\)[,]?\s*$/gm;
  let m: RegExpExecArray | null;
  const block = part.slice(part.indexOf('INSERT INTO public."businessUnitTable"'), part.indexOf('ON CONFLICT', part.indexOf('INSERT INTO public."businessUnitTable"')));
  while ((m = re.exec(block))) rows.push({ rowGUID: m[1], rowOwnerGUID: 'businessUnitCatalog', rowParentGUID: m[2], orderInList: Number(m[3]), rowJSON: JSON.parse(m[4]) });
  return rows;
}
