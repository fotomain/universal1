// BIM example 2 = the buildingSMART Duplex Apartment (IFC2X3, Revit 2011, metres, 215 elements, 4 storeys): a second, independent golden bundle made by py/bim/server/ifc_to_bim.py.
import * as fs from 'fs';
import * as path from 'path';
import { BIM_EXAMPLE2_PROJECT_GUID, BIM_EXAMPLE2_URL } from '../../kit8/pm/bim/model/bimModel';
import { bimcElementOfTriangle, parseBimc } from '../../kit8/pm/bim/bimc/bimcReader';

const OUT = path.join(__dirname, '..', '..', 'kit8', 'pm', 'bim', 'examples', 'example2', 'out');
const bundle = JSON.parse(fs.readFileSync(path.join(OUT, 'bundle.json'), 'utf8'));
const pfile = fs.readdirSync(OUT).find((f) => /^project_data_.+\.json$/.test(f))!;
const project = JSON.parse(fs.readFileSync(path.join(OUT, pfile), 'utf8'));
const bytesOf = (hash: string) => {
  const b = fs.readFileSync(path.join(OUT, 'chunks', `${hash}.bimc`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe('BIM example 2 (Duplex Apartment)', () => {
  it('has the expected numbers', () => {
    expect(bundle.storeys.map((s: any) => s.name)).toEqual(['T/FDN', 'Level 1', 'Level 2', 'Roof']);
    expect(bundle.elements).toHaveLength(215);
    expect(bundle.chunks).toHaveLength(4);
    expect(project.tasks).toHaveLength(219); // 4 stages + 215 tasks
    const byClass: Record<string, number> = {};
    for (const e of bundle.elements) byClass[e.ifcClass] = (byClass[e.ifcClass] ?? 0) + 1;
    expect(byClass.IfcWallStandardCase).toBe(56);
    expect(byClass.IfcSlab).toBe(21);
    expect(byClass.IfcDoor).toBe(14);
    expect(byClass.IfcWindow).toBe(24);
    expect(byClass.IfcFurnishingElement).toBe(61);
  });

  it('every element points at a task and at its own guid inside the chunk', () => {
    const taskGuids = new Set(project.tasks.map((t: any) => t.rowGUID));
    for (const e of bundle.elements) {
      expect(taskGuids.has(e.taskGUID)).toBe(true);
      expect(parseBimc(bytesOf(e.chunkHash)).guids[e.elementNumber]).toBe(e.ifcGuid);
    }
  });

  it('the chunks read and the pick finds the element of a triangle', () => {
    let elements = 0;
    for (const c of bundle.chunks) {
      const chunk = parseBimc(bytesOf(c.hash));
      expect(chunk.vertexCount).toBe(c.vertexCount);
      elements += chunk.elementCount;
      expect(bimcElementOfTriangle(chunk, 0)).toBeGreaterThanOrEqual(0);
    }
    expect(elements).toBe(215);
  });

  it('the importer source: the project GUID of the bundle and an LFS-capable https address', () => {
    expect(BIM_EXAMPLE2_PROJECT_GUID).toBe(project.project.rowGUID);
    expect(BIM_EXAMPLE2_URL.startsWith('https://media.githubusercontent.com/media/')).toBe(true);
    expect(BIM_EXAMPLE2_URL.endsWith('Duplex_A_20110907.ifc')).toBe(true);
  });
});
