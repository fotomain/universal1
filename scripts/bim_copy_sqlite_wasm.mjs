// Copies the official SQLite WASM next to the BIM shared worker (public/bim). Run after npm install and before a web build / deploy: npm run bim:copy-wasm
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', '@sqlite.org', 'sqlite-wasm', 'dist');
const to = join(root, 'public', 'bim');
mkdirSync(to, { recursive: true });
for (const [src, dst] of [['index.mjs', 'sqlite3.mjs'], ['sqlite3.wasm', 'sqlite3.wasm']]) {
  if (!existsSync(join(from, src))) throw new Error(`missing ${join(from, src)}: run npm install first`);
  copyFileSync(join(from, src), join(to, dst));
  console.log(`public/bim/${dst} <- @sqlite.org/sqlite-wasm/dist/${src}`);
}
