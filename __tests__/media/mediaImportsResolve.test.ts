/** @jest-environment node */
// Every relative import / require of the media code points at a file that EXISTS. (A lazy `require('../../x')` that is mocked or never run in a test
// can hide a wrong number of `../` until Metro fails to bundle: the Identification flow once did.)
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '../..');
const dirs = ['kit8/ui/components/media', 'app/media', 'supabase/functions/identification-recognize'];
const EXT = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.web.ts', '.web.tsx', '.native.ts', '.native.tsx', '/index.ts', '/index.tsx', '/index.js'];

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const SPEC = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|jest\.mock\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

describe('relative imports of the media code', () => {
  it('every one resolves to a file', () => {
    const missing: string[] = [];
    let checked = 0;
    for (const d of dirs) {
      for (const f of files(path.join(root, d))) {
        const src = fs.readFileSync(f, 'utf8');
        for (const m of src.matchAll(SPEC)) {
          checked += 1;
          const base = path.resolve(path.dirname(f), m[1]);
          if (!EXT.some((e) => fs.existsSync(base + e) && fs.statSync(base + e).isFile())) missing.push(`${path.relative(root, f)}: ${m[1]}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
    expect(missing).toEqual([]);
  });
});
