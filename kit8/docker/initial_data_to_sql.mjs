#!/usr/bin/env node
// Writes the SQL that installs the JSON files of the initial program data (kit8/initial/data/json) through initial_data_install, in the install order of
// kit8/initial/data/code/initialDataDefinition.json - what the application does at the first run, for test_initial_data.sh. Output on stdout.
//   --compare  writes instead the SQL that fingerprints the 20 tables (count + md5 of the rows, the natural key tables without their rowGUID) and the calendar days:
//              the same text is run in two databases and the answers are compared.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const code = resolve(here, '../initial/data/code');
const json = resolve(here, '../initial/data/json');
const definition = JSON.parse(readFileSync(join(code, 'initialDataDefinition.json'), 'utf8'));
const Q = "'";

if (process.argv.includes('--compare')) {
  const q = [];
  for (const g of definition.groups) {
    for (const t of g.tables) {
      const key = t.mode === 'json' ? `lower("rowJSON"->>${Q}${t.keyColumn}${Q})` : '"rowGUID"';
      const guid = t.mode === 'json' ? '' : '"rowGUID", ';
      q.push(`select ${Q}${t.table}${Q} as t, count(*) as n, md5(coalesce(string_agg(concat_ws(${Q}|${Q}, ${guid}"rowOwnerGUID", "rowParentGUID", "rowFolderGUID", "orderInList"::text, "rowJSON"::text), E${Q}\\n${Q} order by ${key}), ${Q}${Q})) as h from public."${t.table}"`);
    }
  }
  const cals = ['workingDaysCalendar', 'standardWorkWeekCalendar', 'sixDayWeekCalendar', 'sevenDayWeekCalendar', 'partTime4hCalendar'].map((c) => `${Q}${c}${Q}`).join(', ');
  q.push(`select ${Q}calendar days${Q}, count(*), md5(coalesce(string_agg(concat_ws(${Q}|${Q}, "rowGUID", "rowOwnerGUID", "rowParentGUID", "rowJSON"::text), E${Q}\\n${Q} order by "rowGUID"), ${Q}${Q})) from public."managementCalendarDaysTable" where "rowOwnerGUID" in (${cals})`);
  process.stdout.write(`${q.join('\nunion all\n')};\n`);
} else {
  const out = [];
  for (const g of definition.groups) {
    for (const t of g.tables) {
      const rows = JSON.parse(readFileSync(join(json, t.file), 'utf8')).rows;
      for (let i = 0; i < rows.length; i += 500) {
        out.push(`SELECT public.initial_data_install('${t.table}', $kit8json$${JSON.stringify(rows.slice(i, i + 500))}$kit8json$::jsonb);`);
      }
    }
    if (g.special === 'calendarDays') out.push('SELECT public.initial_data_fill_calendars();');
  }
  process.stdout.write(`${out.join('\n')}\n`);
}
