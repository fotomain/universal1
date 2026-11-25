// OPTIONAL TOOL (skipped unless NORM_ZIP is set): runs the real importer on a zip and writes the rows as NDJSON per table into NORM_OUT (a folder), to be loaded by SQL.
//   NORM_ZIP=/path/file.zip NORM_OUT=/tmp/out NORM_VERSION=... NORM_RATE=0.01217 npx jest --runTestsByPath __tests__/pm/estimation/normBookImportCli.test.ts
import fs from 'fs';
import path from 'path';
import { importNormBooks, type NormStore } from '../../../kit8/pm/estimation/import/importNormBooks';

const zip = process.env.NORM_ZIP;
const run = zip ? describe : describe.skip;

run('norm book import to NDJSON', () => {
  it('imports', async () => {
    const out = process.env.NORM_OUT!;
    fs.mkdirSync(out, { recursive: true });
    const streams: Record<string, number> = {};
    const store: NormStore = {
      async upsert(table, rows) {
        if (!rows.length) return;
        const f = path.join(out, `${table}.ndjson`);
        fs.appendFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
        streams[table] = (streams[table] ?? 0) + rows.length;
      },
    };
    const bytes = new Uint8Array(fs.readFileSync(zip!));
    const res = await importNormBooks(store, {
      files: [{ name: path.basename(zip!), bytes }], countryCode: process.env.NORM_COUNTRY ?? 'RU', bookCode: process.env.NORM_BOOK ?? 'FSNB-2022', bookTitle: process.env.NORM_TITLE ?? 'FSNB-2022',
      version: process.env.NORM_VERSION ?? 'edition', sourceCurrency: 'RUB', targetCurrency: process.env.NORM_CURRENCY ?? 'USD', fxRate: Number(process.env.NORM_RATE ?? '0.01217'), fxDate: process.env.NORM_DATE ?? '2026-11-25',
      language: 'ru', storeOriginals: false, batchSize: 2000,
    });
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ res, streams }));
    expect(res.norms).toBeGreaterThan(0);
  }, 3000000);
});
