// Shared data of the BIM tests: the REAL converted example 1 (kit8/pm/bim/examples/example1/out, made by py/bim/server/ifc_to_bim.py) - the golden file of the format.
import * as fs from 'fs';
import * as path from 'path';
import type { BimBundle } from '../../kit8/pm/bim/import/bimImportModel';

export const EXAMPLE1_OUT = path.join(__dirname, '..', '..', 'kit8', 'pm', 'bim', 'examples', 'example1', 'out');

export function readExampleBundle(): BimBundle {
  const bundle = JSON.parse(fs.readFileSync(path.join(EXAMPLE1_OUT, 'bundle.json'), 'utf8'));
  const pfile = fs.readdirSync(EXAMPLE1_OUT).find((f) => /^project_data_.+\.json$/.test(f))!;
  const project = JSON.parse(fs.readFileSync(path.join(EXAMPLE1_OUT, pfile), 'utf8'));
  return { ...bundle, project, chunks: bundle.chunks.map((c: any) => ({ ...c, storagePath: `p/m/${c.hash}.bimc` })) } as BimBundle;
}

export function readChunkBytes(hash: string): ArrayBuffer {
  const b = fs.readFileSync(path.join(EXAMPLE1_OUT, 'chunks', `${hash}.bimc`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}
