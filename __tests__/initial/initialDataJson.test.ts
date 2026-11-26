// The JSON files of the initial program data (kit8/initial/data/json): the manifest says what is in them, nothing personal, the order is installable.
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { INITIAL_TABLES } from '../../kit8/initial/data/code/initialDataModel';
import { INITIAL_JSON_FILE_NAMES, loadInitialFile } from '../../kit8/initial/data/code/loadInitialJson';

const dir = path.join(__dirname, '../../kit8/initial/data/json');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

describe('the files', () => {
  it('the bundled list names exactly the files of the definition, and every one is on the disk', () => {
    expect([...INITIAL_JSON_FILE_NAMES].sort()).toEqual(INITIAL_TABLES.map((t) => t.file).sort());
    for (const f of INITIAL_JSON_FILE_NAMES) expect(fs.existsSync(path.join(dir, f))).toBe(true);
  });
  it('the manifest has the rows and the sha-256 of every file (a hand edit without a new dump is found here)', () => {
    expect(manifest.format).toBe('kit8.initialdata.manifest');
    expect(manifest.tables.map((t: any) => t.table)).toEqual(INITIAL_TABLES.map((t) => t.table));
    for (const m of manifest.tables) {
      const text = fs.readFileSync(path.join(dir, m.file), 'utf8');
      expect(createHash('sha256').update(text).digest('hex')).toBe(m.sha256);
      expect(JSON.parse(text).rows.length).toBe(m.rows);
    }
  });
  it('every file has the format, the table it says and rows of the same shape', () => {
    for (const t of INITIAL_TABLES) {
      const f = loadInitialFile(t.table);
      expect(f.mode).toBe(t.mode);
      expect(f.rows.length).toBeGreaterThan(0);
      for (const r of f.rows) {
        expect(typeof r.rowOwnerGUID).toBe('string');
        expect(typeof r.rowParentGUID).toBe('string');
        expect(typeof r.rowFolderGUID).toBe('string');
        expect(typeof r.orderInList).toBe('number');
        expect(typeof r.rowJSON).toBe('object');
        expect('created_at' in r || 'updated_at' in r).toBe(false);
        if (t.mode === 'json') expect('rowGUID' in r).toBe(false);
        else expect(typeof r.rowGUID).toBe('string');
      }
    }
  });
  it('a key is never twice in a file', () => {
    for (const t of INITIAL_TABLES) {
      const keys = loadInitialFile(t.table).rows.map((r) => (t.mode === 'json' ? String(r.rowJSON[t.keyColumn as string]).toLowerCase() : r.rowGUID));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('no e-mail address is in the data (nothing personal belongs in the initial data)', () => {
    for (const f of INITIAL_JSON_FILE_NAMES) expect(fs.readFileSync(path.join(dir, f), 'utf8')).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });
  it('a row comes after the row it names as its parent (the install checks it)', () => {
    for (const t of INITIAL_TABLES.filter((x) => x.mode === 'guid')) {
      const rows = loadInitialFile(t.table).rows;
      const all = new Set(rows.map((r) => r.rowGUID));
      const seen = new Set<string>();
      for (const r of rows) {
        if (all.has(r.rowParentGUID)) expect(seen.has(r.rowParentGUID)).toBe(true);
        seen.add(r.rowGUID as string);
      }
    }
  });
  it('the facts of the data the application depends on', () => {
    const genus = loadInitialFile('managementGenusTable').rows.map((r) => r.rowGUID);
    expect(genus).toEqual(expect.arrayContaining(['costsGenus', 'timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus', 'inboundPaymentGenus', 'outboundPaymentGenus']));
    expect(loadInitialFile('managementRACIGenusTable').rows.length).toBe(4);
    expect(loadInitialFile('kanban_stage_table').rows.map((r) => r.rowJSON.stageCode)).toEqual(['waiting', 'plan', 'analyse', 'construct', 'execute']);
    expect(loadInitialFile('project_permission_profile_catalog').rows.length).toBe(11);
    expect(loadInitialFile('language_catalog').rows.length).toBe(15);
  });
});
