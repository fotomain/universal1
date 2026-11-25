// OPTIONAL: reads the real FSNB-2022 XML files (a supplement unzipped to a folder). Skipped unless FSNB_DIR is set:
//   FSNB_DIR=/path/with/unzipped/xml npx jest __tests__/pm/estimation/fsnbRealFile.test.ts
import fs from 'fs';
import path from 'path';
import { classifyNormFile, readNormFile } from '../../../kit8/pm/estimation/import/fsnbReader';

const dir = process.env.FSNB_DIR;
const run = dir ? describe : describe.skip;
const OPTS = { bookGUID: 'real', convert: (a: number) => a / 90, sourceCurrency: 'RUB', currency: 'EUR', language: 'ru' };

run('real FSNB files', () => {
  const files = dir ? fs.readdirSync(dir).filter((f) => f.endsWith('.xml')).sort() : [];
  it('reads every file: kinds and row counts', () => {
    const report: string[] = [];
    for (const f of files) {
      const bytes = new Uint8Array(fs.readFileSync(path.join(dir!, f)));
      const info = classifyNormFile(bytes);
      let norms = 0, sections = 0, resources = 0, groups = 0;
      const t0 = Date.now();
      if (info.kind !== 'skipped') for (const r of readNormFile(bytes, OPTS)) { const k = r.row.rowJSON.nodeKind; if (k === 'norm') norms++; else if (k === 'section') sections++; else if (k === 'resource') resources++; else groups++; }
      report.push(`${f} ${info.kind} norms=${norms} sections=${sections} resources=${resources} groups=${groups} ${Date.now() - t0} ms`);
    }
    // eslint-disable-next-line no-console
    console.log(report.join('\n'));
    expect(files.length).toBeGreaterThan(0);
  }, 600000);
});
