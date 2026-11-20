// Reads the BIM model of a project out of the database for the package export (the pieces are INJECTED through BimCloud: tested without a network).
//   manifest (model, storeys, chunks) -> elements in pages of 5000 (bim_elements_page) -> properties in pages of 300 (optional) -> the chunk files (4 at a time, size checked)
import type { BimCloud } from '../../../../bim/cloud/bimCloud';
import { bimExportDataOf, type PMBimExportData } from './packageModel';

export const BIM_EXPORT_PARALLEL = 4;
export const BIM_EXPORT_ELEMENT_PAGE = 5000;
export const BIM_EXPORT_PROPERTY_PAGE = 300;

export type BimExportCloud = Pick<BimCloud, 'manifest' | 'elementsPage' | 'propertiesPage' | 'downloadChunk'>;

/** thrown when the user pressed Cancel export (checked between the pages / files, so the stop is quick) */
export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelledError';
  }
}

/** null = the project has no ready BIM model */
export async function readBimForExport(
  cloud: BimExportCloud,
  projectGUID: string,
  opts: { properties: boolean; onStep?: (text: string) => void; isCancelled?: () => boolean }
): Promise<PMBimExportData | null> {
  const step = opts.onStep ?? (() => {});
  const checkCancel = () => { if (opts.isCancelled?.()) throw new ExportCancelledError(); };
  const manifest = await cloud.manifest(projectGUID);
  if (!manifest) return null;
  const modelGUID = manifest.model.modelGUID;

  const elements: Parameters<typeof bimExportDataOf>[1] = [];
  step('Reading the BIM elements');
  for (let after: string | null = null; ; ) {
    checkCancel();
    const page = await cloud.elementsPage(modelGUID, after, BIM_EXPORT_ELEMENT_PAGE);
    elements.push(...(page.rows as any));
    if (!page.next) break;
    after = page.next;
  }

  const properties: { ifcGuid: string; rowJSON: Record<string, any> }[] = [];
  if (opts.properties) {
    step('Reading the BIM properties');
    for (let after: string | null = null; ; ) {
      checkCancel();
      const page = await cloud.propertiesPage(modelGUID, after, BIM_EXPORT_PROPERTY_PAGE);
      properties.push(...page.rows);
      if (!page.next) break;
      after = page.next;
    }
  }

  step('Reading the BIM geometry');
  const chunkBytes = new Map<string, Uint8Array>();
  const queue = [...manifest.chunks];
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      checkCancel();
      const bytes = new Uint8Array(await cloud.downloadChunk(c.storagePath));
      if (c.byteSize && bytes.byteLength !== c.byteSize) throw new Error(`The BIM chunk ${c.contentHash} has ${bytes.byteLength} bytes, the model says ${c.byteSize}.`);
      chunkBytes.set(c.contentHash, bytes);
    }
  };
  await Promise.all(Array.from({ length: Math.min(BIM_EXPORT_PARALLEL, queue.length) }, worker));
  return bimExportDataOf(manifest, elements, properties, opts.properties, chunkBytes);
}
