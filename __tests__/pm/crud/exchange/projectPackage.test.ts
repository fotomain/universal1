// The project PACKAGE (kit8/pm/crud/exchange/project/package): export of a project with its BIM model into one zip, the read back, and the import in the order of the BIM importer.
// The data is the REAL converted example 1 (bimTestKit); the database / storage are fakes that record what they are asked.
import { exportProjectToFile } from '../../../../kit8/pm/crud/exchange/project/export/exportProjectToFile';
import { importProjectFromFile, pickProjectDataFile } from '../../../../kit8/pm/crud/exchange/project/import/importProjectFromFile';
import { planProjectImport } from '../../../../kit8/pm/crud/exchange/project/import/planProjectImport';
import { buildPackageEntries, checkPackageBim, isZipBytes, packZip, PACKAGE_ENTRY, readPackage, projectPackageFileName } from '../../../../kit8/pm/crud/exchange/project/package/packageModel';
import { buildCsvEntries, csvCell, csvText, flattenJson } from '../../../../kit8/pm/crud/exchange/project/package/csvExport';
import { strFromU8, unzipSync } from 'fflate';
import { ExportCancelledError } from '../../../../kit8/pm/crud/exchange/project/package/bimExportRead';
import { bytesToBase64 } from '../../../../kit8/pm/crud/exchange/project/package/binaryFiles';
import { PMProjectExchangeError } from '../../../../kit8/pm/crud/exchange/project/projectExchangeFormat';
import { readChunkBytes, readExampleBundle } from '../../../bim/bimTestKit';

const bundle = readExampleBundle();
const SOURCE = 'aabd1dde-97e6-4359-97e4-0efcb847589b';
const projectRow: any = { rowGUID: SOURCE, rowOwnerGUID: 'u', rowJSON: { rowKind: 'project', name: 'Source BIM', projectIsBIMBased: true, skipWeekends: true }, orderInList: 1 };
const firstTask = bundle.project.tasks.find((t: any) => t.rowJSON.rowKind === 'task')!;
const lines = [0, 1, 2].map((i) => ({ rowGUID: `line-${i}`, rowOwnerGUID: firstTask.rowGUID, rowParentGUID: 'materialGenus', orderInList: i + 1, rowJSON: { qtyTaskLine: i + 1, priceTaskLine: 10, sumForBudget: (i + 1) * 10, taskIsPosted: true } }));

/** the model as the database answers it: ids of the database for storeys, the hash of every chunk, the paging of elements / properties forced to small pages */
function fakeExportCloud(over: { noModel?: boolean; badSize?: boolean } = {}) {
  const storeyId = (i: number) => `sg-${i}`;
  const manifest: any = {
    model: { modelGUID: 'model-1', revision: 3, sourceName: 'Structure Walls.ifc', sourceSha256: 'abc', ifcSchema: 'IFC4', converterVersion: '2', unitScale: 1, originShift: [1, 2, 3], bbox: [0, 0, 0, 1, 1, 1], counts: { elements: bundle.elements.length } },
    storeys: bundle.storeys.map((s, i) => ({ storeyGUID: storeyId(i), ifcGuid: s.ifcGuid, name: s.name, elevation: s.elevation, orderInList: s.orderInList, stageGUID: s.stageGUID })),
    chunks: bundle.chunks.map((c) => ({
      storeyGUID: c.storeyIfcGuid ? storeyId(bundle.storeys.findIndex((s) => s.ifcGuid === c.storeyIfcGuid)) : null, contentHash: c.hash, part: c.part, byteSize: over.badSize ? c.byteSize + 1 : c.byteSize,
      formatVersion: c.formatVersion, vertexCount: c.vertexCount, elementCount: c.elementCount, bboxMin: c.bboxMin, bboxSize: c.bboxSize, storagePath: `p/m/${c.hash}.bimc`,
    })),
  };
  const rows = bundle.elements.map((e, i) => ({ ifcGuid: e.ifcGuid, ifcClass: e.ifcClass, name: e.name, typeName: e.typeName, storeyGUID: e.storeyIfcGuid ? storeyId(bundle.storeys.findIndex((s) => s.ifcGuid === e.storeyIfcGuid)) : null, taskGUID: e.taskGUID, chunkHash: e.chunkHash, elementNumber: e.elementNumber, bbox: e.bbox, _i: i }));
  const calls = { elementPages: 0, propertyPages: 0, downloaded: [] as string[] };
  return {
    calls,
    cloud: {
      manifest: jest.fn(async () => (over.noModel ? null : manifest)),
      elementsPage: jest.fn(async (_m: string, after: string | null) => {
        calls.elementPages++;
        const from = after ? Number(after) : 0;
        const slice = rows.slice(from, from + 30).map(({ _i, ...r }) => r);
        return { rows: slice, next: from + 30 < rows.length ? String(from + 30) : null };
      }),
      propertiesPage: jest.fn(async (_m: string, after: string | null) => {
        calls.propertyPages++;
        const from = after ? Number(after) : 0;
        const props = bundle.properties.slice(from, from + 40);
        return { rows: props, next: from + 40 < bundle.properties.length ? String(from + 40) : null };
      }),
      downloadChunk: jest.fn(async (path: string) => {
        calls.downloaded.push(path);
        return readChunkBytes(path.split('/').pop()!.replace('.bimc', ''));
      }),
    },
  };
}

