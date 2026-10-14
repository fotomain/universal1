// The SQL files of kit8/sql/start for the tests. The STRUCTURE is two files: start1_sql_tables.sql (the tables) and start2_sql_code.sql (everything else, but the seeds);
// `structureSql` is both (tables first, as they run). A part of the structure = the part of the tables file + the part of the code file (`structurePart`).
import * as fs from 'fs';
import * as path from 'path';

export const sqlDir = path.join(__dirname, '../../kit8/sql/start');
export const readSql = (file: string): string => fs.readFileSync(path.join(sqlDir, file), 'utf8');

export const tablesSql = readSql('start1_sql_tables.sql');
export const codeSql = readSql('start2_sql_code.sql');
export const structureSql = tablesSql + '\n' + codeSql;

/** the text of "-- PART n: ..." up to the next PART (or the end marker) of ONE file; '' when the file has no such part */
export function sqlPart(src: string, n: number | string): string {
  const start = new RegExp(`^-- PART ${n}: `, 'm').exec(src);
  if (!start) return '';
  const rest = src.slice(start.index + 10);
  const next = /^-- PART \d+[a-z]?: |^-- END of start/m.exec(rest);
  return src.slice(start.index, start.index + 10 + (next ? next.index : rest.length));
}
/** a part of the structure: its tables (start1_sql_tables.sql) and its code (start2_sql_code.sql) */
export const structurePart = (n: number | string): string => sqlPart(tablesSql, n) + '\n' + sqlPart(codeSql, n);
/** the parts n..m (inclusive, numbers only) of the structure */
export function structureParts(from: number, to: number): string {
  let s = '';
  for (let i = from; i <= to; i += 1) s += structurePart(i) + '\n';
  return s;
}

/** the top-level statements of a file: split at ";" outside strings, dollar quotes and comments (leading comments cut off) */
export function sqlStatements(src: string): string[] {
  const out: string[] = [];
  let i = 0;
  let start = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === "'") { i++; while (i < n && !(src[i] === "'" && src[i + 1] !== "'")) i += src[i] === "'" ? 2 : 1; i++; }
    else if (c === '"') { const j = src.indexOf('"', i + 1); i = j < 0 ? n : j + 1; }
    else if (c === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(src.slice(i, i + 40));
      if (m) { const j = src.indexOf(m[0], i + m[0].length); i = j < 0 ? n : j + m[0].length; } else i++;
    } else if (c === '-' && src[i + 1] === '-') { const j = src.indexOf('\n', i); i = j < 0 ? n : j; }
    else if (c === ';') { i++; out.push(src.slice(start, i).replace(/^(\s|--[^\n]*\n)+/g, '')); start = i; }
    else i++;
  }
  return out.filter((s) => s.trim());
}
