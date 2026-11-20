import { buildBimRows, BIM_ROW_BATCH, bundleSummary, checkBundle, BimImportError, modelInfoOfBundle, uploadedPathsOf } from '../../kit8/pm/bim/import/bimImportModel';
import { readExampleBundle } from './bimTestKit';

describe('BIM import model on the converted example 1', () => {
  const b = readExampleBundle();

  it('example 1: 4 storeys, 4 stages, 58 tasks, 58 elements, no links, no lines', () => {
    expect(() => checkBundle(b)).not.toThrow();
    const s = bundleSummary(b);
    expect(s).toMatchObject({ storeys: 4, stages: 4, tasks: 58, elements: 58, chunks: 4, granularity: 'one task per element' });
    expect(b.project.dependencies).toEqual([]);
    expect(b.project.taskLines ?? []).toEqual([]);
    expect(b.model.unitScale).toBe(0.3048);
    expect(b.project.project.rowGUID).toBe('aabd1dde-97e6-4359-97e4-0efcb847589b');
  });

  it('every element has exactly one task and every task has an element', () => {
    const leaf = new Set(b.project.tasks.filter((t) => t.rowJSON.rowKind === 'task').map((t) => t.rowGUID));
    const used = new Set(b.elements.map((e) => e.taskGUID));
    expect(used).toEqual(leaf);
    for (const t of b.project.tasks.filter((x) => x.rowJSON.rowKind === 'task')) expect((t.rowJSON as any).bimIfcGuid).toBeTruthy();
    for (const t of b.project.tasks.filter((x) => x.rowJSON.rowKind === 'stage')) expect((t.rowJSON as any).bimStoreyGuid).toBeTruthy();
  });

  it('the tasks are pinned to one working day each (no weekend)', () => {
    const days = b.project.tasks.filter((t) => t.rowJSON.rowKind === 'task').map((t) => String((t.rowJSON as any).manualStartAt).slice(0, 10));
    expect(new Set(days).size).toBe(days.length);
    for (const d of days) expect([0, 6]).not.toContain(new Date(`${d}T00:00:00Z`).getUTCDay());
  });

  it('buildBimRows maps the file ids to the ids the importer gave and fills the storage paths', () => {
    const idMap: Record<string, string> = {};
    for (const t of b.project.tasks) idMap[t.rowGUID] = `new-${t.rowGUID}`;
    const rows = buildBimRows(b, idMap, 'PROJECT/MODEL');
    expect(rows.counts).toEqual({ storeys: 4, chunks: 4, elements: 58, properties: 58 });
    expect(rows.elements[0][0].taskGUID).toBe(`new-${b.elements[0].taskGUID}`);
    expect(rows.storeys[0][0].stageGUID).toMatch(/^new-/);
    expect(rows.chunks[0][0].storagePath).toBe(`PROJECT/MODEL/${b.chunks[0].hash}.bimc`);
    expect(rows.chunks[0][0].contentHash).toBe(b.chunks[0].hash);
    expect(uploadedPathsOf(b, 'P/M')).toEqual(b.chunks.map((c) => `P/M/${c.hash}.bimc`));
  });

  it('big lists are cut in batches', () => {
    const many = { ...b, elements: Array.from({ length: BIM_ROW_BATCH.elements * 2 + 5 }, (_, i) => ({ ...b.elements[0], ifcGuid: `g${i}` })) };
    const rows = buildBimRows(many, {}, 'P/M');
    expect(rows.elements.map((x) => x.length)).toEqual([BIM_ROW_BATCH.elements, BIM_ROW_BATCH.elements, 5]);
  });

  it('the commit gets the facts of the converter', () => {
    expect(modelInfoOfBundle(b)).toMatchObject({ ifcSchema: 'IFC4', unitScale: 0.3048, converterVersion: 'bim-converter-1' });
  });

  it('checkBundle refuses a broken bundle', () => {
    expect(() => checkBundle({} as any)).toThrow(BimImportError);
    expect(() => checkBundle({ ...b, elements: [] })).toThrow(/no element/);
    expect(() => checkBundle({ ...b, elements: [{ ...b.elements[0], chunkHash: 'zzz' }] })).toThrow(/chunk that is not/);
    expect(() => checkBundle({ ...b, elements: [{ ...b.elements[0], taskGUID: 'nope' }] })).toThrow(/task that is not/);
    expect(() => checkBundle({ ...b, project: { ...b.project, dependencies: [{} as any] } })).toThrow(/no links/);
    expect(() => checkBundle({ ...b, project: { ...b.project, taskLines: [{} as any] } })).toThrow(/no task lines/);
  });
});

import { DEFAULT_BIM_IMPORT_OPTIONS } from '../../kit8/pm/bim/import/bimImportModel';
import { BIM_EXAMPLE1_PROJECT_GUID, BIM_EXAMPLE2_PROJECT_GUID, BIM_EXAMPLE3_PROJECT_GUID, BIM_EXAMPLE3_URL, BIM_EXAMPLE3_NAME } from '../../kit8/pm/bim/model/bimModel';

describe('the importer defaults and the examples', () => {
  it('openings are elements by default in the importer; the three examples have three different projects', () => {
    expect(DEFAULT_BIM_IMPORT_OPTIONS.includeOpenings).toBe(true);
    expect(new Set([BIM_EXAMPLE1_PROJECT_GUID, BIM_EXAMPLE2_PROJECT_GUID, BIM_EXAMPLE3_PROJECT_GUID]).size).toBe(3);
  });
  it('example 3 = Schependomlaan, from a host the converter allows (raw.githubusercontent.com), the address is percent encoded', () => {
    expect(BIM_EXAMPLE3_NAME).toContain('Schependomlaan');
    expect(BIM_EXAMPLE3_URL.startsWith('https://raw.githubusercontent.com/')).toBe(true);
    expect(BIM_EXAMPLE3_URL).not.toMatch(/ /);
    expect(decodeURIComponent(BIM_EXAMPLE3_URL).endsWith('IFC Schependomlaan.ifc')).toBe(true);
  });
});