const fakeExportApi = () => ({
  readProject: jest.fn(async () => projectRow),
  readProjectData: jest.fn(async () => ({ tasks: bundle.project.tasks, deps: bundle.project.dependencies })),
  readProjectTaskLines: jest.fn(async () => lines),
});

describe('package export', () => {
  it('a BIM project with the BIM option gives ONE zip: the project file with its task lines + the model, and reads back the same', async () => {
    const f = fakeExportCloud();
    let saved: { name: string; bytes: Uint8Array } | null = null;
    const r = await exportProjectToFile(fakeExportApi() as any, SOURCE, {
      options: { taskLines: true, bim: true, bimProperties: true }, cloud: f.cloud as any, downloadBinary: async (name, bytes) => ((saved = { name, bytes }), 'downloaded'),
    });
    expect(r.kind).toBe('package');
    expect(r.fileName).toBe(projectPackageFileName(SOURCE));
    expect(saved!.name).toBe(`project_package_${SOURCE}.zip`);
    expect(isZipBytes(saved!.bytes)).toBe(true);
    expect(f.calls.elementPages).toBeGreaterThan(1);          // paged
    expect(f.calls.propertyPages).toBeGreaterThan(1);
    expect(f.calls.downloaded).toHaveLength(bundle.chunks.length);

    const pkg = readPackage(saved!.bytes);
    expect(pkg.manifest).toMatchObject({ projectGUID: SOURCE, tasks: bundle.project.tasks.length, taskLines: 3, bim: { elements: bundle.elements.length, chunks: bundle.chunks.length, propertiesIncluded: true } });
    expect(pkg.file.taskLines).toHaveLength(3);
    expect(pkg.file.tasks).toHaveLength(bundle.project.tasks.length);
    const b = pkg.bim!.bundle;
    expect(b.elements).toHaveLength(bundle.elements.length);
    // the ids of the database are turned back into what the importer needs: the ifcGuid of the storey, the task of the FILE
    expect(b.elements.map((e) => [e.ifcGuid, e.storeyIfcGuid, e.taskGUID, e.chunkHash])).toEqual(bundle.elements.map((e) => [e.ifcGuid, e.storeyIfcGuid, e.taskGUID, e.chunkHash]));
    expect(b.storeys.map((s) => [s.ifcGuid, s.stageGUID])).toEqual(bundle.storeys.map((s) => [s.ifcGuid, s.stageGUID]));
    expect(b.chunks.map((c) => [c.hash, c.byteSize, c.storeyIfcGuid])).toEqual(bundle.chunks.map((c) => [c.hash, c.byteSize, c.storeyIfcGuid]));
    expect(b.properties).toHaveLength(bundle.properties.length);
    for (const c of bundle.chunks) expect(Buffer.from(pkg.bim!.chunkBytes(c.hash)).equals(Buffer.from(readChunkBytes(c.hash)))).toBe(true);
    expect(checkPackageBim(b, (h) => pkg.bim!.chunkBytes(h).byteLength)).toBeNull();
  });

  it('without the properties option the zip has no properties entry', async () => {
    const f = fakeExportCloud();
    let bytes!: Uint8Array;
    await exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { taskLines: true, bim: true, bimProperties: false }, cloud: f.cloud as any, downloadBinary: async (_n, b) => ((bytes = b), 'downloaded') });
    expect(f.calls.propertyPages).toBe(0);
    const pkg = readPackage(bytes);
    expect(pkg.bim!.propertiesIncluded).toBe(false);
    expect(pkg.bim!.bundle.properties).toEqual([]);
    expect(pkg.manifest.bim).toMatchObject({ propertiesIncluded: false, properties: 0 });
  });

  it('without the BIM option: the plain project_data JSON, with the task lines when asked, and no BIM call', async () => {
    const f = fakeExportCloud();
    let text = '';
    const r = await exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { taskLines: true, bim: false }, cloud: f.cloud as any, download: async (_n, t) => ((text = t), 'downloaded') });
    expect(r.kind).toBe('json');
    expect(r.fileName).toBe(`project_data_${SOURCE}.json`);
    expect(JSON.parse(text).taskLines).toHaveLength(3);
    expect(f.cloud.manifest).not.toHaveBeenCalled();
    // no options at all = as before: tasks and links only, the lines are not even read
    const api = fakeExportApi();
    await exportProjectToFile(api as any, SOURCE, { download: async (_n, t) => ((text = t), 'downloaded') });
    expect(JSON.parse(text).taskLines).toBeUndefined();
    expect(api.readProjectTaskLines).not.toHaveBeenCalled();
  });

  it('the BIM option on a project that has no ready model gives the plain JSON and says so', async () => {
    const f = fakeExportCloud({ noModel: true });
    const r = await exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { taskLines: true, bim: true }, cloud: f.cloud as any, download: async () => 'downloaded' });
    expect(r.kind).toBe('json');
    expect(r.noBimModel).toBe(true);
  });

  it('a chunk file whose size is not the size of the model stops the export', async () => {
    const f = fakeExportCloud({ badSize: true });
    await expect(exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { bim: true }, cloud: f.cloud as any, downloadBinary: async () => 'downloaded' })).rejects.toThrow(/bytes, the model says/);
  });
});

