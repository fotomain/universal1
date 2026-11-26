#!/usr/bin/env node
// dumpInitialData.mjs - writes the JSON files of the initial program data (kit8/initial/data/json) from a database.
//   Sources:
//     --source supabase   (default) the Supabase of .env: EXPO_PUBLIC_SUPABASE_URL + a SERVICE key (SUPABASE_SERVICE_ROLE_KEY, or EXPO_PUBLIC_SUPABASE_ADMIN_KEY of .env).
//                         The key is read here only, never printed and never written to a file.
//     --source docker     the local test database (docker exec <container> psql -d <db>): --container universal1-pgtest --db sqlseeds
//                         (a database made with start1 + start2 + start4 = the repository seeds, see kit8/docker/make_seeds_db.sh)
//   Which tables: initialDataDefinition.json (ONE list for the dump, the app, the tests). Optional: --only <table>.
//   Every file: { format, version, table, group, mode, keyColumn, rows: [ { rowGUID, rowOwnerGUID, rowParentGUID, rowFolderGUID, orderInList, rowJSON } ] }
//     - a table of mode "json" (currencies, countries, kanban stages) has NO rowGUID: it differs from database to database, the row is known by its natural key
//     - no created_at / updated_at
//   Writes manifest.json (rows and sha-256 per file). Then prints the report: rows added / removed / changed against the files that were there, and a warning for
//   an e-mail address inside the data (nothing personal belongs in the initial data). Nothing is written with --dry.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const jsonDir = resolve(here, '../json');
const definition = JSON.parse(readFileSync(join(here, 'initialDataDefinition.json'), 'utf8'));

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };
const flag = (name) => args.includes(`--${name}`);
const source = opt('source', 'supabase');
const only = opt('only', '');
const dry = flag('dry');

const COLUMNS = ['rowGUID', 'rowOwnerGUID', 'rowParentGUID', 'rowFolderGUID', 'orderInList', 'rowJSON'];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** .env of the project (only the names this script needs are looked at) */
function readEnv() {
  const out = {};
  const file = join(root, '.env');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return { ...out, ...process.env };
}

async function rowsFromDocker(table) {
  const container = opt('container', 'universal1-pgtest');
  const db = opt('db', 'sqlseeds');
  const sql = `select coalesce(json_agg(t), '[]'::json) from (select ${COLUMNS.map((c) => `"${c}"`).join(', ')} from public."${table}" order by "orderInList", "rowGUID") t`;
  const out = execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', db, '-At', '-c', sql], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return JSON.parse(out.trim() || '[]');
}

let client = null;
async function rowsFromSupabase(table) {
  if (!client) {
    const env = readEnv();
    const url = env.EXPO_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.EXPO_PUBLIC_SUPABASE_ADMIN_KEY;
    if (!url || !key) throw new Error('.env needs EXPO_PUBLIC_SUPABASE_URL and a service key (SUPABASE_SERVICE_ROLE_KEY or EXPO_PUBLIC_SUPABASE_ADMIN_KEY)');
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  const rows = [];
  for (let at = 0; ; at += 1000) {
    const { data, error } = await client.from(table).select(COLUMNS.join(',')).order('orderInList').order('rowGUID').range(at, at + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const readRows = source === 'docker' ? rowsFromDocker : rowsFromSupabase;
const keyOf = (t, r) => (t.mode === 'json' ? String(r.rowJSON?.[t.keyColumn] ?? '').toLowerCase() : r.rowGUID);

/** the file text: one row a line, so a git diff shows what changed */
function fileText(group, t, rows) {
  const head = { format: 'kit8.initialdata', version: 1, table: t.table, group: group.id, mode: t.mode, ...(t.keyColumn ? { keyColumn: t.keyColumn } : {}) };
  const open = JSON.stringify(head).slice(0, -1);
  return `${open},"rows":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
}

/** a row after the row it names as its parent (the install checks it: business units); the order of the rest is kept */
function parentsFirst(rows) {
  const guids = new Set(rows.map((r) => r.rowGUID));
  const out = [];
  const done = new Set();
  let left = rows;
  while (left.length) {
    const next = [];
    for (const r of left) {
      if (r.rowParentGUID && guids.has(r.rowParentGUID) && r.rowParentGUID !== r.rowGUID && !done.has(r.rowParentGUID)) next.push(r);
      else { out.push(r); done.add(r.rowGUID); }
    }
    if (next.length === left.length) { out.push(...next); break; } // a cycle: keep the order
    left = next;
  }
  return out;
}

const sha = (text) => createHash('sha256').update(text).digest('hex');

async function main() {
  if (!dry && !existsSync(jsonDir)) mkdirSync(jsonDir, { recursive: true });
  const manifest = { format: 'kit8.initialdata.manifest', version: 1, generatedAt: new Date().toISOString(), source, tables: [] };
  let warnings = 0;
  for (const group of definition.groups) {
    for (const t of group.tables) {
      if (only && only !== t.table) continue;
      const raw = await readRows(t.table);
      const rows = parentsFirst(raw).map((r) => {
        const row = { rowOwnerGUID: r.rowOwnerGUID, rowParentGUID: r.rowParentGUID, rowFolderGUID: r.rowFolderGUID, orderInList: Number(r.orderInList), rowJSON: r.rowJSON };
        return t.mode === 'json' ? row : { rowGUID: r.rowGUID, ...row };
      });
      const text = fileText(group, t, rows);
      if (EMAIL.test(text)) { warnings += 1; console.warn(`!! ${t.table}: an e-mail address is in the data - remove the row before the file is used`); }
      // the report against the file that is there now
      const path = join(jsonDir, t.file);
      let added = rows.length, removed = 0, changed = 0;
      if (existsSync(path)) {
        const old = JSON.parse(readFileSync(path, 'utf8')).rows || [];
        const oldMap = new Map(old.map((r) => [keyOf(t, r), JSON.stringify(r)]));
        const newMap = new Map(rows.map((r) => [keyOf(t, r), JSON.stringify(r)]));
        added = [...newMap.keys()].filter((k) => !oldMap.has(k)).length;
        removed = [...oldMap.keys()].filter((k) => !newMap.has(k)).length;
        changed = [...newMap.keys()].filter((k) => oldMap.has(k) && oldMap.get(k) !== newMap.get(k)).length;
      }
      console.log(`${t.table.padEnd(40)} ${String(rows.length).padStart(5)} rows   +${added} -${removed} ~${changed}  ${t.file}`);
      if (!dry) writeFileSync(path, text);
      manifest.tables.push({ table: t.table, file: t.file, group: group.id, rows: rows.length, sha256: sha(text) });
    }
  }
  if (!only && !dry) {
    writeFileSync(join(jsonDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`manifest.json written (source: ${source}, ${manifest.tables.length} tables)`);
  }
  if (only && !dry) console.log('manifest.json not changed (--only): run without --only to refresh it');
  if (warnings) process.exitCode = 2;
}

main().catch((e) => { console.error(`dumpInitialData: ${e.message}`); process.exit(1); });
