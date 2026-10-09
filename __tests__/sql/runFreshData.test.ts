// kit8/sql: the single file for a fresh database (run_fresh_data.sql) is the generated concatenation of the separate files in the right order, and the
// generated exchange-rate data is what the app expects (D365 style rate types, one rate per currency + day + type).
import fs from 'fs';
import path from 'path';

const SQL = path.join(__dirname, '..', '..', 'kit8', 'sql');
const read = (...p: string[]) => fs.readFileSync(path.join(SQL, ...p), 'utf8');
const fresh = read('run_fresh_data.sql');
const build = read('tools', 'build_run_fresh_data.js');
const listOf = (name: string) => {
  const block = build.slice(build.indexOf(`const ${name} = [`));
  return [...block.slice(0, block.indexOf('\n];')).matchAll(/^\s*\['([^']+\.sql)',/gm)].map((m) => m[1]);
};
const FILES = listOf('FILES');
const DELETE_FILES = listOf('DELETE_FILES');

describe('run_fresh_data.sql', () => {
  it('lists the files in the order the builder says, each as one PART', () => {
    const parts = [...fresh.matchAll(/^-- PART: kit8\/sql\/init\/(.+)$/gm)].map((m) => m[1]);
    expect(parts).toEqual(FILES);
    expect(FILES.length).toBeGreaterThanOrEqual(12);
  });

  it('every part is the CURRENT content of its file (the generated file is up to date: run node kit8/sql/tools/build_run_fresh_data.js)', () => {
    for (const f of FILES) {
      const src = read('init', f).replace(/\r\n/g, '\n').replace(/\s+$/, '');
      expect(fresh.includes(src)).toBe(true);
    }
  });

  it('the order of the dependencies: base tables < rate types < rate data < roles < genus < persons < templates < task lines', () => {
    const at = (name: string) => FILES.indexOf(name);
    const order = [
      'done/create_tables.sql', 'update_currency_exchange_rate_types.sql', 'insert_currency_exchange_rates_2025_2026.sql', 'create_product_tables.sql',
      'create_resource_role_tables.sql', 'create_management_genus_table.sql', 'insert_rows_resource_table.sql', 'create_person_type_table.sql',
      'create_person_descriptors.sql', 'create_template_resource_contract_table.sql', 'create_pm_task_line_table.sql',
    ].map(at);
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('has no transaction control or psql commands that would break a single paste; the dollar quotes are balanced', () => {
    expect(/^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(fresh)).toBe(false);
    expect(/^\\\w+/m.test(fresh)).toBe(false);
    expect((fresh.match(/\$\$/g) || []).length % 2).toBe(0);
  });

  it('the delete / update / migration files are not among the parts that run', () => {
    expect(FILES.filter((f) => /delete_|^rename_|^update_prices|^update_product/.test(f))).toEqual([]);
  });

  it('the delete scripts are there as a RESET section that is COMMENTED OUT: reverse install order, every line a comment, current content of each file', () => {
    expect(DELETE_FILES.length).toBeGreaterThanOrEqual(8);
    expect(DELETE_FILES[DELETE_FILES.length - 1]).toBe('done/delete_tables.sql');
    const reset = fresh.slice(fresh.indexOf('-- RESET SECTION'), fresh.indexOf('-- PART: kit8/sql/init/'));
    expect(reset.length).toBeGreaterThan(1000);
    expect(reset.split('\n').every((l) => l === '' || l.startsWith('--'))).toBe(true);
    // every destructive statement of the delete scripts is inside a comment: no line of the file outside the RESET section deletes or drops a table
    const rest = fresh.replace(reset, '');
    expect(/^\s*DROP TABLE/im.test(rest)).toBe(false);
    for (const f of DELETE_FILES) {
      const src = read('init', f).replace(/\r\n/g, '\n').replace(/\s+$/, '');
      const commented = src.split('\n').map((l) => (l.trim() === '' ? '--' : '-- ' + l)).join('\n');
      expect(reset.includes(commented)).toBe(true);
    }
    const at = (n: string) => reset.indexOf(`kit8/sql/init/${n}`);
    expect(DELETE_FILES.map(at).every((i) => i >= 0)).toBe(true);
    expect([...DELETE_FILES.map(at)].sort((a, b) => a - b)).toEqual(DELETE_FILES.map(at));
    // the delete of a table comes before the create of the same table in the file
    expect(at('delete_product_tables.sql')).toBeLessThan(fresh.indexOf('-- PART: kit8/sql/init/create_product_tables.sql'));
  });
});

describe('exchange rates 2025 -> 2026 (generated from the ECB reference rates)', () => {
  const sql = read('init', 'insert_currency_exchange_rates_2025_2026.sql');
  const rows = [...sql.matchAll(/\('([A-Z]{3})', '(\d{4}-\d{2}-\d{2})', ([0-9.]+), '(Default|Budget)', '([a-z-]+)'\)/g)].map((m) => ({ code: m[1], day: m[2], ratio: Number(m[3]), kind: m[4], source: m[5] }));
  const of = (kind: string) => rows.filter((r) => r.kind === kind);

  it('9 currencies x every ECB working day from 2024-12-31 (the rate that applies on 2025-01-01) to the last day; the base EUR has no rows', () => {
    const codes = new Set(rows.map((r) => r.code));
    expect([...codes].sort()).toEqual(['CHF', 'CNY', 'DKK', 'GBP', 'JPY', 'NOK', 'PLN', 'SEK', 'USD']);
    const defaults = of('Default');
    const days = [...new Set(defaults.map((r) => r.day))].sort();
    expect(days[0]).toBe('2024-12-31');
    expect(days[days.length - 1] >= '2026-01-02').toBe(true);
    expect(days.length).toBeGreaterThan(400); // ~ 250 working days a year
    expect(defaults).toHaveLength(codes.size * days.length); // every currency has every day
    expect(defaults.every((r) => r.source === 'frankfurter-ecb')).toBe(true);
  });

  it('currencyRatio = units of the currency for 1 EUR: plausible values (USD ~1, JPY ~100+, never inverted)', () => {
    const usd = of('Default').filter((r) => r.code === 'USD').map((r) => r.ratio);
    expect(Math.min(...usd)).toBeGreaterThan(0.9);
    expect(Math.max(...usd)).toBeLessThan(1.5);
    const jpy = of('Default').filter((r) => r.code === 'JPY').map((r) => r.ratio);
    expect(Math.min(...jpy)).toBeGreaterThan(100);
    expect(of('Default').every((r) => r.ratio > 0)).toBe(true);
  });

  it('one rate per currency + day + type (the unique key rowOwnerGUID + rowParentGUID); the key is the day or day|Budget', () => {
    const keys = rows.map((r) => `${r.code}|${r.day}${r.kind === 'Budget' ? '|Budget' : ''}`);
    expect(new Set(keys).size).toBe(rows.length);
    expect(sql).toContain("CASE WHEN v.kind = 'Budget' THEN v.day || '|Budget' ELSE v.day END");
    expect(keys.every((k) => /^[A-Z]{3}\|\d{4}-\d{2}-\d{2}(\|Budget)?$/.test(k))).toBe(true);
  });

  it('Budget = ONE planned rate per currency per year, dated 1 January, equal to the Default rate of the first working day of that year', () => {
    const budget = of('Budget');
    expect(budget.every((r) => /-01-01$/.test(r.day))).toBe(true);
    expect([...new Set(budget.map((r) => r.day))].sort()).toEqual(['2025-01-01', '2026-01-01']);
    expect(budget).toHaveLength(18);
    const defaults = of('Default');
    for (const b of budget) {
      const firstDay = defaults.filter((r) => r.code === b.code && r.day >= b.day).map((r) => r.day).sort()[0];
      expect(defaults.find((r) => r.code === b.code && r.day === firstDay)!.ratio).toBe(b.ratio);
    }
    expect(budget.every((r) => r.source === 'budget-plan')).toBe(true);
  });

  it('the SQL finds the currency by its ISO code and does not fail on a second run; orderInList = -(days since 1970-01-01)', () => {
    expect(sql).toContain("JOIN public.\"currencyTable\" c ON upper(c.\"rowJSON\"->>'currencyCode') = v.code");
    expect(sql).toContain('ON CONFLICT DO NOTHING');
    expect(sql).toContain("-(((v.day)::date - DATE '1970-01-01')::int)");
  });

  it('the constraint of the rate types: the day with an optional |Type suffix that agrees with rowJSON.rateType', () => {
    const upd = read('init', 'update_currency_exchange_rate_types.sql');
    expect(upd).toContain('DROP CONSTRAINT IF EXISTS "currencyExchangeRateTable_day_chk"');
    const re = new RegExp(/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\(\\\|\[A-Za-z0-9_ -\]\{1,30\}\)\?\$/.source);
    expect(re.test(upd)).toBe(true);
    // the same rule in JS: key suffix <-> rateType (missing = Default)
    const ok = (key: string, rateType?: string) => /^\d{4}-\d{2}-\d{2}(\|[A-Za-z0-9_ -]{1,30})?$/.test(key) && (rateType || 'Default') === (key.slice(11) || 'Default');
    expect(ok('2026-01-01')).toBe(true);
    expect(ok('2026-01-01', 'Default')).toBe(true);
    expect(ok('2026-01-01|Budget', 'Budget')).toBe(true);
    expect(ok('2026-01-01|Budget')).toBe(false);
    expect(ok('2026-01-01', 'Budget')).toBe(false);
    expect(ok('2026-1-1')).toBe(false);
  });
});