describe('csv folder', () => {
  const csvRows = (text: string) => text.replace(/^﻿/, '').trim().split('\r\n');

  it('csvCell / csvText: quotes, commas, line breaks, BOM + CRLF, empty for no value; flattenJson makes dotted columns', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell([1, 2])).toBe('"[1,2]"');
    expect(csvText(['a', 'b'], [{ a: 1, b: 'x,y' }, { a: 2 }])).toBe('﻿a,b\r\n1,"x,y"\r\n2,\r\n');
    expect(flattenJson({ a: { b: 1, c: { d: 'x' } }, e: [1], f: null, g: {} })).toEqual({ 'a.b': 1, 'a.c.d': 'x', e: [1], f: null });
  });

  it('the zip has a csv/ folder with a file per table; the counts agree with the JSON / the model; the manifest lists them', async () => {
    const f = fakeExportCloud();
    let bytes!: Uint8Array;
    await exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { taskLines: true, bim: true, bimProperties: true }, cloud: f.cloud as any, downloadBinary: async (_n, b) => ((bytes = b), 'downloaded') });
    const files = unzipSync(bytes, { filter: (e) => e.name.startsWith('csv/') });
    expect(Object.keys(files).sort()).toEqual(['project', 'tasks', 'dependencies', 'task_lines', 'bim_storeys', 'bim_elements', 'bim_chunks', 'bim_properties'].map((n) => `csv/${n}.csv`).sort());
    const read = (n: string) => csvRows(strFromU8(files[`csv/${n}.csv`]));
    expect(Array.from(files['csv/tasks.csv'].slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]); // the byte order mark (UTF-8)
    expect(read('project')).toHaveLength(2);
    expect(read('tasks')).toHaveLength(bundle.project.tasks.length + 1);
    expect(read('dependencies')).toHaveLength(bundle.project.dependencies.length + 1);
    expect(read('task_lines')).toHaveLength(4);
    expect(read('bim_elements')).toHaveLength(bundle.elements.length + 1);
    expect(read('bim_storeys')).toHaveLength(bundle.storeys.length + 1);
    expect(read('bim_chunks')).toHaveLength(bundle.chunks.length + 1);
    expect(read('tasks')[0].split(',').slice(0, 4)).toEqual(['rowGUID', 'parentGUID', 'name', 'kind']);
    expect(read('task_lines')[0]).toContain('qtyTaskLine');
    expect(read('bim_properties')[0]).toBe('ifcGuid,property,value');
    expect(read('bim_properties').length).toBeGreaterThan(1);
    expect(readPackage(bytes).manifest.csvFiles).toHaveLength(8);
    // the importer does not care about the csv/ folder
    expect(readPackage(bytes).file.tasks).toHaveLength(bundle.project.tasks.length);
  });

  it('a plain project (no task lines, no BIM) has only project / tasks / dependencies csv', () => {
    const file: any = { project: projectRow, tasks: bundle.project.tasks, dependencies: bundle.project.dependencies };
    expect(Object.keys(buildCsvEntries(file, null)).sort()).toEqual(['csv/dependencies.csv', 'csv/project.csv', 'csv/tasks.csv']);
    expect(Object.keys(buildPackageEntries(file, null)).filter((n) => n.startsWith('csv/'))).toHaveLength(3);
  });
});

describe('cancel export', () => {
  it('Cancel stops the export between the pages: ExportCancelledError, no chunk is downloaded, no file is saved', async () => {
    const f = fakeExportCloud();
    const downloadBinary = jest.fn(async () => 'downloaded');
    let cancelled = false;
    f.cloud.elementsPage.mockImplementationOnce(async () => { cancelled = true; return { rows: [], next: '30' }; }); // the user presses Cancel while the first page is read
    await expect(
      exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { bim: true }, cloud: f.cloud as any, downloadBinary, isCancelled: () => cancelled })
    ).rejects.toBeInstanceOf(ExportCancelledError);
    expect(f.calls.downloaded).toHaveLength(0);
    expect(downloadBinary).not.toHaveBeenCalled();
  });

  it('cancelled before it starts: nothing is read from the BIM cloud', async () => {
    const f = fakeExportCloud();
    await expect(exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { bim: true }, cloud: f.cloud as any, isCancelled: () => true })).rejects.toBeInstanceOf(ExportCancelledError);
    expect(f.cloud.manifest).not.toHaveBeenCalled();
  });
});

describe('package format', () => {
  const exportData = async () => {
    const f = fakeExportCloud();
    let bytes!: Uint8Array;
    await exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { taskLines: true, bim: true }, cloud: f.cloud as any, downloadBinary: async (_n, b) => ((bytes = b), 'downloaded') });
    return bytes;
  };

  it('isZipBytes: PK header only', () => {
    expect(isZipBytes(new Uint8Array([0x50, 0x4b, 3, 4, 0]))).toBe(true);
    expect(isZipBytes(new Uint8Array([0x7b, 0x22]))).toBe(false);
    expect(isZipBytes(null)).toBe(false);
  });

  it('a zip that is no package, a damaged package and a newer version are refused with a readable message', async () => {
    expect(() => readPackage(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))).toThrow(PMProjectExchangeError);
    const strToU8 = (s: string) => new TextEncoder().encode(s);
    expect(() => readPackage(packZip({ 'hello.txt': strToU8('x') }))).toThrow(/not a project package/);
    const newer = packZip({ [PACKAGE_ENTRY.manifest]: strToU8(JSON.stringify({ format: 'kit8.pm.package', version: 99 })) });
    expect(() => readPackage(newer)).toThrow(/Unsupported package version 99/);
    const file = readPackage(await exportData()).file;
    const noChunks = buildPackageEntries(file, null);
    expect(readPackage(packZip(noChunks)).bim).toBeNull();      // a package without a model is the plain project
  });

  it('checkPackageBim finds what a damaged package would write wrong', async () => {
    const pkg = readPackage(await exportData());
    const b = pkg.bim!.bundle;
    const size = (h: string) => pkg.bim!.chunkBytes(h).byteLength;
    expect(checkPackageBim({ ...b, elements: [{ ...b.elements[0], chunkHash: 'nope' }] }, size)).toMatch(/chunk that is not in the package/);
    expect(checkPackageBim({ ...b, elements: [{ ...b.elements[0], taskGUID: 'ghost' }] }, size)).toMatch(/task that is not in the project file/);
    expect(checkPackageBim({ ...b, storeys: [{ ...b.storeys[0], stageGUID: 'ghost' }] }, size)).toMatch(/stage that is not in the project file/);
    expect(checkPackageBim(b, () => null)).toMatch(/missing in the package/);
    expect(checkPackageBim(b, () => 1)).toMatch(/package is damaged/);
  });

  it('pickProjectDataFile prefers the package, then project_data json', () => {
    const j = { name: 'project_data_x.json' };
    const z = { name: 'project_package_x.zip' };
    expect(pickProjectDataFile([j, z])).toBe(z);
    expect(pickProjectDataFile([{ name: 'a.txt', mimeType: 'application/zip' }, j])?.name).toBe('a.txt');
    expect(pickProjectDataFile([j])).toBe(j);
  });

  it('bytesToBase64 equals Buffer base64', () => {
    for (const n of [0, 1, 2, 3, 4, 100, 1001]) {
      const b = new Uint8Array(Array.from({ length: n }, (_, i) => (i * 37) & 255));
      expect(bytesToBase64(b)).toBe(Buffer.from(b).toString('base64'));
    }
  });
});

describe('package import', () => {
  const makeFile = async () => {
    const f = fakeExportCloud();
    let bytes!: Uint8Array;
    await exportProjectToFile(fakeExportApi() as any, SOURCE, { options: { taskLines: true, bim: true, bimProperties: true }, cloud: f.cloud as any, downloadBinary: async (_n, b) => ((bytes = b), 'downloaded') });
    return [{ name: projectPackageFileName(SOURCE), base64: Buffer.from(bytes).toString('base64') }];
  };
  const target = (json: Record<string, any> = {}): any => ({ rowGUID: 'target-1', rowOwnerGUID: 'me', rowJSON: { rowKind: 'project', name: 'Target', ...json }, orderInList: 1 });
  const fakes = (existingTasks: number, over: { uploadFails?: boolean } = {}) => {
    const log: string[] = [];
    const api: any = {
      readProjectData: jest.fn(async () => ({ tasks: Array.from({ length: existingTasks }, (_, i) => ({ rowGUID: `old-${i}` })), deps: [] })),
      deleteProjectTasks: jest.fn(async () => void log.push('deleteTasks')),
      importTasks: jest.fn(async () => void log.push('importTasks')),
      createDependencies: jest.fn(async () => void log.push('createDependencies')),
      createTaskLines: jest.fn(async () => void log.push('createTaskLines')),
      updateProject: jest.fn(async () => void log.push('updateProject')),
    };
    const rows: Record<string, any[]> = { storeys: [], chunks: [], elements: [], properties: [] };
    const uploaded: { path: string; bytes: Uint8Array }[] = [];
    const cloud: any = {
      begin: jest.fn(async () => (log.push('begin'), { modelGUID: 'new-model', revision: 1, storagePrefix: 'target-1/new-model' })),
      uploadChunk: jest.fn(async (path: string, bytes: Uint8Array) => {
        if (over.uploadFails) throw new Error('storage is down');
        uploaded.push({ path, bytes });
      }),
      addRows: jest.fn(async (_m: string, kind: string, r: any[]) => (log.push(`rows:${kind}`), rows[kind].push(...r), r.length)),
      commit: jest.fn(async (_m: string, counts: any) => (log.push('commit'), { modelGUID: 'new-model', revision: 1, counts })),
      fail: jest.fn(async () => void log.push('fail')),
    };
    return { api, cloud, log, rows, uploaded };
  };

  it('a plain project: tasks, links and lines first, then the model; the task ids of the file become the new ids', async () => {
    const x = fakes(0);
    const out = await importProjectFromFile(x.api, target(), 'me', await makeFile(), async () => true, {}, { cloud: x.cloud });
    expect(out.status).toBe('imported');
    expect(x.log).toEqual(['begin', 'importTasks', 'createTaskLines', 'updateProject', 'rows:storeys', 'rows:chunks', 'rows:elements', 'rows:properties', 'commit']);
    if (out.status !== 'imported') return;
    const newIds = new Set(Object.values(out.plan.idMap));
    expect(out.plan.taskLines).toHaveLength(3);                                   // the lines travel with the package, unposted
    expect(out.plan.taskLines.every((l) => newIds.has(l.rowOwnerGUID) && l.rowJSON.taskIsPosted === false)).toBe(true);
    expect(x.rows.elements).toHaveLength(bundle.elements.length);
    expect(x.rows.elements.every((e) => e.taskGUID === null || newIds.has(e.taskGUID))).toBe(true);
    const oldIds = new Set(bundle.project.tasks.map((t: any) => t.rowGUID));
    expect(x.rows.elements.some((e) => e.taskGUID && oldIds.has(e.taskGUID))).toBe(false);   // no id of the file survives
    expect(x.rows.storeys.every((s) => s.stageGUID === null || newIds.has(s.stageGUID))).toBe(true);
    expect(x.rows.chunks.every((c) => c.storagePath === `target-1/new-model/${c.contentHash}.bimc`)).toBe(true);
    expect(x.uploaded.map((u) => u.path).sort()).toEqual(bundle.chunks.map((c) => `target-1/new-model/${c.hash}.bimc`).sort());
    for (const u of x.uploaded) expect(Buffer.from(u.bytes).equals(Buffer.from(readChunkBytes(u.path.split('/').pop()!.replace('.bimc', ''))))).toBe(true);
    expect(x.cloud.commit).toHaveBeenCalledWith('new-model', { storeys: bundle.storeys.length, chunks: bundle.chunks.length, elements: bundle.elements.length, properties: bundle.properties.length }, expect.objectContaining({ ifcSchema: expect.anything() }));
    expect(out.bim).toEqual({ elements: bundle.elements.length, chunks: bundle.chunks.length, properties: bundle.properties.length });
  });

  it('a plain project WITH tasks: they are replaced BEFORE bim_import_begin (it refuses a non-BIM project with tasks); asks first', async () => {
    const x = fakes(5);
    const ask = jest.fn(async () => true);
    await importProjectFromFile(x.api, target(), 'me', await makeFile(), ask, {}, { cloud: x.cloud });
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ tasks: 5 }));
    expect(x.log.slice(0, 3)).toEqual(['deleteTasks', 'begin', 'importTasks']);
    const no = fakes(5);
    expect((await importProjectFromFile(no.api, target(), 'me', await makeFile(), async () => false, {}, { cloud: no.cloud })).status).toBe('cancelled');
    expect(no.log).toEqual([]);                                                    // nothing changed, no model begun
  });

  it('a BIM project keeps its tasks until the import has begun', async () => {
    const x = fakes(5);
    await importProjectFromFile(x.api, target({ projectIsBIMBased: true }), 'me', await makeFile(), async () => true, {}, { cloud: x.cloud });
    expect(x.log.slice(0, 3)).toEqual(['begin', 'deleteTasks', 'importTasks']);
  });

  it('a failure while the files go up: the model is failed with every path, the new tasks go again, the error reaches the caller', async () => {
    const x = fakes(0, { uploadFails: true });
    await expect(importProjectFromFile(x.api, target(), 'me', await makeFile(), async () => true, {}, { cloud: x.cloud })).rejects.toThrow('storage is down');
    expect(x.cloud.fail).toHaveBeenCalledWith('new-model', 'storage is down', bundle.chunks.map((c) => `target-1/new-model/${c.hash}.bimc`));
    expect(x.log).toContain('fail');
    expect(x.log[x.log.length - 1]).toBe('deleteTasks');                          // the half import is taken back
    expect(x.cloud.commit).not.toHaveBeenCalled();
  });

  it('a package with a model needs the cloud; a plain JSON file never touches it', async () => {
    const x = fakes(0);
    await expect(importProjectFromFile(x.api, target(), 'me', await makeFile(), async () => true, {}, {})).rejects.toThrow(/sign in/);
    expect(x.api.importTasks).not.toHaveBeenCalled();
    const json = { name: 'project_data_x.json', blob: new Blob([JSON.stringify({ format: 'kit8.pm.project', version: 1, project: projectRow, tasks: bundle.project.tasks, dependencies: [] })]) };
    const y = fakes(0);
    const out = await importProjectFromFile(y.api, target(), 'me', [json as any], async () => true, {}, { cloud: y.cloud });
    expect(out.status).toBe('imported');
    expect(y.cloud.begin).not.toHaveBeenCalled();
  });

  it('the BIM switch of a file is not taken by a plain import: only a restored model sets it', () => {
    const plan = planProjectImport({ format: 'kit8.pm.project', version: 1, exportedAt: '', project: projectRow, tasks: bundle.project.tasks, dependencies: [] } as any, target(), 'me', (() => { let n = 0; return () => `g${n++}`; })());
    expect(plan.projectRowJSON.projectIsBIMBased).toBeUndefined();
    const planB = planProjectImport({ format: 'kit8.pm.project', version: 1, exportedAt: '', project: { ...projectRow, rowJSON: { ...projectRow.rowJSON, projectIsBIMBased: false } }, tasks: [], dependencies: [] } as any, target({ projectIsBIMBased: true }), 'me', () => 'x');
    expect(planB.projectRowJSON.projectIsBIMBased).toBe(true);                    // the target's own value stays
  });
});
